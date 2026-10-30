/**
 * A luta no mapa (2026-10-30, pedido do Breno, site e app): no lugar da tela
 * em primeira pessoa, a luta acontece na própria sala, com o herói e os
 * monstros à vista, e embaixo só as ações e o sistema de batalha de cada um
 * (a barra por turnos no site, a caixa do coração em tempo real no app).
 *
 * Aqui fica onde cada monstro do grupo se põe na sala, pra o site e o app
 * desenharem igual: em volta do meio dela (onde fica o conteúdo), numa
 * fileira, e o chefe final com os quatro lacaios um passo à frente dele.
 */

import { GEOMETRIA_PADRAO, TILE_UNITS, roomArrival, type GeometriaDaSala, type Walker } from '../dungeon/room-walk.js';

export interface LugarNaLuta {
  col: number;
  row: number;
}

/**
 * Os lugares dos monstros na sala, na ordem do grupo (`inimigosDaLuta`):
 * um no meio; dois e três numa fileira; quatro numa fileira de casa sim,
 * casa não; cinco (o chefe final e os lacaios) com o chefe um passo atrás,
 * no meio, e os lacaios em arco na frente dele. Nenhum cai nas paredes de
 * dentro das salas com arte (os cantos da Caverna, os pilares da Torre).
 */
export function lugaresNaLuta(quantos: number, geometria: GeometriaDaSala = GEOMETRIA_PADRAO): LugarNaLuta[] {
  const { col, row } = geometria.conteudo;
  const desenho = DESENHOS[Math.max(1, Math.min(DESENHOS.length, quantos)) - 1] as readonly (readonly [number, number])[];
  return desenho.map(([dc, dr]) => ({ col: col + dc, row: row + dr }));
}

/** Quanto cada monstro fica do meio da sala (coluna, linha), pelo tamanho do grupo. */
const DESENHOS: readonly (readonly (readonly [number, number])[])[] = [
  [[0, 0]],
  [[-1, 0], [1, 0]],
  [[-2, 0], [0, 0], [2, 0]],
  [[-3, 0], [-1, 0], [1, 0], [3, 0]],
  [[0, -1], [-3, 0], [-1, 1], [1, 1], [3, 0]],
];

/**
 * Onde o herói fica na luta. Ele entra andando e a luta abre na porta, com
 * ele ainda no vão (ou já além da borda); como a câmera enquadra a sala
 * inteira, ali ele ficaria cortado. Então dá um passo pra dentro: o lugar de
 * quem chega por aquela porta (`roomArrival`). Quem já está dentro fica onde está.
 */
export function heroiNaLuta(walker: Walker, geometria: GeometriaDaSala = GEOMETRIA_PADRAO): Walker {
  if (walker.y < TILE_UNITS) return roomArrival('S', geometria);
  if (walker.y >= (geometria.rows - 1) * TILE_UNITS) return roomArrival('N', geometria);
  if (walker.x < TILE_UNITS) return roomArrival('E', geometria);
  if (walker.x >= (geometria.cols - 1) * TILE_UNITS) return roomArrival('W', geometria);
  return walker;
}
