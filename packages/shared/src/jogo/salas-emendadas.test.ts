import { describe, expect, it } from 'vitest';

import type { CelulaDoMapa, EstadoDoJogo } from './estado.js';
import { portasDaPlanta, salasEmVolta } from './salas-emendadas.js';

/**
 * Uma grade de 4 × 3, o herói em (1,1):
 *
 *     (0,0)  (1,0)  ░░░░░  (3,0)
 *     (0,1) ─(1,1)─ (2,1)  (3,1)
 *     ░░░░░  (1,2)  (2,2)  ░░░░░
 *
 * (0,0) foi visitada; (1,0) é vizinha sem porta; (2,0) e as pontas de baixo não são sala.
 */
function estado(ajustes: Partial<Record<string, Partial<CelulaDoMapa>>> = {}, mapMode: 'dungeon' | 'city' = 'dungeon'): EstadoDoJogo {
  const sala = (x: number, y: number, extra: Partial<CelulaDoMapa> = {}): CelulaDoMapa =>
    ({ x, y, type: 'normal', doors: {}, ...extra, ...ajustes[`${x},${y}`] }) as CelulaDoMapa;
  const vazia = (x: number, y: number) => sala(x, y, { type: 'void' });
  const map = [
    [sala(0, 0, { visited: true, doors: { S: true } }), sala(1, 0), vazia(2, 0), sala(3, 0)],
    [sala(0, 1, { doors: { E: true, N: true } }), sala(1, 1, { visited: true, doors: { W: true, E: true, S: true } }), sala(2, 1, { doors: { W: true } }), sala(3, 1)],
    [vazia(0, 2), sala(1, 2, { doors: { N: true } }), sala(2, 2), vazia(3, 2)],
  ];
  return { mapMode, pos: { x: 1, y: 1 }, map, mapCols: 4, mapRows: 3 } as unknown as EstadoDoJogo;
}

describe('salasEmVolta', () => {
  it('o quadrado de 3 × 3 em volta da atual, sem as casas que não são sala, na ordem de leitura', () => {
    const salas = salasEmVolta(estado());
    expect(salas.map((s) => `${s.x},${s.y}:${s.dx},${s.dy}`)).toEqual(['0,0:-1,-1', '1,0:0,-1', '0,1:-1,0', '1,1:0,0', '2,1:1,0', '1,2:0,1', '2,2:1,1']);
  });

  it('acesa: a atual e as já visitadas; as outras ficam na sombra, mesmo ligadas por porta', () => {
    const acesas = salasEmVolta(estado()).filter((s) => s.acesa).map((s) => `${s.x},${s.y}`);
    expect(acesas).toEqual(['0,0', '1,1']);
  });

  it('a sala revelada (o prisioneiro contou) continua na sombra: o conteúdo só aparece ao entrar', () => {
    const salas = salasEmVolta(estado({ '2,1': { revealed: true } }));
    expect(salas.find((s) => s.x === 2 && s.y === 1)?.acesa).toBe(false);
  });

  it('na borda da grade, só o que existe', () => {
    const e = estado();
    const noCanto = { ...e, pos: { x: 0, y: 0 } } as EstadoDoJogo;
    expect(salasEmVolta(noCanto).map((s) => `${s.x},${s.y}`)).toEqual(['0,0', '1,0', '0,1', '1,1']);
  });

  it('fora da masmorra, nenhuma', () => {
    expect(salasEmVolta(estado({}, 'city'))).toEqual([]);
  });
});

describe('portasDaPlanta', () => {
  it('as portas do mapa, na ordem N S E W', () => {
    expect(portasDaPlanta({ x: 0, y: 0, type: 'normal', doors: { W: true, N: true } } as unknown as CelulaDoMapa)).toEqual(['N', 'W']);
  });

  it('mais a passagem da parede rachada já aberta, que leva à sala secreta', () => {
    const celula = {
      x: 0,
      y: 0,
      type: 'normal',
      doors: { N: true },
      extras: [{ kind: 'crack', side: 'E', col: 8, row: 4, used: true }],
    } as unknown as CelulaDoMapa;
    expect(portasDaPlanta(celula)).toEqual(['N', 'E']);
    const fechada = { ...celula, extras: [{ kind: 'crack', side: 'E', col: 8, row: 4 }] } as unknown as CelulaDoMapa;
    expect(portasDaPlanta(fechada)).toEqual(['N']);
  });

  it('sem célula, nenhuma', () => {
    expect(portasDaPlanta(null)).toEqual([]);
  });
});
