import { describe, expect, it } from 'vitest';

import { markCleared, touchTotem, type DungeonProgress } from '../dungeon/dungeons.js';
import { seededRng } from '../rng.js';
import { entrarNaCidade, type EstadoNaCidade } from './estado.js';
import { saveSorteado } from './heroi-sorteado.js';
import { abrirPortao, andares, dificuldades, entrar, escolherAndar, escolherDificuldade, escolherMasmorra, masmorras } from './portao.js';

function cidade(nivel = 1, progresso?: DungeonProgress): EstadoNaCidade {
  const save = saveSorteado('Aria', seededRng(4));
  const base = entrarNaCidade({ ...save, hero: { ...save.hero, level: nivel } });
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
    expect(masmorras(abrirPortao(cidade(80))).find((m) => m.id === 'caverna')?.falta).toBe('Zere a Floresta no Normal');
  });

  it('as dificuldades dizem qual zerar antes', () => {
    expect(dificuldades(abrirPortao(cidade())).map((d) => d.falta)).toEqual([null, 'Zere o Normal', 'Zere o Difícil']);
  });
});

describe('escolher', () => {
  it('masmorra fechada não é escolhida', () => {
    const portao = abrirPortao(cidade(1));
    expect(escolherMasmorra(portao, 'caverna')).toBe(portao);
  });

  it('trocar de masmorra leva a dificuldade mais alta aberta nela', () => {
    const progresso = markCleared(markCleared({ cleared: [], totems: {} }, FLORESTA), { dungeon: 'caverna', difficulty: 'normal' });
    const portao = escolherMasmorra(abrirPortao(cidade(80, progresso)), 'caverna');
    expect(portao.escolha).toEqual({ dungeon: 'caverna', difficulty: 'dificil' });
  });

  it('dificuldade fechada não é escolhida', () => {
    const portao = abrirPortao(cidade());
    expect(escolherDificuldade(portao, 'pesadelo')).toBe(portao);
  });

  it('só os andares de entrada podem ser escolhidos, e cada dificuldade tem os seus totens', () => {
    const progresso = markCleared(touchTotem({ cleared: [], totems: {} }, FLORESTA, 20), FLORESTA);
    const portao = abrirPortao(cidade(1, progresso));

    expect(andares(portao)).toEqual([1, 20]);
    expect(escolherAndar(portao, 33)).toBe(portao);
    expect(escolherAndar(portao, 1).andar).toBe(1);
    expect(andares(escolherDificuldade(portao, 'dificil'))).toEqual([1]);
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
