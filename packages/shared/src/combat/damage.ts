import { classByName } from '../hero/catalog.js';
import { hasDebuffEffect, type Hero } from '../hero/hero.js';
import type { AffinityType } from '../monsters/species.js';
import { decrementField, setStatusField, type CombatMonster } from './monster-state.js';

/** Bônus de rolagem de fuga pela diferença de velocidade herói/monstro. */
export function fleeBonus(hero: Hero, monster: Pick<CombatMonster, 'speed'>): number {
  const diff = hero.derived.velocidade - monster.speed;
  let bonus = diff >= 5 ? 2 : diff > 0 ? 1 : 0;
  if (hasDebuffEffect(hero, 'fleePenalty')) bonus -= 2;
  return bonus;
}

/** Quanto do ataque da arma equipada entra no dano, escalado pela afinidade da classe. */
export function weaponAtkContribution(hero: Pick<Hero, 'equip'>, affinityPct: number): number {
  const weapon = hero.equip.arma;
  return weapon ? Math.round(((weapon.stats.ataque ?? 0) * affinityPct) / 100) : 0;
}

/**
 * Ataque somado dos outros três slots (secundária, armadura, acessório). Só a
 * secundária sofre afinidade de classe — ela pode carregar uma arma leve
 * (adaga/espada/maça); armadura e acessório contribuem cheio.
 */
export function otherEquipAtk(hero: Hero): number {
  let sum = 0;
  for (const slot of ['secundaria', 'armadura', 'acessorio'] as const) {
    const item = hero.equip[slot];
    if (!item?.stats.ataque) continue;
    let pct = 100;
    if (slot === 'secundaria') {
      const affinity = classByName(hero.className)?.affinity[item.templateId];
      if (affinity != null) pct = affinity;
    }
    sum += Math.round((item.stats.ataque * pct) / 100);
  }
  return sum;
}

export interface DamageModifierResult {
  dmg: number;
  monster: CombatMonster;
  /** Para a camada de narração: a Muralha Sombria do Guardião absorveu este golpe. */
  guardConsumed: boolean;
}

/**
 * Aplica fraqueza/resistência elemental, o status "vulnerável" (e o consome
 * um turno) e a redução de Muralha Sombria (e consome um `guardHits`).
 * Dano nunca sai abaixo de 1. Não muta `monster`.
 */
export function modifyDamageByAffinity(
  monster: CombatMonster,
  weakness: AffinityType,
  resistance: AffinityType,
  dmg: number,
  type: AffinityType,
  halfResist: boolean,
): DamageModifierResult {
  let next = dmg;
  if (weakness === type) next = Math.round(next * 1.25);
  if (resistance === type) next = Math.round(next * (halfResist ? 0.9 : 0.8));

  let status = monster.status;
  const vulneravel = status?.vulneravel;
  if (vulneravel && vulneravel.turns > 0) {
    next = Math.round(next * (1 + (vulneravel.amount || 0.2)));
    status = setStatusField(status, 'vulneravel', decrementField(vulneravel));
  }

  let guardHits = monster.guardHits ?? 0;
  let guardConsumed = false;
  if (guardHits > 0) {
    next = Math.max(1, Math.round(next * 0.65));
    guardHits -= 1;
    guardConsumed = true;
  }

  return {
    dmg: Math.max(1, next),
    monster: { ...monster, status, guardHits },
    guardConsumed,
  };
}
