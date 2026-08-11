import { describe, expect, it } from 'vitest';

import { seededRng } from '../rng.js';
import { displayName, instantiate, itemView, randomItem, statTags, type Item } from './item.js';
import { RARITIES, pickRarity, rarityById, rarityWeights } from './rarity.js';
import { TEMPLATES, templateById, templatesByCategory } from './templates.js';
import { powerScore, reforge, tierFor, tierFromScore, tierInfo } from './tiers.js';

const fixedNow = () => 1_700_000_000_000;

function espada(rarityId = 'comum'): Item {
  const template = templateById('espada');
  const rarity = rarityById(rarityId);
  if (!template || !rarity) throw new Error('fixture inválida');
  return instantiate(template, rarity, { rng: seededRng(1), now: fixedNow });
}

describe('catálogo', () => {
  it('mantém os 24 templates do jogo original', () => {
    expect(TEMPLATES).toHaveLength(24);
  });

  it('não tem id de template duplicado', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo template aponta para um sprite sem query de versão', () => {
    for (const t of TEMPLATES) {
      expect(t.sprite).toMatch(/^[a-z]+\/[a-z_]+\.png$/);
      expect(t.sprite).not.toContain('?v=');
    }
  });

  it('todo equipável tem pelo menos um stat', () => {
    for (const t of templatesByCategory('arma')) {
      expect(Object.keys(t.base).length).toBeGreaterThan(0);
    }
  });
});

describe('instantiate', () => {
  it('escala stats e valor pelo multiplicador da raridade', () => {
    const comum = espada('comum');
    // espada base: ataque 4, value 22
    expect(comum.stats.ataque).toBe(4);
    expect(comum.value).toBe(22);

    const epico = espada('epico'); // mult 2.2
    expect(epico.stats.ataque).toBe(9); // round(4 * 2.2)
    expect(epico.value).toBe(48); // round(22 * 2.2)
  });

  it('guarda só a chance do proc, não o objeto inteiro', () => {
    const item = espada('comum');
    // espada tem proc de queimadura com chance base 0.15
    expect(item.procChance).toBeCloseTo(0.15, 5);
    expect(item).not.toHaveProperty('proc');
    expect(item).not.toHaveProperty('icon');
    expect(item).not.toHaveProperty('desc');
    expect(item).not.toHaveProperty('rarityColor');
  });

  it('aumenta a chance do proc com a raridade, com teto de 0.5', () => {
    expect(espada('mitico').procChance).toBeCloseTo(0.15 + 3 * 0.05, 5);
  });
});

describe('nome e visão derivados', () => {
  it('não prefixa item comum', () => {
    expect(displayName(espada('comum'))).toBe('Espada');
  });

  it('prefixa com o rótulo da raridade', () => {
    expect(displayName(espada('lendario'))).toBe('Lendário Espada');
  });

  it('itemView remonta o que foi tirado do item', () => {
    const view = itemView(espada('raro'));
    expect(view.sprite).toBe('weapons/espada.png');
    expect(view.category).toBe('arma');
    expect(view.desc).toContain('lâmina');
    expect(view.rarityColorVar).toBe('--r-raro');
    expect(view.proc?.effect).toBe('queimadura');
  });

  it('lança em vez de devolver item quebrado quando o template sumiu', () => {
    expect(() => displayName({ templateId: 'nao_existe', rarity: 'comum' })).toThrow();
  });
});

describe('raridade', () => {
  it('comum e incomum não mudam de peso com a profundidade', () => {
    expect(rarityWeights(1)[0]).toBe(45);
    expect(rarityWeights(50)[0]).toBe(45);
    expect(rarityWeights(1)[1]).toBe(28);
    expect(rarityWeights(50)[1]).toBe(28);
  });

  it('raro+ fica mais provável no fundo da masmorra', () => {
    const raso = rarityWeights(1)[2] as number;
    const fundo = rarityWeights(20)[2] as number;
    expect(fundo).toBeGreaterThan(raso);
  });

  it('mítico continua mais raro que lendário mesmo no andar mais fundo', () => {
    const w = rarityWeights(100);
    expect(w[5] as number).toBeLessThan(w[4] as number);
  });

  it('é determinística com rng semeado', () => {
    const a = pickRarity(10, seededRng(42));
    const b = pickRarity(10, seededRng(42));
    expect(a.id).toBe(b.id);
  });

  it('sempre devolve uma raridade válida em toda a faixa do sorteio', () => {
    for (let seed = 0; seed < 200; seed++) {
      const r = pickRarity(7, seededRng(seed));
      expect(RARITIES.map((x) => x.id)).toContain(r.id);
    }
  });
});

describe('randomItem', () => {
  it('respeita a categoria pedida', () => {
    for (let seed = 0; seed < 30; seed++) {
      const item = randomItem({ category: 'material', rng: seededRng(seed), now: fixedNow });
      expect(itemView(item).category).toBe('material');
    }
  });

  it('aplica bônus de profundidade só em equipável', () => {
    const raso = randomItem({ category: 'arma', rarity: 'comum', floor: 1, rng: seededRng(3), now: fixedNow });
    const fundo = randomItem({ category: 'arma', rarity: 'comum', floor: 40, rng: seededRng(3), now: fixedNow });
    expect(fundo.foundFloor).toBe(40);
    expect(raso.foundFloor).toBeUndefined();
    expect(fundo.stats.ataque as number).toBeGreaterThanOrEqual(raso.stats.ataque as number);
  });

  it('não marca foundFloor em material, mesmo fundo', () => {
    const item = randomItem({ category: 'material', floor: 40, rng: seededRng(5), now: fixedNow });
    expect(item.foundFloor).toBeUndefined();
  });
});

describe('tiers', () => {
  it('mapeia pontuação para tier pelos mínimos da tabela', () => {
    expect(tierFromScore(0)).toBe('E');
    expect(tierFromScore(24)).toBe('E');
    expect(tierFromScore(25)).toBe('D');
    expect(tierFromScore(250)).toBe('MAX');
    expect(tierFromScore(9999)).toBe('MAX');
  });

  it('consumível e material não têm tier', () => {
    const pocao = randomItem({ category: 'consumivel', rng: seededRng(1), now: fixedNow });
    expect(tierFor(pocao)).toBeNull();
    expect(powerScore(pocao)).toBe(0);
  });

  it('raridade maior gera pontuação maior', () => {
    expect(powerScore(espada('mitico'))).toBeGreaterThan(powerScore(espada('comum')));
  });

  it('progresso do MAX é 100', () => {
    const info = tierInfo({ ...espada('mitico'), tierAdjustment: 999 });
    expect(info.tier).toBe('MAX');
    expect(info.next).toBeNull();
    expect(info.progress).toBe(100);
  });
});

describe('reforge', () => {
  it('não muta o item original', () => {
    const original = espada('comum');
    const snapshot = JSON.stringify(original);
    reforge(original, 2);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it('leva o item para o tier alvo', () => {
    const { item, result } = reforge(espada('comum'), 3);
    expect(result.changed).toBe(true);
    expect(tierFor(item)).toBe(result.newTier);
  });

  it('conta as reforjas', () => {
    const um = reforge(espada('comum'), 1);
    const dois = reforge(um.item, 1);
    expect(dois.item.reforgeCount).toBe(2);
  });

  it('delta que não move o tier devolve cópia sem mudança', () => {
    const original = espada('comum');
    const { item, result } = reforge(original, 0);
    expect(result.changed).toBe(false);
    expect(item).not.toBe(original);
    expect(item.stats).toEqual(original.stats);
  });

  it('não passa dos limites da tabela de tiers', () => {
    const { result } = reforge(espada('comum'), -50);
    expect(result.newRank).toBe(0);
  });
});

describe('statTags', () => {
  it('marca sinal e polaridade', () => {
    const tags = statTags({ stats: { ataque: 5, velocidade: -2 } });
    expect(tags).toContainEqual({ text: '+5 Ataque', positive: true });
    expect(tags).toContainEqual({ text: '-2 Velocidade', positive: false });
  });

  it('ignora stat zerado', () => {
    expect(statTags({ stats: { ataque: 0 } })).toHaveLength(0);
  });
});
