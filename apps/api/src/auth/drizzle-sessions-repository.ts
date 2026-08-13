/**
 * Implementação de `SessionsRepository` sobre o schema Drizzle. Mesma
 * regra de `drizzle-users-repository.ts`: `getDb()` só roda dentro dos
 * métodos, nunca no construtor.
 */

import { and, eq, gt } from 'drizzle-orm';

import { getDb } from '../db/client';
import { sessions, users } from '../db/schema';
import type { AccountRecord } from './users-repository';
import type { CreateSessionInput, SessionsRepository } from './sessions-repository';
import { toAccountRecord } from './to-account-record';

export class DrizzleSessionsRepository implements SessionsRepository {
  async create(input: CreateSessionInput): Promise<void> {
    await getDb().insert(sessions).values({
      tokenHash: input.tokenHash,
      userId: input.userId,
      expiresAt: input.expiresAt,
    });
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await getDb().delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }

  async findUserByTokenHash(tokenHash: string, now: Date): Promise<AccountRecord | null> {
    const rows = await getDb()
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
      .limit(1);
    const row = rows[0];
    return row ? toAccountRecord(row.user) : null;
  }
}
