/**
 * A sessão de loja e de ferreiro — o que sobrou de `js/shop.js` depois que
 * a engine levou a economia (`rollStock`, `resolveBuy`, `resolveSell`,
 * `resolveForge`, `resolveRestock`, `discountForRoll`).
 *
 * Aqui mora o estado que só existe enquanto o modal está aberto: o desconto
 * da pechincha e quantas vezes o estoque já foi renovado nesta visita. No
 * original eram variáveis módulo-level zeradas a cada `open()` — o mesmo
 * ciclo de vida, agora explícito.
 *
 * O estoque **não** é sessão: mora na própria sala e vai pro save, igual ao
 * `cell.forSale` do original. Sair da loja e voltar não sorteia estoque
 * novo de graça — pra isso existe o botão de renovar, que cobra ouro.
 */

import {
  buyPrice,
  defaultRng,
  discountForRoll,
  displayName,
  resolveBuy,
  resolveForge,
  resolveRestock,
  resolveSell,
  rollStock,
  sellPrice,
  type CityCell,
  type Item,
  type Rng,
  type ShopKind,
} from '@rpg-legend/shared';

import { celulaAtual, substituirCelulaAtual, type EstadoNaCidade } from './estado';

export interface Loja {
  estado: EstadoNaCidade;
  kind: ShopKind;
  /** Bônus de pechincha desta visita, de 0 a 0,3. Zera ao reabrir. */
  desconto: number;
  /** O dado de pechincha só pode ser rolado uma vez por visita. */
  descontoRolado: boolean;
  renovacoes: number;
  dado: number | null;
  log: string[];
}

export function abrirLoja(estado: EstadoNaCidade, kind: ShopKind, rng: Rng = defaultRng): Loja {
  const sala = celulaAtual(estado) as CityCell;
  const comEstoque = sala.forSale?.length
    ? estado
    : substituirCelulaAtual(estado, { ...sala, forSale: rollStock(kind, estado.floor, { rng }) });

  return {
    estado: comEstoque,
    kind,
    desconto: 0,
    descontoRolado: false,
    renovacoes: 0,
    dado: null,
    log: [kind === 'blacksmith' ? 'A forja do ferreiro está acesa.' : 'O vendedor itinerante abre a sacola.'],
  };
}

export function estoque(loja: Loja): Item[] {
  return (celulaAtual(loja.estado) as CityCell | null)?.forSale ?? [];
}

/** Itens da mochila que dá pra vender: equipado não sai da mão. */
export function vendaveis(loja: Loja): Item[] {
  return loja.estado.inventory.filter((item) => !item.equipped);
}

export function precoDeCompra(loja: Loja, item: Item): number {
  return buyPrice(loja.estado.hero, item, loja.desconto);
}

export function precoDeVenda(item: Item): number {
  return sellPrice(item);
}

export function precoDaRenovacao(loja: Loja): number {
  return 10 + loja.estado.floor * 3 + loja.renovacoes * 10;
}

/** Rola o d20 da pechincha. A rolagem vem de fora, como no combate. */
export function pechinchar(loja: Loja, roll: number): Loja {
  if (loja.descontoRolado) return loja;

  const desconto = discountForRoll(roll);
  const pct = Math.round(desconto * 100);

  return {
    ...loja,
    desconto,
    descontoRolado: true,
    dado: roll,
    log: [pct > 0 ? `Você conseguiu ${pct}% de desconto.` : 'O comerciante não concedeu desconto.'],
  };
}

export function comprar(loja: Loja, item: Item): Loja {
  const sala = celulaAtual(loja.estado) as CityCell;
  const compra = resolveBuy(loja.estado.hero, loja.estado.inventory, sala.forSale ?? [], item, loja.desconto);

  if (compra.outcome.kind === 'insufficient_gold') {
    return { ...loja, log: [`Ouro insuficiente: ${displayName(item)} custa ${compra.outcome.required}.`] };
  }

  return {
    ...loja,
    estado: substituirCelulaAtual(
      { ...loja.estado, hero: compra.hero, inventory: compra.inventory },
      { ...sala, forSale: compra.forSale },
    ),
    log: [`Você compra ${displayName(item)} por ${compra.outcome.price} de ouro.`],
  };
}

export function vender(loja: Loja, item: Item): Loja {
  const venda = resolveSell(loja.estado.hero, loja.estado.inventory, item);

  return {
    ...loja,
    estado: { ...loja.estado, hero: venda.hero, inventory: venda.inventory },
    log: [`Você vende ${displayName(item)} por ${venda.outcome.price} de ouro.`],
  };
}

export function renovarEstoque(loja: Loja, rng: Rng = defaultRng): Loja {
  const sala = celulaAtual(loja.estado) as CityCell;
  const renovacao = resolveRestock(loja.estado.hero, loja.kind, loja.estado.floor, loja.renovacoes, { rng });

  if (renovacao.outcome.kind === 'insufficient_gold') {
    return { ...loja, log: [`Renovar o estoque custa ${renovacao.outcome.required} de ouro.`] };
  }
  if (!renovacao.forSale) return loja;

  return {
    ...loja,
    estado: substituirCelulaAtual({ ...loja.estado, hero: renovacao.hero }, { ...sala, forSale: renovacao.forSale }),
    renovacoes: renovacao.restockCount,
    log: [`Estoque renovado por ${renovacao.outcome.price} de ouro.`],
  };
}

export function reforjar(loja: Loja, item: Item, materialId: string, rng: Rng = defaultRng): Loja {
  const forja = resolveForge(loja.estado.hero, loja.estado.inventory, item, materialId, { rng });

  if (forja.outcome.kind === 'insufficient_gold') return { ...loja, log: [`A reforja custa ${forja.outcome.required} de ouro.`] };
  if (forja.outcome.kind === 'no_material') return { ...loja, log: ['Você não tem esse material na mochila.'] };
  if (forja.outcome.kind === 'unavailable') return { ...loja, log: ['Material desconhecido.'] };

  const { oldTier, newTier, improved } = forja.outcome;
  let veredito = 'Piorou.';
  if (improved) veredito = 'Melhorou!';
  else if (oldTier === newTier) veredito = 'Manteve o tier.';

  return {
    ...loja,
    estado: { ...loja.estado, hero: forja.hero, inventory: forja.inventory },
    log: [`Reforja de ${displayName(item)}: Tier ${oldTier} → Tier ${newTier}. ${veredito}`],
  };
}
