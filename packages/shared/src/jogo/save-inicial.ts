/**
 * O save de um personagem recém-criado — porta do trecho inicial de
 * `startAdventure()` em `rpg-legend/js/ui.js`.
 *
 * Fica só no que a API valida hoje (`hero`, `inventory`, `party`,
 * `floor`) mais `quests`. Tutorial, mapa da cidade e quadro de missões
 * entram quando a tela de jogo existir — hoje não haveria quem lesse.
 *
 * O herói nasce Aprendiz, sem classe nem arma: quem dá as duas é a Guilda,
 * e até lá o portão da masmorra não abre (ver `criacao.ts`).
 */

import { DEBUFFS } from '../hero/catalog.js';
import { buildApprentice, type Hero } from '../hero/hero.js';
import { addItem } from '../inventory/inventory.js';
import { randomItem, type Item } from '../items/item.js';
import { type Rng, defaultRng } from '../rng.js';
import type { Criacao } from './criacao.js';

export interface SaveInicial {
  hero: Hero;
  inventory: Item[];
  party: never[];
  floor: number;
  quests: never[];
}

export class CriacaoIncompletaError extends Error {
  constructor() {
    super('Criação incompleta: falta a raça.');
    this.name = 'CriacaoIncompletaError';
  }
}

/** `now` é o relógio do `uid` da poção do começo; ausente, `Date.now`. */
export function montarSaveInicial(criacao: Criacao, rng: Rng = defaultRng, now?: () => number): SaveInicial {
  if (!criacao.raca) throw new CriacaoIncompletaError();

  // A fraqueza continua existindo, sorteada — só não aparece mais na
  // criação (decisão do usuário, 2026-10-09). Atenção: hoje nenhuma outra
  // tela a mostra, então o jogador não tem como saber qual é a dele.
  const fraqueza = DEBUFFS[Math.floor(rng() * DEBUFFS.length)] as (typeof DEBUFFS)[number];

  const hero = buildApprentice(
    {
      name: criacao.nome.trim(),
      race: criacao.raca,
      debuff: fraqueza,
      // `?? undefined` e não `?? PADRAO`: quem não escolheu não grava
      // penteado nenhum, e o paperdoll resolve o padrão na hora de
      // desenhar. Gravar o padrão faria o save mentir que houve escolha —
      // e prenderia o personagem ao penteado de hoje se o padrão mudasse.
      hair: criacao.cabelo ?? undefined,
    },
    rng,
  );

  // Todo herói começa com um consumível, igual ao original.
  const inventory = addItem([], randomItem({ category: 'consumivel', floor: 1, rng, now }));

  return { hero, inventory, party: [], floor: 1, quests: [] };
}
