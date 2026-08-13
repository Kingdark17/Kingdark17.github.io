/**
 * Slots de personagem (`/api/characters` e `/api/save/reset`).
 *
 * O resumo vem do próprio save guardado na nuvem — a API lê `hero.name`,
 * `hero.className` e afins de dentro do JSON, então campo faltando volta
 * como string vazia em vez de quebrar.
 */

import { chamarApi } from './client';

export interface ResumoPersonagem {
  slot: number;
  name: string;
  raceIcon: string;
  className: string;
  classIcon: string;
  level: number;
  floor: number;
  updatedAt: string;
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
