/**
 * Armadilhas (doc do Breno de 2026-11-06, decidido com o usuário): casas do
 * chão de salas sorteadas que disparam quando o herói pisa nelas. Ficam
 * escondidas até disparar, e aí ficam à vista; quem tem mais Sabedoria às
 * vezes vê um brilho antes (`vista`), e pode dar a volta.
 *
 * - Espinhos: dano, e o herói sangra por algumas salas.
 * - Dardo: pouco dano, e veneno por algumas salas.
 * - Pedras: dano, e podem quebrar um braço ou uma perna.
 *
 * Os ferimentos são de `hero/ferimentos.ts`; pisar é de `jogo/armadilhas.ts`.
 */

import { pick, type Rng } from '../rng.js';
import { geometriaDaSala, paredesDaSala } from './arte-da-sala.js';
import type { DungeonId } from './dungeons.js';
import type { DungeonCell } from './generate.js';
import { DIR_OPP, type Direction } from './graph.js';
import { roomArrival, roomLayout, TILE_UNITS, type Walker } from './room-walk.js';

export type TipoDeArmadilha = 'espinhos' | 'dardo' | 'pedras';

/** Uma armadilha numa casa da sala. */
export interface Armadilha {
  tipo: TipoDeArmadilha;
  col: number;
  row: number;
  /** Já disparou: fica à vista, e não dispara de novo. */
  disparada?: true;
  /** O herói viu o brilho dela antes de pisar. */
  vista?: true;
}

export interface DefDaArmadilha {
  nome: string;
  icone: string;
  /** O dano, em fração da vida máxima do herói (nunca mata: para em 1). */
  dano: number;
  /** Salas de sangramento que ela deixa. */
  sangramento?: number;
  /** Salas de veneno que ela deixa. */
  veneno?: number;
  /** Chance de quebrar um braço ou uma perna. */
  quebra?: number;
}

export const ARMADILHAS: Record<TipoDeArmadilha, DefDaArmadilha> = {
  espinhos: { nome: 'Espinhos', icone: '🗡️', dano: 0.12, sangramento: 2 },
  dardo: { nome: 'Dardo Envenenado', icone: '🎯', dano: 0.05, veneno: 3 },
  pedras: { nome: 'Pedras Caindo', icone: '🪨', dano: 0.1, quebra: 0.4 },
};

const TIPOS: readonly TipoDeArmadilha[] = ['espinhos', 'dardo', 'pedras'];

/** O brilho de uma armadilha ainda escondida, que o herói viu. */
export const ICONE_DO_BRILHO = '✨';

/** Chance de uma sala ter armadilha. */
export const CHANCE_DE_ARMADILHA = 0.2;

/** As salas sem armadilha: o início, a saída, a escada e o covil do chefe. */
const SEM_ARMADILHA: readonly string[] = ['void', 'start', 'exit', 'stairs', 'boss'];

/** A chance de o herói ver o brilho da armadilha antes de pisar: 6% por ponto de Sabedoria acima de 8, até 60%. */
export function chanceDeVer(sabedoria: number): number {
  return Math.min(0.6, Math.max(0, (sabedoria - 8) * 0.06));
}

/**
 * As casas onde uma armadilha pode ficar: o chão de dentro da sala, sem o
 * conteúdo, os extras e as casas de chegada pelas portas (ninguém pisa numa
 * armadilha só por entrar).
 */
function casasLivres(cell: DungeonCell, dungeon: DungeonId): { col: number; row: number }[] {
  const geometria = geometriaDaSala(dungeon);
  const planta = roomLayout(cell.doors, [], paredesDaSala(dungeon), geometria);
  const ocupadas = new Set<string>([`${geometria.conteudo.col},${geometria.conteudo.row}`]);
  for (const extra of cell.extras ?? []) ocupadas.add(`${extra.col},${extra.row}`);
  for (const porta of Object.keys(cell.doors) as Direction[]) {
    const chegada = roomArrival(DIR_OPP[porta], geometria);
    ocupadas.add(`${Math.floor(chegada.x / TILE_UNITS)},${Math.floor(chegada.y / TILE_UNITS)}`);
  }
  const livres: { col: number; row: number }[] = [];
  for (let row = 1; row < geometria.rows - 1; row++) {
    for (let col = 1; col < geometria.cols - 1; col++) {
      if (!planta.solid[row]?.[col] && !ocupadas.has(`${col},${row}`)) livres.push({ col, row });
    }
  }
  return livres;
}

/**
 * Põe armadilhas nas salas sorteadas do andar: uma por sala, com
 * `CHANCE_DE_ARMADILHA`. Por sala que leva: a chance (um número), o tipo, a
 * casa e o brilho (mais três). Quem gera o andar chama por último, depois
 * dos extras.
 */
export function colocarArmadilhas(rooms: DungeonCell[], dungeon: DungeonId, sabedoria: number, rng: Rng): void {
  for (const cell of rooms) {
    if (SEM_ARMADILHA.includes(cell.type)) continue;
    if (rng() >= CHANCE_DE_ARMADILHA) continue;
    const tipo = pick(TIPOS, rng);
    const livres = casasLivres(cell, dungeon);
    if (!livres.length) continue;
    const casa = pick(livres, rng);
    const vista = rng() < chanceDeVer(sabedoria);
    cell.armadilhas = [{ tipo, col: casa.col, row: casa.row, ...(vista ? { vista: true as const } : {}) }];
  }
}

/** A armadilha ainda armada sob o herói (a casa onde está o centro da base dele), ou `null`. */
export function armadilhaSob(cell: Pick<DungeonCell, 'armadilhas'> | null | undefined, walker: Pick<Walker, 'x' | 'y'>): number | null {
  const col = Math.floor(walker.x / TILE_UNITS);
  const row = Math.floor(walker.y / TILE_UNITS);
  const indice = (cell?.armadilhas ?? []).findIndex((a) => !a.disparada && a.col === col && a.row === row);
  return indice >= 0 ? indice : null;
}

/** As marcas de armadilha que a sala mostra no chão: as disparadas e o brilho das vistas. */
export function marcasDasArmadilhas(cell: Pick<DungeonCell, 'armadilhas'> | null | undefined): { col: number; row: number; icone: string }[] {
  return (cell?.armadilhas ?? [])
    .filter((a) => a.disparada || a.vista)
    .map((a) => ({ col: a.col, row: a.row, icone: a.disparada ? ARMADILHAS[a.tipo].icone : ICONE_DO_BRILHO }));
}
