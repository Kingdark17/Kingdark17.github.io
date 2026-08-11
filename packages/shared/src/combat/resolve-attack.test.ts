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
import { resolveAttack } from './resolve-attack.js';

const SEM_DEBUFF = DEBUFFS.find((d) => !d.effect)!;
const RANGED_DEBUFF = DEBUFFS.find((d) => d.effect === 'rangedPenalty')!;

function baseAttrs(overrides: Partial<Attributes> = {}): Attributes {
  return { forca: 10, destreza: 10, constituicao: 10, intelecto: 10, sabedoria: 10, carisma: 10, ...overrides };
}

/** Herói construído à mão (sem passar por buildHero) para poder calcular os valores esperados manualmente. */
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
    className: opts.className ?? 'Guerreiro',
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

describe('resolveAttack — dano físico puro (sem crit, sem proc, sem passiva)', () => {
  it('bate o valor calculado à mão: Guerreiro com espada, roll 15', () => {
    const hero = heroFixture({ className: 'Guerreiro', weaponId: 'espada' });
    const monster = monsterFixture();
    // dmgFisico = forca*2 = 20; espada ataque:4 (100% afinidade); base = 3+0 = 3 (rng call 1 -> 0)
    // dmg = round((3 + 20 + 4 + 0) * 1) = 27; goblin neutro a fisico -> sem modificador
    // crit: critico=5+destreza*0.5=10 -> critChance=0.10; rng call 2 = 0.99 -> não crita
    // proc espada chance 0.15; rng call 3 = 0.99 -> não dispara
    const result = resolveAttack(hero, monster, 15, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });

    expect(result.outcome).toBe('hit');
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
    resolveAttack(hero, monster, 15, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(JSON.stringify(hero)).toBe(heroSnap);
    expect(JSON.stringify(monster)).toBe(monsterSnap);
  });
});

describe('resolveAttack — mana', () => {
  it('recusa ataque mágico sem mana suficiente, herói fica intocado', () => {
    const hero = heroFixture({ className: 'Mago', weaponId: 'cajado', hero: { mp: 2 } });
    const monster = monsterFixture();
    const result = resolveAttack(hero, monster, 15, 'magic');
    expect(result.outcome).toBe('no_mana');
    expect(result.hero).toBe(hero); // mesma referência: nada foi tocado
  });

  it('desconta o custo de mana antes de resolver o ataque mágico', () => {
    const hero = heroFixture({ className: 'Mago', weaponId: 'cajado', hero: { mp: 20 } });
    const monster = monsterFixture();
    const result = resolveAttack(hero, monster, 15, 'magic', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(result.hero.mp).toBe(15); // 20 - 5 de custo
  });
});

describe('resolveAttack — acerto garantido', () => {
  it('critNext força acerto mesmo com rolagem baixa, e crítico', () => {
    const hero = heroFixture({ weaponId: 'espada', hero: { buffs: { critNext: true } } });
    const monster = monsterFixture();
    const result = resolveAttack(hero, monster, 1, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(result.outcome).toBe('hit');
    expect(result.isCrit).toBe(true);
  });

  it('consome critNext após o ataque', () => {
    const hero = heroFixture({ weaponId: 'espada', hero: { buffs: { critNext: true } } });
    const result = resolveAttack(hero, monsterFixture(), 1, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(result.hero.buffs?.critNext).toBe(false);
  });

  it('crítico multiplica o dano em 1.6x', () => {
    const hero = heroFixture({ weaponId: 'espada' });
    const semCrit = resolveAttack(hero, monsterFixture(), 15, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    const comCrit = resolveAttack(hero, monsterFixture(), 20, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) }); // roll 20 sempre crita
    expect(comCrit.damage).toBe(Math.round((semCrit.damage as number) * 1.6));
  });
});

describe('resolveAttack — esquiva de monstro ágil', () => {
  it('monstro ágil pode esquivar de um acerto que não seja crítico garantido nem roll 20', () => {
    const hero = heroFixture({ weaponId: 'espada' });
    const agil = monsterFixture({ speciesId: 'lobo_sombras' }); // behavior: agil
    const result = resolveAttack(hero, agil, 15, 'normal', { rng: sequenceRng([0.05]) }); // primeira chamada é o rolo de esquiva (<0.15)
    expect(result.outcome).toBe('dodged');
    expect(result.monster).toEqual(agil); // monstro não muda numa esquiva
  });

  it('crítico garantido ignora a checagem de esquiva do monstro ágil', () => {
    const hero = heroFixture({ weaponId: 'espada', hero: { buffs: { critNext: true } } });
    const agil = monsterFixture({ speciesId: 'lobo_sombras' });
    const result = resolveAttack(hero, agil, 1, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(result.outcome).toBe('hit');
  });

  it('roll 20 também ignora a esquiva', () => {
    const hero = heroFixture({ weaponId: 'espada' });
    const agil = monsterFixture({ speciesId: 'lobo_sombras' });
    const result = resolveAttack(hero, agil, 20, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(result.outcome).toBe('hit');
  });
});

describe('resolveAttack — buffs temporários', () => {
  it('precisaoTurns reduz o alvo de acerto', () => {
    const hero = heroFixture({ weaponId: 'espada', hero: { buffs: { precisaoTurns: 2, precisaoAmount: 25 } } });
    // hitTarget = max(4, 11 - floor(25/5)) = 6; roll 7 deveria acertar
    const result = resolveAttack(hero, monsterFixture(), 7, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(result.outcome).toBe('hit');
  });

  it('sem o buff, o mesmo roll 7 erraria (hitTarget=11)', () => {
    const hero = heroFixture({ weaponId: 'espada' });
    const result = resolveAttack(hero, monsterFixture(), 7, 'normal');
    expect(result.outcome).toBe('miss');
  });

  it('decrementa precisaoTurns/forcaTurns em erro e acerto', () => {
    const hero = heroFixture({ weaponId: 'espada', hero: { buffs: { precisaoTurns: 2, forcaTurns: 3, forcaAmount: 0.3 } } });
    const acerto = resolveAttack(hero, monsterFixture(), 15, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(acerto.hero.buffs?.precisaoTurns).toBe(1);
    expect(acerto.hero.buffs?.forcaTurns).toBe(2);

    const erro = resolveAttack(hero, monsterFixture(), 1, 'normal');
    expect(erro.hero.buffs?.precisaoTurns).toBe(1);
    expect(erro.hero.buffs?.forcaTurns).toBe(2);
  });

  it('debuff de visão fraca soma +2 no alvo de acerto só com arco ou cajado', () => {
    const comArco = heroFixture({ weaponId: 'arco', hero: { debuff: RANGED_DEBUFF } });
    // hitTarget vira 13; roll 12 deveria errar
    const result = resolveAttack(comArco, monsterFixture(), 12, 'normal');
    expect(result.outcome).toBe('miss');

    const comEspada = heroFixture({ weaponId: 'espada', hero: { debuff: RANGED_DEBUFF } });
    // espada não sofre a penalidade; hitTarget continua 11, roll 12 acerta
    const semPenalidade = resolveAttack(comEspada, monsterFixture(), 12, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(semPenalidade.outcome).toBe('hit');
  });
});

describe('resolveAttack — ataque mágico', () => {
  it('não aplica bônus de força mesmo com o buff ativo', () => {
    const mago = heroFixture({ className: 'Mago', weaponId: 'cajado', hero: { buffs: { forcaTurns: 3, forcaAmount: 1.0 } } });
    const comForca = resolveAttack(mago, monsterFixture(), 15, 'magic', { rng: sequenceRng([0, 0.99, 0.99]) });
    const semForca = resolveAttack({ ...mago, buffs: {} }, monsterFixture(), 15, 'magic', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(comForca.damage).toBe(semForca.damage);
  });

  it('usa dmgMagico em vez de dmgFisico na base', () => {
    // intelecto 10 -> dmgMagico = intelecto*3 = 30; forca 10 -> dmgFisico = forca*2 = 20
    const mago = heroFixture({ className: 'Mago', weaponId: 'cajado' });
    const result = resolveAttack(mago, monsterFixture(), 15, 'magic', { rng: sequenceRng([0, 0.99, 0.99]) });
    // base=3, dmgMagico=30, cajado ataque:3 (100% afinidade), otherEquipAtk=0 -> round(3+30+3+0)=36
    // o goblin da fixture tem weakness:'magico', que soma +25%: round(36*1.25)=45
    expect(result.damage).toBe(45);
  });
});

describe('resolveAttack — mago lutando fisicamente', () => {
  it('usa metade do dano físico como base quando ataca fisicamente', () => {
    const mago = heroFixture({ className: 'Mago', weaponId: 'cajado' });
    const result = resolveAttack(mago, monsterFixture(), 15, 'physical', { rng: sequenceRng([0, 0.99, 0.99]) });
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

    const comFerido = resolveAttack(ferido, monsterFixture(), 15, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    const comSaudavel = resolveAttack(saudavel, monsterFixture(), 15, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(comFerido.damage as number).toBeGreaterThan(comSaudavel.damage as number);
  });
});

describe('resolveAttack — integração com proc e passiva', () => {
  it('dispara o proc da arma quando o rolo é favorável', () => {
    const hero = heroFixture({ weaponId: 'espada' }); // proc queimadura, chance 0.15
    const result = resolveAttack(hero, monsterFixture(), 15, 'normal', { rng: sequenceRng([0, 0.99, 0]) });
    expect(result.procTriggered?.effect).toBe('queimadura');
    expect(result.monster.status?.queimadura).toBeDefined();
  });

  it('dispara a passiva de classe quando o rolo é favorável', () => {
    const ladino = heroFixture({ className: 'Ladino', weaponId: 'adaga' }); // adaga não tem proc
    const result = resolveAttack(ladino, monsterFixture(), 15, 'normal', { rng: sequenceRng([0, 0.99, 0]) });
    expect(result.classPassiveTriggered?.kind).toBe('ladino');
  });

  it('monsterDefeated fica true quando o hp zera', () => {
    const hero = heroFixture({ weaponId: 'espada' });
    const fraco = monsterFixture({ hp: 5 });
    const result = resolveAttack(hero, fraco, 15, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(result.monsterDefeated).toBe(true);
    expect(result.monster.hp).toBeLessThanOrEqual(0);
  });
});
