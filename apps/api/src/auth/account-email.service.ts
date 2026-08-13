/**
 * Confirmação de e-mail e recuperação de senha — porta das rotas
 * `/api/account/{verify-email,request-password-reset,reset-password,
 * email,resend-verification}` do accounts.js original.
 *
 * Duas regras do original que parecem detalhe e não são:
 *
 * - `requestPasswordReset` responde a mesma coisa exista ou não a conta.
 *   Diferenciar transformaria a rota num verificador de quais e-mails
 *   estão cadastrados.
 * - `resetPassword` derruba todas as sessões do usuário. Quem pediu a
 *   troca provavelmente perdeu o acesso; deixar sessão antiga viva
 *   manteria o invasor logado.
 *
 * O envio em si é melhor-esforço (ver `email-sender.ts`): o token é
 * gravado mesmo que o e-mail não saia, e nenhuma rota falha por causa
 * disso — igual ao original.
 */

import { hashPassword, generateSalt, verifyPassword } from './password';
import { safeUser, type SafeUser } from './cosmetics';
import { emailLink, emailTemplate, type EmailTokenType } from './email-templates';
import { generateSessionToken, hashToken } from './tokens';
import { UniqueViolationError } from './users-repository';
import type { AccountEmailRepository } from './account-email-repository';
import type { EmailSender } from './email-sender';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

/** `NOW()+INTERVAL '1 hour'` do original. */
export const EMAIL_TOKEN_TTL_MS = 60 * 60 * 1000;

export type VerifyEmailResult = { kind: 'invalid-token' } | { kind: 'ok' };

export type RequestPasswordResetResult = { kind: 'ok' };

export type ResetPasswordResult = { kind: 'invalid-password' } | { kind: 'invalid-token' } | { kind: 'ok' };

export type ChangeEmailResult =
  | { kind: 'invalid-email' }
  | { kind: 'wrong-password' }
  | { kind: 'account-not-found' }
  | { kind: 'email-taken' }
  | { kind: 'ok'; user: SafeUser };

export type ResendVerificationResult = { kind: 'no-email' } | { kind: 'already-verified' } | { kind: 'ok' };

export interface AccountEmailServiceConfig {
  adminUsername: string;
  publicGameUrl: string;
}

/** O que o `AuthService` precisa pra mandar o e-mail de confirmação no cadastro. */
export interface VerificationIssuer {
  issueVerification(user: { id: number; email: string | null }): Promise<void>;
}

export class AccountEmailService implements VerificationIssuer {
  constructor(
    private readonly repo: AccountEmailRepository,
    private readonly mailer: EmailSender,
    private readonly config: AccountEmailServiceConfig,
    private readonly now: () => number = Date.now,
  ) {}

  async verifyEmail(token: string): Promise<VerifyEmailResult> {
    const confirmed = await this.repo.consumeEmailVerification(hashToken(token), new Date(this.now()));
    return confirmed ? { kind: 'ok' } : { kind: 'invalid-token' };
  }

  async requestPasswordReset(email: string): Promise<RequestPasswordResetResult> {
    const target = await this.repo.findByEmail(email.trim().toLowerCase());
    if (target) await this.issueToken(target, 'reset');
    // Sempre o mesmo resultado, com conta ou sem.
    return { kind: 'ok' };
  }

  async resetPassword(token: string, password: string): Promise<ResetPasswordResult> {
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) return { kind: 'invalid-password' };

    const salt = generateSalt();
    const hash = await hashPassword(password, salt);
    const changed = await this.repo.consumePasswordReset(hashToken(token), new Date(this.now()), hash, salt);
    return changed ? { kind: 'ok' } : { kind: 'invalid-token' };
  }

  async changeEmail(userId: number, rawEmail: string, password: string): Promise<ChangeEmailResult> {
    const email = rawEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email) || email.length > MAX_EMAIL_LENGTH) return { kind: 'invalid-email' };

    const account = await this.repo.findById(userId);
    if (!account) return { kind: 'account-not-found' };
    if (!(await verifyPassword(password, account.passwordSalt, account.passwordHash))) return { kind: 'wrong-password' };

    let updated;
    try {
      updated = await this.repo.updateEmail(userId, email);
    } catch (err) {
      if (err instanceof UniqueViolationError) return { kind: 'email-taken' };
      throw err;
    }

    await this.issueToken(updated, 'verify');
    return { kind: 'ok', user: safeUser(updated, this.config.adminUsername) };
  }

  async resendVerification(user: { id: number; email: string | null; emailVerified: boolean }): Promise<ResendVerificationResult> {
    if (!user.email) return { kind: 'no-email' };
    if (user.emailVerified) return { kind: 'already-verified' };
    await this.issueToken(user, 'verify');
    return { kind: 'ok' };
  }

  /** `VerificationIssuer`: usado pelo cadastro, que já sabe que o e-mail é novo. */
  async issueVerification(user: { id: number; email: string | null }): Promise<void> {
    await this.issueToken(user, 'verify');
  }

  private async issueToken(user: { id: number; email: string | null }, type: EmailTokenType): Promise<void> {
    if (!user.email) return;

    const token = generateSessionToken();
    await this.repo.setEmailToken(user.id, type, hashToken(token), new Date(this.now() + EMAIL_TOKEN_TTL_MS));

    const { subject, html } = emailTemplate(type, emailLink(this.config.publicGameUrl, type, token));
    await this.mailer.send(user.email, subject, html);
  }
}
