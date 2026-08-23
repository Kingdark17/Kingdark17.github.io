/**
 * Token de sessão opaco (32 bytes aleatórios em hex, devolvido ao cliente)
 * e seu hash sha256 (o que de fato é guardado em `sessions.token_hash`) —
 * mesmo formato do `accounts.js` original, pra sessões emitidas por um
 * servidor continuarem válidas no outro enquanto rodam lado a lado.
 */

import { createHash, randomBytes } from 'node:crypto';

/**
 * Mesma validade de sessão do accounts.js original: `NOW()+INTERVAL '30 days'`.
 *
 * Mora aqui, e não no `auth.module.ts` onde nasceu, porque agora tem dois
 * donos: a linha de `sessions.expires_at` no banco e o `Max-Age` do cookie.
 * Se os dois divergirem, o cookie some antes da sessão morrer (jogador
 * deslogado sem motivo) ou sobrevive a ela (cookie apontando pra sessão
 * que já não existe).
 */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Aceita só o formato que `generateSessionToken` emite: 32 bytes em hex. */
export const FORMATO_DO_TOKEN = /^[0-9a-f]{64}$/;

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
