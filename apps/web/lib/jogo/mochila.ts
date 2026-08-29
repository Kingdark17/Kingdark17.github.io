/**
 * Mochila e ficha do herói: equipar, desequipar, beber poção e gastar os
 * pontos de atributo ganhos ao subir de nível.
 *
 * As regras estão na engine (`equipItem`, `unequipItem`, `consumeItem`,
 * `spendAttrPoint`, que já recalculam os derivados). Aqui mora só a
 * costura com o save.
 *
 * O `equipped` de cada item da mochila é **derivado**, não acumulado:
 * depois de qualquer troca ele é recalculado a partir do que está nos
 * slots do herói. É o que `js/inventory.js` faz no começo de todo
 * `render()` — e evita a classe de bug em que a peça sai do slot mas
 * continua marcada como equipada na mochila (ou o contrário).
 */

import {
  addItem,
  consumeItem,
  displayName,
  EQUIP_SLOTS,
  equipItem,
  equippedSlot,
  isOffhandEligible,
  itemCategory,
  removeByUid,
  spendAttrPoint,
  unequipItem,
  type AttrKey,
  type EquipSlot,
  type Hero,
  type Item,
} from '@rpg-legend/shared';

import type { EstadoDoJogo } from './estado';

export interface Mochila {
  estado: EstadoDoJogo;
  log: string[];
}

export function abrirMochila(estado: EstadoDoJogo): Mochila {
  return { estado: comEquipadosEmDia(estado), log: [] };
}

/** Só arma, armadura e acessório vão pra um slot. */
export function podeEquipar(item: Item): boolean {
  const categoria = itemCategory(item);
  return categoria === 'arma' || categoria === 'armadura' || categoria === 'acessorio';
}

export function podeUsar(item: Item): boolean {
  return itemCategory(item) === 'consumivel' && (!!item.stats.cura || !!item.stats.curaMana);
}

export function slotDoItem(estado: EstadoDoJogo, item: Item): EquipSlot | null {
  return equippedSlot(estado.hero, item);
}

export function equipar(mochila: Mochila, item: Item, slot?: EquipSlot): Mochila {
  const naMaoAntes = mochila.estado.hero.equip;
  const resultado = equipItem(mochila.estado.hero, item, slot);
  if (!resultado.equipped) {
    // A peça cabe no slot e mesmo assim foi recusada: dizer "não vai nesse
    // espaço" faria a pessoa procurar defeito no escudo, e o problema é a arma.
    const recusa =
      resultado.reason === 'two_handed_weapon'
        ? `Suas duas mãos estão ocupadas com ${displayName(naMaoAntes.arma as Item)}.`
        : `${displayName(item)} não vai nesse espaço.`;
    return { ...mochila, log: [recusa] };
  }

  const destino = equippedSlot(resultado.hero, item);
  const log = [`Você equipa ${displayName(item)}${destino === 'secundaria' ? ' na mão secundária' : ''}.`];

  // Arma de duas mãos esvazia a secundária. `trocaDeEquipamento` já devolve a
  // peça pro inventário; o que falta é avisar, senão o escudo some da ficha
  // sem explicação e parece bug.
  // `destino === 'arma'` importa: trocar uma peça da secundária por outra
  // também deixa a anterior sem slot, e ali o motivo não é este.
  const largado = naMaoAntes.secundaria as Item | null;
  if (destino === 'arma' && largado && !equippedSlot(resultado.hero, largado)) {
    log.push(`${displayName(largado)} volta para a mochila: essa arma ocupa as duas mãos.`);
  }

  return { estado: trocaDeEquipamento(mochila.estado, resultado.hero), log };
}

export function desequipar(mochila: Mochila, slot: EquipSlot): Mochila {
  const peca = mochila.estado.hero.equip[slot];
  if (!peca) return mochila;

  return {
    estado: trocaDeEquipamento(mochila.estado, unequipItem(mochila.estado.hero, slot)),
    log: [`Você guarda ${displayName(peca as Item)}.`],
  };
}

export function usar(mochila: Mochila, item: Item): Mochila {
  const resultado = consumeItem(mochila.estado.hero, mochila.estado.inventory, item);
  if (resultado.outcome.kind === 'no_effect') return { ...mochila, log: [`${displayName(item)} não faz nada agora.`] };

  const { hpGained, mpGained } = resultado.outcome;
  const partes: string[] = [];
  if (hpGained > 0) partes.push(`${hpGained} de Vida`);
  if (mpGained > 0) partes.push(`${mpGained} de Mana`);

  return {
    estado: { ...mochila.estado, hero: resultado.hero, inventory: resultado.inventory },
    log: [partes.length ? `Você usa ${displayName(item)} e recupera ${partes.join(' e ')}.` : `Você usa ${displayName(item)}.`],
  };
}

/** Item na mão secundária: só escudo e arma leve (`isOffhandEligible`). */
export function aceitaMaoSecundaria(item: Item): boolean {
  return item.templateId === 'escudo' || (itemCategory(item) === 'arma' && isOffhandEligible(item));
}

/** Jogar fora tira do slot antes de tirar da mochila — senão a peça sumia da lista e continuava vestida. */
export function descartar(mochila: Mochila, item: Item): Mochila {
  const resultado = removeByUid(mochila.estado.inventory, item.uid);
  if (!resultado.removed) return mochila;

  const slot = equippedSlot(mochila.estado.hero, item);
  const hero = slot ? unequipItem(mochila.estado.hero, slot) : mochila.estado.hero;

  return {
    estado: { ...mochila.estado, hero, inventory: resultado.inventory },
    log: [`Você descarta ${displayName(item)}.`],
  };
}

/** Level up é manual: 2 pontos por nível, gastos um a um pelo jogador. */
export function gastarPonto(mochila: Mochila, chave: AttrKey): Mochila {
  const hero = spendAttrPoint(mochila.estado.hero, chave);
  if (hero === mochila.estado.hero) return { ...mochila, log: ['Você não tem pontos para distribuir.'] };

  return { estado: { ...mochila.estado, hero }, log: [] };
}

/**
 * Fecha a troca de equipamento: recolhe pra mochila o que saiu do slot e
 * recalcula o `equipped` de todo mundo.
 *
 * O recolhimento existe porque a arma inicial (`buildHero`) nasce só dentro
 * de `hero.equip.arma`, sem entrada na mochila. Sem isso, guardá-la ou
 * trocar de arma a apagaria — que é justamente o que acontece no jogo
 * antigo. Divergência de propósito: perder a arma inicial pra sempre não é
 * regra, é bug.
 */
function trocaDeEquipamento(antes: EstadoDoJogo, hero: Hero): EstadoDoJogo {
  let inventory = antes.inventory;

  for (const slot of EQUIP_SLOTS) {
    const saiu = antes.hero.equip[slot] as Item | null;
    if (!saiu || equippedSlot(hero, saiu)) continue;
    if (inventory.some((guardado) => guardado.uid === saiu.uid)) continue;
    inventory = addItem(inventory, saiu);
  }

  return comEquipadosEmDia({ ...antes, hero, inventory });
}

/**
 * Recalcula o `equipped` da mochila inteira a partir dos slots do herói —
 * a mesma linha que o original roda a cada `render()`.
 */
function comEquipadosEmDia(estado: EstadoDoJogo): EstadoDoJogo {
  const inventory = sincronizar(estado.hero, estado.inventory);
  return inventory === estado.inventory ? estado : { ...estado, inventory };
}

function sincronizar(hero: Hero, inventory: readonly Item[]): Item[] {
  let mudou = false;
  const proximo = inventory.map((item) => {
    const equipado = equippedSlot(hero, item) !== null;
    if (!!item.equipped === equipado) return item;
    mudou = true;
    return { ...item, equipped: equipado };
  });
  return mudou ? proximo : (inventory as Item[]);
}
