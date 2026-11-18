/**
 * A sala do negociante secreto (rodada 6, só o app a gera; a regra mora em
 * `items/pecas-secretas.ts`): ele mostra a peça que trouxe, por um preço
 * fixo, e depois da compra segue viagem.
 */

import type { DungeonCell } from '../dungeon/generate.js';
import { addItem } from '../inventory/inventory.js';
import { displayName, type Item } from '../items/item.js';
import { celulaAtual, substituirCelulaAtual, type EstadoDoJogo, type EstadoNaMasmorra } from './estado.js';

export interface NegocianteNaSala {
  item: Item;
  preco: number;
  /** O herói tem o ouro. */
  podeComprar: boolean;
}

/** O negociante da sala de agora; `null` fora da sala dele ou depois da venda. */
export function abrirNegociante(estado: EstadoDoJogo): NegocianteNaSala | null {
  if (estado.mapMode !== 'dungeon') return null;
  const sala = celulaAtual(estado) as DungeonCell | undefined;
  const negociante = sala?.negociante;
  if (!negociante || negociante.vendido) return null;
  return { item: negociante.item, preco: negociante.preco, podeComprar: estado.hero.gold >= negociante.preco };
}

/** Compra a peça: o ouro sai, a peça vai pra mochila e o negociante segue viagem. Sem ouro, nada muda. */
export function comprarDoNegociante(estado: EstadoDoJogo): { estado: EstadoDoJogo; texto: string } {
  const negociante = abrirNegociante(estado);
  if (!negociante) return { estado, texto: '' };
  if (!negociante.podeComprar) return { estado, texto: `Faltam ${negociante.preco - estado.hero.gold} de ouro.` };
  const masmorra = estado as EstadoNaMasmorra;
  const sala = celulaAtual(masmorra) as DungeonCell;
  const comprou = {
    ...masmorra,
    hero: { ...masmorra.hero, gold: masmorra.hero.gold - negociante.preco },
    inventory: addItem(masmorra.inventory, negociante.item),
  };
  const depois = substituirCelulaAtual(comprou, { ...sala, negociante: { ...(sala.negociante as NonNullable<DungeonCell['negociante']>), vendido: true } });
  return { estado: depois, texto: `Você comprou ${displayName(negociante.item)} por ${negociante.preco} de ouro. O negociante some pelas sombras.` };
}
