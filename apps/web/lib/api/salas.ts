/**
 * `GET /api/rooms` — a vitrine de salas públicas esperando parceiro.
 *
 * Rota sem autenticação, igual ao original: o menu lê antes de entrar em
 * qualquer sala. Tudo o mais do multiplayer é socket (ver `lib/rede/sala.ts`).
 */

import { chamarApi } from './client';

export interface SalaPublica {
  code: string;
  hostName: string;
}

export async function salasPublicas(): Promise<SalaPublica[]> {
  const resposta = await chamarApi<{ rooms: SalaPublica[] }>('/api/rooms');
  return resposta.rooms;
}
