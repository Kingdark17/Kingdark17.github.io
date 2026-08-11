import { describe, expect, it } from 'vitest';

import { seededRng } from '../rng.js';
import { DIR_OPP, DIR_VECTORS, distancesFrom, generateRoomGraph, inBounds, isKnown, isRoom, type Direction, type RoomCell } from './graph.js';

describe('inBounds', () => {
  it('aceita a borda e rejeita fora da grade', () => {
    expect(inBounds(0, 0, 5, 5)).toBe(true);
    expect(inBounds(4, 4, 5, 5)).toBe(true);
    expect(inBounds(-1, 0, 5, 5)).toBe(false);
    expect(inBounds(5, 0, 5, 5)).toBe(false);
    expect(inBounds(0, 5, 5, 5)).toBe(false);
  });
});

describe('generateRoomGraph', () => {
  it('gera exatamente roomCount salas quando a grade comporta, começando no centro', () => {
    const { grid, rooms, start } = generateRoomGraph(11, 11, 12, seededRng(1));
    expect(rooms).toHaveLength(12);
    expect(start.type).toBe('start');
    expect(start.x).toBe(5);
    expect(start.y).toBe(5);
    expect(grid[5]?.[5]).toBe(start);
  });

  it('nunca gera duas salas na mesma posição', () => {
    const { rooms } = generateRoomGraph(11, 11, 15, seededRng(7));
    const keys = new Set(rooms.map((r) => `${r.x},${r.y}`));
    expect(keys.size).toBe(rooms.length);
  });

  it('toda sala fora de "void" está na lista rooms, e vice-versa', () => {
    const { grid, rooms } = generateRoomGraph(9, 9, 14, seededRng(3));
    const nonVoid = grid.flat().filter((c) => c.type !== 'void');
    expect(nonVoid).toHaveLength(rooms.length);
  });

  it('portas são sempre simétricas: se A abre porta pra B, B abre porta de volta pra A', () => {
    const { grid, rooms } = generateRoomGraph(11, 11, 16, seededRng(42));
    for (const cell of rooms) {
      for (const dir of Object.keys(cell.doors) as Direction[]) {
        const v = DIR_VECTORS[dir];
        const neighbor = grid[cell.y + v.y]?.[cell.x + v.x];
        expect(neighbor).toBeDefined();
        expect(neighbor?.doors[DIR_OPP[dir]]).toBe(true);
      }
    }
  });

  it('é determinístico: a mesma seed produz a mesma grade', () => {
    const a = generateRoomGraph(11, 11, 13, seededRng(99));
    const b = generateRoomGraph(11, 11, 13, seededRng(99));
    expect(JSON.stringify(a.grid)).toBe(JSON.stringify(b.grid));
  });

  it('para com o guard em vez de travar quando a grade é pequena demais para roomCount', () => {
    const { rooms } = generateRoomGraph(3, 3, 50, seededRng(5));
    expect(rooms.length).toBeLessThanOrEqual(9); // grade 3x3 só tem 9 células
  });
});

describe('isRoom', () => {
  it('void não é sala; qualquer outro tipo é', () => {
    expect(isRoom({ type: 'void', x: 0, y: 0, doors: {} })).toBe(false);
    expect(isRoom({ type: 'normal', x: 0, y: 0, doors: {} })).toBe(true);
    expect(isRoom(null)).toBe(false);
  });
});

describe('distancesFrom', () => {
  // Grade 3x1 construída à mão: start -- normal -- normal, ligadas E/W.
  function linearGrid(): { grid: RoomCell[][]; start: RoomCell } {
    const start: RoomCell = { type: 'start', x: 0, y: 0, doors: { E: true } };
    const mid: RoomCell = { type: 'normal', x: 1, y: 0, doors: { W: true, E: true } };
    const end: RoomCell = { type: 'normal', x: 2, y: 0, doors: { W: true } };
    return { grid: [[start, mid, end]], start };
  }

  it('a sala inicial tem distância 0, e a distância cresce 1 por porta', () => {
    const { grid, start } = linearGrid();
    const distances = distancesFrom(grid, start, 3, 1);
    expect(distances['0,0']).toBe(0);
    expect(distances['1,0']).toBe(1);
    expect(distances['2,0']).toBe(2);
  });

  it('salas desconectadas (sem porta de volta) não aparecem no resultado', () => {
    const start: RoomCell = { type: 'start', x: 0, y: 0, doors: {} }; // sem portas
    const isolada: RoomCell = { type: 'normal', x: 1, y: 0, doors: {} };
    const distances = distancesFrom([[start, isolada]], start, 2, 1);
    expect(distances['1,0']).toBeUndefined();
  });
});

describe('isKnown', () => {
  it('sala visitada ou revelada é sempre conhecida', () => {
    const grid: RoomCell[][] = [[{ type: 'normal', x: 0, y: 0, doors: {}, visited: true }]];
    expect(isKnown(grid, grid[0]![0]!, 1, 1)).toBe(true);
  });

  it('sala fica conhecida quando um vizinho ligado por porta já foi visitado', () => {
    const visitado: RoomCell = { type: 'start', x: 0, y: 0, doors: { E: true }, visited: true };
    const vizinha: RoomCell = { type: 'normal', x: 1, y: 0, doors: { W: true } };
    const grid = [[visitado, vizinha]];
    expect(isKnown(grid, vizinha, 2, 1)).toBe(true);
  });

  it('sala sem vizinho visitado e não visitada não é conhecida', () => {
    const a: RoomCell = { type: 'start', x: 0, y: 0, doors: { E: true } };
    const b: RoomCell = { type: 'normal', x: 1, y: 0, doors: { W: true } };
    const grid = [[a, b]];
    expect(isKnown(grid, b, 2, 1)).toBe(false);
  });
});
