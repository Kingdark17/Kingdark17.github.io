import { describe, expect, it } from 'vitest';

import { DEBUFFS } from '../hero/catalog.js';
import { derivedStats } from '../hero/derived.js';
import type { Hero, HeroEquipment } from '../hero/hero.js';
import type { Attributes } from '../hero/stats.js';
import { fleeBonus } from './damage.js';
import { attemptFlee, FLEE_TARGET } from './flee.js';

const SEM_DEBUFF = DEBUFFS.find((d) => !d.effect)!;

function heroFixture(destreza: number): Hero {
  const attrs: Attributes = { forca: 10, destreza, constituicao: 10, intelecto: 10, sabedoria: 10, carisma: 10 };
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
  };
}

describe('attemptFlee', () => {
  it('soma o bônus de velocidade à rolagem', () => {
    const hero = heroFixture(30);
    const monstro = { speed: 1 };
    const bonus = fleeBonus(hero, monstro);
    expect(bonus).toBeGreaterThan(0);

    const resultado = attemptFlee(hero, monstro, 5);

    expect(resultado.bonus).toBe(bonus);
    expect(resultado.total).toBe(5 + bonus);
  });

  it('escapa quando o total alcança o alvo', () => {
    const lento = heroFixture(1);
    const rapido = { speed: 99 };
    expect(fleeBonus(lento, rapido)).toBe(0);

    expect(attemptFlee(lento, rapido, FLEE_TARGET).success).toBe(true);
    expect(attemptFlee(lento, rapido, FLEE_TARGET - 1).success).toBe(false);
  });

  it('devolve a rolagem que entrou, pra tela poder mostrar o dado', () => {
    expect(attemptFlee(heroFixture(10), { speed: 5 }, 17).roll).toBe(17);
  });
});
