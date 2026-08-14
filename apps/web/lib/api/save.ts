/**
 * Save na nuvem (`/api/save`).
 *
 * `baseSignature` é a assinatura do save que este navegador carregou por
 * último. O servidor recusa a gravação se ela não for a atual — é assim
 * que ele impede que uma aba velha sobrescreva progresso mais novo. Save
 * novo (personagem recém-criado) vai sem ela.
 */

import { chamarApi } from './client';

export interface RespostaSave {
  ok: true;
  signature: string;
}

export function gravarSave(entrada: { slot: number; save: unknown; baseSignature?: string }): Promise<RespostaSave> {
  return chamarApi<RespostaSave>('/api/save', {
    method: 'PUT',
    autenticado: true,
    body: { slot: entrada.slot, save: entrada.save, source: 'game', baseSignature: entrada.baseSignature ?? '' },
  });
}
