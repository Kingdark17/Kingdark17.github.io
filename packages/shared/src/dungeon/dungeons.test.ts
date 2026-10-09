import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RUN,
  effectiveFloor,
  emptyProgress,
  entryFloors,
  isCleared,
  legacyProgress,
  lockReason,
  markCleared,
  normalizeProgress,
  normalizeRun,
  runName,
  tierOf,
  touchTotem,
  type DungeonRun,
} from './dungeons.js';

const FLORESTA: DungeonRun = { dungeon: 'floresta', difficulty: 'normal' };
const FLORESTA_DIFICIL: DungeonRun = { dungeon: 'floresta', difficulty: 'dificil' };
const FLORESTA_PESADELO: DungeonRun = { dungeon: 'floresta', difficulty: 'pesadelo' };
const CAVERNA: DungeonRun = { dungeon: 'caverna', difficulty: 'normal' };
const CAVERNA_PESADELO: DungeonRun = { dungeon: 'caverna', difficulty: 'pesadelo' };
const TORRE: DungeonRun = { dungeon: 'torre', difficulty: 'normal' };
const TORRE_PESADELO: DungeonRun = { dungeon: 'torre', difficulty: 'pesadelo' };

describe('a escada de força', () => {
  it('cada dificuldade é um degrau, e o Pesadelo de uma é o Normal da seguinte', () => {
    expect([FLORESTA, FLORESTA_DIFICIL, FLORESTA_PESADELO, CAVERNA, CAVERNA_PESADELO, TORRE, TORRE_PESADELO].map(tierOf)).toEqual([0, 1, 2, 2, 4, 4, 6]);
  });

  it('a regra do usuário: os 4 primeiros andares da Caverna Normal são a Floresta no Pesadelo, e os da Torre Normal são a Caverna no Pesadelo', () => {
    for (const andar of [1, 2, 3, 4]) {
      expect(effectiveFloor(FLORESTA_PESADELO, andar)).toBe(effectiveFloor(CAVERNA, andar));
      expect(effectiveFloor(CAVERNA_PESADELO, andar)).toBe(effectiveFloor(TORRE, andar));
    }
  });

  it('a Caverna começa na força do andar 15 de antes e a Torre na do 29', () => {
    expect(effectiveFloor(FLORESTA, 1)).toBe(1);
    expect(effectiveFloor(CAVERNA, 1)).toBe(15);
    expect(effectiveFloor(TORRE, 1)).toBe(29);
  });

  it('dentro da masmorra sobe um por andar, como sempre', () => {
    expect(effectiveFloor(CAVERNA, 30) - effectiveFloor(CAVERNA, 29)).toBe(1);
  });
});

describe('o que está aberto', () => {
  it('a Floresta Normal abre pra qualquer um', () => {
    expect(lockReason(emptyProgress(), 1, FLORESTA)).toBeNull();
  });

  it('a Caverna pede nível 15 antes de tudo', () => {
    expect(lockReason(emptyProgress(), 14, CAVERNA)).toEqual({ kind: 'level', minLevel: 15 });
  });

  it('com o nível, a Caverna ainda pede a Floresta zerada no Normal', () => {
    expect(lockReason(emptyProgress(), 40, CAVERNA)).toEqual({ kind: 'previous_dungeon', dungeon: 'floresta' });
    expect(lockReason(markCleared(emptyProgress(), FLORESTA), 40, CAVERNA)).toBeNull();
  });

  it('zerar a Floresta no Difícil sem o Normal não abre a Caverna', () => {
    expect(lockReason(markCleared(emptyProgress(), FLORESTA_DIFICIL), 40, CAVERNA)?.kind).toBe('previous_dungeon');
  });

  it('o Difícil pede o Normal zerado, e o Pesadelo pede o Difícil', () => {
    expect(lockReason(emptyProgress(), 1, FLORESTA_DIFICIL)).toEqual({ kind: 'previous_difficulty', difficulty: 'normal' });
    const normal = markCleared(emptyProgress(), FLORESTA);
    expect(lockReason(normal, 1, FLORESTA_DIFICIL)).toBeNull();
    expect(lockReason(normal, 1, FLORESTA_PESADELO)).toEqual({ kind: 'previous_difficulty', difficulty: 'dificil' });
  });

  it('a Torre pede nível 30 e a Caverna zerada', () => {
    const cavernaZerada = markCleared(markCleared(emptyProgress(), FLORESTA), CAVERNA);
    expect(lockReason(cavernaZerada, 29, TORRE)?.kind).toBe('level');
    expect(lockReason(cavernaZerada, 30, TORRE)).toBeNull();
  });
});

describe('totens', () => {
  it('sem totem, só se entra pelo andar 1', () => {
    expect(entryFloors(emptyProgress(), FLORESTA)).toEqual([1]);
  });

  it('cada totem tocado vira entrada, em ordem', () => {
    const tocado = touchTotem(touchTotem(emptyProgress(), FLORESTA, 40), FLORESTA, 20);
    expect(entryFloors(tocado, FLORESTA)).toEqual([1, 20, 40]);
  });

  it('vale só pra masmorra e dificuldade em que foi tocado', () => {
    const tocado = touchTotem(emptyProgress(), FLORESTA, 20);
    expect(entryFloors(tocado, FLORESTA_DIFICIL)).toEqual([1]);
    expect(entryFloors(tocado, CAVERNA)).toEqual([1]);
  });

  it('andar sem totem não marca nada, e tocar de novo devolve o mesmo progresso', () => {
    const vazio = emptyProgress();
    expect(touchTotem(vazio, FLORESTA, 21)).toBe(vazio);
    const tocado = touchTotem(vazio, FLORESTA, 20);
    expect(touchTotem(tocado, FLORESTA, 20)).toBe(tocado);
  });
});

describe('zerar', () => {
  it('marca uma vez só', () => {
    const zerado = markCleared(emptyProgress(), FLORESTA);
    expect(isCleared(zerado, FLORESTA)).toBe(true);
    expect(markCleared(zerado, FLORESTA)).toBe(zerado);
  });
});

describe('save', () => {
  it('masmorra desconhecida vira Floresta Normal', () => {
    expect(normalizeRun(undefined)).toEqual(DEFAULT_RUN);
    expect(normalizeRun({ dungeon: 'pantano', difficulty: 'pesadelo' })).toEqual({ dungeon: 'floresta', difficulty: 'pesadelo' });
    expect(normalizeRun({ dungeon: 'torre', difficulty: 7 })).toEqual({ dungeon: 'torre', difficulty: 'normal' });
  });

  it('o progresso só guarda chave e andar de totem de verdade', () => {
    expect(
      normalizeProgress({ cleared: ['floresta:normal', 'lua:normal', 3], totems: { 'floresta:normal': [40, 20, 20, 33, 'x'], 'lua:normal': [20] } }),
    ).toEqual({ cleared: ['floresta:normal'], totems: { 'floresta:normal': [20, 40] } });
    expect(normalizeProgress('lixo')).toEqual(emptyProgress());
  });

  it('quem estava no andar 37 da masmorra sem fim ganha o totem do 20', () => {
    expect(legacyProgress(37)).toEqual({ cleared: [], totems: { 'floresta:normal': [20] } });
    expect(legacyProgress(85).totems['floresta:normal']).toEqual([20, 40, 60, 80]);
    expect(legacyProgress(5)).toEqual(emptyProgress());
  });

  it('o nome junta masmorra e dificuldade', () => {
    expect(runName(CAVERNA_PESADELO)).toBe('Caverna · Pesadelo');
  });
});
