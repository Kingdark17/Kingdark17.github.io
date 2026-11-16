import { describe, expect, it } from 'vitest';

import type { DungeonCell } from '../dungeon/generate.js';
import { TILE_UNITS, type Walker } from '../dungeon/room-walk.js';
import type { Hero } from '../hero/hero.js';
import { instantiate } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import type { MonsterInstance } from '../monsters/generate.js';
import { seededRng, type Rng } from '../rng.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from '../jogo/estado.js';
import { saveSorteado } from '../jogo/heroi-sorteado.js';
import { DURACAO_DA_BARRA } from './eventos-de-arma.js';
import { abrirLuta, espelhoDaLuta, passoDaLuta, type Acontecimento, type EntradaDaLuta, type LutaEmTempoReal } from './arena.js';

/**
 * A luta em dupla (o co-op do app): o anfitrião cuida dos monstros, cada um
 * do próprio herói, e quem cai vira fantasma.
 */

const T = TILE_UNITS;
const PARADO: EntradaDaLuta = { x: 0, y: 0 };
const AGORA = () => 1_700_000_000_000;

function monstro(overrides: Partial<MonsterInstance> = {}): MonsterInstance {
  return { speciesId: 'zumbi', enemyClassId: 'brutamontes', floor: 2, hp: 60, maxHp: 60, dmg: 4, speed: 5, xp: 12, gold: 7, isBoss: false, ...overrides };
}

function naSala(sala: Partial<DungeonCell> = {}, hero: Partial<Hero> = {}, nome = 'Aria'): EstadoNaMasmorra {
  const save = saveSorteado(nome, seededRng(11), seededRng(11));
  const base = retomarSave({ ...save, floor: 2, mapMode: 'dungeon' }, seededRng(11));
  if (base.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
  const celula = base.map.flat().find((c) => c.type === 'monster')!;
  const posicionado: EstadoNaMasmorra = {
    ...base,
    pos: { x: celula.x, y: celula.y },
    party: [],
    hero: { ...base.hero, className: 'Monge', classId: 'monge', hp: 999, maxHp: 999, ...hero },
  };
  return substituirCelulaAtual(posicionado, { ...celula, monsters: [monstro()], monsterIndex: 0, beaten: false, bonusTreasure: undefined, ...sala });
}

/** Com a espada na mão (o evento dela é a barra). */
function comEspada(base: EstadoNaMasmorra): EstadoNaMasmorra {
  const espada = { ...instantiate(templateById('espada')!, RARITIES[0]!), equipped: true };
  return { ...base, hero: { ...base.hero, equip: { ...base.hero.equip, arma: espada } } };
}

/** Aperta o ataque e toca no meio da barra, sem parar. */
function batendo(l: LutaEmTempoReal): EntradaDaLuta {
  if (!l.arena.evento) return { x: 0, y: 0, atacar: true };
  return l.arena.evento.passo === DURACAO_DA_BARRA / 2 - 1 ? { x: 0, y: 0, tocar: true } : PARADO;
}

function vida(l: LutaEmTempoReal, indice = 0): number {
  return ((celulaAtual(l.estado) as DungeonCell).monsters ?? [])[indice]!.hp;
}

/** Os dois lados de uma dupla na mesma sala: o herói do anfitrião embaixo, o do convidado em cima. */
function dupla(sala: Partial<DungeonCell> = {}, doConvidado: Partial<Hero> = {}) {
  const embaixo: Walker = { x: 4.5 * T, y: 7.5 * T, facing: 'N' };
  const emCima: Walker = { x: 4.5 * T, y: 1.5 * T, facing: 'S' };
  const anfitriao = abrirLuta(naSala(sala), embaixo, null, true, 'anfitriao').luta;
  const convidado = abrirLuta(comEspada(naSala(sala, doConvidado, 'Bree')), emCima, null, true, 'convidado').luta;
  return { anfitriao, convidado };
}

/**
 * Roda os dois lados juntos, como a rede faria: a cada passo cada um diz ao
 * outro onde está; a cada 6, o anfitrião manda o espelho; e o dano do
 * convidado chega no passo seguinte.
 */
function rodarDupla(
  inicio: { anfitriao: LutaEmTempoReal; convidado: LutaEmTempoReal },
  passos: number,
  rngs: { a: Rng; c: Rng },
  entradas: { a?: (i: number) => EntradaDaLuta; c?: (i: number, l: LutaEmTempoReal) => EntradaDaLuta } = {},
) {
  let a = inicio.anfitriao;
  let c = inicio.convidado;
  let danos: { indice: number; dano: number }[] = [];
  const doA: Acontecimento[] = [];
  const doC: Acontecimento[] = [];
  for (let i = 0; i < passos && !(a.fim && c.fim); i++) {
    const quadroA = passoDaLuta(
      a,
      { ...(entradas.a?.(i) ?? PARADO), parceiro: { x: c.arena.heroi.x, y: c.arena.heroi.y, caido: !!c.arena.dupla?.fantasma }, danoDeFora: danos },
      rngs.a,
      AGORA,
    );
    a = quadroA.luta;
    doA.push(...quadroA.acontecimentos);
    const quadroC = passoDaLuta(
      c,
      {
        ...(entradas.c?.(i, c) ?? PARADO),
        parceiro: { x: a.arena.heroi.x, y: a.arena.heroi.y, caido: !!a.arena.dupla?.fantasma },
        ...(i % 6 === 0 || a.fim ? { espelho: espelhoDaLuta(a) } : {}),
      },
      rngs.c,
      AGORA,
    );
    c = quadroC.luta;
    doC.push(...quadroC.acontecimentos);
    danos = quadroC.danos ?? [];
  }
  return { anfitriao: a, convidado: c, doA, doC };
}

describe('luta em dupla: o anfitrião', () => {
  it('o monstro vai atrás do herói de pé mais perto, que pode ser o parceiro', () => {
    const { anfitriao } = dupla();
    // O parceiro colado no monstro, o herói daqui longe.
    const perto = { x: 4.5 * T, y: 3.5 * T };
    let atual = anfitriao;
    for (let i = 0; i < 400 && atual.arena.monstros[0]!.fase === 'esperando'; i++) atual = passoDaLuta(atual, { ...PARADO, parceiro: perto }, seededRng(3), AGORA).luta;
    const m = atual.arena.monstros[0]!;
    expect(m.fase).toBe('avisando');
    expect(m.noParceiro).toBe(true);
    // O golpe de perto mira onde o parceiro está, e não o herói daqui.
    expect({ x: m.x, y: m.y }).toEqual(perto);
  });

  it('o golpe que cai no parceiro não fere o herói daqui nem diz que errou', () => {
    const { anfitriao } = dupla();
    const perto = { x: 4.5 * T, y: 3.5 * T };
    let atual = anfitriao;
    const tudo: Acontecimento[] = [];
    for (let i = 0; i < 600; i++) {
      const quadro = passoDaLuta(atual, { ...PARADO, parceiro: perto }, seededRng(3), AGORA);
      atual = quadro.luta;
      tudo.push(...quadro.acontecimentos);
    }
    expect(atual.estado.hero.hp).toBe(999);
    expect(tudo.some((a) => a.texto === 'Errou')).toBe(false);
  });

  it('o dano do parceiro fere o monstro e, derrubando o último, vence a sala', () => {
    const { anfitriao } = dupla();
    const ferido = passoDaLuta(anfitriao, { ...PARADO, danoDeFora: [{ indice: 0, dano: 25 }] }, seededRng(3), AGORA);
    expect(vida(ferido.luta)).toBe(35);
    expect(ferido.acontecimentos.some((a) => a.onde === 'monstro' && a.texto === '-25')).toBe(true);

    const fim = passoDaLuta(ferido.luta, { ...PARADO, danoDeFora: [{ indice: 0, dano: 500 }] }, seededRng(3), AGORA);
    expect(fim.luta.fim).toBe('vitoria');
  });

  it('dano de fora num monstro que não existe ou já caiu não faz nada', () => {
    const { anfitriao } = dupla();
    const depois = passoDaLuta(anfitriao, { ...PARADO, danoDeFora: [{ indice: 7, dano: 25 }, { indice: 0, dano: -4 }] }, seededRng(3), AGORA);
    expect(vida(depois.luta)).toBe(60);
  });
});

describe('luta em dupla: o convidado (o espelho)', () => {
  it('sozinho, o monstro do espelho não anda nem golpeia', () => {
    const { convidado } = dupla();
    let atual = convidado;
    const antes = { ...atual.arena.monstros[0]! };
    for (let i = 0; i < 400; i++) atual = passoDaLuta(atual, PARADO, seededRng(3), AGORA).luta;
    expect(atual.arena.monstros[0]).toEqual(antes);
    expect(atual.estado.hero.hp).toBe(999);
  });

  it('o golpe do herói daqui não derruba: a vida para em 1 e o dano sai pra mandar', () => {
    const colado: Walker = { x: 4.5 * T, y: 5.5 * T, facing: 'N' };
    const convidado = abrirLuta(comEspada(naSala({ monsters: [monstro({ hp: 3, maxHp: 3 })] })), colado, null, true, 'convidado').luta;
    let atual = convidado;
    const danos: { indice: number; dano: number }[] = [];
    const rng = seededRng(5);
    for (let i = 0; i < 600 && danos.length === 0; i++) {
      const quadro = passoDaLuta(atual, batendo(atual), rng, AGORA);
      atual = quadro.luta;
      danos.push(...(quadro.danos ?? []));
    }
    expect(danos.length).toBeGreaterThan(0);
    expect(danos[0]!.indice).toBe(0);
    expect(danos[0]!.dano).toBeGreaterThan(0);
    expect(vida(atual)).toBe(1);
    expect(atual.fim).toBeNull();
    expect(atual.arena.monstros[0]!.fase).not.toBe('caido');
  });

  it('a queda que chega no espelho paga o abate e vence a sala aqui também', () => {
    const { anfitriao, convidado } = dupla();
    const xpAntes = convidado.estado.hero.xp;
    const morto = passoDaLuta(anfitriao, { ...PARADO, danoDeFora: [{ indice: 0, dano: 500 }] }, seededRng(3), AGORA).luta;
    expect(morto.fim).toBe('vitoria');
    // O anfitrião venceu antes de montar o espelho: a vida zerada vai escrita à mão, como a tela faz no último quadro.
    const espelho = espelhoDaLuta(anfitriao);
    espelho.monstros[0]!.hp = 0;
    const fim = passoDaLuta(convidado, { ...PARADO, espelho }, seededRng(4), AGORA);
    expect(fim.luta.fim).toBe('vitoria');
    expect(fim.luta.estado.hero.xp + fim.luta.estado.hero.level * 1000).toBeGreaterThan(xpAntes + convidado.estado.hero.level * 1000);
  });

  it('o lacaio que o espelho não tinha entra com o monstro inteiro', () => {
    const { anfitriao, convidado } = dupla();
    const espelho = espelhoDaLuta(anfitriao);
    const lacaio = monstro({ speciesId: 'goblin', hp: 20, maxHp: 20 });
    espelho.monstros.push({ ...espelho.monstros[0]!, indice: 1, corpoX: 2.5 * T, corpoY: 2.5 * T, hp: 20, monstro: lacaio });
    const depois = passoDaLuta(convidado, { ...PARADO, espelho }, seededRng(4), AGORA).luta;
    expect(depois.arena.monstros).toHaveLength(2);
    expect(vida(depois, 1)).toBe(20);
    expect(depois.arena.monstros[1]!.corpoX).toBe(2.5 * T);
    // Sem o monstro inteiro, um índice novo é ignorado.
    const semEle = espelhoDaLuta(anfitriao);
    semEle.monstros.push({ ...semEle.monstros[0]!, indice: 1, hp: 20 });
    expect(passoDaLuta(convidado, { ...PARADO, espelho: semEle }, seededRng(4), AGORA).luta.arena.monstros).toHaveLength(1);
  });
});

describe('luta em dupla: os dois lados juntos', () => {
  it('o monstro que vai no convidado o fere no app dele, e só nele', () => {
    // O convidado colado no monstro; o anfitrião longe.
    const sala = { monsters: [monstro({ hp: 900, maxHp: 900 })] };
    const base = dupla(sala);
    const convidado = { ...base.convidado, arena: { ...base.convidado.arena, heroi: { x: 4.5 * T, y: 3.5 * T, facing: 'S' as const } } };
    const fim = rodarDupla({ anfitriao: base.anfitriao, convidado }, 900, { a: seededRng(7), c: seededRng(8) });
    expect(fim.convidado.estado.hero.hp).toBeLessThan(999);
    expect(fim.anfitriao.estado.hero.hp).toBe(999);
    expect(fim.doC.some((a) => a.onde === 'heroi' && a.tom === 'dano')).toBe(true);
  });

  it('o convidado bate, o anfitrião derruba, e os dois vencem', () => {
    const sala = { monsters: [monstro({ hp: 30, maxHp: 30, dmg: 1 })] };
    const base = dupla(sala);
    const convidado = { ...base.convidado, arena: { ...base.convidado.arena, heroi: { x: 4.5 * T, y: 3.5 * T, facing: 'S' as const } } };
    const fim = rodarDupla({ anfitriao: base.anfitriao, convidado }, 3000, { a: seededRng(7), c: seededRng(8) }, { c: (_i, l) => batendo(l) });
    expect(fim.anfitriao.fim).toBe('vitoria');
    expect(fim.convidado.fim).toBe('vitoria');
  });
});

describe('luta em dupla: o fantasma', () => {
  const fraco = { hp: 1, maxHp: 999 };

  it('quem cai vira fantasma e a luta segue; os monstros passam a ir no outro', () => {
    const sala = { monsters: [monstro({ hp: 900, maxHp: 900, dmg: 50 })] };
    const base = dupla(sala, fraco);
    const convidado = { ...base.convidado, arena: { ...base.convidado.arena, heroi: { x: 4.5 * T, y: 3.5 * T, facing: 'S' as const } } };
    let fim = rodarDupla({ anfitriao: base.anfitriao, convidado }, 900, { a: seededRng(7), c: seededRng(8) });
    expect(fim.convidado.arena.dupla?.fantasma).toBe(true);
    expect(fim.convidado.fim).toBeNull();
    expect(fim.convidado.estado.hero.hp).toBe(0);
    expect(fim.doC.some((a) => a.tipo === 'aviso' && a.texto?.includes('Você caiu'))).toBe(true);

    // O fantasma não apanha mais nem ataca; o monstro vira pro anfitrião.
    fim = rodarDupla(fim, 600, { a: seededRng(9), c: seededRng(10) }, { c: () => ({ x: 0, y: 0, atacar: true }) });
    expect(fim.convidado.arena.evento).toBeNull();
    expect(fim.anfitriao.arena.monstros[0]!.noParceiro).toBeUndefined();
    expect(fim.anfitriao.estado.hero.hp).toBeLessThan(999);
  });

  it('com os dois caídos, é derrota', () => {
    const { convidado } = dupla({}, fraco);
    const fantasma: LutaEmTempoReal = { ...convidado, estado: { ...convidado.estado, hero: { ...convidado.estado.hero, hp: 0 } }, arena: { ...convidado.arena, dupla: { papel: 'convidado', fantasma: true } } };
    const fim = passoDaLuta(fantasma, { ...PARADO, parceiro: { x: 0, y: 0, caido: true } }, seededRng(3), AGORA);
    expect(fim.luta.fim).toBe('derrota');
  });

  it('o parceiro saiu: o fantasma perde; quem estava de pé segue sozinho', () => {
    const { anfitriao, convidado } = dupla({}, fraco);
    const fantasma: LutaEmTempoReal = { ...convidado, arena: { ...convidado.arena, dupla: { papel: 'convidado', fantasma: true } } };
    expect(passoDaLuta(fantasma, { ...PARADO, semParceiro: true }, seededRng(3), AGORA).luta.fim).toBe('derrota');

    const sozinho = passoDaLuta(anfitriao, { ...PARADO, semParceiro: true }, seededRng(3), AGORA).luta;
    expect(sozinho.fim).toBeNull();
    expect(sozinho.arena.dupla).toBeUndefined();
  });

  it('quem abre a luta já caído entra como fantasma', () => {
    const luta = abrirLuta(naSala({}, { hp: 0 }), { x: 4.5 * T, y: 7.5 * T, facing: 'N' }, null, true, 'anfitriao').luta;
    expect(luta.arena.dupla?.fantasma).toBe(true);
  });

  it('sozinho, cair continua sendo a derrota de sempre', () => {
    const sala = { monsters: [monstro({ hp: 900, maxHp: 900, dmg: 50 })] };
    let atual = abrirLuta(naSala(sala, fraco), { x: 4.5 * T, y: 5.5 * T, facing: 'N' }, null, true).luta;
    const rng = seededRng(7);
    for (let i = 0; i < 900 && !atual.fim; i++) atual = passoDaLuta(atual, PARADO, rng, AGORA).luta;
    expect(atual.fim).toBe('derrota');
  });
});
