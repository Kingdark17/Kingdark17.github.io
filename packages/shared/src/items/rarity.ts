import { defaultRng, type Rng } from '../rng.js';

export const RARITY_IDS = ['comum', 'incomum', 'raro', 'epico', 'lendario', 'mitico'] as const;

export type RarityId = (typeof RARITY_IDS)[number];

export interface Rarity {
  id: RarityId;
  label: string;
  /** Token CSS — a engine não sabe a cor, só o nome da variável. */
  colorVar: string;
  /** Multiplicador aplicado aos stats e ao valor do item. */
  mult: number;
  weight: number;
}

export const RARITIES: readonly Rarity[] = [
  { id: 'comum', label: 'Comum', colorVar: '--r-comum', mult: 1.0, weight: 45 },
  { id: 'incomum', label: 'Incomum', colorVar: '--r-incomum', mult: 1.3, weight: 28 },
  { id: 'raro', label: 'Raro', colorVar: '--r-raro', mult: 1.7, weight: 16 },
  { id: 'epico', label: 'Épico', colorVar: '--r-epico', mult: 2.2, weight: 7 },
  { id: 'lendario', label: 'Lendário', colorVar: '--r-lendario', mult: 3.0, weight: 1.2 },
  { id: 'mitico', label: 'Mítico', colorVar: '--r-mitico', mult: 4.0, weight: 0.35 },
];

export function rarityById(id: string): Rarity | null {
  return RARITIES.find((r) => r.id === id) ?? null;
}

/**
 * Pesos de raridade para um andar. Extraído de `pickRarity` para poder ser
 * testado sem sortear: comum/incomum não mudam com a profundidade, e o bônus
 * de andar fundo é dividido proporcionalmente ao peso base — é o que mantém
 * lendário e mítico raros mesmo no fim da masmorra.
 */
export function rarityWeights(floor: number): number[] {
  const depth = Math.min(1, (Math.max(1, floor) - 1) / 12);
  const rareTiers = RARITIES.slice(2);
  const rareWeightSum = rareTiers.reduce((sum, r) => sum + r.weight, 0);
  const bonus = depth * 12;

  return RARITIES.map((r, index) => {
    if (index < 2) return r.weight;
    const scaled = r.weight * (0.12 + 0.88 * depth);
    return scaled + bonus * (r.weight / rareWeightSum);
  });
}

export function pickRarity(floor = 1, rng: Rng = defaultRng): Rarity {
  const weights = rarityWeights(floor);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;

  for (let i = 0; i < RARITIES.length; i++) {
    roll -= weights[i] as number;
    if (roll < 0) return RARITIES[i] as Rarity;
  }
  return RARITIES[RARITIES.length - 1] as Rarity;
}
