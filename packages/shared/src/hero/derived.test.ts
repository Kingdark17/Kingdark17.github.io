import { describe, expect, it } from 'vitest';

import {
  attrModifier,
  derivedStats,
  equipmentBonus,
  equipmentCap,
  equipmentStat,
  totalAttributePoints,
  xpForLevel,
} from './derived.js';
import type { Attributes, HeroCore } from './stats.js';

function attrs(overrides: Partial<Attributes> = {}): Attributes {
  return {
    forca: 10,
    destreza: 10,
    constituicao: 10,
    intelecto: 10,
    sabedoria: 10,
    carisma: 10,
    ...overrides,
  };
}

function hero(overrides: Partial<HeroCore> = {}): HeroCore {
  return { level: 1, attrs: attrs(), equip: {}, ...overrides };
}

describe('derivedStats', () => {
  it('reproduz as fórmulas do jogo original para um herói base', () => {
    const d = derivedStats(hero());

    // 20 + nível*5 + constituição*10
    expect(d.maxHp).toBe(125);
    // 10 + nível*2 + intelecto*5
    expect(d.maxMp).toBe(62);
    expect(d.dmgFisico).toBe(20);
    expect(d.dmgMagico).toBe(30);
    expect(d.velocidade).toBe(10);
    expect(d.descontoLoja).toBe(5);
  });

  it('é idempotente — chamar de novo não acumula', () => {
    const h = hero({ level: 7 });
    expect(derivedStats(h)).toEqual(derivedStats(h));
  });

  it('aplica a penalidade de crítico apenas quando o debuff está ativo', () => {
    expect(derivedStats(hero()).critico).toBe(10);
    expect(derivedStats(hero(), { critPenalty: true }).critico).toBe(2);
  });

  it('nunca deixa crítico ou esquiva ficarem negativos', () => {
    const fraco = hero({ attrs: attrs({ destreza: 1 }) });
    expect(derivedStats(fraco, { critPenalty: true }).critico).toBe(0);
    expect(derivedStats(fraco).esquiva).toBeGreaterThanOrEqual(0);
  });
});

describe('teto de equipamento (semântica do servidor)', () => {
  it('limita o bônus de vida ao teto do nível', () => {
    const h = hero({ equip: { armadura: { stats: { vida: 9999 } } } });
    // teto no nível 1 é 550, então maxHp = 125 + 550
    expect(equipmentCap(1)).toBe(550);
    expect(derivedStats(h).maxHp).toBe(675);
  });

  it('trata stat negativo de item como zero nos stats com teto', () => {
    const h = hero({ equip: { armadura: { stats: { vida: -50 } } } });
    // O cliente antigo subtraía 50 aqui; o servidor sempre zerou. Vale o servidor.
    expect(derivedStats(h).maxHp).toBe(125);
  });

  it('mantém a soma livre nos stats que o servidor não policia', () => {
    const h = hero({ equip: { acessorio: { stats: { esquiva: -3 } } } });
    expect(derivedStats(h).esquiva).toBe(2);
  });

  it('soma os quatro slots e respeita o teto no total, não só por item', () => {
    const h = hero({
      equip: {
        arma: { stats: { vida: 300 } },
        secundaria: { stats: { vida: 300 } },
        armadura: { stats: { vida: 300 } },
      },
    });
    expect(equipmentStat(h.equip, 'vida', equipmentCap(1))).toBe(550);
  });
});

describe('entrada corrompida', () => {
  it('não quebra com stats ausentes, NaN ou string vinda de save editado', () => {
    const h = hero({
      equip: {
        arma: { stats: { vida: Number.NaN } },
        armadura: { stats: { vida: '80' as unknown as number } },
        acessorio: null,
      },
    });
    expect(Number.isFinite(derivedStats(h).maxHp)).toBe(true);
    expect(derivedStats(h).maxHp).toBe(205);
  });

  it('soma zero quando não há nada equipado', () => {
    expect(equipmentBonus({})).toMatchObject({ vida: 0, mana: 0, esquiva: 0 });
  });
});

describe('progressão', () => {
  it('calcula o XP necessário por nível', () => {
    expect(xpForLevel(1)).toBe(40);
    expect(xpForLevel(2)).toBe(75);
    expect(xpForLevel(10)).toBe(355);
  });

  it('deriva o modificador clássico de atributo', () => {
    expect(attrModifier(10)).toBe(0);
    expect(attrModifier(18)).toBe(4);
    expect(attrModifier(3)).toBe(-4);
  });

  it('soma os seis atributos', () => {
    expect(totalAttributePoints(attrs())).toBe(60);
  });
});
