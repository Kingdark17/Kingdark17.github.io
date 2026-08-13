/**
 * Porta das operações de `users` ligadas a e-mail e recuperação de senha
 * — separada de `UsersRepository` (que existe pro `AuthService`) porque
 * quem depende dela é só o `AccountEmailService`.
 *
 * Consumir token é uma operação só, não "busca depois atualiza": no
 * original os dois casos são um `UPDATE ... WHERE token_hash=$1 AND
 * expires_at>NOW()`, o que garante que o mesmo link não vale duas vezes
 * nem que duas requisições simultâneas passem juntas.
 */

import type { EmailTokenType } from './email-templates';
import type { AccountRecord } from './users-repository';

export interface AccountEmailRepository {
  findById(userId: number): Promise<AccountRecord | null>;
  /** `WHERE LOWER(email)=LOWER($1)` do original. */
  findByEmail(email: string): Promise<AccountRecord | null>;
  setEmailToken(userId: number, type: EmailTokenType, tokenHash: string, expiresAt: Date): Promise<void>;
  /** Marca `email_verified` e limpa o token. `false` quando o link não vale mais. */
  consumeEmailVerification(tokenHash: string, now: Date): Promise<boolean>;
  /** Troca a senha, limpa o token e derruba todas as sessões do usuário. `false` quando o link não vale mais. */
  consumePasswordReset(tokenHash: string, now: Date, passwordHash: string, passwordSalt: string): Promise<boolean>;
  /** Grava o novo e-mail e volta `email_verified` pra falso. Lança `UniqueViolationError` se for de outra conta. */
  updateEmail(userId: number, email: string): Promise<AccountRecord>;
}
