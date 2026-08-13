/**
 * Erro 23505 do Postgres (unique_violation) — mesma checagem
 * `e.code==='23505'` do accounts.js original.
 *
 * Só olhar `err.code` não basta: o Drizzle embrulha o erro do driver num
 * `DrizzleQueryError` e põe o erro original em `cause`. Sem descer a
 * cadeia, cadastro com username repetido responderia 500 em vez de 409.
 * Isso passou despercebido até o primeiro teste rodar query de verdade.
 */

const UNIQUE_VIOLATION = '23505';
const MAX_DEPTH = 5;

export function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    if (typeof current !== 'object' || current === null) return false;
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
