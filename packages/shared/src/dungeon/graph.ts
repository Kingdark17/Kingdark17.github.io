/**
 * Geração procedural de masmorra em salas (estilo "Binding of Isaac"): cada
 * célula da grade é uma sala inteira ou vazio, salas vizinhas se conectam
 * por portas fixas (Norte/Sul/Leste/Oeste). Sem conceito de "para onde o
 * jogador olha" — direções são sempre absolutas.
 *
 * Porta de `js/map.js`. Já era puro no original (só `Math.random()` direto);
 * aqui ganha `Rng` injetável para poder ser testado com seed.
 */

import { defaultRng, randomInt, type Rng } from '../rng.js';

export type Direction = 'N' | 'S' | 'E' | 'W';

export const DIR_VECTORS: Record<Direction, { x: number; y: number }> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
  E: { x: 1, y: 0 },
};

export const DIR_LABEL: Record<Direction, string> = { N: 'Norte', S: 'Sul', E: 'Leste', W: 'Oeste' };
export const DIR_OPP: Record<Direction, Direction> = { N: 'S', S: 'N', E: 'W', W: 'E' };
export const DIR_ORDER: Direction[] = ['N', 'S', 'E', 'W'];

/**
 * Uma célula da grade. `type` fica solto em `string` aqui de propósito — o
 * gerador de grafo só conhece `'void' | 'start' | 'normal'`; quem gera o
 * conteúdo de cada andar (`dungeon/generate.ts`) é quem sabe os demais tipos
 * (`npc`, `treasure`, `monster`...), então não faz sentido este módulo travar
 * a união inteira.
 */
export interface RoomCell {
  type: string;
  x: number;
  y: number;
  doors: Partial<Record<Direction, true>>;
  /** Jogador já entrou nesta sala. */
  visited?: boolean;
  /** Sala marcada como conhecida sem o jogador ter entrado (ex: dom de vidente). */
  revealed?: boolean;
}

export function inBounds(x: number, y: number, cols: number, rows: number): boolean {
  return x >= 0 && x < cols && y >= 0 && y < rows;
}

export interface RoomGraph {
  grid: RoomCell[][];
  rooms: RoomCell[];
  start: RoomCell;
}

/**
 * Planta uma grade esparsa de salas conectadas por portas, crescendo a
 * partir do centro. Cresce por frontier: a cada passo escolhe uma sala já
 * existente ao acaso e tenta abrir porta numa direção livre; se nenhuma
 * direção estiver livre, a sala sai da fronteira de crescimento.
 */
export function generateRoomGraph(rows: number, cols: number, roomCount: number, rng: Rng = defaultRng): RoomGraph {
  const grid: RoomCell[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: RoomCell[] = [];
    for (let x = 0; x < cols; x++) row.push({ type: 'void', x, y, doors: {} });
    grid.push(row);
  }

  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  const start = grid[cy]![cx]!;
  start.type = 'start';
  const rooms = [start];
  let frontier = [start];
  let count = 1;
  let guard = 0;

  while (count < roomCount && frontier.length && guard < 800) {
    guard++;
    const r = frontier[randomInt(frontier.length, rng)] as RoomCell;
    const dirs = DIR_ORDER.slice().sort(() => rng() - 0.5);
    let placed = false;
    for (const d of dirs) {
      const v = DIR_VECTORS[d];
      const nx = r.x + v.x;
      const ny = r.y + v.y;
      if (!inBounds(nx, ny, cols, rows)) continue;
      const target = grid[ny]![nx]!;
      if (target.type !== 'void') continue;
      target.type = 'normal';
      target.doors[DIR_OPP[d]] = true;
      r.doors[d] = true;
      rooms.push(target);
      frontier.push(target);
      count++;
      placed = true;
      break;
    }
    if (!placed) frontier = frontier.filter((f) => f !== r);
  }

  return { grid, rooms, start };
}

export function isRoom(cell: RoomCell | null | undefined): boolean {
  return !!cell && cell.type !== 'void';
}

/** Distância real em número de portas a partir de uma sala (BFS). Usada para impedir que saídas importantes fiquem coladas ao ponto inicial. */
export function distancesFrom(grid: RoomCell[][], start: RoomCell, cols: number, rows: number): Record<string, number> {
  const distances: Record<string, number> = {};
  const queue: RoomCell[] = [start];
  distances[`${start.x},${start.y}`] = 0;

  while (queue.length) {
    const cell = queue.shift() as RoomCell;
    const base = distances[`${cell.x},${cell.y}`] as number;
    for (const dir of Object.keys(cell.doors || {}) as Direction[]) {
      const v = DIR_VECTORS[dir];
      const nx = cell.x + v.x;
      const ny = cell.y + v.y;
      if (!inBounds(nx, ny, cols, rows)) continue;
      const key = `${nx},${ny}`;
      if (distances[key] !== undefined) continue;
      distances[key] = base + 1;
      queue.push(grid[ny]![nx]!);
    }
  }

  return distances;
}

/**
 * Uma sala fica "conhecida" (silhueta visível no minimapa) assim que
 * qualquer sala vizinha ligada por porta já foi visitada — não precisa ter
 * tentado abrir a porta ainda. O conteúdo só aparece ao entrar.
 */
export function isKnown(grid: RoomCell[][], cell: RoomCell, cols: number, rows: number): boolean {
  if (cell.visited || cell.revealed) return true;
  for (const dir of Object.keys(cell.doors || {}) as Direction[]) {
    const v = DIR_VECTORS[dir];
    const nx = cell.x + v.x;
    const ny = cell.y + v.y;
    if (inBounds(nx, ny, cols, rows) && grid[ny]![nx]!.visited) return true;
  }
  return false;
}
