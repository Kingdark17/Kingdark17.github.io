/** Normaliza texto de chat — mesmo corte do accounts.js original: `String(text || '').trim().slice(0,2000)`. */

import { comoTexto } from '../common/texto';

const MAX_MESSAGE_LENGTH = 2000;

export function cleanMessageText(text: unknown): string {
  return comoTexto(text).trim().slice(0, MAX_MESSAGE_LENGTH);
}
