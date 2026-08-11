import { describe, expect, it } from 'vitest';

import { buildHero, type Hero } from '../hero/hero.js';
import { classByName, raceByName, DEBUFFS } from '../hero/catalog.js';
import { instantiate } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import { generate } from '../monsters/generate.js';
import { seededRng } from '../rng.js';
import { fleeBonus, modifyDamageByAffinity, otherEquipAtk, weaponAtkContribution } from './damage.js';
import { freshCombatMonster, type CombatMonster } from './monster-state.js';
import { applyPowerStatus, tickMonsterDot } from './status-effects.js';
import { applyWeaponProc } from './weapon-proc.js';

const HUMANO = raceByName('Humano')!;
const GUERREIRO = classByName('Guerreiro')!;
const MAGO = classByName('Mago')!;
const SEM_DEBUFF = DEBUFFS.find((d) => !d.effect)!;
const FLEE_DEBUFF = DEBUFFS.find((d) => d.effect === 'fleePenalty')!;

function heroi(cls = GUERREIRO, debuff = SEM_DEBUFF): Hero {
  return buildHero({ name: 'T', race: HUMANO, cls, debuff, chosenPowerNames: [] }, seededRng(1));
}

function monstro(floor = 1): CombatMonster {
  return freshCombatMonster(generate(floor, { rng: seededRng(1) }));
}

describe('fleeBonus', () => {
  it('sem bônus quando a velocidade é igual', () => {
    const hero = heroi();
    const monster = { ...monstro(), speed: hero.derived.velocidade };
    expect(fleeBonus(hero, monster)).toBe(0);
  });

  it('+1 com vantagem pequena, +2 com vantagem de 5 ou mais', () => {
    const hero = heroi();
    const base = hero.derived.velocidade;
    expect(fleeBonus(hero, { ...monstro(), speed: base - 1 })).toBe(1);
    expect(fleeBonus(hero, { ...monstro(), speed: base - 5 })).toBe(2);
  });

  it('debuff de fuga tira 2, podendo ficar negativo', () => {
    const hero = heroi(GUERREIRO, FLEE_DEBUFF);
    const monster = { ...monstro(), speed: hero.derived.velocidade };
    expect(fleeBonus(hero, monster)).toBe(-2);
  });
});

describe('weaponAtkContribution', () => {
  it('escala o ataque da arma pela afinidade', () => {
    const hero = heroi();
    const ataqueArma = hero.equip.arma!.stats.ataque!;
    expect(weaponAtkContribution(hero, 100)).toBe(ataqueArma);
    expect(weaponAtkContribution(hero, 50)).toBe(Math.round(ataqueArma * 0.5));
  });

  it('zero sem arma equipada', () => {
    expect(weaponAtkContribution({ equip: {} }, 100)).toBe(0);
  });
});

describe('otherEquipAtk', () => {
  it('soma ataque de armadura/acessório sem afinidade', () => {
    const hero = heroi();
    const colar = instantiate(templateById('colar_forca')!, RARITIES[0]!); // base ataque:2
    const comAcessorio = { ...hero, equip: { ...hero.equip, acessorio: colar } };
    expect(otherEquipAtk(comAcessorio)).toBe(colar.stats.ataque);
  });

  it('aplica afinidade de classe só na secundária', () => {
    const hero = heroi(MAGO);
    const adaga = instantiate(templateById('adaga')!, RARITIES[0]!); // afinidade mago-adaga: 45%
    const comSecundaria = { ...hero, equip: { ...hero.equip, secundaria: adaga } };
    const afinidade = MAGO.affinity.adaga!;
    expect(otherEquipAtk(comSecundaria)).toBe(Math.round(adaga.stats.ataque! * afinidade / 100));
  });
});

describe('modifyDamageByAffinity', () => {
  it('fraqueza aumenta 25%, resistência reduz 20% (ou 10% com halfResist)', () => {
    const monster = monstro();
    expect(modifyDamageByAffinity(monster, 'fisico', 'nenhuma', 100, 'fisico', false).dmg).toBe(125);
    expect(modifyDamageByAffinity(monster, 'nenhuma', 'fisico', 100, 'fisico', false).dmg).toBe(80);
    expect(modifyDamageByAffinity(monster, 'nenhuma', 'fisico', 100, 'fisico', true).dmg).toBe(90);
  });

  it('vulnerável aumenta o dano e consome 1 turno, sem mutar a entrada', () => {
    const monster: CombatMonster = { ...monstro(), status: { vulneravel: { turns: 2, amount: 0.15 } } };
    const snapshot = JSON.stringify(monster);
    const result = modifyDamageByAffinity(monster, 'nenhuma', 'nenhuma', 100, 'fisico', false);
    expect(result.dmg).toBe(115);
    expect(result.monster.status?.vulneravel?.turns).toBe(1);
    expect(JSON.stringify(monster)).toBe(snapshot);
  });

  it('remove vulnerável quando os turnos acabam', () => {
    const monster: CombatMonster = { ...monstro(), status: { vulneravel: { turns: 1, amount: 0.2 } } };
    const result = modifyDamageByAffinity(monster, 'nenhuma', 'nenhuma', 100, 'fisico', false);
    expect(result.monster.status?.vulneravel).toBeUndefined();
  });

  it('Muralha Sombria reduz 35% e consome 1 guardHits, sinalizando pra narração', () => {
    const monster: CombatMonster = { ...monstro(), guardHits: 2 };
    const result = modifyDamageByAffinity(monster, 'nenhuma', 'nenhuma', 100, 'fisico', false);
    expect(result.dmg).toBe(65);
    expect(result.monster.guardHits).toBe(1);
    expect(result.guardConsumed).toBe(true);
  });

  it('nunca desce de 1', () => {
    const monster = monstro();
    expect(modifyDamageByAffinity(monster, 'nenhuma', 'fisico', 1, 'fisico', false).dmg).toBeGreaterThanOrEqual(1);
  });
});

describe('tickMonsterDot', () => {
  it('soma dano de queimadura + sangramento no mesmo turno', () => {
    const monster: CombatMonster = {
      ...monstro(),
      hp: 100,
      status: { queimadura: { turns: 2, dmg: 5 }, sangramento: { turns: 1, dmg: 3 } },
    };
    const result = tickMonsterDot(monster);
    expect(result.damage).toBe(8);
    expect(result.monster.hp).toBe(92);
    expect(result.monster.status?.queimadura?.turns).toBe(1);
    expect(result.monster.status?.sangramento).toBeUndefined(); // zerou e some
  });

  it('sem status ativo, dano zero e não mexe no hp', () => {
    const monster = monstro();
    const result = tickMonsterDot(monster);
    expect(result.damage).toBe(0);
    expect(result.monster.hp).toBe(monster.hp);
  });

  it('marca derrotado quando o dano contínuo zera a vida', () => {
    const monster: CombatMonster = { ...monstro(), hp: 3, status: { veneno: { turns: 1, dmg: 5 } } };
    const result = tickMonsterDot(monster);
    expect(result.defeated).toBe(true);
    expect(result.monster.hp).toBeLessThanOrEqual(0);
  });

  it('não muta o monstro recebido', () => {
    const monster: CombatMonster = { ...monstro(), status: { queimadura: { turns: 3, dmg: 4 } } };
    const snapshot = JSON.stringify(monster);
    tickMonsterDot(monster);
    expect(JSON.stringify(monster)).toBe(snapshot);
  });
});

describe('applyPowerStatus', () => {
  const derived = { dmgFisico: 20, dmgMagico: 30 };

  it('atordoado acumula turnos em vez de sobrescrever', () => {
    const monster: CombatMonster = { ...monstro(), status: { atordoado: 1 } };
    const result = applyPowerStatus({ status: 'atordoado', turns: 2 }, monster, derived);
    expect(result.status?.atordoado).toBe(3);
  });

  it('dano contínuo escala pelo MAIOR entre físico e mágico do herói', () => {
    const monster = monstro();
    const result = applyPowerStatus({ status: 'queimadura', dotRatio: 0.2 }, monster, derived);
    // maior é dmgMagico (30) * 0.2 = 6
    expect(result.status?.queimadura?.dmg).toBe(6);
  });

  it('status de porcentagem (vulneravel/lento/enfraquecido) usa amount', () => {
    const monster = monstro();
    const result = applyPowerStatus({ status: 'vulneravel', turns: 3, amount: 0.2 }, monster, derived);
    expect(result.status?.vulneravel).toEqual({ turns: 3, amount: 0.2 });
  });

  it('sem status no poder, devolve o monstro como está', () => {
    const monster = monstro();
    expect(applyPowerStatus({}, monster, derived)).toBe(monster);
  });
});

describe('applyWeaponProc', () => {
  it('nunca dispara quando o rolo falha', () => {
    const hero = heroi(); // Guerreiro com espada, proc queimadura chance 0.15
    const monster = monstro();
    const result = applyWeaponProc(hero, monster, () => 0.99);
    expect(result.triggered).toBeNull();
    expect(result.monster).toBe(monster);
  });

  it('aplica queimadura escalada pelo dano físico do herói', () => {
    const hero = heroi();
    const monster = monstro();
    const result = applyWeaponProc(hero, monster, () => 0);
    expect(result.triggered?.effect).toBe('queimadura');
    expect(result.monster.status?.queimadura?.dmg).toBe(Math.max(2, Math.round(hero.derived.dmgFisico * 0.3)));
  });

  it('mana_gratis cura mana em vez de mexer no monstro', () => {
    const mago = heroi(MAGO); // cajado tem proc mana_gratis
    const machucado = { ...mago, mp: 0 };
    const monster = monstro();
    const result = applyWeaponProc(machucado, monster, () => 0);
    expect(result.triggered?.effect).toBe('mana_gratis');
    expect(result.hero.mp).toBe(Math.min(machucado.maxMp, 6));
    expect(result.monster).toEqual(monster); // monstro não muda nesse proc (conteúdo, não referência)
  });

  it('sem arma equipada, não faz nada', () => {
    const hero = { ...heroi(), equip: {} };
    const result = applyWeaponProc(hero, monstro(), () => 0);
    expect(result.triggered).toBeNull();
  });
});
