/**
 * Orquestração de registro/login/logout/sessão — porta das rotas
 * `/api/account/register`, `/api/account/login`, `/api/account/logout` e
 * `/api/account/me` do `accounts.js` original, sem a camada HTTP (isso
 * fica pro controller, que ainda não existe).
 *
 * Duas coisas ficam de fora de propósito, adiadas pra quando o slice de
 * auth crescer: o rate limiting por IP (`limited()` no original — estado
 * de processo, não regra de negócio) e verificação de e-mail/reset de
 * senha (dependem do Resend, um serviço externo).
 *
 * `adminUsername`/`sessionTtlMs`/`now` entram como config injetada em vez
 * de `process.env`/`Date.now()` direto, mesmo padrão de `save-signature.ts`
 * e do resto do pacote (`Rng`/`now` em `packages/shared`).
 */

import { generateSalt, hashPassword, verifyPassword } from './password';
import { generateSessionToken, hashToken } from './tokens';
import { safeUser, type SafeUser } from './cosmetics';
import { UniqueViolationError, type UsersRepository } from './users-repository';
import type { SessionsRepository } from './sessions-repository';

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MIN_TOKEN_LENGTH = 32;

export type RegisterResult =
  | { kind: 'invalid-username' }
  | { kind: 'invalid-email' }
  | { kind: 'invalid-password' }
  | { kind: 'username-or-email-taken' }
  | { kind: 'registered'; token: string; user: SafeUser };

export type LoginResult = { kind: 'invalid-credentials' } | { kind: 'logged-in'; token: string; user: SafeUser };

export type LogoutResult = { kind: 'logged-out' };

export type MeResult = { kind: 'unauthenticated' } | { kind: 'ok'; user: SafeUser };

export interface AuthServiceConfig {
  adminUsername: string;
  sessionTtlMs: number;
}

export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly sessions: SessionsRepository,
    private readonly config: AuthServiceConfig,
    private readonly now: () => number = Date.now,
  ) {}

  async register(input: { username: string; email: string; password: string }): Promise<RegisterResult> {
    const username = input.username.trim();
    const email = input.email.trim().toLowerCase();
    const password = input.password;

    if (!USERNAME_PATTERN.test(username)) return { kind: 'invalid-username' };
    if (!EMAIL_PATTERN.test(email) || email.length > MAX_EMAIL_LENGTH) return { kind: 'invalid-email' };
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) return { kind: 'invalid-password' };

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    let created;
    try {
      created = await this.users.create({ username, email, passwordHash, passwordSalt: salt });
    } catch (err) {
      if (err instanceof UniqueViolationError) return { kind: 'username-or-email-taken' };
      throw err;
    }

    const token = await this.issueSession(created.id);
    return { kind: 'registered', token, user: safeUser(created, this.config.adminUsername) };
  }

  async login(input: { username: string; password: string }): Promise<LoginResult> {
    const identifier = input.username.trim();
    const user = await this.users.findByUsernameOrEmail(identifier);
    if (!user || !(await verifyPassword(input.password, user.passwordSalt, user.passwordHash))) {
      return { kind: 'invalid-credentials' };
    }
    const token = await this.issueSession(user.id);
    return { kind: 'logged-in', token, user: safeUser(user, this.config.adminUsername) };
  }

  async logout(token: string): Promise<LogoutResult> {
    await this.sessions.deleteByTokenHash(hashToken(token));
    return { kind: 'logged-out' };
  }

  async me(token: string): Promise<MeResult> {
    if (!token || token.length < MIN_TOKEN_LENGTH) return { kind: 'unauthenticated' };
    const user = await this.sessions.findUserByTokenHash(hashToken(token), new Date(this.now()));
    if (!user) return { kind: 'unauthenticated' };
    return { kind: 'ok', user: safeUser(user, this.config.adminUsername) };
  }

  private async issueSession(userId: number): Promise<string> {
    const token = generateSessionToken();
    await this.sessions.create({
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(this.now() + this.config.sessionTtlMs),
    });
    return token;
  }
}
