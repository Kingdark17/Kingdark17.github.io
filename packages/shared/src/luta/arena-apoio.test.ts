import { describe, expect, it } from 'vitest';

import type { DungeonCell } from '../dungeon/generate.js';
import { TILE_UNITS, type Walker } from '../dungeon/room-walk.js';
import type { Hero } from '../hero/hero.js';
import { REGRAS_DO_ARQUEIRO, REGRAS_DO_BARDO, REGRAS_DO_CLERIGO, REGRAS_DO_DRUIDA } from '../hero/classes-de-luta.js';
import { instantiate } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import type { CombatMonster } from '../combat/monster-state.js';
import type { MonsterInstance } from '../monsters/generate.js';
import { seededRng, type Rng } from '../rng.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from '../jogo/estado.js';
import { saveSorteado } from '../jogo/heroi-sorteado.js';
import {
  abrirLuta,
  danoLevadoNaJanela,
  extrasDaLuta,
  memoriaDaLuta,
  passoDaLuta,
  RECARGA_DO_ATAQUE,
  type Acontecimento,
  type ApoioDoParceiro,
  type EntradaDaLuta,
  type LutaEmTempoReal,
} from './arena.js';
import { DURACAO_DA_BARRA } from './eventos-de-arma.js';

// As classes de longe e de apoio refeitas pelo doc do Breno na luta do app (rodada 3b, 2026-11-17).

function monstro(overrides: Partial<MonsterInstance> = {}): MonsterInstance {
  return { speciesId: 'zumbi', enemyClassId: 'brutamontes', floor: 2, hp: 4000, maxHp: 4000, dmg: 3, speed: 5, xp: 12, gold: 7, isBoss: false, ...overrides };
}

function arma(id: string) {
  return { ...instantiate(templateById(id)!, RARITIES[0]!), equipped: true };
}

/** Uma sala de monstro montada à mão, com um herói da classe pedida (de espada: o evento é a barra) e vida de sobra. */
function naSala(classId: string, className: string, monsters: MonsterInstance[], hero: Partial<Hero> = {}): EstadoNaMasmorra {
  const save = saveSorteado('Aria', seededRng(11), seededRng(11));
  const base = retomarSave({ ...save, floor: 2, mapMode: 'dungeon' }, seededRng(11));
  if (base.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
  const celula = base.map.flat().find((c) => c.type === 'monster')!;
  const posicionado: EstadoNaMasmorra = {
    ...base,
    pos: { x: celula.x, y: celula.y },
    party: [],
    hero: { ...base.hero, className, classId, hp: 999, maxHp: 999, mp: 50, maxMp: 50, level: 1, gold: 100, buffs: {}, equip: { ...base.hero.equip, arma: arma('espada') }, ...hero },
  };
  return substituirCelulaAtual(posicionado, { ...celula, monsters, monsterIndex: 0, beaten: false, bonusTreasure: undefined });
}

const PARADO: EntradaDaLuta = { x: 0, y: 0 };
const T = TILE_UNITS;
const NUNCA: Rng = () => 0.99;
const AGORA = () => 1_700_000_000_000;

interface Rodada {
  luta: LutaEmTempoReal;
  acontecimentos: Acontecimento[];
  apoios: ApoioDoParceiro[];
  moral?: number;
}

function rodar(luta: LutaEmTempoReal, passos: number, rng: Rng, entrada: (i: number) => EntradaDaLuta = () => PARADO): Rodada {
  let atual = luta;
  const tudo: Acontecimento[] = [];
  const apoios: ApoioDoParceiro[] = [];
  let moral: number | undefined;
  for (let i = 0; i < passos && !atual.fim; i++) {
    const quadro = passoDaLuta(atual, entrada(i), rng, AGORA);
    atual = quadro.luta;
    tudo.push(...quadro.acontecimentos);
    apoios.push(...(quadro.apoios ?? []));
    if (quadro.moral !== undefined) moral = quadro.moral;
  }
  return { luta: atual, acontecimentos: tudo, apoios, ...(moral !== undefined ? { moral } : {}) };
}

/** Um golpe com o toque no meio da barra (crita); depois espera a recarga. */
function golpeNoMeio(luta: LutaEmTempoReal, entrada: Partial<EntradaDaLuta> = {}, rng: Rng = NUNCA): Rodada {
  const aberto = passoDaLuta(luta, { ...PARADO, ...entrada, atacar: true }, rng, AGORA);
  const meio = DURACAO_DA_BARRA / 2;
  const fim = rodar(aberto.luta, meio + RECARGA_DO_ATAQUE, rng, (i) => (i === meio - 1 ? { ...PARADO, tocar: true } : PARADO));
  return {
    luta: fim.luta,
    acontecimentos: [...aberto.acontecimentos, ...fim.acontecimentos],
    apoios: [...(aberto.apoios ?? []), ...fim.apoios],
    ...(fim.moral !== undefined ? { moral: fim.moral } : {}),
  };
}

function vidaDoMonstro(luta: LutaEmTempoReal, indice = 0): number {
  return ((celulaAtual(luta.estado) as DungeonCell).monsters ?? [])[indice]!.hp;
}

function heroi(luta: LutaEmTempoReal): Hero {
  return luta.estado.hero;
}

function avisos(r: Rodada): string[] {
  return r.acontecimentos.filter((a) => a.tipo === 'aviso' && a.texto).map((a) => a.texto as string);
}

/** O herói uma casa abaixo do meio da sala (onde o monstro sozinho fica). */
const PERTO: Walker = { x: 4.5 * T, y: 5.5 * T, facing: 'N' };
/** O monstro sozinho fica no meio da sala. */
const MEIO = { x: 4.5 * T, y: 4.5 * T };
/** No canto de baixo à esquerda: longe do monstro do meio (4 blocos). */
const CANTO: Walker = { x: 1.5 * T, y: 7.5 * T, facing: 'N' };

describe('o Arqueiro', () => {
  it('de perto bate 30% menos; de longe, parado há 3 s, ganha 12% por bloco', () => {
    const sala = naSala('arqueiro', 'Arqueiro', [monstro({ speciesId: 'goblin' })]);
    const dano = (onde: Walker, parado: number) => {
      const luta = abrirLuta(sala, onde).luta;
      const pronto = { ...luta, arena: { ...luta.arena, classe: { parado } } };
      return 4000 - vidaDoMonstro(golpeNoMeio(pronto, { cursor: MEIO }).luta);
    };
    const pertoParado = dano(PERTO, REGRAS_DO_ARQUEIRO.parado);
    const longeAndando = dano(CANTO, 0);
    const longeParado = dano(CANTO, REGRAS_DO_ARQUEIRO.parado);
    // Perto, o −30% vale mesmo parado; longe, o bônus só vale parado (de 4 blocos o monstro anda até uns 3 durante o evento: +36% a +48%).
    expect(pertoParado).toBeLessThan(longeAndando);
    expect(longeParado).toBeGreaterThan(longeAndando);
    expect(longeParado / longeAndando).toBeGreaterThan((92 + 36) / 92 - 0.03);
    expect(longeParado / longeAndando).toBeLessThan((92 + 48) / 92 + 0.03);
    expect(Math.abs(pertoParado / longeAndando - (92 - 30) / 92)).toBeLessThan(0.05);
  });

  it('conta o tempo parado, e andar zera', () => {
    const luta = abrirLuta(naSala('arqueiro', 'Arqueiro', [monstro()]), CANTO).luta;
    const parado = rodar(luta, 10, NUNCA).luta;
    expect(parado.arena.classe?.parado).toBe(10);
    expect(passoDaLuta(parado, { x: 100, y: 0 }, NUNCA).luta.arena.classe?.parado).toBe(0);
  });

  it('a mira dele é 2,3× maior: pega o monstro com o cursor a 2,5 casas, onde a de todo mundo não pega', () => {
    const cursor = { x: MEIO.x + 2.5 * T, y: MEIO.y };
    const arqueiro = abrirLuta(naSala('arqueiro', 'Arqueiro', [monstro()]), PERTO).luta;
    const guerreiro = abrirLuta(naSala('guerreiro', 'Guerreiro', [monstro()]), PERTO).luta;
    expect(passoDaLuta(arqueiro, { ...PARADO, atacar: true, cursor }, NUNCA).luta.arena.evento).not.toBeNull();
    expect(passoDaLuta(guerreiro, { ...PARADO, atacar: true, cursor }, NUNCA).luta.arena.evento).toBeNull();
  });
});

describe('o Bardo', () => {
  it('batendo num monstro, cura 30% da vida que falta e ganha o reforço de 6 s', () => {
    const luta = abrirLuta(naSala('bardo', 'Bardo', [monstro()], { hp: 499 }), PERTO).luta;
    const fim = golpeNoMeio(luta, { cursor: MEIO });
    expect(heroi(fim.luta).hp).toBe(499 + 150);
    expect(fim.luta.arena.reforco).toBeGreaterThan(0);
    expect(fim.luta.arena.reforco).toBeLessThanOrEqual(REGRAS_DO_BARDO.tempoDaForca);
  });

  it('o reforço dá +20% no golpe seguinte', () => {
    const sala = naSala('bardo', 'Bardo', [monstro()]);
    const luta = abrirLuta(sala, PERTO).luta;
    const sem = 4000 - vidaDoMonstro(golpeNoMeio(luta, { cursor: MEIO }).luta);
    const comReforco = { ...luta, arena: { ...luta.arena, reforco: 600 } };
    const com = 4000 - vidaDoMonstro(golpeNoMeio(comReforco, { cursor: MEIO }).luta);
    expect(Math.abs(com / sem - (85 + 20) / 85)).toBeLessThan(0.05);
  });

  it('mirando em si mesmo (sozinho), cura sem bater; e a cada 5 críticos num aliado o grupo ganha moral', () => {
    let luta = abrirLuta(naSala('bardo', 'Bardo', [monstro()], { hp: 100 }), CANTO).luta;
    let subiu: number | undefined;
    const todos: string[] = [];
    for (let i = 0; i < REGRAS_DO_BARDO.criticosDaMoral; i++) {
      const r = golpeNoMeio(luta, { cursor: { x: CANTO.x, y: CANTO.y } });
      luta = r.luta;
      todos.push(...avisos(r));
      if (r.moral !== undefined) subiu = r.moral;
    }
    expect(vidaDoMonstro(luta)).toBe(4000);
    expect(heroi(luta).hp).toBeGreaterThan(100);
    expect(luta.arena.moral).toEqual({ nivel: 1, criticos: 0 });
    expect(subiu).toBe(1);
    expect(todos).toContain('🎵 Moral 1!');
  });

  it('em dupla, mirando no parceiro: o apoio vai pela rede, e ele mesmo também recebe', () => {
    const parceiro = { x: 2.5 * T, y: 7.5 * T };
    const luta = abrirLuta(naSala('bardo', 'Bardo', [monstro()], { hp: 100 }), CANTO, null, false, 'anfitriao').luta;
    const r = golpeNoMeio(luta, { cursor: parceiro, parceiro });
    expect(r.apoios).toEqual([{ tipo: 'bardo' }]);
    expect(heroi(r.luta).hp).toBe(100 + Math.trunc((899 * 30) / 100));
  });
});

describe('a moral do grupo', () => {
  it('vem da memória do app na abertura e volta no fim', () => {
    const memoria = { moral: { nivel: 3, criticos: 2 }, recargaDaFe: 500 };
    const luta = abrirLuta(naSala('guerreiro', 'Guerreiro', [monstro()]), PERTO, null, false, null, memoria).luta;
    expect(luta.arena.moral).toEqual({ nivel: 3, criticos: 2 });
    const depois = rodar(luta, 10, NUNCA).luta;
    expect(memoriaDaLuta(depois)).toEqual({ moral: { nivel: 3, criticos: 2 }, recargaDaFe: 490 });
    expect(extrasDaLuta(depois).moral).toBe(3);
  });

  it('no nível 3 o grupo leva 30% menos dano', () => {
    const sala = naSala('mago', 'Mago', [monstro({ dmg: 60 })]);
    const levado = (nivel: number) => {
      const luta = abrirLuta(sala, PERTO, null, false, null, { moral: { nivel } }).luta;
      const fim = rodar(luta, 400, NUNCA);
      const golpe = fim.acontecimentos.find((a) => a.tipo === 'numero' && a.onde === 'heroi' && a.tom === 'dano');
      return Number((golpe?.texto ?? '-0').slice(1));
    };
    const sem = levado(0);
    const com = levado(3);
    expect(sem).toBeGreaterThan(0);
    expect(Math.abs(com - (sem - Math.floor((sem * 30) / 100)))).toBeLessThanOrEqual(1);
  });

  it('em dupla, a moral que o Bardo do parceiro sobe chega pela entrada (fica a maior)', () => {
    const luta = abrirLuta(naSala('guerreiro', 'Guerreiro', [monstro()]), PERTO, null, false, 'convidado', { moral: { nivel: 2 } }).luta;
    expect(passoDaLuta(luta, { ...PARADO, moral: 4 }, NUNCA).luta.arena.moral?.nivel).toBe(4);
    expect(passoDaLuta(luta, { ...PARADO, moral: 1 }, NUNCA).luta.arena.moral?.nivel).toBe(2);
  });
});

describe('o Clérigo', () => {
  it('o golpe mágico dele num morto-vivo vale 5×', () => {
    const dano = (speciesId: string) => {
      // O Slime tem a mesma fraqueza e a mesma resistência do Zumbi, e não é morto-vivo.
      const luta = abrirLuta(naSala('clerigo', 'Clérigo', [monstro({ speciesId })]), PERTO).luta;
      return 4000 - vidaDoMonstro(golpeNoMeio(luta, { cursor: MEIO }).luta);
    };
    const vivo = dano('slime');
    const morto = dano('zumbi');
    expect(Math.abs(morto - vivo * REGRAS_DO_CLERIGO.mortoVivo)).toBeLessThanOrEqual(REGRAS_DO_CLERIGO.mortoVivo);
  });

  it('batendo, cura 15% da vida máxima; e o golpe é mágico (gasta mana)', () => {
    const luta = abrirLuta(naSala('clerigo', 'Clérigo', [monstro({ speciesId: 'goblin' })], { hp: 100 }), PERTO).luta;
    const fim = golpeNoMeio(luta, { cursor: MEIO });
    expect(heroi(fim.luta).hp).toBe(100 + Math.trunc((999 * 15) / 100));
    expect(heroi(fim.luta).mp).toBe(45);
  });

  it('o Santo Egoísta pede a mana cheia; com ela, cura, zera a mana e conta a recarga de 7 min', () => {
    const sala = naSala('clerigo', 'Clérigo', [monstro()], { hp: 300, mp: 40 });
    const semMana = rodar(abrirLuta(sala, CANTO).luta, 1, NUNCA, () => ({ ...PARADO, fe: true }));
    expect(avisos(semMana)).toContain('O Santo Egoísta pede a mana cheia');
    expect(semMana.luta.arena.recargaDaFe).toBeUndefined();

    const cheia = abrirLuta({ ...sala, hero: { ...sala.hero, mp: 50 } }, CANTO).luta;
    const comDano = { ...cheia, arena: { ...cheia.arena, passo: 100, danosLevados: [{ passo: 90, dano: 30 }] } };
    const r = rodar(comDano, 1, NUNCA, () => ({ ...PARADO, fe: true }));
    expect(avisos(r)).toContain('✝️ Santo Egoísta!');
    expect(heroi(r.luta).mp).toBe(0);
    expect(heroi(r.luta).hp).toBe(300 + Math.trunc((999 * 40) / 100));
    expect(r.luta.arena.recargaDaFe).toBe(REGRAS_DO_CLERIGO.recargaDaFe);
    // 30 de dano ÷ 3 = 10 s.
    expect(r.luta.arena.fe).toBe(10 * 60 - 1);
  });

  it('com a fé de pé, a vida não desce de 20% e o efeito novo não pega', () => {
    const sala = naSala('clerigo', 'Clérigo', [monstro({ dmg: 900 })], { hp: 300, maxHp: 999 });
    const luta = abrirLuta(sala, PERTO).luta;
    const comFe = { ...luta, arena: { ...luta.arena, fe: 3000, reforco: 100 } };
    const fim = rodar(comFe, 400, NUNCA);
    expect(fim.luta.fim).toBeNull();
    expect(heroi(fim.luta).hp).toBeGreaterThanOrEqual(Math.ceil(999 * 0.2));
    expect(fim.luta.arena.reforco).toBeUndefined();
  });

  it('em dupla sai a Comunhão sagrada: o parceiro recebe pela rede, com a duração', () => {
    const parceiro = { x: 2.5 * T, y: 7.5 * T };
    const sala = naSala('clerigo', 'Clérigo', [monstro()], { hp: 300, mp: 10 });
    const luta = abrirLuta(sala, CANTO, null, false, 'anfitriao').luta;
    const comDano = { ...luta, arena: { ...luta.arena, passo: 100, danosLevados: [{ passo: 90, dano: 40 }] } };
    const r = rodar(comDano, 1, NUNCA, () => ({ ...PARADO, fe: true, parceiro: { ...parceiro, dano: 80 } }));
    // (40 + 80) ÷ (2 × 2) = 30 s.
    expect(r.apoios).toEqual([{ tipo: 'comunhao', passos: 30 * 60 }]);
    expect(heroi(r.luta).mp).toBe(0);
  });

  it('o dano levado entra na janela de 30 s', () => {
    const luta = abrirLuta(naSala('clerigo', 'Clérigo', [monstro({ dmg: 40 })]), PERTO).luta;
    const fim = rodar(luta, 400, NUNCA);
    const levado = fim.acontecimentos
      .filter((a) => a.tipo === 'numero' && a.onde === 'heroi' && a.tom === 'dano')
      .reduce((soma, a) => soma + Number((a.texto as string).slice(1)), 0);
    expect(levado).toBeGreaterThan(0);
    expect(danoLevadoNaJanela(fim.luta)).toBe(levado);
  });
});

describe('o Druida', () => {
  it('as vinhas pegam o monstro perto da parede, de longe; o do meio da sala, só com ele perto', () => {
    const naParede = abrirLuta(naSala('druida', 'Druida', [monstro()]), CANTO).luta;
    // O monstro sozinho fica no meio: longe de toda parede. Ele mesmo, no canto, não alcança.
    expect(avisos(rodar(naParede, 1, NUNCA, () => ({ ...PARADO, atacar: true })))).toContain('Chegue mais perto');
    const encostado = { ...naParede, arena: { ...naParede.arena, monstros: naParede.arena.monstros.map((m) => ({ ...m, corpoX: 1.5 * T, corpoY: 2.5 * T })) } };
    expect(passoDaLuta(encostado, { ...PARADO, atacar: true }, NUNCA).luta.arena.evento).not.toBeNull();
    const perto = abrirLuta(naSala('druida', 'Druida', [monstro()]), PERTO).luta;
    expect(passoDaLuta(perto, { ...PARADO, atacar: true }, NUNCA).luta.arena.evento).not.toBeNull();
  });

  it('todo golpe deixa o monstro lento e envenenado por 2 turnos', () => {
    const luta = abrirLuta(naSala('druida', 'Druida', [monstro()]), PERTO).luta;
    const fim = golpeNoMeio(luta, { cursor: MEIO });
    const status = (((celulaAtual(fim.luta.estado) as DungeonCell).monsters ?? [])[0] as CombatMonster).status;
    expect(status?.veneno).toEqual({ turns: REGRAS_DO_DRUIDA.turnos, dmg: 200 });
    expect(status?.lento?.amount).toBe(0.1);
  });

  it('a Purificação nele mesmo tira o veneno e os ferimentos, cura 10% e o deixa 30 s sem atacar', () => {
    const sala = naSala('druida', 'Druida', [monstro()], { hp: 100, ferimentos: { braco: true, veneno: 3 }, buffs: { poisonTurns: 3, poisonDmg: 5 } });
    const luta = abrirLuta(sala, CANTO).luta;
    const fim = golpeNoMeio(luta, { cursor: { x: CANTO.x, y: CANTO.y } });
    expect(heroi(fim.luta).ferimentos).toBeUndefined();
    expect(heroi(fim.luta).buffs?.poisonTurns).toBeUndefined();
    expect(heroi(fim.luta).hp).toBe(100 + 99);
    expect(fim.luta.arena.recarga).toBeGreaterThan(RECARGA_DO_ATAQUE);
    expect(extrasDaLuta(fim.luta).semAtacar).toBe(fim.luta.arena.recarga);
    expect(REGRAS_DO_DRUIDA.semAtacar - fim.luta.arena.recarga).toBeLessThan(DURACAO_DA_BARRA);
  });
});

describe('o apoio que chega do parceiro', () => {
  it('a cura do Clérigo, a Purificação e a Comunhão caem no herói daqui; o fantasma não recebe', () => {
    const sala = naSala('guerreiro', 'Guerreiro', [monstro()], { hp: 100, mp: 30, ferimentos: { perna: true } });
    const luta = abrirLuta(sala, PERTO, null, false, 'convidado').luta;
    const curado = passoDaLuta(luta, { ...PARADO, apoios: [{ tipo: 'clerigo' }] }, NUNCA).luta;
    expect(heroi(curado).hp).toBe(100 + 149);
    const purificado = passoDaLuta(luta, { ...PARADO, apoios: [{ tipo: 'purificar' }] }, NUNCA).luta;
    expect(heroi(purificado).ferimentos).toBeUndefined();
    const comunhao = passoDaLuta(luta, { ...PARADO, apoios: [{ tipo: 'comunhao', passos: 600 }] }, NUNCA).luta;
    expect(heroi(comunhao).mp).toBe(0);
    expect(comunhao.arena.fe).toBe(599);

    const fantasma = { ...luta, arena: { ...luta.arena, dupla: { ...luta.arena.dupla!, fantasma: true } } };
    expect(heroi(passoDaLuta(fantasma, { ...PARADO, apoios: [{ tipo: 'clerigo' }] }, NUNCA).luta).hp).toBe(100);
  });
});
