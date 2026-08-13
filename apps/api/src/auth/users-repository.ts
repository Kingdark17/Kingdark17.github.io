/**
 * Porta de acesso a `users` que o `AuthService` depende — implementada por
 * cima do Drizzle depois, quando houver um `DATABASE_URL` real pra
 * apontar. Interface primeiro pra manter `AuthService` testável com um
 * fake em memória, sem precisar de banco nenhum.
 */

import type { UserRow } from './cosmetics';

export class UniqueViolationError extends Error {
  constructor(message = 'Esse nome de usuário ou e-mail já está sendo usado.') {
    super(message);
    this.name = 'UniqueViolationError';
  }
}

/** Registro completo de `users`, incluindo os campos de senha que `UserRow`/`safeUser` nunca expõem. */
export type AccountRecord = UserRow & {
  passwordHash: string;
  passwordSalt: string;
};

export interface CreateUserInput {
  username: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
}

export interface UsersRepository {
  /** Espelha `WHERE LOWER(username)=LOWER($1) OR LOWER(email)=LOWER($1)` do accounts.js original. */
  findByUsernameOrEmail(identifier: string): Promise<AccountRecord | null>;
  /** Lança `UniqueViolationError` quando username ou email já existem (equivalente ao erro 23505 do Postgres). */
  create(input: CreateUserInput): Promise<AccountRecord>;
}
