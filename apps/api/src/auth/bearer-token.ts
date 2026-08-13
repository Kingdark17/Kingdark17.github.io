/** Extrai o token de `Authorization: Bearer <token>` — mesmo parsing do accounts.js original. */
export function extractBearerToken(header: string | undefined): string {
  const value = String(header || '');
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}
