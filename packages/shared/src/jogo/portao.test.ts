import { describe, expect, it } from 'vitest';

import { markCleared, touchTotem, type DifficultyId, type DungeonProgress } from '../dungeon/dungeons.js';
import { seededRng } from '../rng.js';
import { entrarNaCidade, type EstadoNaCidade } from './estado.js';
import { saveSorteado } from './heroi-sorteado.js';
import { abrirPortao, andares, dificuldadeDoPortao, entrar, escolherAndar, escolherMasmorra, masmorras } from './portao.js';

function cidade(nivel = 1, progresso?: DungeonProgress, dificuldade: DifficultyId = 'normal'): EstadoNaCidade {
  const save = saveSorteado('Aria', seededRng(4));
  const base = entrarNaCidade({ ...save, hero: { ...save.hero, level: nivel }, dificuldade });
  return progresso ? { ...base, progresso } : base;
}

const FLORESTA = { dungeon: 'floresta', difficulty: 'normal' } as const;

describe('abrir o portão', () => {
  it('quem nunca desceu começa na Floresta Normal, pelo andar 1', () => {
    const portao = abrirPortao(cidade());
    expect(portao.escolha).toEqual(FLORESTA);
    expect(portao.andar).toBe(1);
  });

  it('abre no totem mais fundo da última masmorra', () => {
    const progresso = touchTotem(touchTotem({ cleared: [], totems: {} }, FLORESTA, 20), FLORESTA, 40);
    expect(abrirPortao(cidade(1, progresso)).andar).toBe(40);
  });

  it('se a última masmorra fechou (save editado, nível baixo), volta pra Floresta Normal', () => {
    const naTorre: EstadoNaCidade = { ...cidade(1), masmorra: { dungeon: 'torre', difficulty: 'pesadelo' } };
    expect(abrirPortao(naTorre).escolha).toEqual(FLORESTA);
  });
});

describe('o que o portão mostra', () => {
  it('Caverna e Torre aparecem fechadas, com o que falta', () => {
    expect(masmorras(abrirPortao(cidade(1))).map((m) => [m.id, m.falta])).toEqual([
      ['floresta', null],
      ['caverna', 'Nível 70'],
      ['torre', 'Nível 140'],
    ]);
  });

  it('com o nível mas sem a Floresta zerada, diz o que zerar', () => {
    expect(masmorras(abrirPortao(cidade(80))).find((m) => m.id === 'caverna')?.falta).toBe('Zere a Floresta');
  });

  it('mostra a dificuldade do personagem, que não se escolhe ali', () => {
    expect(dificuldadeDoPortao(abrirPortao(cidade())).name).toBe('Normal');
    const pesadelo = abrirPortao(cidade(1, undefined, 'pesadelo'));
    expect(dificuldadeDoPortao(pesadelo).name).toBe('Pesadelo');
    expect(pesadelo.escolha).toEqual({ dungeon: 'floresta', difficulty: 'pesadelo' });
  });
});

describe('escolher', () => {
  it('masmorra fechada não é escolhida', () => {
    const portao = abrirPortao(cidade(1));
    expect(escolherMasmorra(portao, 'caverna')).toBe(portao);
  });

  it('trocar de masmorra fica na dificuldade do personagem', () => {
    const portao = escolherMasmorra(abrirPortao(cidade(80, markCleared({ cleared: [], totems: {} }, FLORESTA))), 'caverna');
    expect(portao.escolha).toEqual({ dungeon: 'caverna', difficulty: 'normal' });
  });

  it('no Pesadelo, a Caverna pede a Floresta zerada no Pesadelo', () => {
    const soNormal = abrirPortao(cidade(80, markCleared({ cleared: [], totems: {} }, FLORESTA), 'pesadelo'));
    expect(masmorras(soNormal).find((m) => m.id === 'caverna')?.falta).toBe('Zere a Floresta');
    const zerada = abrirPortao(cidade(80, markCleared({ cleared: [], totems: {} }, { dungeon: 'floresta', difficulty: 'pesadelo' }), 'pesadelo'));
    expect(masmorras(zerada).find((m) => m.id === 'caverna')?.falta).toBeNull();
  });

  it('só os andares de entrada podem ser escolhidos, e cada dificuldade tem os seus totens', () => {
    const progresso = markCleared(touchTotem({ cleared: [], totems: {} }, FLORESTA, 20), FLORESTA);
    const portao = abrirPortao(cidade(1, progresso));

    expect(andares(portao)).toEqual([1, 20]);
    expect(escolherAndar(portao, 33)).toBe(portao);
    expect(escolherAndar(portao, 1).andar).toBe(1);
    // Os totens do Normal não valem pra quem joga no Difícil.
    expect(andares(abrirPortao(cidade(1, progresso, 'dificil')))).toEqual([1]);
  });
});

describe('entrar', () => {
  it('desce na masmorra, dificuldade e andar escolhidos', () => {
    const progresso = touchTotem({ cleared: [], totems: {} }, FLORESTA, 20);
    const entrada = entrar(abrirPortao(cidade(1, progresso)), seededRng(2));

    expect(entrada?.estado.mapMode).toBe('dungeon');
    expect(entrada?.estado.floor).toBe(20);
    expect(entrada?.estado.masmorra).toEqual(FLORESTA);
    expect(entrada?.texto).toBe('Você atravessa o portão: Floresta · Normal. Andar 20, pelo totem.');
  });

  it('não entra se a escolha estiver fechada', () => {
    const portao = { ...abrirPortao(cidade(1)), escolha: { dungeon: 'torre', difficulty: 'normal' } as const };
    expect(entrar(portao, seededRng(2))).toBeNull();
  });
});
