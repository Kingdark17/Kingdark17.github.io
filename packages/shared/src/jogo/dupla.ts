/**
 * O que a dupla do co-op do app precisa fora da luta (2026-11-16, decisões do
 * usuário): quem cai vira fantasma — nada o fere e ele não mexe em nada, só
 * segue o parceiro —, e só o parceiro o levanta, com a Poção de Reviver, que
 * devolve metade da vida máxima. A mesma poção vai servir pra montaria.
 *
 * A luta em dupla em si mora em `luta/arena.ts` (`Dupla`).
 */

import type { Hero } from '../hero/hero.js';
import type { Item } from '../items/item.js';
import type { EstadoDoJogo } from './estado.js';

/** Sem vida numa partida em dupla: o herói é um fantasma até o parceiro o reviver. */
export function ehFantasma(hero: Hero): boolean {
  return hero.hp <= 0;
}

/** A primeira Poção de Reviver da mochila (qualquer item com o efeito `reviver`), ou `null`. */
export function pocaoDeReviver(inventory: readonly Item[]): Item | null {
  return inventory.find((item) => !!item.stats.reviver) ?? null;
}

/** Quanto da vida máxima a poção devolve, em % (o `reviver` dela). */
export function forcaDaPocao(item: Item): number {
  return Math.max(1, Math.min(100, Math.trunc(item.stats.reviver ?? 0)));
}

/**
 * Gasta uma Poção de Reviver da mochila pra levantar o parceiro. Devolve o
 * estado sem ela e a força com que ele levanta, ou `null` sem poção.
 */
export function gastarPocaoDeReviver<E extends EstadoDoJogo>(estado: E): { estado: E; porcento: number } | null {
  const pocao = pocaoDeReviver(estado.inventory);
  if (!pocao) return null;
  return { estado: { ...estado, inventory: estado.inventory.filter((item) => item.uid !== pocao.uid) }, porcento: forcaDaPocao(pocao) };
}

/** Levanta o herói caído com `porcento` da vida máxima (pelo menos 1). Quem está de pé fica como está. */
export function reviver(hero: Hero, porcento: number): Hero {
  if (hero.hp > 0) return hero;
  const pct = Math.max(1, Math.min(100, Math.trunc(porcento)));
  return { ...hero, hp: Math.max(1, Math.floor((hero.maxHp * pct) / 100)) };
}

/** O parceiro foi embora e ninguém mais pode reviver o fantasma: ele se levanta por um fio, pra não ficar preso. */
export function levantarSozinho(hero: Hero): Hero {
  return hero.hp > 0 ? hero : { ...hero, hp: 1 };
}
