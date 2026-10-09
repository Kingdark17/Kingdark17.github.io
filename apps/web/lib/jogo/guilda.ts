/**
 * O Treinamento de Guilda — onde o Aprendiz escolhe a classe.
 *
 * Pedido do doc do Breno (2026-10): "Treinamento de Guilda, para
 * selecionar classe e poder inicial", junto com tirar classe e poderes da
 * criação. As decisões do usuário (2026-10-09): o herói nasce sem classe e
 * o portão da masmorra não abre até ele treinar; os atributos ganham o viés
 * da classe aqui; e o poder inicial é **só o da classe** — os outros virão
 * dos professores, pela maestria.
 *
 * A regra mora em `trainAtGuild`, na engine. Aqui fica o que a tela
 * precisa: abrir, treinar e dizer o que aconteceu.
 */

import { addItem, displayName, hasClass, powerById, trainAtGuild, type ClassDef } from '@rpg-legend/shared';

import type { EstadoDoJogo } from './estado';

export interface Guilda {
  estado: EstadoDoJogo;
  log: string[];
}

export function abrirGuilda(estado: EstadoDoJogo): Guilda {
  return { estado, log: [] };
}

/**
 * Treina na classe escolhida. Quem já tem classe não troca: a guilda diz
 * qual é, e nada muda — trocar de classe é outra decisão, que ninguém pediu.
 */
export function treinar(guilda: Guilda, classe: ClassDef): Guilda {
  const { hero, inventory } = guilda.estado;
  if (hasClass(hero)) return { ...guilda, log: [`Você já treinou como ${hero.className}.`] };

  const { hero: treinado, toInventory } = trainAtGuild(hero, classe);
  const poder = powerById(classe.signatureId)?.name ?? classe.signatureId;
  const log = [`Você treina como ${classe.name} e aprende ${poder}.`];
  // A arma inicial que não coube na mão vai pra mochila, e a pessoa precisa
  // saber — senão parece que a guilda não deu arma nenhuma.
  if (toInventory) log.push(`${displayName(toInventory)} vai para a mochila: sua mão já estava ocupada.`);

  return {
    estado: { ...guilda.estado, hero: treinado, inventory: toInventory ? addItem(inventory, toInventory) : inventory },
    log,
  };
}
