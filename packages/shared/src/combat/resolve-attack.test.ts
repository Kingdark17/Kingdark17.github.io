import { describe, expect, it } from 'vitest';

import { derivedStats } from '../hero/derived.js';
import type { Attributes } from '../hero/stats.js';
import { DEBUFFS } from '../hero/catalog.js';
import type { Hero, HeroEquipment } from '../hero/hero.js';
import { instantiate } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import { freshCombatMonster, type CombatMonster, type CombatMonsterView } from './monster-state.js';
import { monsterView, type MonsterInstance } from '../monsters/generate.js';
import type { Rng } from '../rng.js';
import {
  ataquesDisponiveis,
  ehAtaqueDaClasse,
  lerMira,
  resolveAttack,
  zonaDoAtaque,
  type AttackStyle,
  type JogadaDeAtaque,
} from './resolve-attack.js';

const SEM_DEBUFF = DEBUFFS.find((d) => !d.effect)!;
const RANGED_DEBUFF = DEBUFFS.find((d) => d.effect === 'rangedPenalty')!;

function baseAttrs(overrides: Partial<Attributes> = {}): Attributes {
  return { forca: 10, destreza: 10, constituicao: 10, intelecto: 10, sabedoria: 10, carisma: 10, ...overrides };
}

/**
 * Herói construído à mão (sem passar por buildHero) para poder calcular os
 * valores esperados manualmente.
 *
 * **Bárbaro por padrão.** É a classe sem ataque principal (zona comum, de
 * metade da barra) **e** sem passiva que puxe o `rng`: com paladino ou
 * clérigo a cura da passiva consumiria um número da `sequenceRng` e
 * deslocaria todos os outros.
 */
function heroFixture(opts: { className?: string; weaponId?: string; attrs?: Partial<Attributes>; hero?: Partial<Hero> } = {}): Hero {
  const attrs = baseAttrs(opts.attrs);
  const weapon = opts.weaponId ? instantiate(templateById(opts.weaponId)!, RARITIES[0]!) : null;
  const equip: HeroEquipment = { arma: weapon, secundaria: null, armadura: null, acessorio: null };
  const derived = derivedStats({ level: 1, attrs, equip });
  return {
    level: 1,
    attrs,
    equip,
    name: 'T',
    race: 'Humano',
    raceIcon: '',
    className: opts.className ?? 'Bárbaro',
    classIcon: '',
    xp: 0,
    xpNext: 40,
    attrPoints: 0,
    gold: 0,
    powerNames: [],
    debuff: SEM_DEBUFF,
    killCount: 0,
    derived,
    maxHp: derived.maxHp,
    hp: derived.maxHp,
    maxMp: derived.maxMp,
    mp: derived.maxMp,
    buffs: {},
    ...opts.hero,
  };
}

/** Monstro construído à mão. Goblin: weakness magico, resistance nenhuma — neutro pra ataque físico. */
function monsterFixture(overrides: Partial<CombatMonster> = {}): CombatMonsterView {
  const instance: MonsterInstance = {
    speciesId: 'goblin',
    enemyClassId: 'brutamontes',
    floor: 5,
    hp: 100,
    maxHp: 100,
    dmg: 5,
    speed: 8,
    xp: 10,
    gold: 10,
    isBoss: false,
  };
  return monsterView({ ...freshCombatMonster(instance), ...overrides });
}

/** Devolve valores fixos em sequência — controla exatamente cada chamada de rng() dentro de resolveAttack. */
function sequenceRng(values: number[]): Rng {
  let i = 0;
  return () => (i < values.length ? (values[i++] as number) : (values[values.length - 1] ?? 0));
}

/** Nem crítico de sorte, nem proc: as duas chamadas de `rng` de um acerto. */
const LISO = () => sequenceRng([0.99, 0.99]);

/**
 * Golpe que acerta com força 1× — a meio caminho entre o centro e a borda
 * da zona deste ataque. Com o d20 em 1 a base fica 3, a mesma do d6
 * escondido que rolava 0: as contas à mão de antes da barra continuam
 * valendo.
 */
function golpeNeutro(hero: Hero, estilo: AttackStyle = 'normal', dado = 1): JogadaDeAtaque {
  return { dado, mira: 0.5 + zonaDoAtaque(hero, estilo) / 4 };
}

/** O cursor passou do fim sem toque. */
const NO_VAZIO: JogadaDeAtaque = { dado: 1, mira: null };

describe('resolveAttack — dano físico puro (sem crit, sem proc, sem passiva)', () => {
  it('bate o valor calculado à mão: Guerreiro com espada, d20 em 1, força 1×', () => {
    const hero = heroFixture({ className: 'Guerreiro', weaponId: 'espada' });
    const monster = monsterFixture();
    // dmgFisico = forca*2 = 20; espada ataque:4 (100% afinidade); base = 2 + 1 = 3
    // dmg = round((3 + 20 + 4 + 0) * 1) = 27; goblin neutro a fisico -> sem modificador
    // crit: critico=5+destreza*0.5=10 -> critChance=0.10; rng call 1 = 0.99 -> não crita
    // proc espada chance 0.15; rng call 2 = 0.99 -> não dispara
    const result = resolveAttack(hero, monster, golpeNeutro(hero), 'normal', { rng: LISO() });

    expect(result.outcome).toBe('hit');
    expect(result.mira).toEqual({ acerto: true, forca: 1, critico: false });
    expect(result.damage).toBe(27);
    expect(result.isCrit).toBe(false);
    expect(result.magical).toBe(false);
    expect(result.affinityPct).toBe(100);
    expect(result.procTriggered).toBeNull();
    expect(result.classPassiveTriggered).toBeNull();
    expect(result.monster.hp).toBe(73);
    expect(result.monsterDefeated).toBe(false);
  });

  it('não muta hero nem monster recebidos', () => {
    const hero = heroFixture({ weaponId: 'espada' });
    const monster = monsterFixture();
    const heroSnap = JSON.stringify(hero);
    const monsterSnap = JSON.stringify(monster);
    resolveAttack(hero, monster, golpeNeutro(hero), 'normal', { rng: LISO() });
    expect(JSON.stringify(hero)).toBe(heroSnap);
    expect(JSON.stringify(monster)).toBe(monsterSnap);
  });
});

describe('resolveAttack — o d20 de dano', () => {
  it('a face entra inteira na base: 20 no dado bate 19 a mais que 1', () => {
    const hero = heroFixture({ className: 'Guerreiro', weaponId: 'espada' });
    const baixo = resolveAttack(hero, monsterFixture(), golpeNeutro(hero, 'normal', 1), 'normal', { rng: LISO() });
    const alto = resolveAttack(hero, monsterFixture(), golpeNeutro(hero, 'normal', 20), 'normal', { rng: LISO() });
    expect((alto.damage ?? 0) - (baixo.damage ?? 0)).toBe(19);
  });

  it('o 20 não crita sozinho: o crítico mora na barra agora', () => {
    const hero = heroFixture({ weaponId: 'espada' });
    expect(resolveAttack(hero, monsterFixture(), golpeNeutro(hero, 'normal', 20), 'normal', { rng: LISO() }).isCrit).toBe(false);
  });

  it('o 20 não fura a esquiva do monstro ágil', () => {
    const agil = monsterFixture({ speciesId: 'lobo_sombras' });
    expect(agil.behavior).toBe('agil');
    const hero = heroFixture({ weaponId: 'espada' });
    expect(resolveAttack(hero, agil, golpeNeutro(hero, 'normal', 20), 'normal', { rng: sequenceRng([0.05]) }).outcome).toBe('dodged');
  });
});

describe('resolveAttack — maestria', () => {
  it('com a arma da classe, +2% por nível: os 27 da espada viram 29 no nível 3', () => {
    const hero = heroFixture({ className: 'Guerreiro', weaponId: 'espada', hero: { masteryBattles: 60 } });
    const result = resolveAttack(hero, monsterFixture(), golpeNeutro(hero), 'normal', { rng: LISO() });
    expect(result.damage).toBe(29); // round(27 × 1,06)
  });

  it('com arma que a classe não domina, a maestria não entra', () => {
    const sem = heroFixture({ className: 'Guerreiro', weaponId: 'machado' });
    const com = heroFixture({ className: 'Guerreiro', weaponId: 'machado', hero: { masteryBattles: 550 } });
    const golpe = (hero: Hero) => resolveAttack(hero, monsterFixture(), golpeNeutro(hero), 'normal', { rng: LISO() }).damage;
    expect(golpe(com)).toBe(golpe(sem));
  });

  it('vale também pro golpe mágico do mago de cajado', () => {
    const sem = heroFixture({ className: 'Mago', weaponId: 'cajado' });
    const com = heroFixture({ className: 'Mago', weaponId: 'cajado', hero: { masteryBattles: 550 } });
    const golpe = (hero: Hero) => resolveAttack(hero, monsterFixture(), golpeNeutro(hero, 'magic'), 'magic', { rng: LISO() });
    const semMaestria = golpe(sem);
    expect(semMaestria.outcome).toBe('hit');
    expect(golpe(com).damage).toBeGreaterThan(semMaestria.damage ?? 0);
  });
});

describe('resolveAttack — mana', () => {
  it('recusa ataque mágico sem mana suficiente, herói fica intocado', () => {
    const hero = heroFixture({ className: 'Mago', weaponId: 'cajado', hero: { mp: 2 } });
    const result = resolveAttack(hero, monsterFixture(), golpeNeutro(hero, 'magic'), 'magic');
    expect(result.outcome).toBe('no_mana');
    expect(result.hero).toBe(hero); // mesma referência: nada foi tocado
  });

  it('desconta o custo de mana antes de resolver o ataque mágico', () => {
    const hero = heroFixture({ className: 'Mago', weaponId: 'cajado', hero: { mp: 20 } });
    const result = resolveAttack(hero, monsterFixture(), golpeNeutro(hero, 'magic'), 'magic', { rng: LISO() });
    expect(result.hero.mp).toBe(15); // 20 - 5 de custo
  });
});

describe('resolveAttack — acerto garantido', () => {
  it('critNext acerta mesmo com a barra no vazio, e crita com força 1×', () => {
    const hero = heroFixture({ weaponId: 'espada', hero: { buffs: { critNext: true } } });
    const neutro = resolveAttack(heroFixture({ weaponId: 'espada' }), monsterFixture(), golpeNeutro(hero), 'normal', { rng: LISO() });
    const result = resolveAttack(hero, monsterFixture(), NO_VAZIO, 'normal', { rng: LISO() });
    expect(result.outcome).toBe('hit');
    expect(result.isCrit).toBe(true);
    expect(result.damage).toBe(Math.round((neutro.damage as number) * 1.6));
  });

  it('consome critNext após o ataque', () => {
    const hero = heroFixture({ weaponId: 'espada', hero: { buffs: { critNext: true } } });
    const result = resolveAttack(hero, monsterFixture(), NO_VAZIO, 'normal', { rng: LISO() });
    expect(result.hero.buffs?.critNext).toBe(false);
  });

  it('crítico de sorte multiplica o dano em 1.6x', () => {
    const hero = heroFixture({ weaponId: 'espada' });
    const semCrit = resolveAttack(hero, monsterFixture(), golpeNeutro(hero), 'normal', { rng: LISO() });
    const comCrit = resolveAttack(hero, monsterFixture(), golpeNeutro(hero), 'normal', { rng: sequenceRng([0, 0.99]) }); // 0 < 10% de crítico
    expect(comCrit.isCrit).toBe(true);
    expect(comCrit.damage).toBe(Math.round((semCrit.damage as number) * 1.6));
  });
});

describe('resolveAttack — esquiva de monstro ágil', () => {
  it('monstro ágil pode esquivar de um acerto fora da faixa do crítico', () => {
    const hero = heroFixture({ weaponId: 'espada' });
    const agil = monsterFixture({ speciesId: 'lobo_sombras' }); // behavior: agil
    const result = resolveAttack(hero, agil, golpeNeutro(hero), 'normal', { rng: sequenceRng([0.05]) }); // primeira chamada é o rolo de esquiva (<0.15)
    expect(result.outcome).toBe('dodged');
    expect(result.monster).toEqual(agil); // monstro não muda numa esquiva
  });

  it('crítico garantido ignora a checagem de esquiva do monstro ágil', () => {
    const hero = heroFixture({ weaponId: 'espada', hero: { buffs: { critNext: true } } });
    const agil = monsterFixture({ speciesId: 'lobo_sombras' });
    const result = resolveAttack(hero, agil, NO_VAZIO, 'normal', { rng: sequenceRng([0.05, 0.99, 0.99]) });
    expect(result.outcome).toBe('hit');
  });

  it('a faixa do crítico também ignora a esquiva, como o 20 natural ignorava', () => {
    const hero = heroFixture({ weaponId: 'espada' });
    const agil = monsterFixture({ speciesId: 'lobo_sombras' });
    const result = resolveAttack(hero, agil, { dado: 1, mira: 0.5 }, 'normal', { rng: sequenceRng([0.05, 0.99, 0.99]) });
    expect(result.outcome).toBe('hit');
    expect(result.isCrit).toBe(true);
  });
});

describe('resolveAttack — buffs temporários', () => {
  /** A 0,3 do centro: fora da zona comum (meia 0,25), dentro com Precisão 25 (meia 0,375). */
  const LONGE: JogadaDeAtaque = { dado: 1, mira: 0.8 };

  it('precisaoTurns alarga a zona: o mesmo ponto passa a acertar', () => {
    const hero = heroFixture({ weaponId: 'espada', hero: { buffs: { precisaoTurns: 2, precisaoAmount: 25 } } });
    expect(zonaDoAtaque(hero, 'normal')).toBeCloseTo(0.75); // 0,5 + 5 pontos × 5%
    expect(resolveAttack(hero, monsterFixture(), LONGE, 'normal', { rng: LISO() }).outcome).toBe('hit');
  });

  it('sem o buff, o mesmo ponto erra', () => {
    const hero = heroFixture({ weaponId: 'espada' });
    expect(resolveAttack(hero, monsterFixture(), LONGE, 'normal').outcome).toBe('miss');
  });

  it('a Precisão para nos 85% da barra, o antigo errar só no 1, 2 e 3', () => {
    const hero = heroFixture({ weaponId: 'espada', hero: { buffs: { precisaoTurns: 2, precisaoAmount: 100 } } });
    expect(zonaDoAtaque(hero, 'normal')).toBeCloseTo(0.85);
  });

  it('decrementa precisaoTurns/forcaTurns em erro e acerto', () => {
    const hero = heroFixture({ weaponId: 'espada', hero: { buffs: { precisaoTurns: 2, forcaTurns: 3, forcaAmount: 0.3 } } });
    const acerto = resolveAttack(hero, monsterFixture(), golpeNeutro(hero), 'normal', { rng: LISO() });
    expect(acerto.hero.buffs?.precisaoTurns).toBe(1);
    expect(acerto.hero.buffs?.forcaTurns).toBe(2);

    const erro = resolveAttack(hero, monsterFixture(), NO_VAZIO, 'normal');
    expect(erro.hero.buffs?.precisaoTurns).toBe(1);
    expect(erro.hero.buffs?.forcaTurns).toBe(2);
  });

  it('Visão Fraca tira 10% da zona só com arco ou cajado', () => {
    const comArco = heroFixture({ weaponId: 'arco', hero: { debuff: RANGED_DEBUFF } });
    expect(zonaDoAtaque(comArco, 'normal')).toBeCloseTo(0.4);
    // A 0,22 do centro: dentro da zona comum (0,25), fora da encolhida (0,2).
    expect(resolveAttack(comArco, monsterFixture(), { dado: 1, mira: 0.72 }, 'normal').outcome).toBe('miss');

    const comEspada = heroFixture({ weaponId: 'espada', hero: { debuff: RANGED_DEBUFF } });
    expect(zonaDoAtaque(comEspada, 'normal')).toBeCloseTo(0.5);
    expect(resolveAttack(comEspada, monsterFixture(), { dado: 1, mira: 0.72 }, 'normal', { rng: LISO() }).outcome).toBe('hit');
  });
});

describe('resolveAttack — ataque mágico', () => {
  it('não aplica bônus de força mesmo com o buff ativo', () => {
    const mago = heroFixture({ className: 'Mago', weaponId: 'cajado', hero: { buffs: { forcaTurns: 3, forcaAmount: 1.0 } } });
    const comForca = resolveAttack(mago, monsterFixture(), golpeNeutro(mago, 'magic'), 'magic', { rng: LISO() });
    const semForca = resolveAttack({ ...mago, buffs: {} }, monsterFixture(), golpeNeutro(mago, 'magic'), 'magic', { rng: LISO() });
    expect(comForca.damage).toBe(semForca.damage);
  });

  it('usa dmgMagico em vez de dmgFisico na base', () => {
    // intelecto 10 -> dmgMagico = intelecto*3 = 30; forca 10 -> dmgFisico = forca*2 = 20
    const mago = heroFixture({ className: 'Mago', weaponId: 'cajado' });
    const result = resolveAttack(mago, monsterFixture(), golpeNeutro(mago, 'magic'), 'magic', { rng: LISO() });
    // base=3, dmgMagico=30, cajado ataque:3 (100% afinidade), otherEquipAtk=0 -> round(3+30+3+0)=36
    // o goblin da fixture tem weakness:'magico', que soma +25%: round(36*1.25)=45
    expect(result.damage).toBe(45);
  });
});

describe('resolveAttack — mago lutando fisicamente', () => {
  it('usa metade do dano físico como base quando ataca fisicamente', () => {
    const mago = heroFixture({ className: 'Mago', weaponId: 'cajado' });
    const result = resolveAttack(mago, monsterFixture(), golpeNeutro(mago, 'physical'), 'physical', { rng: LISO() });
    // physicalBase = round(dmgFisico*0.5) = round(20*0.5) = 10
    // dmg = round((3 + 10 + weaponAtkContribution(cajado,100%=3) + 0) * 1) = round(16) = 16
    expect(result.damage).toBe(16);
    expect(result.magical).toBe(false);
  });
});

describe('resolveAttack — Bárbaro', () => {
  it('bônus de força só se aplica abaixo de 50% de vida', () => {
    const barbaroFerido = heroFixture({ className: 'Bárbaro', weaponId: 'machado', hero: {} });
    const ferido = { ...barbaroFerido, hp: Math.floor(barbaroFerido.maxHp * 0.4) };
    const saudavel = barbaroFerido;

    const comFerido = resolveAttack(ferido, monsterFixture(), golpeNeutro(ferido), 'normal', { rng: LISO() });
    const comSaudavel = resolveAttack(saudavel, monsterFixture(), golpeNeutro(saudavel), 'normal', { rng: LISO() });
    expect(comFerido.damage as number).toBeGreaterThan(comSaudavel.damage as number);
  });
});

describe('resolveAttack — integração com proc e passiva', () => {
  it('dispara o proc da arma quando o rolo é favorável', () => {
    const hero = heroFixture({ weaponId: 'espada' }); // proc queimadura, chance 0.15
    const result = resolveAttack(hero, monsterFixture(), golpeNeutro(hero), 'normal', { rng: sequenceRng([0.99, 0]) });
    expect(result.procTriggered?.effect).toBe('queimadura');
    expect(result.monster.status?.queimadura).toBeDefined();
  });

  it('dispara a passiva de classe quando o rolo é favorável', () => {
    const ladino = heroFixture({ className: 'Ladino', weaponId: 'adaga' }); // adaga não tem proc
    const result = resolveAttack(ladino, monsterFixture(), golpeNeutro(ladino), 'normal', { rng: sequenceRng([0.99, 0]) });
    expect(result.classPassiveTriggered?.kind).toBe('ladino');
  });

  it('monsterDefeated fica true quando o hp zera', () => {
    const hero = heroFixture({ weaponId: 'espada' });
    const fraco = monsterFixture({ hp: 5 });
    const result = resolveAttack(hero, fraco, golpeNeutro(hero), 'normal', { rng: LISO() });
    expect(result.monsterDefeated).toBe(true);
    expect(result.monster.hp).toBeLessThanOrEqual(0);
  });
});

/**
 * A barra de mira — combate em primeira pessoa do doc do Breno, regras do
 * usuário em 2026-10-09: a zona fica no meio, fora dela erra; dentro, a
 * força vai de 0,5× na borda a 1,5× no centro; a faixa fina do centro
 * crita. A vantagem do ataque da classe (que era o d6) é a zona maior.
 */
describe('a barra de mira', () => {
  it('lê o centro como 1,5× e crítico, e a borda como 0,5×', () => {
    expect(lerMira(0.5, 0.5)).toEqual({ acerto: true, forca: 1.5, critico: true });
    expect(lerMira(0.5, 0.75)).toEqual({ acerto: true, forca: 0.5, critico: false });
    expect(lerMira(0.5, 0.25)).toEqual({ acerto: true, forca: 0.5, critico: false });
    expect(lerMira(0.5, 0.625)).toEqual({ acerto: true, forca: 1, critico: false });
  });

  it('fora da zona, ou sem toque, erra', () => {
    expect(lerMira(0.5, 0.76).acerto).toBe(false);
    expect(lerMira(0.5, 0).acerto).toBe(false);
    expect(lerMira(0.5, null)).toEqual({ acerto: false, forca: 0, critico: false });
  });

  it('a faixa do crítico tem 5% da barra, metade pra cada lado do centro', () => {
    // Dentro da faixa, e não na borda exata: 0,525 − 0,5 dá um fio acima de
    // 0,025 em ponto flutuante.
    expect(lerMira(0.5, 0.52).critico).toBe(true);
    expect(lerMira(0.5, 0.48).critico).toBe(true);
    expect(lerMira(0.5, 0.53).critico).toBe(false);
    expect(lerMira(0.5, 0.47).critico).toBe(false);
  });

  it('a força perto do centro pesa no dano: 1,3× a 0,05 do centro', () => {
    const hero = heroFixture({ className: 'Guerreiro', weaponId: 'espada' });
    // Zona da classe: meia = 1/3. 1,5 − 0,05/(1/3) = 1,35.
    const result = resolveAttack(hero, monsterFixture(), { dado: 1, mira: 0.55 }, 'normal', { rng: LISO() });
    expect(result.mira.forca).toBe(1.35);
    expect(result.damage).toBe(Math.round(27 * 1.35)); // round((3 + 20 + 4) × 1,35) = 36
  });

  it('cada classe tem a zona maior só no ataque dela', () => {
    expect(ehAtaqueDaClasse(heroFixture({ className: 'Guerreiro', weaponId: 'espada' }), 'normal')).toBe(true);
    expect(ehAtaqueDaClasse(heroFixture({ className: 'Ladino', weaponId: 'adaga' }), 'normal')).toBe(true);
    expect(ehAtaqueDaClasse(heroFixture({ className: 'Mago', weaponId: 'cajado' }), 'magic')).toBe(true);
    expect(ehAtaqueDaClasse(heroFixture({ className: 'Mago', weaponId: 'cajado' }), 'physical')).toBe(false);
    expect(ehAtaqueDaClasse(heroFixture({ className: 'Arqueiro', weaponId: 'arco' }), 'ranged')).toBe(true);
    expect(ehAtaqueDaClasse(heroFixture({ className: 'Arqueiro', weaponId: 'arco' }), 'normal')).toBe(false);
    expect(ehAtaqueDaClasse(heroFixture({ className: 'Caçador', weaponId: 'arco' }), 'ranged')).toBe(true);
    // Paladino não é o cavaleiro do doc — o Pedro disse que é o guerreiro.
    expect(ehAtaqueDaClasse(heroFixture({ className: 'Paladino', weaponId: 'espada' }), 'normal')).toBe(false);
    expect(ehAtaqueDaClasse(heroFixture({ className: 'Bardo', weaponId: 'violao' }), 'normal')).toBe(false);
  });

  it('o tiro só conta como ataque da classe com arco na mão', () => {
    expect(ehAtaqueDaClasse(heroFixture({ className: 'Arqueiro', weaponId: 'espada' }), 'ranged')).toBe(false);
    expect(ehAtaqueDaClasse(heroFixture({ className: 'Arqueiro' }), 'ranged')).toBe(false);
  });

  it('a classe vem pelo id, não pelo nome — save antigo sem acento acha a mesma regra', () => {
    expect(ehAtaqueDaClasse(heroFixture({ className: 'Cacador', weaponId: 'arco' }), 'ranged')).toBe(true);
  });

  it('os botões: o da classe primeiro, com 2/3 da barra, e o físico sempre existe', () => {
    const botoes = (className: string, weaponId?: string) =>
      ataquesDisponiveis(heroFixture({ className, weaponId })).map(
        (a) => `${a.estilo}:${a.zona.toFixed(2)}${a.daClasse ? ':classe' : ''}${a.custo ? `:${a.custo}MP` : ''}`,
      );

    expect(botoes('Mago', 'cajado')).toEqual(['magic:0.67:classe:5MP', 'physical:0.50']);
    expect(botoes('Arqueiro', 'arco')).toEqual(['ranged:0.67:classe', 'normal:0.50']);
    expect(botoes('Arqueiro', 'espada')).toEqual(['normal:0.50']);
    expect(botoes('Guerreiro', 'espada')).toEqual(['normal:0.67:classe']);
    expect(botoes('Ladino', 'adaga')).toEqual(['normal:0.67:classe']);
    expect(botoes('Clérigo', 'maca')).toEqual(['normal:0.50']);
  });

  it('a zona da classe acerta onde a comum erra', () => {
    const longe: JogadaDeAtaque = { dado: 1, mira: 0.8 }; // 0,3 do centro: dentro de 1/3, fora de 1/4
    expect(resolveAttack(heroFixture({ className: 'Guerreiro', weaponId: 'espada' }), monsterFixture(), longe, 'normal', { rng: LISO() }).outcome).toBe(
      'hit',
    );
    expect(resolveAttack(heroFixture({ weaponId: 'espada' }), monsterFixture(), longe, 'normal').outcome).toBe('miss');
  });

  it('recusa dado fora do d20 e mira fora da barra', () => {
    const hero = heroFixture({ weaponId: 'espada' });
    for (const dado of [0, 21, 2.5]) {
      expect(() => resolveAttack(hero, monsterFixture(), { dado, mira: 0.5 }, 'normal')).toThrow(RangeError);
    }
    for (const mira of [-0.1, 1.1, Number.NaN]) {
      expect(() => resolveAttack(hero, monsterFixture(), { dado: 10, mira }, 'normal')).toThrow(RangeError);
    }
  });

  it('o tiro causa o mesmo dano do golpe físico com a mesma força', () => {
    const arqueiro = heroFixture({ className: 'Arqueiro', weaponId: 'arco' });
    const rng = () => sequenceRng([0.99, 0.99, 0.99]);
    const tiro = resolveAttack(arqueiro, monsterFixture(), golpeNeutro(arqueiro, 'ranged'), 'ranged', { rng: rng() });
    const golpe = resolveAttack(arqueiro, monsterFixture(), golpeNeutro(arqueiro, 'normal'), 'normal', { rng: rng() });
    expect(tiro.damage).toBe(golpe.damage);
  });
});

describe('Canção de Batalha no golpe do herói', () => {
  const inspirar = (hero: Hero): Hero => ({ ...hero, buffs: { ...hero.buffs, inspiracaoTurns: 2, inspiracaoAmount: 0.25 } });

  it('vale pro golpe físico', () => {
    const bardo = heroFixture({ className: 'Bardo', weaponId: 'adaga' });
    const sem = resolveAttack(bardo, monsterFixture(), golpeNeutro(bardo), 'normal', { rng: LISO() });
    const com = resolveAttack(inspirar(bardo), monsterFixture(), golpeNeutro(bardo), 'normal', { rng: LISO() });
    expect(com.damage).toBe(Math.round((sem.damage as number) * 1.25));
  });

  it('vale pro golpe mágico também — ao contrário da força', () => {
    const mago = heroFixture({ className: 'Mago', weaponId: 'cajado' });
    const sem = resolveAttack(mago, monsterFixture(), golpeNeutro(mago, 'magic'), 'magic', { rng: LISO() });
    const com = resolveAttack(inspirar(mago), monsterFixture(), golpeNeutro(mago, 'magic'), 'magic', { rng: LISO() });
    expect(com.damage).toBeGreaterThan(sem.damage as number);
  });

  it('não é descontada pelo ataque — isso é do turno da equipe', () => {
    const bardo = inspirar(heroFixture({ className: 'Bardo', weaponId: 'adaga' }));
    const depois = resolveAttack(bardo, monsterFixture(), golpeNeutro(bardo), 'normal', { rng: LISO() });
    expect(depois.hero.buffs?.inspiracaoTurns).toBe(2);
  });
});
