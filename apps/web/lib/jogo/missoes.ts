/**
 * Quadro de missões da cidade. As regras estão em `quests/quests.ts` — o
 * quadro se preenche sozinho até 3 missões e nunca encolhe: resgatar uma
 * sorteia outra no lugar.
 *
 * O progresso não é atualizado aqui: `onMonsterKilled`, `onItemCollected` e
 * `onFloorReached` já são chamados de dentro do combate, da sala de baú e
 * da geração de andar, como no original.
 */

import { claimQuest, defaultRng, ensureQuestBoard, type Quest, type Rng } from '@rpg-legend/shared';

import type { EstadoNaCidade } from './estado';

export interface Quadro {
  estado: EstadoNaCidade;
  log: string[];
}

export function abrirQuadro(estado: EstadoNaCidade, rng: Rng = defaultRng): Quadro {
  const quests = ensureQuestBoard(estado.quests, estado.floor, { rng });

  return {
    estado: quests === estado.quests ? estado : { ...estado, quests },
    log: ['Você lê os anúncios afixados no quadro.'],
  };
}

export function missoes(quadro: Quadro): Quest[] {
  return quadro.estado.quests;
}

export function resgatar(quadro: Quadro, questId: string, rng: Rng = defaultRng): Quadro {
  const alvo = quadro.estado.quests.find((q) => q.id === questId);
  const resgate = claimQuest(quadro.estado.hero, quadro.estado.quests, questId, quadro.estado.floor, { rng });

  if (!resgate.claimed) return { ...quadro, log: ['Esta missão ainda não pode ser resgatada.'] };

  const log = [`Missão concluída: ${alvo?.title ?? 'recompensa'} rendeu ${alvo?.rewardGold ?? 0} de ouro e ${alvo?.rewardXp ?? 0} XP.`];
  if (resgate.leveledUp) log.push(`Você subiu ${resgate.levels} nível(is)!`);

  return { estado: { ...quadro.estado, hero: resgate.hero, quests: resgate.quests }, log };
}
