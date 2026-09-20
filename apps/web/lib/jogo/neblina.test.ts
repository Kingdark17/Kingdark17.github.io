import { describe, expect, it } from 'vitest';

import type { CelulaDoMapa } from './estado';
import { estadoDaSala, sabeOTipo } from './neblina';

/**
 * Duas salas ligadas por porta, lado a lado, e uma terceira solta.
 *
 *     (0,0) ── (1,0)      (3,0)
 */
function grade(ajustes: Partial<Record<string, Partial<CelulaDoMapa>>> = {}): CelulaDoMapa[][] {
  const sala = (x: number, y: number, extra: Partial<CelulaDoMapa> = {}): CelulaDoMapa =>
    ({ x, y, type: 'normal', doors: {}, ...extra }) as CelulaDoMapa;

  const linha = [
    sala(0, 0, { doors: { E: true }, ...ajustes['0,0'] }),
    sala(1, 0, { doors: { W: true }, ...ajustes['1,0'] }),
    sala(2, 0, { type: 'void', ...ajustes['2,0'] }),
    sala(3, 0, { ...ajustes['3,0'] }),
  ];
  return [linha];
}

const COLUNAS = 4;
const LINHAS = 1;

function estadoDe(g: CelulaDoMapa[][], x: number): ReturnType<typeof estadoDaSala> {
  return estadoDaSala(g, g[0]![x]!, COLUNAS, LINHAS);
}

describe('estadoDaSala', () => {
  it('sala que não é sala é vazia', () => {
    expect(estadoDe(grade(), 2)).toBe('vazia');
  });

  it('sala longe de tudo é inexplorada', () => {
    expect(estadoDe(grade(), 3)).toBe('inexplorada');
  });

  it('sala visitada é visitada', () => {
    expect(estadoDe(grade({ '0,0': { visited: true } }), 0)).toBe('visitada');
  });

  it('vizinha de visitada, pela porta, é silhueta', () => {
    expect(estadoDe(grade({ '0,0': { visited: true } }), 1)).toBe('silhueta');
  });

  /**
   * **O bug do doc do Breno, preso.**
   *
   * A informação do prisioneiro marca `revealed`, e o minimapa gateava
   * arte e ícone em `visited` sozinho — então a sala revelada saía
   * idêntica a uma vizinha qualquer de sala visitada, e o serviço que a
   * pessoa pagou não fazia nada visível.
   */
  it('sala revelada é revelada, e não silhueta', () => {
    expect(estadoDe(grade({ '3,0': { revealed: true } }), 3)).toBe('revelada');
  });

  /** Revelada e vizinha de visitada ao mesmo tempo: o que ela sabe manda. */
  it('revelada ganha da silhueta quando as duas valem', () => {
    expect(estadoDe(grade({ '0,0': { visited: true }, '1,0': { revealed: true } }), 1)).toBe('revelada');
  });

  /** Entrar marca os dois; visitada é o estado mais forte. */
  it('visitada ganha de revelada', () => {
    expect(estadoDe(grade({ '0,0': { visited: true, revealed: true } }), 0)).toBe('visitada');
  });

  /** Void revelado continua void — o prisioneiro não inventa sala. */
  it('nem revelar transforma vazio em sala', () => {
    expect(estadoDe(grade({ '2,0': { revealed: true } }), 2)).toBe('vazia');
  });
});

describe('sabeOTipo', () => {
  /**
   * A lista inteira, e não só os dois que liberam: é a tabela que decide
   * se o baú e o chefe aparecem antes da hora. Estado novo na névoa cai
   * aqui pra alguém decidir de que lado ele fica.
   */
  it('só visitada e revelada mostram o que tem dentro', () => {
    expect(sabeOTipo('visitada')).toBe(true);
    expect(sabeOTipo('revelada')).toBe(true);

    expect(sabeOTipo('silhueta')).toBe(false);
    expect(sabeOTipo('inexplorada')).toBe(false);
    expect(sabeOTipo('vazia')).toBe(false);
  });
});
