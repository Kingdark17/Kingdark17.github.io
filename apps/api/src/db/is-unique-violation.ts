/** Erro 23505 do Postgres (unique_violation) — mesma checagem `e.code==='23505'` do accounts.js original. */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === '23505';
}
