import { describe, expect, it } from 'vitest';

import { instantiate } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import { seededRng } from '../rng.js';
import { classById, DEBUFFS, raceById } from './catalog.js';
import { buildApprentice, buildHero, hydrateSavedHero, trainAtGuild, type Hero } from './hero.js';
import {
  masteryBattlesFor,
  masteryDamageMult,
  masteryLevel,
  masteryProgress,
  masteryWeapons,
  veteranMasteryBattles,
  winBattle,
  wieldsMasteryWeapon,
} from './mastery.js';

const SEM_DEBUFF = DEBUFFS.find((d) => !d.effect)!;
const HUMANO = raceById('humano')!;

function heroi(classe: string, extra: Partial<Hero> = {}): Hero {
  return { ...buildHero({ name: 'T', race: HUMANO, cls: classById(classe)!, debuff: SEM_DEBUFF, chosenPowerIds: [] }, seededRng(1)), ...extra };
}

function comArma(hero: Hero, templateId: string | null): Hero {
  const arma = templateId ? { ...instantiate(templateById(templateId)!, RARITIES[0]!), equipped: true } : null;
  return { ...hero, equip: { ...hero.equip, arma } };
}

function aprendiz(): Hero {
  return buildApprentice({ name: 'A', race: HUMANO, debuff: SEM_DEBUFF }, seededRng(1));
}

describe('níveis de maestria', () => {
  it('cada nível pede 10 vitórias a mais que o anterior: 10, 30, 60… 550', () => {
    expect([0, 1, 2, 3, 4, 10].map(masteryBattlesFor)).toEqual([0, 10, 30, 60, 100, 550]);
  });

  it('o teto é o nível 10', () => {
    expect(masteryBattlesFor(11)).toBe(550);
    expect(masteryLevel(549)).toBe(9);
    expect(masteryLevel(550)).toBe(10);
    expect(masteryLevel(100_000)).toBe(10);
  });

  it('sobe exatamente no limiar', () => {
    expect(masteryLevel(9)).toBe(0);
    expect(masteryLevel(10)).toBe(1);
    expect(masteryLevel(29)).toBe(1);
    expect(masteryLevel(30)).toBe(2);
  });

  it('contagem estragada é zero, não nível', () => {
    expect(masteryLevel(Number.NaN)).toBe(0);
    expect(masteryLevel(-40)).toBe(0);
    expect(masteryLevel(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('masteryProgress', () => {
  it('conta a partir do nível atual', () => {
    expect(masteryProgress({ masteryBattles: 35 })).toEqual({ level: 2, intoLevel: 5, toNext: 30, maxed: false, bonus: 0.04 });
  });

  it('no teto não falta nada e o bônus é +20%', () => {
    expect(masteryProgress({ masteryBattles: 600 })).toEqual({ level: 10, intoLevel: 0, toNext: 0, maxed: true, bonus: 0.2 });
  });

  it('herói sem contagem está no começo do nível 0', () => {
    expect(masteryProgress({})).toEqual({ level: 0, intoLevel: 0, toNext: 10, maxed: false, bonus: 0 });
  });
});

describe('arma da classe', () => {
  it('é a de afinidade 100 — bárbaro e bardo têm duas', () => {
    expect(masteryWeapons(classById('guerreiro')!)).toEqual(['espada']);
    expect(masteryWeapons(classById('barbaro')!)).toEqual(['machado', 'marreta']);
    expect(masteryWeapons(classById('bardo')!)).toEqual(['adaga', 'violao']);
  });

  it('toda classe domina pelo menos uma arma', () => {
    for (const id of ['guerreiro', 'mago', 'ladino', 'clerigo', 'barbaro', 'arqueiro', 'paladino', 'necromante', 'druida', 'monge', 'bardo', 'cacador']) {
      expect(masteryWeapons(classById(id)!).length, id).toBeGreaterThan(0);
    }
  });

  it('só conta com ela na mão principal', () => {
    expect(wieldsMasteryWeapon(comArma(heroi('guerreiro'), 'espada'))).toBe(true);
    expect(wieldsMasteryWeapon(comArma(heroi('guerreiro'), 'machado'))).toBe(false);
  });

  it('mão vazia não é arma da classe, mesmo com a afinidade dando 100 pra ela', () => {
    expect(wieldsMasteryWeapon(comArma(heroi('guerreiro'), null))).toBe(false);
  });

  it('o Aprendiz não tem classe, então não tem arma da classe', () => {
    expect(wieldsMasteryWeapon(comArma(aprendiz(), 'espada'))).toBe(false);
  });
});

describe('masteryDamageMult', () => {
  it('+2% por nível com a arma da classe', () => {
    expect(masteryDamageMult(comArma(heroi('guerreiro', { masteryBattles: 60 }), 'espada'))).toBeCloseTo(1.06);
    expect(masteryDamageMult(comArma(heroi('barbaro', { masteryBattles: 550 }), 'marreta'))).toBeCloseTo(1.2);
  });

  it('sem a arma da classe, nada', () => {
    expect(masteryDamageMult(comArma(heroi('guerreiro', { masteryBattles: 550 }), 'machado'))).toBe(1);
  });

  it('no nível 0, nada', () => {
    expect(masteryDamageMult(comArma(heroi('guerreiro', { masteryBattles: 9 }), 'espada'))).toBe(1);
  });
});

describe('winBattle', () => {
  it('soma uma vitória', () => {
    const { hero, leveledUp, level } = winBattle(heroi('mago', { masteryBattles: 4 }));
    expect(hero.masteryBattles).toBe(5);
    expect(leveledUp).toBe(false);
    expect(level).toBe(0);
  });

  it('avisa quando a vitória completa o nível', () => {
    const { hero, leveledUp, level } = winBattle(heroi('mago', { masteryBattles: 29 }));
    expect(hero.masteryBattles).toBe(30);
    expect(leveledUp).toBe(true);
    expect(level).toBe(2);
  });

  it('continua contando depois do teto, sem subir de nível', () => {
    const { hero, leveledUp, level } = winBattle(heroi('mago', { masteryBattles: 550 }));
    expect(hero.masteryBattles).toBe(551);
    expect(leveledUp).toBe(false);
    expect(level).toBe(10);
  });

  it('o Aprendiz não ganha: a maestria é da classe', () => {
    const antes = aprendiz();
    expect(winBattle(antes).hero).toBe(antes);
  });

  it('contagem estragada recomeça do zero em vez de virar NaN', () => {
    expect(winBattle(heroi('mago', { masteryBattles: Number.NaN })).hero.masteryBattles).toBe(1);
  });

  it('não muta o herói', () => {
    const antes = heroi('mago', { masteryBattles: 3 });
    winBattle(antes);
    expect(antes.masteryBattles).toBe(3);
  });
});

describe('quem já tinha personagem', () => {
  it('converte monstros em vitórias, 1,6 por sala', () => {
    expect(veteranMasteryBattles(160)).toBe(100);
    expect(veteranMasteryBattles(1)).toBe(0);
    // 16 ÷ 1,6 em ponto flutuante dá 9,999…; a conta em inteiros dá 10.
    expect(veteranMasteryBattles(16)).toBe(10);
    expect(veteranMasteryBattles(Number.NaN)).toBe(0);
  });

  it('ao carregar, o save sem contagem começa com as vitórias de antes', () => {
    const { masteryBattles: _, ...antigo } = heroi('guerreiro', { killCount: 160 });
    expect(hydrateSavedHero(antigo as Hero).masteryBattles).toBe(100);
  });

  it('a contagem gravada é a que vale, e o killCount não é relido', () => {
    expect(hydrateSavedHero(heroi('guerreiro', { killCount: 900, masteryBattles: 7 })).masteryBattles).toBe(7);
  });

  it('contagem gravada estragada volta a sair do killCount', () => {
    expect(hydrateSavedHero(heroi('guerreiro', { killCount: 16, masteryBattles: Number.NaN })).masteryBattles).toBe(10);
  });

  it('o Aprendiz sem contagem fica em 0', () => {
    const { masteryBattles: _, ...antigo } = aprendiz();
    expect(hydrateSavedHero({ ...antigo, killCount: 50 } as Hero).masteryBattles).toBe(0);
  });
});

describe('herói novo', () => {
  it('nasce Aprendiz com 0 e treina na Guilda com 0', () => {
    const novo = aprendiz();
    expect(novo.masteryBattles).toBe(0);
    expect(trainAtGuild(novo, classById('guerreiro')!).hero.masteryBattles).toBe(0);
  });
});
