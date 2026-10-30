import { describe, expect, it } from 'vitest';

import { CAMADAS_DAS_SALAS, camadasDaSala, cobreOHeroiNaSala, enfeitesDaSala, geometriaDaSala, paredesDaSala, type CamadaDaSala } from './arte-da-sala.js';
import { EXTRA_TILES } from './extras.js';
import { CONTENT_TILE, DOOR_TILE, TILE_UNITS, roomArrival, roomLayout } from './room-walk.js';

describe('a arte das salas', () => {
  it('a sala da Floresta leva o chão, o caminho só das portas que tem e as copas por cima', () => {
    expect(camadasDaSala('floresta', ['N', 'S'])!.map((c) => c.arquivo)).toEqual(['1_grama', '2_caminho_cima', '5_caminho_baixo', '6_floresta_cima']);
    expect(camadasDaSala('floresta', ['E', 'W'])!.map((c) => c.arquivo)).toEqual(['1_grama', '3_caminho_direita', '4_caminho_esquerda', '6_floresta_cima']);
  });

  it('as copas ficam por cima e o resto no chão', () => {
    const camadas = camadasDaSala('floresta', ['N', 'S', 'E', 'W'])!;
    expect(camadas.filter((c) => c.plano === 'cima').map((c) => c.arquivo)).toEqual(['6_floresta_cima']);
    expect(camadas).toHaveLength(CAMADAS_DAS_SALAS.floresta!.length);
  });

  it('a sala da Caverna leva o chão, a parede de trás, a passagem só das portas que tem e a parede da frente por cima', () => {
    expect(camadasDaSala('caverna', [])!.map((c) => c.arquivo)).toEqual(['1_caverna_chao', '2_caverna_atras', '7_caverna_frente']);
    expect(camadasDaSala('caverna', ['N', 'W'])!.map((c) => c.arquivo)).toEqual(['1_caverna_chao', '2_caverna_atras', '3_portal_acima', '5_portal_esquerda', '7_caverna_frente']);
    expect(camadasDaSala('caverna', ['N', 'E', 'S', 'W'])!.filter((c) => c.plano === 'cima').map((c) => c.arquivo)).toEqual(['7_caverna_frente']);
  });

  it('a sala da Torre leva o tapete das portas que tem e fecha o vão das que não tem; o arco de cima só com a porta de cima', () => {
    expect(camadasDaSala('torre', ['N', 'S'])!.map((c) => c.arquivo)).toEqual([
      '1_fundo_torre',
      '3_tapete_cima',
      '4_tapete_baixo',
      '8_frente_torre',
      '9_portal_frente',
      '10_close_esquerda',
      '11_close_direita',
    ]);
    expect(camadasDaSala('torre', ['W'])!.map((c) => c.arquivo)).toEqual(['1_fundo_torre', '5_tapete_esquerda', '6_close_cima', '8_frente_torre', '11_close_direita']);
  });
});

describe('as paredes de dentro da sala', () => {
  it('a Caverna fecha os quatro cantos de dentro; a Floresta e fora da masmorra, nenhum', () => {
    expect(paredesDaSala('caverna')).toEqual([
      { col: 1, row: 1 },
      { col: 7, row: 1 },
      { col: 1, row: 7 },
      { col: 7, row: 7 },
    ]);
    expect(paredesDaSala('floresta')).toEqual([]);
    expect(paredesDaSala(null)).toEqual([]);
  });

  it('nenhuma parede cai num vão de porta, no conteúdo ou na chegada pelas portas', () => {
    const paredes = paredesDaSala('caverna');
    const proibidas = [...Object.values(DOOR_TILE), CONTENT_TILE, { col: 4, row: 1 }, { col: 4, row: 7 }, { col: 1, row: 4 }, { col: 7, row: 4 }];
    for (const casa of proibidas) expect(paredes.some((p) => p.col === casa.col && p.row === casa.row)).toBe(false);
  });

  it('na planta, a casa da parede fica sólida', () => {
    const planta = roomLayout({ N: true }, [], paredesDaSala('caverna'));
    expect(planta.solid[1]![1]).toBe(true);
    expect(planta.solid[7]![7]).toBe(true);
    expect(planta.solid[2]![1]).toBe(false);
    expect(roomLayout({ N: true }, []).solid[1]![1]).toBe(false);
  });

  it('as tochas da Caverna são enfeite (anda-se nelas); fora dela, nenhum', () => {
    expect(enfeitesDaSala('caverna')).toEqual([
      { col: 2, row: 1 },
      { col: 6, row: 1 },
      { col: 2, row: 6 },
      { col: 6, row: 6 },
    ]);
    expect(enfeitesDaSala('floresta')).toEqual([]);
    expect(enfeitesDaSala(null)).toEqual([]);
    expect(roomLayout({}, [], paredesDaSala('caverna')).solid[1]![2]).toBe(false);
  });

  it('os cantos de baixo dos extras (linha 6) ficam livres na Caverna', () => {
    const paredes = paredesDaSala('caverna');
    const deBaixo = EXTRA_TILES.filter((t) => t.row > CONTENT_TILE.row);
    for (const casa of deBaixo) expect(paredes.some((p) => p.col === casa.col && p.row === casa.row)).toBe(false);
  });
});

describe('a camada de cima que cobre o herói', () => {
  const camada = (dungeon: 'floresta' | 'caverna' | 'torre', arquivo: string): CamadaDaSala => CAMADAS_DAS_SALAS[dungeon]!.find((c) => c.arquivo === arquivo)!;
  const naCasa = (col: number, row: number) => ({ x: col * TILE_UNITS + TILE_UNITS / 2, y: row * TILE_UNITS + TILE_UNITS / 2 });
  const copa = camada('floresta', '6_floresta_cima');

  it('toda camada de cima tem a cobertura medida, do tamanho da sala', () => {
    for (const dungeon of ['floresta', 'caverna', 'torre'] as const) {
      const { cols, rows } = geometriaDaSala(dungeon);
      for (const c of CAMADAS_DAS_SALAS[dungeon]!.filter((c) => c.plano === 'cima')) {
        expect(c.cobre).toHaveLength(rows);
        for (const linha of c.cobre!) expect(linha).toMatch(new RegExp(`^[.#]{${cols}}$`));
      }
    }
  });

  it('as copas da Floresta cobrem quem está no vão de uma porta, e não quem está dentro da sala', () => {
    expect(cobreOHeroiNaSala(copa, naCasa(0, 4))).toBe(true);
    expect(cobreOHeroiNaSala(copa, naCasa(8, 4))).toBe(true);
    expect(cobreOHeroiNaSala(copa, naCasa(4, 8))).toBe(true);
    expect(cobreOHeroiNaSala(copa, naCasa(4, 4))).toBe(false);
    expect(cobreOHeroiNaSala(copa, naCasa(4, 7))).toBe(false);
    for (const lado of ['N', 'S', 'E', 'W'] as const) expect(cobreOHeroiNaSala(copa, roomArrival(lado))).toBe(false);
  });

  it('o herói já na sala vizinha, além da borda, não conta pra esta', () => {
    expect(cobreOHeroiNaSala(copa, naCasa(-1, 4))).toBe(false);
    expect(cobreOHeroiNaSala(copa, naCasa(9, 4))).toBe(false);
  });

  it('a parede da frente da Caverna cobre o pé de quem anda junto dela; os pilares da Torre, quem passa atrás', () => {
    const frente = camada('caverna', '7_caverna_frente');
    expect(cobreOHeroiNaSala(frente, naCasa(2, 7))).toBe(true);
    expect(cobreOHeroiNaSala(frente, naCasa(4, 7))).toBe(false);
    const torre = camada('torre', '8_frente_torre');
    expect(cobreOHeroiNaSala(torre, naCasa(1, 3))).toBe(true);
    expect(cobreOHeroiNaSala(torre, naCasa(2, 3))).toBe(false);
    expect(cobreOHeroiNaSala(torre, naCasa(5, 11))).toBe(true);
  });

  it('o chão nunca cobre, nem a camada sem a cobertura medida', () => {
    expect(cobreOHeroiNaSala(camada('floresta', '1_grama'), naCasa(0, 4))).toBe(false);
    expect(cobreOHeroiNaSala({ arquivo: 'nova', plano: 'cima' }, naCasa(0, 4))).toBe(false);
  });
});
