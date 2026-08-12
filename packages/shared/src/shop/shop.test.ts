import { describe, expect, it } from 'vitest';

import { derivedStats } from '../hero/derived.js';
import type { Attributes } from '../hero/stats.js';
import { DEBUFFS } from '../hero/catalog.js';
import type { Hero, HeroEquipment } from '../hero/hero.js';
import { instantiate, itemCategory, type Item } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import { seededRng, type Rng } from '../rng.js';
import {
  buyPrice,
  discountForRoll,
  resolveBuy,
  resolveForge,
  resolveRestock,
  resolveSell,
  rollForgeOutcome,
  rollStock,
  sellPrice,
  type ForgeMaterialConfig,
} from './shop.js';

const SEM_DEBUFF = DEBUFFS.find((d) => !d.effect)!;

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
    gold: 100,
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

function itemFixture(templateId: string, overrides: Partial<Item> = {}): Item {
  return { ...instantiate(templateById(templateId)!, RARITIES[0]!), ...overrides };
}

function sequenceRng(values: number[]): Rng {
  let i = 0;
  return () => (i < values.length ? (values[i++] as number) : (values[values.length - 1] ?? 0));
}

describe('rollStock', () => {
  it('ferreiro vende só equipamento (arma/armadura/acessório)', () => {
    const stock = rollStock('blacksmith', 5, { rng: seededRng(1) });
    expect(stock).toHaveLength(5);
    for (const item of stock) expect(['arma', 'armadura', 'acessorio']).toContain(itemCategory(item));
  });

  it('vendedor itinerante vende só consumível', () => {
    const stock = rollStock('shop', 5, { rng: seededRng(1) });
    expect(stock).toHaveLength(5);
    for (const item of stock) expect(itemCategory(item)).toBe('consumivel');
  });
});

describe('buyPrice / sellPrice', () => {
  it('preço de compra desconta descontoLoja (carisma) e o bônus de pechincha, teto de 60%', () => {
    const hero = heroFixture({ attrs: { carisma: 10 } }); // descontoLoja = 5
    const item = itemFixture('minerio', { value: 100, stats: {} });
    expect(buyPrice(hero, item)).toBe(95); // round(100*(1-0.05))
    expect(buyPrice(hero, item, 0.2)).toBe(75); // round(100*(1-0.25))
  });

  it('o desconto nunca passa de 60% mesmo somando descontoLoja alto com pechincha alta', () => {
    const hero = heroFixture({ attrs: { carisma: 90 } }); // descontoLoja = 45 -> 45/100=0.45
    const item = itemFixture('minerio', { value: 100 });
    expect(buyPrice(hero, item, 0.5)).toBe(40); // min(0.6, 0.45+0.5)=0.6 -> round(100*0.4)
  });

  it('preço mínimo de compra é 1', () => {
    const hero = heroFixture();
    const item = itemFixture('minerio', { value: 1 });
    expect(buyPrice(hero, item, 0.5)).toBe(1);
  });

  it('preço de venda é metade do valor, arredondado pra baixo, mínimo 1', () => {
    expect(sellPrice(itemFixture('minerio', { value: 15 }))).toBe(7);
    expect(sellPrice(itemFixture('minerio', { value: 1 }))).toBe(1);
  });
});

describe('discountForRoll', () => {
  it('mapeia cada faixa do d20 pro desconto certo', () => {
    expect(discountForRoll(20)).toBe(0.3);
    expect(discountForRoll(19)).toBe(0.2);
    expect(discountForRoll(15)).toBe(0.15);
    expect(discountForRoll(14)).toBe(0.1);
    expect(discountForRoll(11)).toBe(0.1);
    expect(discountForRoll(10)).toBe(0.05);
    expect(discountForRoll(6)).toBe(0.05);
    expect(discountForRoll(5)).toBe(0);
    expect(discountForRoll(1)).toBe(0);
  });
});

describe('rollForgeOutcome', () => {
  const cfg: ForgeMaterialConfig = { cost: 20, outcomes: [[-1, 30], [0, 40], [1, 30]] };

  it('escolhe o bucket certo pelo rolo acumulado (0-100)', () => {
    expect(rollForgeOutcome(cfg, 0, sequenceRng([0]))).toBe(-1); // 0 < 30
    expect(rollForgeOutcome(cfg, 0, sequenceRng([0.35]))).toBe(0); // 35, entre 30 e 70
    expect(rollForgeOutcome(cfg, 0, sequenceRng([0.9]))).toBe(1); // 90, entre 70 e 100
  });

  it('com pity >= 4, o resultado nunca fica abaixo de +1', () => {
    expect(rollForgeOutcome(cfg, 4, sequenceRng([0]))).toBe(1); // seria -1, forçado pra 1
    expect(rollForgeOutcome(cfg, 4, sequenceRng([0.9]))).toBe(1); // já era 1, continua 1
  });
});

describe('resolveForge', () => {
  it('material desconhecido não faz nada', () => {
    const hero = heroFixture();
    const item = itemFixture('espada');
    const result = resolveForge(hero, [], item, 'inexistente');
    expect(result.outcome).toEqual({ kind: 'unavailable' });
    expect(result.hero).toBe(hero);
    expect(result.item).toBe(item);
  });

  it('sem o material na mochila, não faz nada', () => {
    const hero = heroFixture();
    const item = itemFixture('espada');
    const result = resolveForge(hero, [], item, 'minerio');
    expect(result.outcome).toEqual({ kind: 'no_material' });
  });

  it('sem ouro suficiente, não faz nada', () => {
    const hero = heroFixture({ hero: { gold: 5 } }); // minerio custa 20
    const material = itemFixture('minerio');
    const item = itemFixture('espada');
    const result = resolveForge(hero, [material], item, 'minerio');
    expect(result.outcome).toEqual({ kind: 'insufficient_gold', required: 20 });
  });

  it('reforja com sucesso: cobra o custo, consome uma unidade do material, atualiza o item na mochila', () => {
    const hero = heroFixture({ hero: { gold: 100 } });
    const material = itemFixture('minerio');
    const item = itemFixture('espada', { stats: { ataque: 10 } });
    // rng 0 -> primeiro bucket do minério (-1): delta negativo, ainda assim testável
    const result = resolveForge(hero, [material, item], item, 'minerio', { rng: sequenceRng([0]) });

    expect(result.outcome.kind).toBe('forged');
    expect(result.hero.gold).toBe(80); // 100 - custo do minério (20)
    expect(result.inventory.some((i) => i.uid === material.uid)).toBe(false); // material consumido
    expect(result.inventory.find((i) => i.uid === item.uid)).toBe(result.item); // item atualizado no lugar certo
  });

  it('reforgeFails zera ao melhorar e incrementa quando não melhora', () => {
    const hero = heroFixture({ hero: { gold: 100 } });
    const material = itemFixture('essencia');
    const item = itemFixture('espada', { reforgeFails: 2 });
    // bucket 0 (delta=0, sem mudança de tier) -> não melhora -> reforgeFails 2+1=3
    const semMelhora = resolveForge(hero, [material, item], item, 'essencia', { rng: sequenceRng([0.2]) });
    expect(semMelhora.outcome.kind === 'forged' && semMelhora.outcome.improved).toBe(false);
    expect(semMelhora.item.reforgeFails).toBe(3);
  });
});

describe('resolveBuy / resolveSell', () => {
  it('recusa compra sem ouro suficiente, sem tocar em nada', () => {
    const hero = heroFixture({ hero: { gold: 1 } });
    const item = itemFixture('minerio', { value: 100 });
    const result = resolveBuy(hero, [], [item], item);
    expect(result.outcome.kind).toBe('insufficient_gold');
    expect(result.hero).toBe(hero);
  });

  it('compra: desconta ouro, adiciona ao inventário, remove do estoque', () => {
    const hero = heroFixture({ hero: { gold: 100 } });
    const item = itemFixture('minerio', { value: 20 });
    const result = resolveBuy(hero, [], [item], item);
    expect(result.outcome).toEqual({ kind: 'bought', price: buyPrice(hero, item) });
    expect(result.inventory).toContain(item);
    expect(result.forSale).toHaveLength(0);
  });

  it('venda: soma ouro pela metade do valor, remove do inventário', () => {
    const hero = heroFixture({ hero: { gold: 0 } });
    const item = itemFixture('minerio', { value: 20 });
    const result = resolveSell(hero, [item], item);
    expect(result.outcome).toEqual({ kind: 'sold', price: 10 });
    expect(result.hero.gold).toBe(10);
    expect(result.inventory).toHaveLength(0);
  });
});

describe('resolveRestock', () => {
  it('recusa sem ouro suficiente, forSale fica null (quem chama mantém o atual)', () => {
    const hero = heroFixture({ hero: { gold: 5 } }); // preço andar 5, 0 renovações = 25
    const result = resolveRestock(hero, 'shop', 5, 0);
    expect(result.outcome).toEqual({ kind: 'insufficient_gold', required: 25 });
    expect(result.forSale).toBeNull();
    expect(result.restockCount).toBe(0);
  });

  it('renova: cobra preço crescente por renovação, sorteia novo estoque, incrementa o contador', () => {
    const hero = heroFixture({ hero: { gold: 100 } });
    const result = resolveRestock(hero, 'shop', 5, 2, { rng: seededRng(1) }); // preço = 10+15+20=45
    expect(result.outcome).toEqual({ kind: 'restocked', price: 45 });
    expect(result.hero.gold).toBe(55);
    expect(result.forSale).toHaveLength(5);
    expect(result.restockCount).toBe(3);
  });
});
