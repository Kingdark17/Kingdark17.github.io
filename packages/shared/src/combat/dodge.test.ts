import { describe, expect, it } from 'vitest';

import { buildHero } from '../hero/hero.js';
import { CLASSES, DEBUFFS, RACES } from '../hero/catalog.js';
import { seededRng } from '../rng.js';
import { attemptDodge, ESQUIVA_TARGET } from './dodge.js';
import { attemptFlee, FLEE_TARGET } from './flee.js';

function heroi() {
  return buildHero(
    { name: 'T', race: RACES[0]!, cls: CLASSES[0]!, debuff: DEBUFFS.find((d) => !d.effect)!, chosenPowerIds: [] },
    seededRng(3),
  );
}

describe('attemptDodge', () => {
  it('é a regra da fuga: mesmo alvo, mesmo bônus', () => {
    expect(ESQUIVA_TARGET).toBe(FLEE_TARGET);
    const hero = heroi();
    const lento = { speed: 1 };
    for (const roll of [1, 7, 11, 12, 20]) {
      const esquiva = attemptDodge(hero, lento, roll);
      const fuga = attemptFlee(hero, lento, roll);
      expect({ roll, total: esquiva.total, success: esquiva.success }).toEqual({ roll, total: fuga.total, success: fuga.success });
    }
  });

  it('12 ou mais esquiva; 11 sem bônus não', () => {
    const hero = heroi();
    const igual = { speed: hero.derived.velocidade };
    expect(attemptDodge(hero, igual, 12).success).toBe(true);
    expect(attemptDodge(hero, igual, 11).success).toBe(false);
  });

  it('só aceita número de d20', () => {
    expect(() => attemptDodge(heroi(), { speed: 5 }, 0)).toThrow(RangeError);
    expect(() => attemptDodge(heroi(), { speed: 5 }, 21)).toThrow(RangeError);
  });
});
