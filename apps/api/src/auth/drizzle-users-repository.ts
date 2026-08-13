/**
 * Implementação de `UsersRepository` sobre o schema Drizzle (`db/schema.ts`).
 * `getDb()` só é chamado dentro de cada método, nunca no construtor — a
 * classe pode ser instanciada e o app pode subir sem `DATABASE_URL`
 * configurada; só quebra se um método for de fato chamado sem banco.
 *
 * Erro 23505 do Postgres (unique_violation, disparado pelos índices
 * únicos de username/email do schema) vira `UniqueViolationError`, igual
 * o `accounts.js` original faz checando `e.code==='23505'`.
 */

import { or, sql } from 'drizzle-orm';

import { getDb } from '../db/client';
import { users } from '../db/schema';
import type { AccountRecord, CreateUserInput, UsersRepository } from './users-repository';
import { UniqueViolationError } from './users-repository';
import { toAccountRecord } from './to-account-record';

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === '23505';
}

export class DrizzleUsersRepository implements UsersRepository {
  async findByUsernameOrEmail(identifier: string): Promise<AccountRecord | null> {
    const needle = identifier.toLowerCase();
    const rows = await getDb()
      .select()
      .from(users)
      .where(or(sql`lower(${users.username}) = ${needle}`, sql`lower(${users.email}) = ${needle}`))
      .limit(1);
    const row = rows[0];
    return row ? toAccountRecord(row) : null;
  }

  async create(input: CreateUserInput): Promise<AccountRecord> {
    try {
      const [row] = await getDb()
        .insert(users)
        .values({
          username: input.username,
          email: input.email,
          passwordHash: input.passwordHash,
          passwordSalt: input.passwordSalt,
        })
        .returning();
      return toAccountRecord(row);
    } catch (err) {
      if (isUniqueViolation(err)) throw new UniqueViolationError();
      throw err;
    }
  }
}
