/**
 * A Encantadora — a sala da cidade que fortifica armaduras. Só o app abre a
 * porta dela; as regras das fortificações estão em `items/encantamentos.ts`.
 *
 * Decisões do usuário (2026-10-17 e 18): uma NPC nova na cidade, com tela
 * própria; só armaduras, uma fortificação por peça (encantar de novo troca
 * a que havia); três níveis, pagos em ouro.
 */

import { EQUIP_SLOTS } from '../hero/stats.js';
import { custoDoEncantamento, encantarPeca, nomeDoEncantamento, podeEncantar } from '../items/encantamentos.js';
import { displayName, type EncantamentoId, type Item } from '../items/item.js';
import type { EstadoDoJogo } from './estado.js';
import { comPecaTrocada, temPeca } from './mochila.js';

export interface Encantadora {
  estado: EstadoDoJogo;
  log: string[];
}

export function abrirEncantadora(estado: EstadoDoJogo): Encantadora {
  return { estado, log: [] };
}

/** As armaduras que ela fortifica: as vestidas, na ordem dos slots, e depois as guardadas na mochila. */
export function pecasParaEncantar(estado: EstadoDoJogo): Item[] {
  const vestidas = EQUIP_SLOTS.map((slot) => estado.hero.equip[slot]).filter((peca): peca is Item => !!peca && podeEncantar(peca));
  const guardadas = estado.inventory.filter((item) => !item.equipped && podeEncantar(item));
  return [...vestidas, ...guardadas];
}

/**
 * Fortifica a peça com o tipo e o nível pedidos, cobrando o preço do nível; a
 * fortificação que ela tinha se desfaz. Sem ouro, com a mesma fortificação
 * que a peça já tem, ou com uma peça que não é armadura, nada muda e o log
 * diz por quê. Uma peça que não está com o herói é ignorada.
 */
export function encantar(encantadora: Encantadora, peca: Item, tipo: EncantamentoId, nivel: number): Encantadora {
  const { estado } = encantadora;
  if (!temPeca(estado, peca)) return encantadora;
  const encantada = encantarPeca(peca, tipo, nivel);
  if (!encantada?.encantamento) return { ...encantadora, log: ['A Encantadora só fortifica armaduras.'] };

  const nova = encantada.encantamento;
  const antes = peca.encantamento;
  if (antes && antes.tipo === nova.tipo && antes.nivel === nova.nivel) {
    return { ...encantadora, log: [`${displayName(peca)} já tem ${nomeDoEncantamento(nova)}.`] };
  }
  const custo = custoDoEncantamento(nova.nivel);
  if (estado.hero.gold < custo) return { ...encantadora, log: [`Faltam ${custo - estado.hero.gold} de ouro.`] };

  const pago = { ...estado, hero: { ...estado.hero, gold: estado.hero.gold - custo } };
  const troca = antes ? ` (${nomeDoEncantamento(antes)} se desfaz)` : '';
  return {
    estado: comPecaTrocada(pago, encantada),
    log: [`A Encantadora fortifica ${displayName(peca)} com ${nomeDoEncantamento(nova)}${troca}.`],
  };
}
