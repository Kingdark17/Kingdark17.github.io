/**
 * Mochila do jogador. Porta de `js/inventory.js`: as três operações puras
 * de coleção (`addItem`/`removeByUid`/`findByUid`) e o uso de consumível —
 * `render()` e `showDetail()` do original constroem DOM direto e ficam de
 * fora.
 *
 * No original, `state.inventory` é só um array (`Array.prototype.push`/
 * `splice` direto); aqui vira `Item[]` com as mesmas operações, mas sem
 * mutar a entrada — devolvem uma cópia, mesmo padrão do resto do pacote.
 *
 * `useConsumable()` do original virou `consumeItem()`: o `react-hooks` do
 * ESLint trata qualquer `useX()` como Hook e recusa a chamada fora de um
 * componente. Mesmo motivo do `castPower()`.
 */

import type { Hero } from '../hero/hero.js';
import type { Item } from '../items/item.js';

export type Inventory = Item[];

export function addItem(inventory: readonly Item[], item: Item): Item[] {
  return [...inventory, item];
}

export interface RemoveByUidResult {
  inventory: Item[];
  removed: Item | null;
}

export function removeByUid(inventory: readonly Item[], uid: string): RemoveByUidResult {
  const idx = inventory.findIndex((it) => it.uid === uid);
  if (idx < 0) return { inventory: [...inventory], removed: null };
  return { inventory: [...inventory.slice(0, idx), ...inventory.slice(idx + 1)], removed: inventory[idx] as Item };
}

export function findByUid(inventory: readonly Item[], uid: string): Item | null {
  return inventory.find((it) => it.uid === uid) ?? null;
}

export type ConsumeItemOutcome =
  | { kind: 'no_effect' }
  | { kind: 'used'; hpGained: number; mpGained: number };

export interface ConsumeItemResult {
  hero: Hero;
  inventory: Item[];
  outcome: ConsumeItemOutcome;
}

/**
 * Bebe/usa um consumível: devolve vida e mana até o máximo e some da
 * mochila. Item sem `cura` nem `curaMana` não é gasto — igual ao original,
 * que só removia da mochila quando `healed` era verdadeiro.
 *
 * Não recalcula os derivados: cura mexe em `hp`/`mp`, não em atributo.
 */
export function consumeItem(hero: Hero, inventory: readonly Item[], item: Item): ConsumeItemResult {
  const hpGained = item.stats.cura ? Math.min(hero.maxHp, hero.hp + item.stats.cura) - hero.hp : 0;
  const mpGained = item.stats.curaMana ? Math.min(hero.maxMp, hero.mp + item.stats.curaMana) - hero.mp : 0;

  if (!item.stats.cura && !item.stats.curaMana) {
    return { hero, inventory: [...inventory], outcome: { kind: 'no_effect' } };
  }

  return {
    hero: { ...hero, hp: hero.hp + hpGained, mp: hero.mp + mpGained },
    inventory: removeByUid(inventory, item.uid).inventory,
    outcome: { kind: 'used', hpGained, mpGained },
  };
}
