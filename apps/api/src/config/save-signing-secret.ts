/**
 * Segredo de assinatura dos saves — resolvido uma única vez por processo
 * e compartilhado por qualquer módulo que assine/verifique saves
 * (SaveModule, ProfileModule, ...). Duas leituras independentes do
 * fallback aleatório gerariam segredos diferentes dentro do mesmo
 * processo e quebrariam a verificação entre rotas (ex: assinar em
 * /api/save e falhar ao verificar em /api/account/profile/purchase).
 *
 * Mesma cadeia de fallback do accounts.js original: `SAVE_SIGNING_SECRET`,
 * senão `DATABASE_URL`, senão um valor aleatório por processo (o que
 * invalida saves ao reiniciar — comportamento herdado do original, não
 * uma escolha nova daqui).
 */

import { randomBytes } from 'node:crypto';

let cachedSecret: string | null = null;

export function resolveSaveSigningSecret(): string {
  if (cachedSecret === null) {
    cachedSecret = process.env.SAVE_SIGNING_SECRET || process.env.DATABASE_URL || randomBytes(32).toString('hex');
  }
  return cachedSecret;
}
