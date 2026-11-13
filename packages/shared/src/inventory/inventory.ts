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

import { curarMembros } from '../hero/ferimentos.js';
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

/**
 * As peças iguais da mochila numa carta só, "Poção de Vida ×5" (doc do
 * Breno, 2026-11-13). Decisão do usuário: o empilhamento é **só da tela**,
 * no site e no app; no save cada peça continua a dela, com o `uid` dela, e
 * usar, vender ou descartar gasta uma (a primeira da pilha).
 *
 * Igual é igual em tudo o que a peça é: modelo, raridade, atributos, valor,
 * degrau, runas, encantamento, o que a forja mexeu. Só o `uid`, o andar em
 * que caiu (`foundFloor`, que não muda nada) e o `equipped` ficam de fora;
 * e o que está vestido nunca empilha.
 */
export interface Pilha {
  /** A primeira peça da pilha, na ordem da mochila: a que a carta mostra e a ficha abre. */
  item: Item;
  /** Os `uid` das peças da pilha, na ordem da mochila. */
  uids: string[];
}

/** As duas peças empilham: iguais em tudo menos `uid`, `foundFloor` e `equipped`, e nenhuma vestida. */
export function mesmaPeca(a: Item, b: Item): boolean {
  if (a.equipped || b.equipped) return false;
  return (
    a.templateId === b.templateId &&
    a.rarity === b.rarity &&
    a.value === b.value &&
    a.procChance === b.procChance &&
    (a.tierAdjustment ?? 0) === (b.tierAdjustment ?? 0) &&
    (a.reforgeCount ?? 0) === (b.reforgeCount ?? 0) &&
    (a.reforgeFails ?? 0) === (b.reforgeFails ?? 0) &&
    (a.degrau ?? 1) === (b.degrau ?? 1) &&
    (a.tierDaRuna ?? 1) === (b.tierDaRuna ?? 1) &&
    (a.nivelDoUnico ?? 1) === (b.nivelDoUnico ?? 1) &&
    a.encantamento?.tipo === b.encantamento?.tipo &&
    a.encantamento?.nivel === b.encantamento?.nivel &&
    mesmasRunas(a.runas ?? [], b.runas ?? []) &&
    mesmosAtributos(a.stats ?? {}, b.stats ?? {})
  );
}

function mesmasRunas(a: readonly { runa: string; tier: number }[], b: readonly { runa: string; tier: number }[]): boolean {
  return a.length === b.length && a.every((r, i) => r.runa === b[i]?.runa && r.tier === b[i]?.tier);
}

function mesmosAtributos(a: Item['stats'], b: Item['stats']): boolean {
  const chaves = Object.keys(a) as (keyof Item['stats'])[];
  return chaves.length === Object.keys(b).length && chaves.every((chave) => chave in b && a[chave] === b[chave]);
}

/** As pilhas da lista, na ordem em que a primeira peça de cada uma aparece. */
export function empilhar(items: readonly Item[]): Pilha[] {
  const pilhas: Pilha[] = [];
  for (const item of items) {
    const pilha = pilhas.find((p) => mesmaPeca(p.item, item));
    if (pilha) pilha.uids.push(item.uid);
    else pilhas.push({ item, uids: [item.uid] });
  }
  return pilhas;
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

  if (!item.stats.cura && !item.stats.curaMana && !item.stats.tala) {
    return { hero, inventory: [...inventory], outcome: { kind: 'no_effect' } };
  }

  // A tala conserta o braço e a perna quebrados (`hero/ferimentos.ts`).
  const tratado = item.stats.tala ? curarMembros(hero) : hero;
  return {
    hero: { ...tratado, hp: hero.hp + hpGained, mp: hero.mp + mpGained },
    inventory: removeByUid(inventory, item.uid).inventory,
    outcome: { kind: 'used', hpGained, mpGained },
  };
}
