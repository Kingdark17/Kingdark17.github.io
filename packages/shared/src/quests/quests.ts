/**
 * Quadro de missões: matar monstros, alcançar andar, coletar itens. Porta
 * de `js/quests.js`, só a parte de regras — `renderBoard()`/`openBoard()`/
 * `closeBoard()` do original tocam DOM (`document.getElementById`) e
 * multiplayer (`RPG.Multiplayer.broadcastAction`) direto; ficam de fora.
 *
 * `dungeon/generate.ts`'s `generateDungeonFloor()` deliberadamente NÃO
 * chama `onFloorReached` — cada função aqui cobre só a fórmula, quem
 * orquestra troca de andar decide quando chamar isso, igual todo o resto
 * do pacote (a própria geração de andar não sabe nada sobre missões).
 */

import { gainXP, type Hero } from '../hero/hero.js';
import { defaultRng, randomInt, type Rng } from '../rng.js';

export type QuestType = 'kill' | 'floor' | 'collect';

export interface Quest {
  id: string;
  type: QuestType;
  target: number;
  progress: number;
  title: string;
  desc: string;
  rewardXp: number;
  rewardGold: number;
  done: boolean;
  claimed: boolean;
}

export interface GenerateQuestOptions {
  rng?: Rng;
  /** Injetável pro `id` da missão ficar reproduzível em teste — mesmo padrão de `InstantiateOptions.now`. */
  now?: () => number;
}

const QUEST_TYPES: QuestType[] = ['kill', 'floor', 'collect'];

function questId(rng: Rng, now: () => number): string {
  return `q_${now()}_${randomInt(9999, rng)}`;
}

function generateKillQuest(rng: Rng, now: () => number): Quest {
  const amount = 3 + randomInt(4, rng);
  return {
    id: questId(rng, now),
    type: 'kill',
    target: amount,
    progress: 0,
    title: 'Caçador de Monstros',
    desc: `Derrote ${amount} monstros na masmorra.`,
    rewardXp: 20 + amount * 5,
    rewardGold: 15 + amount * 4,
    done: false,
    claimed: false,
  };
}

function generateFloorQuest(floor: number, rng: Rng, now: () => number): Quest {
  const floorTarget = floor + 2 + randomInt(3, rng);
  return {
    id: questId(rng, now),
    type: 'floor',
    target: floorTarget,
    progress: floor,
    title: 'Exploradora das Profundezas',
    desc: `Alcance o andar ${floorTarget} da masmorra.`,
    rewardXp: 30 + floorTarget * 4,
    rewardGold: 20 + floorTarget * 5,
    done: false,
    claimed: false,
  };
}

function generateCollectQuest(rng: Rng, now: () => number): Quest {
  const amount = 2 + randomInt(3, rng);
  return {
    id: questId(rng, now),
    type: 'collect',
    target: amount,
    progress: 0,
    title: 'Coletora de Materiais',
    desc: `Colete ${amount} itens de qualquer tipo.`,
    rewardXp: 15 + amount * 5,
    rewardGold: 10 + amount * 4,
    done: false,
    claimed: false,
  };
}

export function generateQuest(floor: number, options: GenerateQuestOptions = {}): Quest {
  const rng = options.rng ?? defaultRng;
  const now = options.now ?? Date.now;
  const type = QUEST_TYPES[randomInt(QUEST_TYPES.length, rng)] as QuestType;
  if (type === 'kill') return generateKillQuest(rng, now);
  if (type === 'floor') return generateFloorQuest(floor, rng, now);
  return generateCollectQuest(rng, now);
}

/** Preenche o quadro com 2 missões iniciais quando está vazio; devolve a lista sem mudar quando já tem algo. */
export function ensureQuestBoard(quests: readonly Quest[], floor: number, options: GenerateQuestOptions = {}): Quest[] {
  if (quests.length > 0) return [...quests];
  return [generateQuest(floor, options), generateQuest(floor, options)];
}

function bumpProgress(quests: readonly Quest[], type: QuestType, nextProgress: (q: Quest) => number): Quest[] {
  return quests.map((q) => {
    if (q.type !== type || q.done) return q;
    const progress = nextProgress(q);
    return { ...q, progress, done: progress >= q.target };
  });
}

export function onMonsterKilled(quests: readonly Quest[]): Quest[] {
  return bumpProgress(quests, 'kill', (q) => q.progress + 1);
}

export function onFloorReached(quests: readonly Quest[], floor: number): Quest[] {
  return bumpProgress(quests, 'floor', () => floor);
}

export function onItemCollected(quests: readonly Quest[]): Quest[] {
  return bumpProgress(quests, 'collect', (q) => q.progress + 1);
}

export interface ClaimQuestResult {
  hero: Hero;
  quests: Quest[];
  claimed: boolean;
  leveledUp: boolean;
  levels: number;
}

/**
 * Resgata a recompensa de uma missão concluída: ouro e XP pro herói, remove
 * a missão do quadro e sorteia uma nova no lugar — o quadro nunca fica
 * menor. Sem efeito (`claimed: false`) se a missão não existe, ainda não
 * está pronta, ou já foi resgatada — igual o `if(!q || !q.done || q.claimed)
 * return;` do original.
 */
export function claimQuest(hero: Hero, quests: readonly Quest[], targetId: string, floor: number, options: GenerateQuestOptions = {}): ClaimQuestResult {
  const quest = quests.find((q) => q.id === targetId);
  if (!quest || !quest.done || quest.claimed) return { hero, quests: [...quests], claimed: false, leveledUp: false, levels: 0 };

  const xpResult = gainXP({ ...hero, gold: hero.gold + quest.rewardGold }, quest.rewardXp);
  const remaining = quests.filter((q) => q.id !== targetId);
  const nextQuests = [...remaining, generateQuest(floor, options)];

  return { hero: xpResult.hero, quests: nextQuests, claimed: true, leveledUp: xpResult.leveledUp, levels: xpResult.levels };
}
