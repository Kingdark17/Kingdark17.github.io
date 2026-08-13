/**
 * Primeiro teste que roda as queries de verdade: Postgres real (PGlite),
 * criado com o DDL do servidor original — ver `testing/original-ddl.ts`
 * pra o porquê de não gerar o schema a partir de `db/schema.ts`.
 *
 * Cobre os repositórios de conta, sessão e e-mail: mapeamento de coluna,
 * índices únicos case-insensitive, expiração por tempo do banco e a
 * transação que derruba sessões no reset de senha.
 */

import { DrizzleAccountEmailRepository } from '../auth/drizzle-account-email-repository';
import { DrizzleSessionsRepository } from '../auth/drizzle-sessions-repository';
import { DrizzleUsersRepository } from '../auth/drizzle-users-repository';
import { UniqueViolationError } from '../auth/users-repository';
import { startPglite, type PgliteHarness } from './testing/pglite-harness';

jest.setTimeout(60_000);

let harness: PgliteHarness;
let users: DrizzleUsersRepository;
let sessions: DrizzleSessionsRepository;
let emails: DrizzleAccountEmailRepository;

const HORA = 60 * 60 * 1000;

async function criarConta(username = 'Aria', email = 'aria@exemplo.com') {
  return users.create({ username, email, passwordHash: 'hash', passwordSalt: 'salt' });
}

beforeAll(async () => {
  harness = await startPglite();
  users = new DrizzleUsersRepository();
  sessions = new DrizzleSessionsRepository();
  emails = new DrizzleAccountEmailRepository();
});

beforeEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.stop();
});

describe('DrizzleUsersRepository', () => {
  it('cria conta e devolve todos os campos que safeUser usa', async () => {
    const conta = await criarConta();

    expect(conta.id).toBeGreaterThan(0);
    expect(conta.username).toBe('Aria');
    expect(conta.email).toBe('aria@exemplo.com');
    expect(conta.emailVerified).toBe(false);
    expect(conta.avatarUrl).toBe('');
    expect(conta.profileFrame).toBe('none');
    expect(conta.nameColor).toBe('#e8d7a5');
    expect(conta.pet).toBe('none');
    expect(conta.cosmetics).toEqual({ frames: ['none'], colors: ['#e8d7a5', '#ffffff'], pets: ['none'] });
    expect(conta.createdAt).toBeInstanceOf(Date);
    expect(conta.passwordHash).toBe('hash');
  });

  it('acha por username ou e-mail, sem diferenciar maiúscula', async () => {
    await criarConta();

    expect((await users.findByUsernameOrEmail('aria'))?.username).toBe('Aria');
    expect((await users.findByUsernameOrEmail('ARIA'))?.username).toBe('Aria');
    expect((await users.findByUsernameOrEmail('ARIA@EXEMPLO.COM'))?.username).toBe('Aria');
    expect(await users.findByUsernameOrEmail('ninguem')).toBeNull();
  });

  it('username repetido em outra caixa esbarra no índice único', async () => {
    await criarConta();
    await expect(criarConta('aria', 'outro@exemplo.com')).rejects.toBeInstanceOf(UniqueViolationError);
  });

  it('e-mail repetido em outra caixa esbarra no índice único parcial', async () => {
    await criarConta();
    await expect(criarConta('Bree', 'ARIA@exemplo.com')).rejects.toBeInstanceOf(UniqueViolationError);
  });
});

describe('DrizzleSessionsRepository', () => {
  it('acha o usuário pela sessão válida e devolve null pra sessão vencida', async () => {
    const conta = await criarConta();
    const agora = new Date();

    await sessions.create({ tokenHash: 'a'.repeat(64), userId: conta.id, expiresAt: new Date(agora.getTime() + HORA) });
    await sessions.create({ tokenHash: 'b'.repeat(64), userId: conta.id, expiresAt: new Date(agora.getTime() - HORA) });

    expect((await sessions.findUserByTokenHash('a'.repeat(64), agora))?.id).toBe(conta.id);
    expect(await sessions.findUserByTokenHash('b'.repeat(64), agora)).toBeNull();
    expect(await sessions.findUserByTokenHash('c'.repeat(64), agora)).toBeNull();
  });

  it('logout apaga só a sessão daquele token', async () => {
    const conta = await criarConta();
    const agora = new Date();
    const daqui = new Date(agora.getTime() + HORA);

    await sessions.create({ tokenHash: 'a'.repeat(64), userId: conta.id, expiresAt: daqui });
    await sessions.create({ tokenHash: 'b'.repeat(64), userId: conta.id, expiresAt: daqui });

    await sessions.deleteByTokenHash('a'.repeat(64));

    expect(await sessions.findUserByTokenHash('a'.repeat(64), agora)).toBeNull();
    expect(await sessions.findUserByTokenHash('b'.repeat(64), agora)).not.toBeNull();
  });

  it('apagar a conta leva as sessões junto (ON DELETE CASCADE)', async () => {
    const conta = await criarConta();
    const agora = new Date();
    await sessions.create({ tokenHash: 'a'.repeat(64), userId: conta.id, expiresAt: new Date(agora.getTime() + HORA) });

    await harness.reset();

    expect(await sessions.findUserByTokenHash('a'.repeat(64), agora)).toBeNull();
  });
});

describe('DrizzleAccountEmailRepository', () => {
  it('acha por id e por e-mail sem diferenciar maiúscula', async () => {
    const conta = await criarConta();

    expect((await emails.findById(conta.id))?.username).toBe('Aria');
    expect(await emails.findById(9999)).toBeNull();
    expect((await emails.findByEmail('ARIA@exemplo.com'))?.id).toBe(conta.id);
    expect(await emails.findByEmail('ninguem@exemplo.com')).toBeNull();
  });

  it('confirma e-mail com token válido e recusa o mesmo token de novo', async () => {
    const conta = await criarConta();
    const agora = new Date();
    await emails.setEmailToken(conta.id, 'verify', 'v'.repeat(64), new Date(agora.getTime() + HORA));

    expect(await emails.consumeEmailVerification('v'.repeat(64), agora)).toBe(true);
    expect((await emails.findById(conta.id))?.emailVerified).toBe(true);
    expect(await emails.consumeEmailVerification('v'.repeat(64), agora)).toBe(false);
  });

  it('token de confirmação vencido não vale', async () => {
    const conta = await criarConta();
    const agora = new Date();
    await emails.setEmailToken(conta.id, 'verify', 'v'.repeat(64), new Date(agora.getTime() - 1));

    expect(await emails.consumeEmailVerification('v'.repeat(64), agora)).toBe(false);
    expect((await emails.findById(conta.id))?.emailVerified).toBe(false);
  });

  it('reset de senha troca a senha e derruba todas as sessões, numa transação', async () => {
    const conta = await criarConta();
    const agora = new Date();
    await sessions.create({ tokenHash: 'a'.repeat(64), userId: conta.id, expiresAt: new Date(agora.getTime() + HORA) });
    await emails.setEmailToken(conta.id, 'reset', 'r'.repeat(64), new Date(agora.getTime() + HORA));

    expect(await emails.consumePasswordReset('r'.repeat(64), agora, 'hash-novo', 'salt-novo')).toBe(true);

    const depois = await emails.findById(conta.id);
    expect(depois?.passwordHash).toBe('hash-novo');
    expect(depois?.passwordSalt).toBe('salt-novo');
    expect(await sessions.findUserByTokenHash('a'.repeat(64), agora)).toBeNull();
  });

  it('reset com token inválido não mexe em senha nem em sessão', async () => {
    const conta = await criarConta();
    const agora = new Date();
    await sessions.create({ tokenHash: 'a'.repeat(64), userId: conta.id, expiresAt: new Date(agora.getTime() + HORA) });

    expect(await emails.consumePasswordReset('x'.repeat(64), agora, 'hash-novo', 'salt-novo')).toBe(false);
    expect((await emails.findById(conta.id))?.passwordHash).toBe('hash');
    expect(await sessions.findUserByTokenHash('a'.repeat(64), agora)).not.toBeNull();
  });

  it('token de verificação não serve de token de reset', async () => {
    const conta = await criarConta();
    const agora = new Date();
    await emails.setEmailToken(conta.id, 'verify', 't'.repeat(64), new Date(agora.getTime() + HORA));

    expect(await emails.consumePasswordReset('t'.repeat(64), agora, 'h', 's')).toBe(false);
  });

  it('trocar o e-mail volta emailVerified pra falso', async () => {
    const conta = await criarConta();
    const agora = new Date();
    await emails.setEmailToken(conta.id, 'verify', 'v'.repeat(64), new Date(agora.getTime() + HORA));
    await emails.consumeEmailVerification('v'.repeat(64), agora);

    const atualizada = await emails.updateEmail(conta.id, 'novo@exemplo.com');

    expect(atualizada.email).toBe('novo@exemplo.com');
    expect(atualizada.emailVerified).toBe(false);
  });

  it('trocar pro e-mail de outra conta esbarra no índice único', async () => {
    const aria = await criarConta();
    await criarConta('Bree', 'bree@exemplo.com');

    await expect(emails.updateEmail(aria.id, 'BREE@exemplo.com')).rejects.toBeInstanceOf(UniqueViolationError);
  });
});
