/**
 * Slots de personagem (`/api/characters` e `/api/save/reset`).
 *
 * O resumo vem do próprio save guardado na nuvem — a API lê `hero.name`,
 * `hero.className` e afins de dentro do JSON, então campo faltando volta
 * como string vazia em vez de quebrar.
 */

import { chamarApi } from './client';

/** `templateId` de cada slot, pro card desenhar o boneco equipado. */
export interface EquipDoResumo {
  arma: string | null;
  armadura: string | null;
  secundaria: string | null;
}

export interface ResumoPersonagem {
  slot: number;
  name: string;
  raceIcon: string;
  className: string;
  classIcon: string;
  level: number;
  floor: number;
  updatedAt: string;
  /**
   * Opcionais porque o front e a API sobem separados — Vercel e Render não
   * combinam relógio. Um front novo contra uma API que ainda não devolve
   * estes campos recebe `undefined`, e o card cai no emoji da raça em vez
   * de quebrar. Nasceram juntos em 2026-08-24.
   */
  race?: string;
  raceId?: string;
  equip?: EquipDoResumo;
}

export interface ListaPersonagens {
  characters: ResumoPersonagem[];
  maxSlots: number;
}

export function listarPersonagens(): Promise<ListaPersonagens> {
  return chamarApi<ListaPersonagens>('/api/characters', { autenticado: true });
}

export async function apagarPersonagem(slot: number): Promise<void> {
  await chamarApi('/api/save/reset', { method: 'POST', body: { slot }, autenticado: true });
}
