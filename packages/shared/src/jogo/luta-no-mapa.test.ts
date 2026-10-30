import { describe, expect, it } from 'vitest';

import { geometriaDaSala, paredesDaSala } from '../dungeon/arte-da-sala.js';
import { TILE_UNITS, roomArrival } from '../dungeon/room-walk.js';
import { heroiNaLuta, lugaresNaLuta } from './luta-no-mapa.js';

describe('lugaresNaLuta', () => {
  it('um no meio da sala; dois, três e quatro numa fileira; o chefe com os lacaios à frente', () => {
    expect(lugaresNaLuta(1)).toEqual([{ col: 4, row: 4 }]);
    expect(lugaresNaLuta(2)).toEqual([{ col: 3, row: 4 }, { col: 5, row: 4 }]);
    expect(lugaresNaLuta(3)).toEqual([{ col: 2, row: 4 }, { col: 4, row: 4 }, { col: 6, row: 4 }]);
    expect(lugaresNaLuta(4).map((l) => l.col)).toEqual([1, 3, 5, 7]);
    expect(lugaresNaLuta(5)[0]).toEqual({ col: 4, row: 3 });
  });

  it('na Torre, em volta do pentagrama', () => {
    expect(lugaresNaLuta(1, geometriaDaSala('torre'))).toEqual([{ col: 5, row: 6 }]);
  });

  it('nunca em parede de dentro nem fora do chão, e cada um na sua casa', () => {
    for (const masmorra of ['floresta', 'caverna', 'torre'] as const) {
      const geometria = geometriaDaSala(masmorra);
      const paredes = new Set(paredesDaSala(masmorra).map((p) => `${p.col},${p.row}`));
      for (let quantos = 1; quantos <= 5; quantos++) {
        const lugares = lugaresNaLuta(quantos, geometria);
        expect(lugares).toHaveLength(quantos);
        expect(new Set(lugares.map((l) => `${l.col},${l.row}`)).size).toBe(quantos);
        for (const l of lugares) {
          expect(paredes.has(`${l.col},${l.row}`)).toBe(false);
          expect(l.col).toBeGreaterThan(0);
          expect(l.col).toBeLessThan(geometria.cols - 1);
          expect(l.row).toBeGreaterThan(0);
          expect(l.row).toBeLessThan(geometria.rows - 1);
        }
      }
    }
  });

  it('nenhum monstro conta como um', () => {
    expect(lugaresNaLuta(0)).toEqual([{ col: 4, row: 4 }]);
  });
});

describe('heroiNaLuta', () => {
  const T = TILE_UNITS;
  it('quem acabou de entrar pela porta dá um passo pra dentro, como quem chega por ela', () => {
    expect(heroiNaLuta({ x: 4.5 * T, y: 30, facing: 'S' })).toEqual(roomArrival('S'));
    expect(heroiNaLuta({ x: 4.5 * T, y: 9 * T - 10, facing: 'N' })).toEqual(roomArrival('N'));
    expect(heroiNaLuta({ x: 10, y: 4.5 * T, facing: 'E' })).toEqual(roomArrival('E'));
    expect(heroiNaLuta({ x: 9 * T - 1, y: 4.5 * T, facing: 'W' })).toEqual(roomArrival('W'));
  });

  it('quem já está dentro fica onde está', () => {
    const dentro = { x: 2.5 * T, y: 6.5 * T, facing: 'S' as const };
    expect(heroiNaLuta(dentro)).toBe(dentro);
  });

  it('na Torre, pela porta dela', () => {
    const torre = geometriaDaSala('torre');
    expect(heroiNaLuta({ x: 5.5 * T, y: 12 * T - 5, facing: 'N' }, torre)).toEqual(roomArrival('N', torre));
  });
});
