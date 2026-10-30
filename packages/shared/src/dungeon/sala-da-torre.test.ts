import { describe, expect, it } from 'vitest';

import { geometriaDaSala, paredesDaSala } from './arte-da-sala.js';
import { EXTRA_TILES } from './extras.js';
import { casasDoVao, GEOMETRIA_PADRAO, roomArrival, roomLayout, TILE_UNITS, walkTick, type Walker } from './room-walk.js';
import { objetosDaSala, plantaDaSalaSecreta } from '../jogo/extras.js';
import { plantaDaSala } from '../jogo/andar-na-sala.js';
import type { DungeonCell } from './generate.js';

const torre = geometriaDaSala('torre');
const centro = (casa: number) => casa * TILE_UNITS + TILE_UNITS / 2;

/** Anda com o joystick fixo até sair por uma porta (ou cansar). */
function andar(planta: ReturnType<typeof roomLayout>, de: Walker, x: number, y: number, passos = 600) {
  let walker = de;
  for (let i = 0; i < passos; i++) {
    const passo = walkTick(planta, walker, { x, y });
    walker = passo.walker;
    if (passo.exit) return { walker, saiu: passo.exit };
  }
  return { walker, saiu: null };
}

describe('a sala da Torre', () => {
  it('tem 11 × 12, o meio no pentagrama, e as outras masmorras continuam na sala de sempre', () => {
    expect(torre.cols).toBe(11);
    expect(torre.rows).toBe(12);
    expect(torre.conteudo).toEqual({ col: 5, row: 6 });
    expect(geometriaDaSala('floresta')).toBe(GEOMETRIA_PADRAO);
    expect(geometriaDaSala(null)).toBe(GEOMETRIA_PADRAO);
  });

  it('o vão é de 3 casas, e o de cima atravessa a parede de 2', () => {
    expect(casasDoVao(torre, 'N')).toEqual([
      { col: 4, row: 0 },
      { col: 4, row: 1 },
      { col: 5, row: 0 },
      { col: 5, row: 1 },
      { col: 6, row: 0 },
      { col: 6, row: 1 },
    ]);
    expect(casasDoVao(torre, 'W')).toEqual([
      { col: 0, row: 5 },
      { col: 0, row: 6 },
      { col: 0, row: 7 },
    ]);
    expect(casasDoVao(GEOMETRIA_PADRAO, 'E')).toEqual([{ col: 8, row: 4 }]);
  });

  it('a planta segue a colisão do Breno: parede de cima de 2, pilares, e o vão aberto só com a porta', () => {
    const fechada = plantaDaSala({}, true, 'torre');
    expect(fechada.cols).toBe(11);
    expect(fechada.rows).toBe(12);
    expect(fechada.solid[1]![5]).toBe(true);
    expect(fechada.solid[2]![3]).toBe(true);
    expect(fechada.solid[8]![9]).toBe(true);
    expect(fechada.solid[2]![5]).toBe(false);
    expect(fechada.objects).toEqual([{ id: 'conteudo', col: 5, row: 6 }]);
    const aberta = plantaDaSala({ N: true, W: true }, false, 'torre');
    for (const casa of [...casasDoVao(torre, 'N'), ...casasDoVao(torre, 'W')]) expect(aberta.solid[casa.row]![casa.col]).toBe(false);
    expect(aberta.solid[11]![5]).toBe(true);
    // A sala de sempre não leva tamanho nem portas na planta, como sempre foi.
    expect(plantaDaSala({ N: true }, true, 'floresta').cols).toBeUndefined();
  });

  it('chega-se um passo pra dentro do vão, e sem direção logo abaixo do pentagrama', () => {
    expect(roomArrival('S', torre)).toEqual({ x: centro(5), y: centro(2), facing: 'S' });
    expect(roomArrival('N', torre)).toEqual({ x: centro(5), y: centro(10), facing: 'N' });
    expect(roomArrival('E', torre)).toEqual({ x: centro(1), y: centro(6), facing: 'E' });
    expect(roomArrival(null, torre)).toEqual({ x: centro(5), y: centro(8), facing: 'S' });
  });

  it('atravessa-se a porta de cima pela parede grossa, e as dos lados por qualquer casa do vão', () => {
    const planta = plantaDaSala({ N: true, E: true }, false, 'torre');
    expect(andar(planta, roomArrival(null, torre), 0, -127).saiu).toBe('N');
    // Na beira do vão da direita (linha 5, não a do meio), sai sem ajuda.
    expect(andar(planta, { x: centro(8), y: centro(5), facing: 'E' }, 127, 0).saiu).toBe('E');
  });

  it('encostado na parede de cima longe do vão (os pilares o ladeiam), fica: a ajuda não puxa de longe', () => {
    const planta = plantaDaSala({ N: true }, false, 'torre');
    expect(andar(planta, { x: centro(1), y: centro(3), facing: 'N' }, 0, -127, 200).saiu).toBeNull();
    expect(andar(planta, { x: centro(8), y: centro(3), facing: 'N' }, 0, -127, 200).saiu).toBeNull();
  });

  it('os extras gravados vão pra casa correspondente da Torre, e a parede rachada pro vão do lado dela', () => {
    const celula = {
      type: 'normal',
      x: 0,
      y: 0,
      doors: {},
      extras: [
        { kind: 'chest', ...EXTRA_TILES[0], item: null, used: false },
        { kind: 'pot', ...EXTRA_TILES[7], used: false },
        { kind: 'crack', col: 4, row: 0, side: 'N', used: false },
      ],
    } as DungeonCell;
    expect(objetosDaSala(celula, true, 'torre')).toEqual([
      { id: 'conteudo', col: 5, row: 6 },
      { id: 'extra-0', col: 2, row: 2 },
      { id: 'extra-1', col: 9, row: 10 },
      { id: 'extra-2', col: 5, row: 1 },
    ]);
    for (const casa of torre.extras!) {
      expect(paredesDaSala('torre').some((p) => p.col === casa.col && p.row === casa.row)).toBe(false);
    }
  });

  it('a sala secreta da Torre é do formato dela', () => {
    const planta = plantaDaSalaSecreta('N', 'torre');
    expect(planta.cols).toBe(11);
    expect(planta.doors).toEqual(['S']);
    expect(planta.objects).toEqual([{ id: 'bau-secreto', col: 5, row: 6 }]);
  });
});
