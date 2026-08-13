/**
 * Implementação de `AccountEmailRepository` sobre o schema Drizzle.
 * `getDb()` só é chamado dentro dos métodos, como no resto do app — o
 * processo sobe sem `DATABASE_URL`.
 *
 * Uma diferença proposital em relação ao original: consumir o token de
 * senha é um `UPDATE ... WHERE token_hash=$1 AND expires_at>$now`, não um
 * `SELECT` seguido de `UPDATE`. Com o SELECT antes, duas requisições
 * simultâneas com o mesmo link podiam passar as duas pela checagem antes
 * de qualquer uma limpar o token. Com o UPDATE condicional, só a primeira
 * acha a linha.
 */

import { and, eq, gt, sql } from 'drizzle-orm';

import { getDb } from '../db/client';
import { isUniqueViolation } from '../db/is-unique-violation';
import { sessions, users } from '../db/schema';
import type { AccountEmailRepository } from './account-email-repository';
import type { EmailTokenType } from './email-templates';
import { toAccountRecord } from './to-account-record';
import { UniqueViolationError, type AccountRecord } from './users-repository';

export class DrizzleAccountEmailRepository implements AccountEmailRepository {
  async findById(userId: number): Promise<AccountRecord | null> {
    const rows = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
    return rows[0] ? toAccountRecord(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<AccountRecord | null> {
    const rows = await getDb()
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
      .limit(1);
    return rows[0] ? toAccountRecord(rows[0]) : null;
  }

  async setEmailToken(userId: number, type: EmailTokenType, tokenHash: string, expiresAt: Date): Promise<void> {
    const patch =
      type === 'verify'
        ? { emailVerificationTokenHash: tokenHash, emailVerificationExpiresAt: expiresAt }
        : { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt };
    await getDb().update(users).set(patch).where(eq(users.id, userId));
  }

  async consumeEmailVerification(tokenHash: string, now: Date): Promise<boolean> {
    const changed = await getDb()
      .update(users)
      .set({ emailVerified: true, emailVerificationTokenHash: null, emailVerificationExpiresAt: null })
      .where(and(eq(users.emailVerificationTokenHash, tokenHash), gt(users.emailVerificationExpiresAt, now)))
      .returning({ id: users.id });
    return changed.length > 0;
  }

  async consumePasswordReset(tokenHash: string, now: Date, passwordHash: string, passwordSalt: string): Promise<boolean> {
    return getDb().transaction(async (tx) => {
      const changed = await tx
        .update(users)
        .set({ passwordHash, passwordSalt, passwordResetTokenHash: null, passwordResetExpiresAt: null })
        .where(and(eq(users.passwordResetTokenHash, tokenHash), gt(users.passwordResetExpiresAt, now)))
        .returning({ id: users.id });

      const target = changed[0];
      if (!target) return false;

      // Quem pediu a troca provavelmente perdeu o acesso: nenhuma sessão
      // antiga continua valendo.
      await tx.delete(sessions).where(eq(sessions.userId, target.id));
      return true;
    });
  }

  async updateEmail(userId: number, email: string): Promise<AccountRecord> {
    try {
      const [row] = await getDb().update(users).set({ email, emailVerified: false }).where(eq(users.id, userId)).returning();
      return toAccountRecord(row);
    } catch (err) {
      if (isUniqueViolation(err)) throw new UniqueViolationError('Este e-mail já pertence a outra conta.');
      throw err;
    }
  }
}
