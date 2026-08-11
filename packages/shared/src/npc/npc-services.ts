/**
 * Serviços oferecidos por NPCs encontrados no mapa. Porta de
 * `js/npc-services.js`, só a parte de regras — `finish()` do original toca
 * DOM/`RPG.Save` direto (`npc.serviceUsed=true` + render + save); aqui cada
 * `resolve*` devolve `used: boolean` e quem chama decide o que fazer com
 * isso (marcar a sala, salvar, etc.), mesmo padrão de `resolved` em
 * `events.ts`.
 *
 * Dos 5 serviços, só `heal` e `reveal` são hoje alcançáveis pelos NPCs que
 * `dungeon/generate.ts` sorteia (`NPC_TEMPLATES` só usa esses dois) —
 * `blessing`/`barter`/`recruit` existem no catálogo porque o original os
 * usa a partir de outro conteúdo (NPCs da cidade, fora do escopo portado
 * até agora), mas a lógica em si já sai pronta.
 */

import type { Companion, Hero } from '../hero/hero.js';
import { generateCompanion } from '../hero/hero.js';
import type { DungeonCell } from '../dungeon/generate.js';
import { itemCategory, randomItem, type Item } from '../items/item.js';
import { defaultRng, type Rng } from '../rng.js';

export type NpcService = 'heal' | 'blessing' | 'barter' | 'reveal' | 'recruit';

export interface NpcServiceInfo {
  icon: string;
  label: string;
}

/** Igual a `js/npc-services.js`'s `INFO`. */
export const NPC_SERVICE_INFO: Record<NpcService, NpcServiceInfo> = {
  heal: { icon: '❤️', label: 'Receber Tratamento' },
  blessing: { icon: '✨', label: 'Receber Bênção' },
  barter: { icon: '🧪', label: 'Trocar Material' },
  reveal: { icon: '🗺️', label: 'Pedir Informações' },
  recruit: { icon: '🤝', label: 'Convidar para a Equipe' },
};

export function npcServiceInfo(service: NpcService): NpcServiceInfo | null {
  return NPC_SERVICE_INFO[service] ?? null;
}

// ---------- heal ----------

export type HealOutcome = { kind: 'insufficient_gold'; required: number } | { kind: 'already_full' } | { kind: 'healed'; goldSpent: number; hpGained: number; mpGained: number };

export interface HealResult {
  hero: Hero;
  outcome: HealOutcome;
  used: boolean;
}

/** Preço cai com `descontoLoja` (carisma), até 40% de desconto — mesma fórmula do curandeiro do original. */
export function resolveHeal(hero: Hero, floor: number): HealResult {
  const discount = Math.min(0.4, (hero.derived.descontoLoja || 0) / 100);
  const price = Math.max(5, Math.round((14 + floor * 2) * (1 - discount)));

  if (hero.gold < price) return { hero, outcome: { kind: 'insufficient_gold', required: price }, used: false };
  if (hero.hp === hero.maxHp && hero.mp === hero.maxMp) return { hero, outcome: { kind: 'already_full' }, used: false };

  const hpGained = Math.min(hero.maxHp, hero.hp + Math.round(hero.maxHp * 0.45)) - hero.hp;
  const mpGained = Math.min(hero.maxMp, hero.mp + Math.round(hero.maxMp * 0.35)) - hero.mp;
  const nextHero: Hero = { ...hero, gold: hero.gold - price, hp: hero.hp + hpGained, mp: hero.mp + mpGained };
  return { hero: nextHero, outcome: { kind: 'healed', goldSpent: price, hpGained, mpGained }, used: true };
}

// ---------- blessing ----------

export type BlessingOutcome = { kind: 'blessed'; combats: number; dodge: number };

export interface BlessingResult {
  hero: Hero;
  outcome: BlessingOutcome;
  used: boolean;
}

/** Sempre concede — sem condição de falha no original. Consumida por `applyNpcBlessing` no início de cada combate. */
export function resolveBlessing(hero: Hero): BlessingResult {
  const combats = 3;
  const dodge = 12;
  return { hero: { ...hero, npcBlessing: { combats, dodge } }, outcome: { kind: 'blessed', combats, dodge }, used: true };
}

export interface ApplyBlessingResult {
  hero: Hero;
  applied: boolean;
}

/**
 * Consome um combate da bênção ativa, virando um bônus de esquiva válido só
 * para este combate (`esquivaTurns: 999` — dura o combate inteiro, não um
 * número de turnos real). Assume que `hero.buffs` já foi resetado para o
 * novo combate por quem chama (o original faz `hero.buffs={}` antes,
 * incondicionalmente, dentro de `startCombat()` — fora do escopo desta
 * função, que só cobre a parte condicional da bênção).
 */
export function applyNpcBlessing(hero: Hero): ApplyBlessingResult {
  if (!hero.npcBlessing || hero.npcBlessing.combats <= 0) return { hero, applied: false };

  const combatsLeft = hero.npcBlessing.combats - 1;
  const buffs = { ...hero.buffs, esquivaTurns: 999, esquivaAmount: hero.npcBlessing.dodge };
  const nextHero: Hero = { ...hero, buffs, npcBlessing: combatsLeft > 0 ? { ...hero.npcBlessing, combats: combatsLeft } : undefined };
  return { hero: nextHero, applied: true };
}

// ---------- barter ----------

export type BarterOutcome = { kind: 'no_material' } | { kind: 'bartered'; given: Item; received: Item };

export interface BarterResult {
  inventory: Item[];
  outcome: BarterOutcome;
  used: boolean;
}

export interface BarterOptions {
  rng?: Rng;
  now?: () => number;
}

/** Troca o primeiro material não equipado da mochila por uma poção aleatória. */
export function resolveBarter(inventory: readonly Item[], floor: number, options: BarterOptions = {}): BarterResult {
  const rng = options.rng ?? defaultRng;
  const material = inventory.find((item) => itemCategory(item) === 'material' && !item.equipped);
  if (!material) return { inventory: [...inventory], outcome: { kind: 'no_material' }, used: false };

  const potion = randomItem({ category: 'consumivel', floor, rng, now: options.now });
  const nextInventory = [...inventory.filter((item) => item.uid !== material.uid), potion];
  return { inventory: nextInventory, outcome: { kind: 'bartered', given: material, received: potion }, used: true };
}

// ---------- reveal ----------

export type RevealOutcome = { kind: 'revealed'; count: number };

export interface RevealResult {
  grid: DungeonCell[][];
  outcome: RevealOutcome;
  used: boolean;
}

export interface GridPosition {
  x: number;
  y: number;
}

/** Marca `revealed` em toda sala não-void a até 2 de distância (Manhattan) da posição do jogador, sem depender de porta/visita. */
export function resolveReveal(grid: readonly DungeonCell[][], pos: GridPosition): RevealResult {
  let count = 0;
  const nextGrid = grid.map((row) =>
    row.map((cell) => {
      const distance = Math.abs(cell.x - pos.x) + Math.abs(cell.y - pos.y);
      if (cell.type !== 'void' && distance <= 2 && !cell.revealed) {
        count++;
        return { ...cell, revealed: true };
      }
      return cell;
    }),
  );
  return { grid: nextGrid, outcome: { kind: 'revealed', count }, used: true };
}

// ---------- recruit ----------

export type RecruitOutcome = { kind: 'party_full' } | { kind: 'recruited'; companion: Companion };

export interface RecruitResult {
  party: Companion[];
  outcome: RecruitOutcome;
  used: boolean;
}

const MAX_PARTY_SIZE = 3;
/** Recrutas de NPC ficam só por um número fixo de combates — não são permanentes como os recrutados em outro lugar. */
const TEMPORARY_RECRUIT_COMBATS = 3;

export function resolveRecruit(party: readonly Companion[], rng: Rng = defaultRng): RecruitResult {
  if (party.length >= MAX_PARTY_SIZE) return { party: [...party], outcome: { kind: 'party_full' }, used: false };

  const companion: Companion = { ...generateCompanion(rng), temporary: true, combatsLeft: TEMPORARY_RECRUIT_COMBATS };
  return { party: [...party, companion], outcome: { kind: 'recruited', companion }, used: true };
}
