import { AccountEmailService, EMAIL_TOKEN_TTL_MS } from './account-email.service';
import type { AccountEmailRepository } from './account-email-repository';
import type { EmailSender } from './email-sender';
import type { EmailTokenType } from './email-templates';
import { generateSalt, hashPassword, verifyPassword } from './password';
import { hashToken } from './tokens';
import { UniqueViolationError, type AccountRecord } from './users-repository';

interface StoredToken {
  type: EmailTokenType;
  hash: string;
  expiresAt: Date;
}

class FakeAccountEmailRepository implements AccountEmailRepository {
  readonly accounts = new Map<number, AccountRecord>();
  readonly tokens = new Map<number, StoredToken>();
  readonly droppedSessionsOf: number[] = [];

  async findById(userId: number): Promise<AccountRecord | null> {
    return this.accounts.get(userId) ?? null;
  }

  async findByEmail(email: string): Promise<AccountRecord | null> {
    for (const account of this.accounts.values()) {
      if ((account.email ?? '').toLowerCase() === email.toLowerCase()) return account;
    }
    return null;
  }

  async setEmailToken(userId: number, type: EmailTokenType, tokenHash: string, expiresAt: Date): Promise<void> {
    this.tokens.set(userId, { type, hash: tokenHash, expiresAt });
  }

  async consumeEmailVerification(tokenHash: string, now: Date): Promise<boolean> {
    for (const [userId, token] of this.tokens) {
      if (token.type !== 'verify' || token.hash !== tokenHash || token.expiresAt <= now) continue;
      const account = this.accounts.get(userId);
      if (account) account.emailVerified = true;
      this.tokens.delete(userId);
      return true;
    }
    return false;
  }

  async consumePasswordReset(tokenHash: string, now: Date, passwordHash: string, passwordSalt: string): Promise<boolean> {
    for (const [userId, token] of this.tokens) {
      if (token.type !== 'reset' || token.hash !== tokenHash || token.expiresAt <= now) continue;
      const account = this.accounts.get(userId);
      if (account) {
        account.passwordHash = passwordHash;
        account.passwordSalt = passwordSalt;
      }
      this.tokens.delete(userId);
      this.droppedSessionsOf.push(userId);
      return true;
    }
    return false;
  }

  async updateEmail(userId: number, email: string): Promise<AccountRecord> {
    for (const [otherId, account] of this.accounts) {
      if (otherId !== userId && (account.email ?? '').toLowerCase() === email.toLowerCase()) throw new UniqueViolationError();
    }
    const account = this.accounts.get(userId);
    if (!account) throw new Error('conta inexistente no fake');
    account.email = email;
    account.emailVerified = false;
    return account;
  }
}

class FakeEmailSender implements EmailSender {
  readonly sent: { to: string; subject: string; html: string }[] = [];
  outcome = true;

  async send(to: string, subject: string, html: string): Promise<boolean> {
    this.sent.push({ to, subject, html });
    return this.outcome;
  }
}

const NOW = Date.parse('2026-08-13T12:00:00Z');

async function makeAccount(id: number, email: string | null, password = 'segredo123'): Promise<AccountRecord> {
  const passwordSalt = generateSalt();
  return {
    id,
    username: `jogador${id}`,
    email,
    emailVerified: false,
    avatarUrl: '',
    profileFrame: 'none',
    nameColor: '#e8d7a5',
    pet: 'none',
    cosmetics: null,
    createdAt: new Date(NOW),
    passwordHash: await hashPassword(password, passwordSalt),
    passwordSalt,
  };
}

async function setup() {
  const repo = new FakeAccountEmailRepository();
  const mailer = new FakeEmailSender();
  const service = new AccountEmailService(repo, mailer, { adminUsername: 'ADM', publicGameUrl: 'https://kingdark17.github.io/rpg-legend/' }, () => NOW);
  const account = await makeAccount(1, 'aria@exemplo.com');
  repo.accounts.set(account.id, account);
  return { repo, mailer, service, account };
}

/** Recupera o token cru a partir do link do e-mail que o fake capturou. */
function tokenFromLastEmail(mailer: FakeEmailSender, type: EmailTokenType): string {
  const html = mailer.sent[mailer.sent.length - 1].html;
  const match = new RegExp(`[?&]${type}=([^"&]+)`).exec(html);
  if (!match) throw new Error(`link de ${type} não encontrado no e-mail`);
  return decodeURIComponent(match[1]);
}

describe('AccountEmailService.verifyEmail', () => {
  it('confirma o e-mail com o token que foi enviado', async () => {
    const { repo, mailer, service, account } = await setup();
    await service.issueVerification(account);

    const result = await service.verifyEmail(tokenFromLastEmail(mailer, 'verify'));

    expect(result).toEqual({ kind: 'ok' });
    expect(repo.accounts.get(1)?.emailVerified).toBe(true);
  });

  it('recusa token desconhecido, vazio ou já usado', async () => {
    const { mailer, service, account } = await setup();
    await service.issueVerification(account);
    const token = tokenFromLastEmail(mailer, 'verify');

    expect(await service.verifyEmail('nada')).toEqual({ kind: 'invalid-token' });
    expect(await service.verifyEmail('')).toEqual({ kind: 'invalid-token' });
    expect(await service.verifyEmail(token)).toEqual({ kind: 'ok' });
    expect(await service.verifyEmail(token)).toEqual({ kind: 'invalid-token' });
  });

  it('guarda só o hash do token, nunca o token em si', async () => {
    const { repo, mailer, service, account } = await setup();
    await service.issueVerification(account);
    const token = tokenFromLastEmail(mailer, 'verify');

    expect(repo.tokens.get(1)?.hash).toBe(hashToken(token));
    expect(repo.tokens.get(1)?.hash).not.toBe(token);
  });

  it('o token expira em uma hora', async () => {
    const { repo, service, account } = await setup();
    await service.issueVerification(account);

    expect(repo.tokens.get(1)?.expiresAt.getTime()).toBe(NOW + EMAIL_TOKEN_TTL_MS);
  });
});

describe('AccountEmailService.requestPasswordReset', () => {
  it('manda o link e responde ok quando a conta existe', async () => {
    const { mailer, service } = await setup();

    expect(await service.requestPasswordReset('ARIA@exemplo.com')).toEqual({ kind: 'ok' });
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].subject).toBe('Redefina sua senha do RPG Legend');
  });

  it('responde exatamente o mesmo quando a conta não existe, sem mandar e-mail', async () => {
    const { mailer, service } = await setup();

    expect(await service.requestPasswordReset('ninguem@exemplo.com')).toEqual({ kind: 'ok' });
    expect(mailer.sent).toEqual([]);
  });

  it('falha de envio não muda a resposta nem apaga o token', async () => {
    const { repo, mailer, service } = await setup();
    mailer.outcome = false;

    expect(await service.requestPasswordReset('aria@exemplo.com')).toEqual({ kind: 'ok' });
    expect(repo.tokens.get(1)?.type).toBe('reset');
  });
});

describe('AccountEmailService.resetPassword', () => {
  it('troca a senha e derruba as sessões', async () => {
    const { repo, mailer, service } = await setup();
    await service.requestPasswordReset('aria@exemplo.com');

    const result = await service.resetPassword(tokenFromLastEmail(mailer, 'reset'), 'senhanova123');

    expect(result).toEqual({ kind: 'ok' });
    const account = repo.accounts.get(1)!;
    expect(await verifyPassword('senhanova123', account.passwordSalt, account.passwordHash)).toBe(true);
    expect(await verifyPassword('segredo123', account.passwordSalt, account.passwordHash)).toBe(false);
    expect(repo.droppedSessionsOf).toEqual([1]);
  });

  it('recusa senha fora de 8..128 antes de olhar o token', async () => {
    const { repo, service } = await setup();

    expect(await service.resetPassword('qualquer', 'curta')).toEqual({ kind: 'invalid-password' });
    expect(await service.resetPassword('qualquer', 'x'.repeat(129))).toEqual({ kind: 'invalid-password' });
    expect(repo.droppedSessionsOf).toEqual([]);
  });

  it('recusa token inválido e não deixa a senha antiga de lado', async () => {
    const { repo, service } = await setup();
    const antes = repo.accounts.get(1)!.passwordHash;

    expect(await service.resetPassword('token-que-nao-existe', 'senhanova123')).toEqual({ kind: 'invalid-token' });
    expect(repo.accounts.get(1)?.passwordHash).toBe(antes);
  });

  it('o mesmo link não vale duas vezes', async () => {
    const { mailer, service } = await setup();
    await service.requestPasswordReset('aria@exemplo.com');
    const token = tokenFromLastEmail(mailer, 'reset');

    expect(await service.resetPassword(token, 'senhanova123')).toEqual({ kind: 'ok' });
    expect(await service.resetPassword(token, 'outrasenha123')).toEqual({ kind: 'invalid-token' });
  });
});

describe('AccountEmailService.changeEmail', () => {
  it('troca o e-mail, marca como não confirmado e manda a confirmação', async () => {
    const { repo, mailer, service } = await setup();
    repo.accounts.get(1)!.emailVerified = true;

    const result = await service.changeEmail(1, '  NOVO@exemplo.com ', 'segredo123');

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.user.email).toBe('novo@exemplo.com');
    expect(result.user.emailVerified).toBe(false);
    expect(mailer.sent[0].subject).toBe('Confirme seu e-mail no RPG Legend');
  });

  it('exige a senha certa', async () => {
    const { repo, mailer, service } = await setup();

    expect(await service.changeEmail(1, 'novo@exemplo.com', 'senha-errada')).toEqual({ kind: 'wrong-password' });
    expect(repo.accounts.get(1)?.email).toBe('aria@exemplo.com');
    expect(mailer.sent).toEqual([]);
  });

  it('recusa e-mail malformado ou longo demais antes de checar a senha', async () => {
    const { service } = await setup();

    expect(await service.changeEmail(1, 'sem-arroba', 'segredo123')).toEqual({ kind: 'invalid-email' });
    expect(await service.changeEmail(1, `${'x'.repeat(250)}@exemplo.com`, 'segredo123')).toEqual({ kind: 'invalid-email' });
  });

  it('recusa e-mail que já é de outra conta', async () => {
    const { repo, service } = await setup();
    const outra = await makeAccount(2, 'bree@exemplo.com');
    repo.accounts.set(2, outra);

    expect(await service.changeEmail(1, 'bree@exemplo.com', 'segredo123')).toEqual({ kind: 'email-taken' });
  });

  it('conta inexistente não vira erro', async () => {
    const { service } = await setup();
    expect(await service.changeEmail(404, 'novo@exemplo.com', 'segredo123')).toEqual({ kind: 'account-not-found' });
  });
});

describe('AccountEmailService.resendVerification', () => {
  it('reenvia pra quem tem e-mail pendente', async () => {
    const { mailer, service } = await setup();

    expect(await service.resendVerification({ id: 1, email: 'aria@exemplo.com', emailVerified: false })).toEqual({ kind: 'ok' });
    expect(mailer.sent).toHaveLength(1);
  });

  it('não reenvia pra conta sem e-mail nem pra e-mail já confirmado', async () => {
    const { mailer, service } = await setup();

    expect(await service.resendVerification({ id: 1, email: null, emailVerified: false })).toEqual({ kind: 'no-email' });
    expect(await service.resendVerification({ id: 1, email: 'aria@exemplo.com', emailVerified: true })).toEqual({ kind: 'already-verified' });
    expect(mailer.sent).toEqual([]);
  });
});
