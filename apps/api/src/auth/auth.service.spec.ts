import { AuthService } from './auth.service';
import { defaultCosmetics } from './cosmetics';
import { UniqueViolationError, type AccountRecord, type CreateUserInput, type UsersRepository } from './users-repository';
import type { CreateSessionInput, SessionsRepository } from './sessions-repository';

class FakeUsersRepository implements UsersRepository {
  private byId = new Map<number, AccountRecord>();
  private nextId = 1;

  findByUsernameOrEmail(identifier: string): Promise<AccountRecord | null> {
    const needle = identifier.toLowerCase();
    for (const user of this.byId.values()) {
      if (user.username.toLowerCase() === needle || user.email?.toLowerCase() === needle) return Promise.resolve(user);
    }
    return Promise.resolve(null);
  }

  create(input: CreateUserInput): Promise<AccountRecord> {
    for (const user of this.byId.values()) {
      if (user.username.toLowerCase() === input.username.toLowerCase() || user.email?.toLowerCase() === input.email.toLowerCase()) {
        throw new UniqueViolationError();
      }
    }
    const record: AccountRecord = {
      id: this.nextId++,
      username: input.username,
      email: input.email,
      emailVerified: false,
      avatarUrl: '',
      profileFrame: 'none',
      nameColor: '#e8d7a5',
      pet: 'none',
      cosmetics: defaultCosmetics(),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      passwordHash: input.passwordHash,
      passwordSalt: input.passwordSalt,
    };
    this.byId.set(record.id, record);
    return Promise.resolve(record);
  }

  findById(id: number): AccountRecord | undefined {
    return this.byId.get(id);
  }
}

class FakeSessionsRepository implements SessionsRepository {
  private sessions = new Map<string, { userId: number; expiresAt: Date }>();

  constructor(private readonly users: FakeUsersRepository) {}

  create(input: CreateSessionInput): Promise<void> {
    this.sessions.set(input.tokenHash, { userId: input.userId, expiresAt: input.expiresAt });
    return Promise.resolve();
  }

  deleteByTokenHash(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
    return Promise.resolve();
  }

  findUserByTokenHash(tokenHash: string, now: Date): Promise<AccountRecord | null> {
    const session = this.sessions.get(tokenHash);
    if (!session || session.expiresAt <= now) return Promise.resolve(null);
    return Promise.resolve(this.users.findById(session.userId) ?? null);
  }
}

const ADMIN_USERNAME = 'adm';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

class FakeVerificationIssuer {
  readonly issuedFor: { id: number; email: string | null }[] = [];

  issueVerification(user: { id: number; email: string | null }): Promise<void> {
    this.issuedFor.push({ id: user.id, email: user.email });
    return Promise.resolve();
  }
}

function makeService(startTime = 1700000000000) {
  let currentTime = startTime;
  const users = new FakeUsersRepository();
  const sessions = new FakeSessionsRepository(users);
  const verification = new FakeVerificationIssuer();
  const service = new AuthService(users, sessions, { adminUsername: ADMIN_USERNAME, sessionTtlMs: SESSION_TTL_MS }, () => currentTime, verification);
  return { service, users, sessions, verification, advanceTime: (ms: number) => (currentTime += ms) };
}

describe('AuthService.register', () => {
  it('rejeita username inválido (curto, ou com caracteres fora de A-Za-z0-9_)', async () => {
    const { service } = makeService();
    expect(await service.register({ username: 'ab', email: 'a@b.com', password: 'senha123' })).toEqual({ kind: 'invalid-username' });
    expect(await service.register({ username: 'nome com espaço', email: 'a@b.com', password: 'senha123' })).toEqual({ kind: 'invalid-username' });
  });

  it('rejeita e-mail inválido', async () => {
    const { service } = makeService();
    expect(await service.register({ username: 'jogador', email: 'nao-e-email', password: 'senha123' })).toEqual({ kind: 'invalid-email' });
  });

  it('dispara o e-mail de confirmação pra conta recém-criada, como o original', async () => {
    const { service, verification } = makeService();
    const result = await service.register({ username: 'Jogador1', email: 'jogador1@example.com', password: 'senha123' });

    expect(result.kind).toBe('registered');
    expect(verification.issuedFor).toEqual([{ id: expect.any(Number) as unknown, email: 'jogador1@example.com' }]);
  });

  it('não dispara confirmação quando o cadastro é recusado', async () => {
    const { service, verification } = makeService();
    await service.register({ username: 'ab', email: 'a@b.com', password: 'senha123' });

    expect(verification.issuedFor).toEqual([]);
  });

  it('rejeita senha fora de [8, 128] caracteres', async () => {
    const { service } = makeService();
    expect(await service.register({ username: 'jogador', email: 'a@b.com', password: '1234567' })).toEqual({ kind: 'invalid-password' });
    expect(await service.register({ username: 'jogador', email: 'a@b.com', password: 'x'.repeat(129) })).toEqual({ kind: 'invalid-password' });
  });

  it('registra com sucesso e devolve token + usuário público', async () => {
    const { service } = makeService();
    const result = await service.register({ username: 'Jogador1', email: 'jogador1@example.com', password: 'senha123' });
    expect(result.kind).toBe('registered');
    if (result.kind !== 'registered') return;
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    expect(result.user).toMatchObject({ username: 'Jogador1', email: 'jogador1@example.com', isAdmin: false });
  });

  it('marca isAdmin quando o username registrado é o admin configurado', async () => {
    const { service } = makeService();
    const result = await service.register({ username: 'ADM', email: 'adm@example.com', password: 'senha123' });
    expect(result.kind).toBe('registered');
    if (result.kind !== 'registered') return;
    expect(result.user.isAdmin).toBe(true);
  });

  it('rejeita username duplicado (case-insensitive)', async () => {
    const { service } = makeService();
    await service.register({ username: 'Jogador1', email: 'a@b.com', password: 'senha123' });
    const result = await service.register({ username: 'jogador1', email: 'outro@b.com', password: 'senha123' });
    expect(result).toEqual({ kind: 'username-or-email-taken' });
  });

  it('rejeita e-mail duplicado (case-insensitive)', async () => {
    const { service } = makeService();
    await service.register({ username: 'Jogador1', email: 'jogador@b.com', password: 'senha123' });
    const result = await service.register({ username: 'OutroJogador', email: 'Jogador@b.com', password: 'senha123' });
    expect(result).toEqual({ kind: 'username-or-email-taken' });
  });

  it('cria uma sessão válida junto com o registro', async () => {
    const { service, sessions } = makeService();
    const result = await service.register({ username: 'Jogador1', email: 'a@b.com', password: 'senha123' });
    expect(result.kind).toBe('registered');
    if (result.kind !== 'registered') return;
    const me = await service.me(result.token);
    expect(me).toEqual({ kind: 'ok', user: result.user });
    expect(sessions).toBeDefined();
  });
});

describe('AuthService.login', () => {
  async function withRegisteredUser() {
    const ctx = makeService();
    await ctx.service.register({ username: 'Jogador1', email: 'jogador1@example.com', password: 'senha-correta' });
    return ctx;
  }

  it('rejeita usuário desconhecido', async () => {
    const { service } = await withRegisteredUser();
    expect(await service.login({ username: 'ninguem', password: 'senha-correta' })).toEqual({ kind: 'invalid-credentials' });
  });

  it('rejeita senha errada', async () => {
    const { service } = await withRegisteredUser();
    expect(await service.login({ username: 'Jogador1', password: 'senha-errada' })).toEqual({ kind: 'invalid-credentials' });
  });

  it('aceita login pelo username', async () => {
    const { service } = await withRegisteredUser();
    const result = await service.login({ username: 'Jogador1', password: 'senha-correta' });
    expect(result.kind).toBe('logged-in');
  });

  it('aceita login pelo e-mail, ignorando maiúsculas', async () => {
    const { service } = await withRegisteredUser();
    const result = await service.login({ username: 'JOGADOR1@EXAMPLE.COM', password: 'senha-correta' });
    expect(result.kind).toBe('logged-in');
  });

  it('emite um novo token a cada login, independente do anterior', async () => {
    const { service } = await withRegisteredUser();
    const first = await service.login({ username: 'Jogador1', password: 'senha-correta' });
    const second = await service.login({ username: 'Jogador1', password: 'senha-correta' });
    if (first.kind !== 'logged-in' || second.kind !== 'logged-in') throw new Error('esperava login');
    expect(first.token).not.toBe(second.token);
    expect(await service.me(first.token)).toMatchObject({ kind: 'ok' });
    expect(await service.me(second.token)).toMatchObject({ kind: 'ok' });
  });
});

describe('AuthService.me', () => {
  it('rejeita token vazio ou curto demais', async () => {
    const { service } = makeService();
    expect(await service.me('')).toEqual({ kind: 'unauthenticated' });
    expect(await service.me('curto')).toEqual({ kind: 'unauthenticated' });
  });

  it('rejeita token desconhecido', async () => {
    const { service } = makeService();
    expect(await service.me('a'.repeat(64))).toEqual({ kind: 'unauthenticated' });
  });

  it('rejeita token expirado', async () => {
    const { service, advanceTime } = makeService();
    const registered = await service.register({ username: 'Jogador1', email: 'a@b.com', password: 'senha123' });
    if (registered.kind !== 'registered') throw new Error('esperava registro');
    advanceTime(SESSION_TTL_MS + 1);
    expect(await service.me(registered.token)).toEqual({ kind: 'unauthenticated' });
  });

  it('aceita token válido dentro da validade', async () => {
    const { service, advanceTime } = makeService();
    const registered = await service.register({ username: 'Jogador1', email: 'a@b.com', password: 'senha123' });
    if (registered.kind !== 'registered') throw new Error('esperava registro');
    advanceTime(SESSION_TTL_MS - 1);
    expect(await service.me(registered.token)).toEqual({ kind: 'ok', user: registered.user });
  });
});

describe('AuthService.logout', () => {
  it('invalida o token de sessão', async () => {
    const { service } = makeService();
    const registered = await service.register({ username: 'Jogador1', email: 'a@b.com', password: 'senha123' });
    if (registered.kind !== 'registered') throw new Error('esperava registro');

    expect(await service.me(registered.token)).toMatchObject({ kind: 'ok' });
    expect(await service.logout(registered.token)).toEqual({ kind: 'logged-out' });
    expect(await service.me(registered.token)).toEqual({ kind: 'unauthenticated' });
  });
});
