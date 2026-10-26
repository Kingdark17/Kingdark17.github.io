import { describe, expect, it } from 'vitest';

import { CAMADAS_DAS_SALAS, camadasDaSala, enfeitesDaSala, paredesDaSala } from './arte-da-sala.js';
import { EXTRA_TILES } from './extras.js';
import { CONTENT_TILE, DOOR_TILE, roomLayout } from './room-walk.js';

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

  it('masmorra sem arte fica com os quadradinhos', () => {
    expect(camadasDaSala('torre', [])).toBeNull();
    expect(camadasDaSala('torre', ['N'])).toBeNull();
  });
});

describe('as paredes de dentro da sala', () => {
  it('a Caverna fecha os quatro cantos de dentro; a Floresta, a Torre e fora da masmorra, nenhum', () => {
    expect(paredesDaSala('caverna')).toEqual([
      { col: 1, row: 1 },
      { col: 7, row: 1 },
      { col: 1, row: 7 },
      { col: 7, row: 7 },
    ]);
    expect(paredesDaSala('floresta')).toEqual([]);
    expect(paredesDaSala('torre')).toEqual([]);
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
