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

import { cabeNaMaoLivre, equipItem, equippedSlot, isOffhandEligible, spendAttrPoint, unequipItem, type Hero } from '../hero/hero.js';
import { EQUIP_SLOTS, type AttrKey, type EquipSlot } from '../hero/stats.js';
import { addItem, consumeItem, removeByUid } from '../inventory/inventory.js';
import { concordar, displayName, itemCategory, type Item } from '../items/item.js';
import { engastar, nomeDaRuna, QUEBRA_AO_TIRAR, tirar } from '../items/runas.js';
import { defaultRng, type Rng } from '../rng.js';
import type { EstadoDoJogo } from './estado.js';

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
        : `${displayName(item)} ${concordar(item, ['não vai', 'não vai', 'não vão', 'não vão'])} nesse espaço.`;
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

/** Item na mão secundária: escudo, grimório e arma leve (`isOffhandEligible`). */
export function aceitaMaoSecundaria(item: Item): boolean {
  return isOffhandEligible(item);
}

/**
 * A arma de duas mãos que está impedindo esta peça de ir pra mão secundária,
 * ou `null` quando não há impedimento — a peça não vai pra secundária, já
 * está vestida, ou a mão principal não ocupa as duas.
 *
 * A tela pergunta isso **antes** de mostrar o botão de equipar: o jogador
 * merece ver o aviso e escolher, em vez de clicar e levar uma recusa.
 */
export function armaQueOcupaAsMaos(estado: EstadoDoJogo, item: Item): Item | null {
  if (equippedSlot(estado.hero, item)) return null;
  if (!aceitaMaoSecundaria(item)) return null;

  const arma = estado.hero.equip.arma as Item | null;
  return cabeNaMaoLivre(arma, item) ? null : arma;
}

/**
 * Guarda a arma de duas mãos e põe a peça na secundária — a saída que o
 * aviso oferece quando as duas mãos estão ocupadas.
 *
 * Existe separada de `equipar()` de propósito: a troca só acontece quando o
 * jogador clica no botão que diz o que vai acontecer. `equipar()` continua
 * recusando calado, e é ela que o resto do jogo chama.
 */
export function equiparNoLugarDaArma(mochila: Mochila, item: Item): Mochila {
  const arma = armaQueOcupaAsMaos(mochila.estado, item);
  if (!arma) return equipar(mochila, item, 'secundaria');

  const resultado = equipItem(unequipItem(mochila.estado.hero, 'arma'), item, 'secundaria');
  if (!resultado.equipped) return { ...mochila, log: [`${displayName(item)} não vai nesse espaço.`] };

  return {
    estado: trocaDeEquipamento(mochila.estado, resultado.hero),
    log: [`Você guarda ${displayName(arma)} e equipa ${displayName(item)} na mão secundária.`],
  };
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

/**
 * Engasta a runa na arma, guardada ou equipada, de graça (`items/runas.ts`):
 * no primeiro espaço livre, ou — com a arma cheia — no espaço `indice`,
 * e a runa que estava lá se desfaz. A runa sai da mochila. Só o app oferece.
 */
export function engastarRuna(mochila: Mochila, arma: Item, runa: Item, indice?: number): Mochila {
  // A arma e a runa têm de estar com o herói: senão a runa se duplicaria (ou sumiria).
  if (!temPeca(mochila.estado, arma) || !mochila.estado.inventory.some((item) => item.uid === runa.uid)) return mochila;
  const resultado = engastar(arma, runa, indice);
  switch (resultado.kind) {
    case 'nao_e_arma':
      return { ...mochila, log: [`${displayName(arma)} não tem espaço de runa.`] };
    case 'nao_e_runa':
      return { ...mochila, log: [`${displayName(runa)} não é uma runa.`] };
    case 'cheia':
      return { ...mochila, log: [`Os espaços de ${displayName(arma)} estão cheios: escolha qual runa trocar.`] };
  }
  const semARuna = { ...mochila.estado, inventory: removeByUid(mochila.estado.inventory, runa.uid).inventory };
  const log = [`Você engasta ${displayName(runa)} em ${displayName(arma)}.`];
  if (resultado.kind === 'substituiu') log.push(`A ${nomeDaRuna(resultado.destruida)} que estava ali se desfaz.`);
  return { estado: comPecaTrocada(semARuna, resultado.arma), log };
}

/**
 * Tira a runa do espaço `indice` da arma: ela volta pra mochila ou quebra,
 * pelo tier (`QUEBRA_AO_TIRAR`). Só o app oferece.
 */
export function tirarRuna(mochila: Mochila, arma: Item, indice: number, rng: Rng = defaultRng, now?: () => number): Mochila {
  if (!temPeca(mochila.estado, arma)) return mochila;
  const resultado = tirar(arma, indice, rng, now);
  if (resultado.kind === 'sem_runa') return mochila;
  if (resultado.kind === 'quebrou') {
    return { estado: comPecaTrocada(mochila.estado, resultado.arma), log: [`A ${nomeDaRuna(resultado.quebrada)} quebra ao sair de ${displayName(arma)}.`] };
  }
  const estado = comPecaTrocada({ ...mochila.estado, inventory: addItem(mochila.estado.inventory, resultado.runa) }, resultado.arma);
  return { estado, log: [`Você tira ${displayName(resultado.runa)} de ${displayName(arma)}, inteira.`] };
}

/** A chance de a runa do espaço `indice` quebrar ao ser tirada, pra tela avisar antes. */
export function chanceDeQuebrar(arma: Item, indice: number): number {
  const runa = arma.runas?.[indice];
  return runa ? (QUEBRA_AO_TIRAR[Math.min(QUEBRA_AO_TIRAR.length, Math.max(1, Math.trunc(runa.tier))) - 1] as number) : 0;
}

/** A peça está com o herói: na mochila ou vestida. */
export function temPeca(estado: EstadoDoJogo, peca: Item): boolean {
  return estado.inventory.some((item) => item.uid === peca.uid) || EQUIP_SLOTS.some((slot) => estado.hero.equip[slot]?.uid === peca.uid);
}

/** A peça mudada (as runas, o encantamento) no lugar dela: na mochila e, se estiver vestida, no slot. Os atributos não mudam. */
export function comPecaTrocada(estado: EstadoDoJogo, peca: Item): EstadoDoJogo {
  const inventory = estado.inventory.map((item) => (item.uid === peca.uid ? { ...peca, equipped: item.equipped } : item));
  let equip = estado.hero.equip;
  for (const slot of EQUIP_SLOTS) {
    if (equip[slot]?.uid === peca.uid) equip = { ...equip, [slot]: { ...peca, equipped: true } };
  }
  return { ...estado, inventory, hero: equip === estado.hero.equip ? estado.hero : { ...estado.hero, equip } };
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
