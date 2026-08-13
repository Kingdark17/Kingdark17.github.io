/**
 * Porta de acesso a `sessions` que o `AuthService` depende — mesmo motivo
 * de `users-repository.ts`: implementação real por cima do Drizzle vem
 * depois, quando houver banco pra apontar.
 */

import type { AccountRecord } from './users-repository';

export interface CreateSessionInput {
  tokenHash: string;
  userId: number;
  expiresAt: Date;
}

export interface SessionsRepository {
  create(input: CreateSessionInput): Promise<void>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
  /** Espelha o JOIN sessions+users filtrando `expires_at>NOW()` do accounts.js original — `now` explícito em vez de `NOW()` do banco. */
  findUserByTokenHash(tokenHash: string, now: Date): Promise<AccountRecord | null>;
}
