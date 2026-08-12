/**
 * Assinatura HMAC dos saves na nuvem — mesma lógica do `accounts.js`
 * original (`canonical`/`signSave`/`validSignature`: HMAC-sha256 sobre
 * `userId|slot|json-canonico-com-chaves-ordenadas`, sem o campo
 * `integrity`). Única mudança deliberada: o segredo de assinatura entra
 * como parâmetro em vez de ser lido de `process.env` dentro da função,
 * pra manter a lógica pura e testável — mesmo padrão de injeção usado em
 * `packages/shared` pra `Rng`/`now`.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export function canonical(value: JsonValue): string {
  if (Array.isArray(value)) {
    return '[' + value.map(canonical).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + canonical(value[key]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

export function signSave(userId: number, slot: number, data: JsonValue, signingSecret: string): string {
  const clean: JsonValue = data && typeof data === 'object' ? ({ ...(data as Record<string, JsonValue>) } as JsonValue) : data;
  if (clean && typeof clean === 'object') {
    delete (clean as Record<string, JsonValue>).integrity;
  }
  return createHmac('sha256', signingSecret)
    .update(`${userId}|${slot}|${canonical(clean)}`)
    .digest('hex');
}

export function validSignature(userId: number, slot: number, data: JsonValue, signature: string | undefined, signingSecret: string): boolean {
  const expected = signSave(userId, slot, data, signingSecret);
  const given = String(signature || '');
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
