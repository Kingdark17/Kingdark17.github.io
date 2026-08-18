/**
 * O save de um personagem recém-criado — porta do trecho inicial de
 * `startAdventure()` em `rpg-legend/js/ui.js`.
 *
 * Fica só no que a API valida hoje (`hero`, `inventory`, `party`,
 * `floor`) mais `quests`. Tutorial, mapa da cidade e quadro de missões
 * entram quando a tela de jogo existir — hoje não haveria quem lesse.
 */

import { addItem, buildHero, randomItem, type Hero, type Item, type Rng, defaultRng } from '@rpg-legend/shared';

import type { Criacao } from './criacao';

export interface SaveInicial {
  hero: Hero;
  inventory: Item[];
  party: never[];
  floor: number;
  quests: never[];
}

export class CriacaoIncompletaError extends Error {
  constructor() {
    super('Criação incompleta: faltam raça, classe, fraqueza ou atributos.');
    this.name = 'CriacaoIncompletaError';
  }
}

export function montarSaveInicial(criacao: Criacao, rng: Rng = defaultRng): SaveInicial {
  if (!criacao.raca || !criacao.classe || !criacao.fraqueza || !criacao.atributos) throw new CriacaoIncompletaError();

  const hero = buildHero(
    {
      name: criacao.nome.trim(),
      race: criacao.raca,
      cls: criacao.classe,
      debuff: criacao.fraqueza,
      chosenPowerIds: criacao.poderes.map((poder) => poder.id),
      attrs: criacao.atributos,
    },
    rng,
  );

  // Todo herói começa com um consumível, igual ao original.
  const inventory = addItem([], randomItem({ category: 'consumivel', floor: 1, rng }));

  return { hero, inventory, party: [], floor: 1, quests: [] };
}
