/**
 * Token de sessão opaco (32 bytes aleatórios em hex, devolvido ao cliente)
 * e seu hash sha256 (o que de fato é guardado em `sessions.token_hash`) —
 * mesmo formato do `accounts.js` original, pra sessões emitidas por um
 * servidor continuarem válidas no outro enquanto rodam lado a lado.
 */

import { createHash, randomBytes } from 'node:crypto';

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
