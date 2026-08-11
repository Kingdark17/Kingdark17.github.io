import { RARITY_IDS } from './rarity.js';
import { itemCategory, type Item } from './item.js';
import { isEquippable, type AnyStatKey } from './templates.js';

export const TIER_ORDER = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'SSS+', 'MAX'] as const;

export type Tier = (typeof TIER_ORDER)[number];

/** Pontuação mínima de cada tier, na mesma ordem de TIER_ORDER. */
export const TIER_MIN = [0, 25, 40, 60, 85, 115, 145, 175, 210, 250] as const;

const RARITY_BASE = [10, 25, 40, 58, 78, 95] as const;

const STAT_WEIGHTS: Partial<Record<AnyStatKey, number>> = {
  ataque: 4,
  defesa: 4,
  vida: 0.2,
  mana: 0.2,
  critico: 1,
  velocidade: 3,
  esquiva: 2,
};

const DEFAULT_WEIGHT = 0.5;

/** Só equipamento tem tier; consumível e material devolvem 0. */
export function powerScore(item: Item): number {
  if (!isEquippable(itemCategory(item))) return 0;

  const rarityIndex = Math.max(0, RARITY_IDS.indexOf(item.rarity));
  let score: number = RARITY_BASE[rarityIndex] ?? 10;

  for (const key of Object.keys(item.stats) as AnyStatKey[]) {
    const value = Math.max(0, item.stats[key] ?? 0);
    score += value * (STAT_WEIGHTS[key] ?? DEFAULT_WEIGHT);
  }

  if (item.procChance !== undefined) score += item.procChance * 30;

  return Math.round(score + (Number(item.tierAdjustment) || 0));
}

export function tierFromScore(score: number): Tier {
  for (let i = TIER_MIN.length - 1; i >= 0; i--) {
    if (score >= (TIER_MIN[i] as number)) return TIER_ORDER[i] as Tier;
  }
  return 'E';
}

export function tierFor(item: Item): Tier | null {
  if (!isEquippable(itemCategory(item))) return null;
  return tierFromScore(powerScore(item));
}

export function tierRank(item: Item | Tier): number {
  const tier = typeof item === 'string' ? item : tierFor(item);
  return tier ? TIER_ORDER.indexOf(tier) : -1;
}

/** Classe CSS do tier — `SSS+` vira `tier-sss-plus`. */
export function tierClass(tier: Tier | null): string {
  return `tier-${String(tier ?? '').toLowerCase().replace('+', '-plus')}`;
}

export interface TierInfo {
  score: number;
  tier: Tier;
  rank: number;
  min: number;
  next: number | null;
  /** Progresso até o próximo tier, 0–100. MAX devolve 100. */
  progress: number;
}

export function tierInfo(item: Item): TierInfo {
  const score = powerScore(item);
  const rank = Math.max(0, tierRank(item));
  const min = TIER_MIN[rank] as number;
  const next = rank < TIER_ORDER.length - 1 ? (TIER_MIN[rank + 1] as number) : null;

  return {
    score,
    tier: TIER_ORDER[rank] as Tier,
    rank,
    min,
    next,
    progress: next === null ? 100 : clampPercent(((score - min) / (next - min)) * 100),
  };
}

export interface ReforgeResult {
  oldTier: Tier;
  newTier: Tier;
  oldRank: number;
  newRank: number;
  changed: boolean;
}

/**
 * Reforja um item movendo-o `delta` tiers.
 *
 * Diferente do original, NÃO muta o item recebido — devolve uma cópia nova.
 * O jogo antigo mutava em cima do objeto do inventário, o que em React faria
 * a tela não redesenhar (mesma referência) ou redesenhar com estado
 * compartilhado por engano.
 */
export function reforge(item: Item, delta: number): { item: Item; result: ReforgeResult } {
  const oldRank = Math.max(0, tierRank(item));
  const target = Math.max(0, Math.min(TIER_ORDER.length - 1, oldRank + delta));

  const base: ReforgeResult = {
    oldTier: TIER_ORDER[oldRank] as Tier,
    newTier: TIER_ORDER[target] as Tier,
    oldRank,
    newRank: target,
    changed: target !== oldRank,
  };

  if (target === oldRank) return { item: { ...item, stats: { ...item.stats } }, result: base };

  const oldScore = Math.max(1, powerScore(item));
  const nextMin = TIER_MIN[target] as number;
  const nextMax = target < TIER_ORDER.length - 1 ? (TIER_MIN[target + 1] as number) - 1 : 300;
  const desired = Math.round((nextMin + nextMax) / 2);
  const factor = Math.max(0.55, Math.min(1.8, desired / oldScore));

  const stats = { ...item.stats };
  for (const key of Object.keys(stats) as AnyStatKey[]) {
    const value = stats[key] ?? 0;
    if (value > 0) stats[key] = Math.max(1, Math.round(value * factor));
  }

  const next: Item = {
    ...item,
    stats,
    value: Math.max(1, Math.round(item.value * (1 + (target - oldRank) * 0.16))),
    reforgeCount: (item.reforgeCount ?? 0) + 1,
    tierAdjustment: 0,
  };

  if (item.procChance !== undefined) {
    next.procChance = Math.max(
      0.05,
      Math.min(0.65, item.procChance + (target - oldRank) * 0.015),
    );
  }

  // O ajuste fecha a diferença entre o score que sobrou do reescalonamento e o
  // centro da faixa do tier alvo, garantindo que o item realmente caia nele.
  next.tierAdjustment = desired - powerScore(next);

  return { item: next, result: base };
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
