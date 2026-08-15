import { describe, expect, it } from 'vitest';

import { DEBUFFS, POWERS, type Power } from '../hero/catalog.js';
import { derivedStats } from '../hero/derived.js';
import type { Companion, Hero, HeroEquipment } from '../hero/hero.js';
import type { Attributes } from '../hero/stats.js';
import { monsterView, type MonsterInstance } from '../monsters/generate.js';
import type { Rng } from '../rng.js';
import { freshCombatMonster, type CombatMonster, type CombatMonsterView } from './monster-state.js';
import { castPower, powerManaCost } from './use-power.js';

const SEM_DEBUFF = DEBUFFS.find((d) => !d.effect)!;
const MANA_CARA = DEBUFFS.find((d) => d.effect === 'manaCostPenalty')!;
const CURA_RUIM = DEBUFFS.find((d) => d.effect === 'healingPenalty')!;

const poder = (id: string): Power => POWERS.find((p) => p.id === id)!;

function baseAttrs(overrides: Partial<Attributes> = {}): Attributes {
  return { forca: 10, destreza: 10, constituicao: 10, intelecto: 10, sabedoria: 10, carisma: 10, ...overrides };
}

function heroFixture(opts: { attrs?: Partial<Attributes>; hero?: Partial<Hero> } = {}): Hero {
  const attrs = baseAttrs(opts.attrs);
  const equip: HeroEquipment = { arma: null, secundaria: null, armadura: null, acessorio: null };
  const derived = derivedStats({ level: 1, attrs, equip });
  return {
    level: 1,
    attrs,
    equip,
    name: 'T',
    race: 'Humano',
    raceIcon: '',
    className: 'Guerreiro',
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

/** Goblin: fraqueza mágico, resistência nenhuma — neutro pra dano físico. */
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

function companion(overrides: Partial<Companion> = {}): Companion {
  return {
    name: 'Aliado',
    raceIcon: '',
    race: 'Humano',
    className: 'Guerreiro',
    classIcon: '',
    hp: 10,
    maxHp: 40,
    attack: 5,
    attrs: baseAttrs(),
    stance: 'equilibrada',
    ability: '',
    abilityDesc: '',
    ...overrides,
  };
}

function sequenceRng(values: number[]): Rng {
  let i = 0;
  return () => (i < values.length ? (values[i++] as number) : (values[values.length - 1] ?? 0));
}

describe('powerManaCost', () => {
  it('cobra o custo cheio sem fraqueza', () => {
    expect(powerManaCost(heroFixture(), { cost: 10 })).toBe(10);
  });

  it('arredonda pra cima os 20% a mais da Mana Instável', () => {
    const hero = heroFixture({ hero: { debuff: MANA_CARA } });
    expect(powerManaCost(hero, { cost: 7 })).toBe(9); // ceil(8.4)
  });
});

describe('castPower — sem mana', () => {
  it('não gasta nada e devolve o mesmo herói', () => {
    const hero = heroFixture({ hero: { mp: 3 } });
    const resultado = castPower(hero, [], monsterFixture(), poder('bola_de_fogo'));

    expect(resultado.outcome).toBe('no_mana');
    expect(resultado.hero).toBe(hero);
    expect(resultado.monsterDefeated).toBe(false);
  });
});

describe('castPower — dano', () => {
  it('bate o valor calculado à mão e aplica o status do poder', () => {
    // Golpe Poderoso: dano_fisico, power 1.8, custo 8.
    // dmgFisico = forca*2 = 20 -> round(20*1.8) = 36; + rnd(6) com rng 0 -> 36.
    // Goblin é neutro a físico: sem modificador.
    const hero = heroFixture();
    const resultado = castPower(hero, [], monsterFixture(), poder('golpe_poderoso'), { rng: sequenceRng([0]) });

    expect(resultado.outcome).toBe('damage');
    expect(resultado.damage).toBe(36);
    expect(resultado.monster.hp).toBe(64);
    expect(resultado.hero.mp).toBe(hero.mp - 8);
  });

  it('a fraqueza mágica do goblin aumenta o dano do poder mágico', () => {
    // Bola de Fogo: dano_magico, power 1.5. dmgMagico = intelecto*3 = 30 -> round(45) = 45.
    // Fraqueza a mágico multiplica por 1.25 -> round(56.25) = 56.
    const resultado = castPower(heroFixture(), [], monsterFixture(), poder('bola_de_fogo'), { rng: sequenceRng([0]) });

    expect(resultado.damage).toBe(56);
    expect(resultado.monster.status?.queimadura?.turns).toBe(3);
  });

  it('marca monsterDefeated quando o poder derruba a criatura', () => {
    const resultado = castPower(heroFixture(), [], monsterFixture({ hp: 5 }), poder('golpe_poderoso'), { rng: sequenceRng([0]) });

    expect(resultado.monsterDefeated).toBe(true);
    expect(resultado.monster.hp).toBeLessThanOrEqual(0);
  });

  it('poder com healRatio devolve parte do dano como vida', () => {
    const comDreno = POWERS.find((p) => p.healRatio);
    if (!comDreno) return; // catálogo sem dreno: nada a testar

    const hero = heroFixture({ hero: { hp: 10 } });
    const resultado = castPower(hero, [], monsterFixture(), comDreno, { rng: sequenceRng([0]) });

    expect(resultado.healed).toBeGreaterThan(0);
    expect(resultado.hero.hp).toBe(10 + (resultado.healed ?? 0));
  });
});

describe('castPower — cura', () => {
  it('cura o herói e 70% disso em cada companheiro vivo', () => {
    const hero = heroFixture({ hero: { hp: 1 } });
    const vivo = companion({ hp: 10 });
    const morto = companion({ name: 'Caído', hp: 0 });

    const resultado = castPower(hero, [vivo, morto], monsterFixture(), poder('cura_menor'));
    const curado = resultado.healed ?? 0;

    expect(resultado.outcome).toBe('heal');
    expect(resultado.hero.hp).toBe(1 + curado);
    expect(resultado.allyHealed).toBe(Math.max(1, Math.round(curado * 0.7)));
    expect(resultado.party[0]?.hp).toBe(10 + (resultado.allyHealed ?? 0));
    expect(resultado.party[1]?.hp).toBe(0); // companheiro caído não levanta com cura
  });

  it('não passa do máximo de vida', () => {
    const hero = heroFixture();
    const resultado = castPower(hero, [], monsterFixture(), poder('cura_menor'));

    expect(resultado.hero.hp).toBe(hero.maxHp);
  });

  it('Cicatrização Lenta corta 25% da cura', () => {
    const cheio = castPower(heroFixture({ hero: { hp: 1 } }), [], monsterFixture(), poder('cura_menor'));
    const cortado = castPower(heroFixture({ hero: { hp: 1, debuff: CURA_RUIM } }), [], monsterFixture(), poder('cura_menor'));

    expect(cortado.healed).toBe(Math.round((cheio.healed ?? 0) * 0.75));
  });
});

describe('castPower — buffs', () => {
  it('crítico garantido liga critNext', () => {
    const resultado = castPower(heroFixture(), [], monsterFixture(), poder('furtividade_sombria'));

    expect(resultado.outcome).toBe('buff');
    expect(resultado.hero.buffs?.critNext).toBe(true);
  });

  it('precisão guarda turnos e quantidade do catálogo', () => {
    const tiro = poder('tiro_certeiro');
    const resultado = castPower(heroFixture(), [], monsterFixture(), tiro);

    expect(resultado.hero.buffs?.precisaoTurns).toBe(tiro.turns);
    expect(resultado.hero.buffs?.precisaoAmount).toBe(tiro.amount);
  });

  it('buff não encosta no monstro', () => {
    const monstro = monsterFixture();
    const resultado = castPower(heroFixture(), [], monstro, poder('furtividade_sombria'));

    expect(resultado.monster).toBe(monstro);
  });
});

describe('castPower — não muta a entrada', () => {
  it('herói, equipe e monstro originais ficam intactos', () => {
    const hero = heroFixture({ hero: { hp: 1 } });
    const aliado = companion({ hp: 5 });
    const monstro = monsterFixture();

    castPower(hero, [aliado], monstro, poder('bola_de_fogo'), { rng: sequenceRng([0]) });

    expect(hero.hp).toBe(1);
    expect(hero.mp).toBe(hero.maxMp);
    expect(aliado.hp).toBe(5);
    expect(monstro.hp).toBe(100);
    expect(monstro.status?.queimadura).toBeUndefined();
  });
});
