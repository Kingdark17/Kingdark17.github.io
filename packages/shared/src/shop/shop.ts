/**
 * Economia de loja/ferreiro: estoque, preço de compra/venda, desconto por
 * dado, e a reforja na forja (com garantia de "pity" após 4 tentativas sem
 * melhora). Porta de `js/shop.js` — o arquivo original é quase todo string
 * de HTML pra modal (`render`/`showDetail`/`compactCard`/`comparison`/
 * `progress`/`forgePanel`); só a fatia de regra sai daqui.
 *
 * `discount` (bônus de pechincha) e `restockCount` eram variáveis
 * módulo-level no original, reiniciadas a cada `open()` do modal — aqui
 * viram parâmetro explícito de quem chama, mesmo padrão de estado de sessão
 * já usado (ex: `applyMonsterHit`'s `petEsquivaBonus`).
 */

import type { Hero } from '../hero/hero.js';
import { addItem, removeByUid } from '../inventory/inventory.js';
import { randomItem, type Item } from '../items/item.js';
import type { ItemCategory } from '../items/templates.js';
import { reforge, tierRank, type Tier } from '../items/tiers.js';
import { defaultRng, pick, type Rng } from '../rng.js';

export type ShopKind = 'shop' | 'blacksmith';

const BLACKSMITH_CATEGORIES: ItemCategory[] = ['arma', 'armadura', 'acessorio'];

export interface RollStockOptions {
  rng?: Rng;
  now?: () => number;
}

/** Sorteia 5 itens à venda: equipamento pro ferreiro, consumível pro vendedor itinerante. */
export function rollStock(kind: ShopKind, floor: number, options: RollStockOptions = {}): Item[] {
  const rng = options.rng ?? defaultRng;
  const stock: Item[] = [];
  for (let i = 0; i < 5; i++) {
    const category: ItemCategory = kind === 'blacksmith' ? pick(BLACKSMITH_CATEGORIES, rng) : 'consumivel';
    stock.push(randomItem({ category, floor, rng, now: options.now }));
  }
  return stock;
}

/** Preço de compra: desconto de loja do herói (`descontoLoja`) somado ao bônus de pechincha, teto de 60%. */
export function buyPrice(hero: Hero, item: Item, discount = 0): number {
  const descontoLoja = hero.derived.descontoLoja || 0;
  return Math.max(1, Math.round(item.value * (1 - Math.min(0.6, descontoLoja / 100 + discount))));
}

export function sellPrice(item: Item): number {
  return Math.max(1, Math.floor(item.value * 0.5));
}

/** Mapa fixo de resultado do dado de pechincha (d20) pro desconto concedido. */
export function discountForRoll(roll: number): number {
  const pct = roll >= 20 ? 30 : roll >= 19 ? 20 : roll >= 15 ? 15 : roll >= 11 ? 10 : roll >= 6 ? 5 : 0;
  return pct / 100;
}

export interface ForgeMaterialConfig {
  cost: number;
  /** Pares `[delta de tier, peso percentual]`, na ordem que o original testava. */
  outcomes: Array<[number, number]>;
}

/** Igual a `js/shop.js`'s `FORGE` — as chaves são `templateId`s de material que já existem no catálogo de itens. */
export const FORGE_MATERIALS: Record<string, ForgeMaterialConfig> = {
  minerio: { cost: 20, outcomes: [[-1, 30], [0, 40], [1, 30]] },
  essencia: { cost: 50, outcomes: [[-1, 15], [0, 35], [1, 40], [2, 10]] },
  catalisador_mitico: { cost: 120, outcomes: [[-1, 5], [0, 20], [1, 45], [2, 25], [3, 5]] },
  pedra_protecao: { cost: 80, outcomes: [[0, 45], [1, 45], [2, 10]] },
};

/**
 * Sorteia o delta de tier de uma tentativa de reforja. Com `pity >= 4`
 * (4 tentativas seguidas sem melhora), o resultado nunca piora — força pelo
 * menos `+1`.
 */
export function rollForgeOutcome(cfg: ForgeMaterialConfig, pity: number, rng: Rng = defaultRng): number {
  const roll = rng() * 100;
  let total = 0;
  let result = 0;
  for (const [delta, weight] of cfg.outcomes) {
    total += weight;
    if (roll < total) {
      result = delta;
      break;
    }
  }
  return pity >= 4 ? Math.max(1, result) : result;
}

export type ForgeOutcome =
  | { kind: 'unavailable' }
  | { kind: 'no_material' }
  | { kind: 'insufficient_gold'; required: number }
  | { kind: 'forged'; oldTier: Tier; newTier: Tier; improved: boolean; reforgeFails: number };

export interface ForgeResult {
  hero: Hero;
  inventory: Item[];
  item: Item;
  outcome: ForgeOutcome;
}

export interface ForgeOptions {
  rng?: Rng;
}

/**
 * Reforja `item` (que precisa estar na mochila, não equipado — mesma regra
 * do original) gastando ouro e uma unidade do material. Sem efeito
 * (`outcome` explica por quê) quando o material é desconhecido, não há
 * unidade dele na mochila, ou falta ouro — igual o
 * `if(!cfg||!materialCount(state,id)||state.hero.gold<cfg.cost)return;` do
 * original, só que com o motivo explícito em vez de um retorno silencioso.
 */
export function resolveForge(hero: Hero, inventory: readonly Item[], item: Item, materialId: string, options: ForgeOptions = {}): ForgeResult {
  const rng = options.rng ?? defaultRng;
  const cfg = FORGE_MATERIALS[materialId];
  if (!cfg) return { hero, inventory: [...inventory], item, outcome: { kind: 'unavailable' } };

  const material = inventory.find((i) => i.templateId === materialId);
  if (!material) return { hero, inventory: [...inventory], item, outcome: { kind: 'no_material' } };
  if (hero.gold < cfg.cost) return { hero, inventory: [...inventory], item, outcome: { kind: 'insufficient_gold', required: cfg.cost } };

  const oldRank = tierRank(item);
  const delta = rollForgeOutcome(cfg, item.reforgeFails ?? 0, rng);
  const { item: reforgedBase, result } = reforge(item, delta);
  const improved = result.newRank > oldRank;
  const reforgedItem: Item = { ...reforgedBase, reforgeFails: improved ? 0 : (item.reforgeFails ?? 0) + 1 };

  const afterRemoval = removeByUid(inventory, material.uid).inventory;
  const nextInventory = afterRemoval.map((i) => (i.uid === item.uid ? reforgedItem : i));

  return {
    hero: { ...hero, gold: hero.gold - cfg.cost },
    inventory: nextInventory,
    item: reforgedItem,
    outcome: { kind: 'forged', oldTier: result.oldTier, newTier: result.newTier, improved, reforgeFails: reforgedItem.reforgeFails ?? 0 },
  };
}

export type BuyOutcome = { kind: 'insufficient_gold'; required: number } | { kind: 'bought'; price: number };

export interface BuyResult {
  hero: Hero;
  inventory: Item[];
  forSale: Item[];
  outcome: BuyOutcome;
}

export function resolveBuy(hero: Hero, inventory: readonly Item[], forSale: readonly Item[], item: Item, discount = 0): BuyResult {
  const price = buyPrice(hero, item, discount);
  if (hero.gold < price) return { hero, inventory: [...inventory], forSale: [...forSale], outcome: { kind: 'insufficient_gold', required: price } };

  return {
    hero: { ...hero, gold: hero.gold - price },
    inventory: addItem(inventory, item),
    forSale: forSale.filter((i) => i.uid !== item.uid),
    outcome: { kind: 'bought', price },
  };
}

export interface SellResult {
  hero: Hero;
  inventory: Item[];
  outcome: { kind: 'sold'; price: number };
}

export function resolveSell(hero: Hero, inventory: readonly Item[], item: Item): SellResult {
  const price = sellPrice(item);
  return {
    hero: { ...hero, gold: hero.gold + price },
    inventory: removeByUid(inventory, item.uid).inventory,
    outcome: { kind: 'sold', price },
  };
}

export type RestockOutcome = { kind: 'insufficient_gold'; required: number } | { kind: 'restocked'; price: number };

export interface RestockResult {
  hero: Hero;
  /** `null` quando a recusa não gera estoque novo — quem chama mantém o `forSale` atual. */
  forSale: Item[] | null;
  restockCount: number;
  outcome: RestockOutcome;
}

/** Preço de renovar o estoque sobe a cada renovação na mesma visita (`restockCount`, zerado quando o modal reabre). */
export function resolveRestock(hero: Hero, kind: ShopKind, floor: number, restockCount: number, options: RollStockOptions = {}): RestockResult {
  const price = 10 + floor * 3 + restockCount * 10;
  if (hero.gold < price) return { hero, forSale: null, restockCount, outcome: { kind: 'insufficient_gold', required: price } };

  return {
    hero: { ...hero, gold: hero.gold - price },
    forSale: rollStock(kind, floor, options),
    restockCount: restockCount + 1,
    outcome: { kind: 'restocked', price },
  };
}
