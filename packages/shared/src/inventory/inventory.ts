/**
 * Mochila do jogador. Porta de `js/inventory.js`, só as três operações
 * puras de coleção (`addItem`/`removeByUid`/`findByUid`) — `render()` e
 * `showDetail()` do original constroem DOM direto, ficam de fora.
 *
 * No original, `state.inventory` é só um array (`Array.prototype.push`/
 * `splice` direto); aqui vira `Item[]` com as mesmas três operações, mas
 * sem mutar a entrada — devolvem uma cópia, mesmo padrão do resto do pacote.
 */

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
