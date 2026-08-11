import { describe, expect, it } from 'vitest';

import { derivedStats } from '../hero/derived.js';
import type { Attributes } from '../hero/stats.js';
import { DEBUFFS } from '../hero/catalog.js';
import type { Companion, Hero, HeroEquipment } from '../hero/hero.js';
import { freshCombatMonster, type CombatMonster, type CombatMonsterView } from './monster-state.js';
import { monsterView, type MonsterInstance } from '../monsters/generate.js';
import type { Rng } from '../rng.js';
import { applyMonsterHit } from './monster-hit.js';

const SEM_DEBUFF = DEBUFFS.find((d) => !d.effect)!;
const FIRE_VULNERABILITY = DEBUFFS.find((d) => d.effect === 'fireVulnerability')!;
const PHYSICAL_VULNERABILITY = DEBUFFS.find((d) => d.effect === 'physicalVulnerability')!;

function baseAttrs(overrides: Partial<Attributes> = {}): Attributes {
  return { forca: 10, destreza: 10, constituicao: 10, intelecto: 10, sabedoria: 10, carisma: 10, ...overrides };
}

/** Herói construído à mão (sem passar por buildHero), sem equipamento — bônus de defesa/esquiva sempre 0. */
function heroFixture(opts: { className?: string; attrs?: Partial<Attributes>; hero?: Partial<Hero> } = {}): Hero {
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
    className: opts.className ?? 'Ladino',
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

/** Monstro construído à mão. Goblin: behavior 'agressivo', dmg 5. `speciesId` sobrescrevível para testar outros comportamentos. */
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

function companionFixture(overrides: Partial<Companion> = {}): Companion {
  return {
    name: 'C',
    raceIcon: '',
    race: 'Humano',
    className: 'Guerreiro',
    classIcon: '',
    hp: 20,
    maxHp: 20,
    attack: 5,
    attrs: baseAttrs(),
    stance: 'equilibrada',
    ability: '',
    abilityDesc: '',
    ...overrides,
  };
}

/** Devolve valores fixos em sequência — controla exatamente cada chamada de rng() dentro de applyMonsterHit. */
function sequenceRng(values: number[]): Rng {
  let i = 0;
  return () => (i < values.length ? (values[i++] as number) : (values[values.length - 1] ?? 0));
}

describe('applyMonsterHit — atordoado', () => {
  it('pula o ataque e decrementa o contador, sem consumir rng nem tocar hero/party', () => {
    const hero = heroFixture();
    const monster = monsterFixture({ status: { atordoado: 2 } });
    const result = applyMonsterHit(hero, [], monster, { rng: sequenceRng([]) });

    expect(result.outcome).toBe('stunned');
    expect(result.monster.status?.atordoado).toBe(1);
    expect(result.hero).toBe(hero);
    expect(result.heroDefeated).toBe(false);
  });
});

describe('applyMonsterHit — lento', () => {
  it('pode fazer o monstro perder o turno inteiro', () => {
    const hero = heroFixture();
    const monster = monsterFixture({ status: { lento: { turns: 2, amount: 0.2 } } });
    const result = applyMonsterHit(hero, [], monster, { rng: sequenceRng([0.1]) }); // 0.1 < 0.2 -> pula

    expect(result.outcome).toBe('lento_skip');
    expect(result.monster.attackCount).toBe(1);
    expect(result.monster.status?.lento).toEqual({ turns: 1, amount: 0.2 });
    expect(result.hero).toBe(hero);
  });
});

describe('applyMonsterHit — enrage de mini-chefe', () => {
  it('dispara uma vez ao cruzar 50% de vida, soma +3 de dano permanente', () => {
    const hero = heroFixture();
    const monster = monsterFixture({ isBoss: true, isMainBoss: false, hp: 40, maxHp: 100, rageTriggered: undefined });
    // agressivo(0.99 falha) -> dodge(0.99 falha) -> dano base(0)
    const result = applyMonsterHit(hero, [], monster, { rng: sequenceRng([0.99, 0.99, 0]) });

    expect(result.rageTriggered).toBe(true);
    expect(result.monster.dmg).toBe(8); // 5 + 3
    expect(result.monster.rageTriggered).toBe(true);
    // dmg = round((1 + 0 + 8 - 0 - floor(10/4)) * 1) = round(7) = 7
    expect(result.damage).toBe(7);
    expect(result.hero.hp).toBe(hero.maxHp - 7);
  });

  it('não dispara de novo se já tiver disparado antes', () => {
    const monster = monsterFixture({ isBoss: true, isMainBoss: false, hp: 40, maxHp: 100, rageTriggered: true, dmg: 8 });
    const result = applyMonsterHit(heroFixture(), [], monster, { rng: sequenceRng([0.99, 0.99, 0]) });
    expect(result.rageTriggered).toBe(false);
    expect(result.monster.dmg).toBe(8); // não soma +3 de novo
  });
});

describe('applyMonsterHit — enfraquecido reduz o multiplicador de ataque', () => {
  it('reduz o dano pela fração configurada', () => {
    const hero = heroFixture();
    const monster = monsterFixture({ status: { enfraquecido: { turns: 2, amount: 0.3 } } });
    // agressivo(0.99 falha, mantém o mult reduzido) -> dodge(0.99) -> dano base(0)
    const result = applyMonsterHit(hero, [], monster, { rng: sequenceRng([0.99, 0.99, 0]) });

    // base = 1+0+5-0-2 = 4; *0.7 = 2.8 -> round 3
    expect(result.damage).toBe(3);
    expect(result.monster.status?.enfraquecido).toEqual({ turns: 1, amount: 0.3 });
  });
});

describe('applyMonsterHit — escolha de alvo na equipe', () => {
  it('mira um defensor quando o rolo favorece, e calcula o dano à parte', () => {
    const hero = heroFixture();
    const defensor = companionFixture({ className: 'Guerreiro', hp: 20, maxHp: 20 });
    // agressivo(0.99 falha) -> escolhe pool de defensores(0.1 < 0.55) -> indice(0) -> dano base(0)
    const result = applyMonsterHit(hero, [defensor], monsterFixture(), { rng: sequenceRng([0.99, 0.1, 0, 0]) });

    expect(result.outcome).toBe('hit_party');
    expect(result.targetIndex).toBe(0);
    // partyDmg = round((1 + 0 + 5 - 1) * 1) = 5
    expect(result.damage).toBe(5);
    expect(result.party[0]?.hp).toBe(15);
    expect(result.partyMemberDefeated).toBe(false);
    expect(result.hero).toBe(hero); // herói intocado
  });

  it('marca partyMemberDefeated quando o golpe zera o hp do companheiro', () => {
    const fraco = companionFixture({ className: 'Guerreiro', hp: 3, maxHp: 20 });
    const result = applyMonsterHit(heroFixture(), [fraco], monsterFixture(), { rng: sequenceRng([0.99, 0.1, 0, 0]) });
    expect(result.party[0]?.hp).toBe(0);
    expect(result.partyMemberDefeated).toBe(true);
  });

  it('sem defensor nem sorteio de alvo, o ataque vai para o herói', () => {
    const hero = heroFixture();
    const suporte = companionFixture({ className: 'Clérigo', stance: 'suporte' });
    // agressivo(0.99) -> pool defensor (n/a, sem defensor) -> pool qualquer(0.99 falha) -> dodge(0.99) -> dano(0)
    const result = applyMonsterHit(hero, [suporte], monsterFixture(), { rng: sequenceRng([0.99, 0.99, 0.99, 0]) });
    expect(result.outcome).toBe('hit_hero');
    expect(result.party[0]).toEqual(suporte); // companheiro não sorteado, intocado
  });
});

describe('applyMonsterHit — ataque ao herói: esquiva', () => {
  it('esquiva evita qualquer dano e decrementa esquivaTurns', () => {
    const hero = heroFixture({ hero: { buffs: { esquivaTurns: 3, esquivaAmount: 10 } } }); // esquiva total = 5+10=15
    // agressivo(0.99 falha) -> dodge: rng*100=10 < 15 -> esquiva
    const result = applyMonsterHit(hero, [], monsterFixture(), { rng: sequenceRng([0.99, 0.1]) });

    expect(result.outcome).toBe('dodged');
    expect(result.heroDefeated).toBe(false);
    expect(result.hero.buffs?.esquivaTurns).toBe(2);
    expect(result.hero.hp).toBe(hero.hp);
  });
});

describe('applyMonsterHit — dano base ao herói', () => {
  it('bate o valor calculado à mão: sem equipamento, sem debuff', () => {
    const hero = heroFixture();
    // agressivo(0.99 falha) -> dodge(0.99 falha) -> dano base(0)
    const result = applyMonsterHit(hero, [], monsterFixture(), { rng: sequenceRng([0.99, 0.99, 0]) });

    // dmg = round((1 + 0 + 5 - floor(0/3) - floor(10/4)) * 1) = round(4) = 4
    expect(result.outcome).toBe('hit_hero');
    expect(result.damage).toBe(4);
    expect(result.hero.hp).toBe(hero.maxHp - 4);
    expect(result.heroDefeated).toBe(false);
    expect(result.poisonApplied).toBe(false);
    expect(result.manaDrained).toBe(0);
  });

  it('não muta hero, party nem monster recebidos', () => {
    const hero = heroFixture();
    const party = [companionFixture()];
    const monster = monsterFixture();
    const heroSnap = JSON.stringify(hero);
    const partySnap = JSON.stringify(party);
    const monsterSnap = JSON.stringify(monster);
    applyMonsterHit(hero, party, monster, { rng: sequenceRng([0.99, 0.99, 0.99, 0]) });
    expect(JSON.stringify(hero)).toBe(heroSnap);
    expect(JSON.stringify(party)).toBe(partySnap);
    expect(JSON.stringify(monster)).toBe(monsterSnap);
  });
});

describe('applyMonsterHit — vulnerabilidades do herói', () => {
  it('debuff de fogo soma +25% contra monstro de comportamento mágico', () => {
    const hero = heroFixture({ hero: { debuff: FIRE_VULNERABILITY } });
    const monster = monsterFixture({ speciesId: 'elemental_fogo' }); // behavior: magico
    // dodge(0.99) -> dano base(0) -> dreno de mana(0.99 falha, pois behavior=magico)
    const result = applyMonsterHit(hero, [], monster, { rng: sequenceRng([0.99, 0, 0.99]) });

    // base = round((1+0+5-0-2)*1) = 4; *1.25 = 5
    expect(result.damage).toBe(5);
    expect(result.manaDrained).toBe(0);
  });

  it('debuff de corpo frágil soma +20% de dano físico, sem depender do tipo de monstro', () => {
    const hero = heroFixture({ hero: { debuff: PHYSICAL_VULNERABILITY } });
    const monster = monsterFixture({ speciesId: 'esqueleto' }); // behavior: defensivo, sem casos especiais
    const result = applyMonsterHit(hero, [], monster, { rng: sequenceRng([0.99, 0]) });

    // base = 4; *1.2 = 4.8 -> round 5
    expect(result.damage).toBe(5);
  });
});

describe('applyMonsterHit — passiva defensiva do Guerreiro', () => {
  it('20% de chance de reduzir o golpe recebido em 40%', () => {
    const hero = heroFixture({ className: 'Guerreiro' });
    const monster = monsterFixture({ speciesId: 'esqueleto' });
    // dodge(0.99) -> dano base(0) -> passiva guerreiro(0.1 < 0.2 dispara)
    const result = applyMonsterHit(hero, [], monster, { rng: sequenceRng([0.99, 0, 0.1]) });

    // base = 4; *0.6 = 2.4 -> round 2
    expect(result.damage).toBe(2);
    expect(result.defensivePassiveTriggered).toBe(true);
  });
});

describe('applyMonsterHit — escudo', () => {
  it('absorve parte do golpe e é consumido no processo', () => {
    const hero = heroFixture({ hero: { buffs: { shield: 0.5 } } });
    const monster = monsterFixture({ speciesId: 'esqueleto' });
    const result = applyMonsterHit(hero, [], monster, { rng: sequenceRng([0.99, 0]) });

    // base = 4; *(1-0.5) = 2
    expect(result.damage).toBe(2);
    expect(result.shieldConsumed).toBe(true);
    expect(result.hero.buffs?.shield).toBe(0);
  });
});

describe('applyMonsterHit — veneno', () => {
  it('poisonStrike do Assassino aplica veneno no herói e se consome', () => {
    const hero = heroFixture();
    const monster = monsterFixture({ speciesId: 'esqueleto', poisonStrike: true });
    const result = applyMonsterHit(hero, [], monster, { rng: sequenceRng([0.99, 0]) });

    expect(result.poisonApplied).toBe(true);
    // poisonDmg = max(2, round(5*0.35)) = max(2, 2) = 2
    expect(result.hero.buffs?.poisonTurns).toBe(3);
    expect(result.hero.buffs?.poisonDmg).toBe(2);
    expect(result.monster.poisonStrike).toBe(false);
  });

  it('comportamento venenoso pode envenenar o herói por conta própria', () => {
    const hero = heroFixture();
    const monster = monsterFixture({ speciesId: 'aranha' }); // behavior: venenoso
    // dodge(0.99) -> dano base(0) -> chance de veneno(0.1 < 0.35 dispara)
    const result = applyMonsterHit(hero, [], monster, { rng: sequenceRng([0.99, 0, 0.1]) });

    expect(result.poisonApplied).toBe(true);
    // poisonDmg = max(2, round(floor(5/3)*1)) = max(2, round(1)) = 2
    expect(result.hero.buffs?.poisonDmg).toBe(2);
  });
});

describe('applyMonsterHit — dreno de mana', () => {
  it('comportamento mágico pode drenar mana do herói', () => {
    const hero = heroFixture();
    const monster = monsterFixture({ speciesId: 'elemental_fogo' }); // behavior: magico
    // dodge(0.99) -> dano base(0) -> dreno(0.1 < 0.35 dispara)
    const result = applyMonsterHit(hero, [], monster, { rng: sequenceRng([0.99, 0, 0.1]) });

    // manaDrained = min(mp, 3 + floor(5/3)) = min(62, 4) = 4
    expect(result.manaDrained).toBe(4);
    expect(result.hero.mp).toBe(hero.mp - 4);
  });
});

describe('applyMonsterHit — poder de classe de inimigo', () => {
  it('só dispara no 3º ataque, multiplica o dano do Brutamontes em 1.7x', () => {
    const hero = heroFixture();
    const monster = monsterFixture({ attackCount: 2, enemyClassId: 'brutamontes' });
    // agressivo(0.99 falha) -> dodge(0.99) -> dano base(0)
    const result = applyMonsterHit(hero, [], monster, { rng: sequenceRng([0.99, 0.99, 0]) });

    expect(result.enemyClassPowerTriggered).toBe('brutamontes');
    // base = 4; *1.7 = 6.8 -> round 7
    expect(result.damage).toBe(7);
  });

  it('Feiticeiro drena a mana do herói e o efeito sobrevive até o dano final', () => {
    const hero = heroFixture({ hero: { mp: 20 } });
    const monster = monsterFixture({ attackCount: 2, enemyClassId: 'feiticeiro' });
    const result = applyMonsterHit(hero, [], monster, { rng: sequenceRng([0.99, 0.99, 0]) });

    expect(result.enemyClassPowerTriggered).toBe('feiticeiro');
    expect(result.hero.mp).toBeLessThan(20);
  });
});
