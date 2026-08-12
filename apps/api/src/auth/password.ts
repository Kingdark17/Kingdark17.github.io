/**
 * Hash de senha via scrypt — mesmo algoritmo e parâmetros do
 * RPG-Legend-Server original (`accounts.js`'s `passwordHash`: scrypt com
 * salt de 16 bytes hex e chave de 64 bytes hex), pra qualquer conta criada
 * pelo servidor real continuar validando aqui sem re-hash.
 */

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

export function generateSalt(): string {
  return randomBytes(16).toString('hex');
}

export function hashPassword(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (err, key) => {
      if (err) reject(err);
      else resolve(key.toString('hex'));
    });
  });
}

export async function verifyPassword(password: string, salt: string, expectedHashHex: string): Promise<boolean> {
  const actual = Buffer.from(await hashPassword(password, salt), 'hex');
  const expected = Buffer.from(expectedHashHex, 'hex');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
