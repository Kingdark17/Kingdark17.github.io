import { equipmentBonus } from '../hero/derived.js';
import { hasDebuffEffect, weaponAffinityPct, type Hero } from '../hero/hero.js';
import type { ProcTemplate } from '../items/templates.js';
import { defaultRng, randomInt, type Rng } from '../rng.js';
import { applyHeroClassPassive, type HeroClassPassiveResult } from './class-passives.js';
import { modifyDamageByAffinity, otherEquipAtk, weaponAtkContribution } from './damage.js';
import type { CombatMonsterView } from './monster-state.js';
import { applyWeaponProc } from './weapon-proc.js';

export type AttackStyle = 'normal' | 'magic' | 'physical';

export interface ResolveAttackOptions {
  rng?: Rng;
  /** Bônus de crítico vindo do sistema de pets (ainda não portado) — 0 se ausente. */
  petCriticoBonus?: number;
}

export interface ResolveAttackResult {
  hero: Hero;
  monster: CombatMonsterView;
  outcome: 'no_mana' | 'miss' | 'dodged' | 'hit';
  magical: boolean;
  affinityPct: number;
  damage?: number;
  isCrit?: boolean;
  procTriggered?: (ProcTemplate & { chance: number }) | null;
  classPassiveTriggered?: HeroClassPassiveResult['triggered'];
  monsterDefeated: boolean;
}

const MAGIC_ATTACK_COST = 5;

/** Decrementa os buffs de duração por turno — acontece tanto em acerto quanto em erro, `critNext` não. */
function consumeTurnBuffs(hero: Hero): Hero {
  const b = hero.buffs ?? {};
  return {
    ...hero,
    buffs: {
      ...b,
      precisaoTurns: b.precisaoTurns && b.precisaoTurns > 0 ? b.precisaoTurns - 1 : b.precisaoTurns,
      forcaTurns: b.forcaTurns && b.forcaTurns > 0 ? b.forcaTurns - 1 : b.forcaTurns,
    },
  };
}

/**
 * Resolve o ataque do herói contra o monstro atual: acerto/erro, dano
 * físico ou mágico, crítico, proc de arma e passiva de classe. Não decide
 * sozinho o que acontece depois (turno da equipe, status contínuo, turno do
 * monstro) — isso é responsabilidade de quem orquestra a rodada, chamando
 * esta função e as demais (`applyPartyTurn`, `tickMonsterDot`,
 * `applyMonsterHit`) em sequência, igual o `resolveAttack` original fazia
 * internamente antes de virar quatro funções puras separadas.
 *
 * Não chama `tickHeroStatus()` — isso é um passo anterior, comum também a
 * `usePower()`, e cabe a quem orquestra rodar antes de chegar aqui.
 */
export function resolveAttack(
  hero: Hero,
  monster: CombatMonsterView,
  roll: number,
  attackStyle: AttackStyle,
  options: ResolveAttackOptions = {},
): ResolveAttackResult {
  const rng = options.rng ?? defaultRng;
  const petCritico = options.petCriticoBonus ?? 0;

  const isMage = hero.className === 'Mago';
  const magicalAttack = isMage && attackStyle === 'magic';

  if (magicalAttack && hero.mp < MAGIC_ATTACK_COST) {
    return { hero, monster, outcome: 'no_mana', magical: true, affinityPct: weaponAffinityPct(hero), monsterDefeated: false };
  }
  const heroAfterCost = magicalAttack ? { ...hero, mp: hero.mp - MAGIC_ATTACK_COST } : hero;

  const d = heroAfterCost.derived;
  const bonus = equipmentBonus(heroAfterCost.equip);
  const affinity = weaponAffinityPct(heroAfterCost);
  const buffs = heroAfterCost.buffs ?? {};
  const guaranteedCrit = !!buffs.critNext;

  let hitTarget = 11;
  if (buffs.precisaoTurns && buffs.precisaoTurns > 0) {
    hitTarget = Math.max(4, hitTarget - Math.floor((buffs.precisaoAmount ?? 0) / 5));
  }
  const weapon = heroAfterCost.equip.arma;
  if (hasDebuffEffect(heroAfterCost, 'rangedPenalty') && weapon && (weapon.templateId === 'arco' || weapon.templateId === 'cajado')) {
    hitTarget += 2;
  }

  let hit = roll >= hitTarget || guaranteedCrit;
  let dodgedByAgility = false;
  // O escudo de esquiva do "guaranteedCrit" também pula essa checagem — um
  // crítico garantido não pode ser esquivado pelo monstro.
  if (hit && !guaranteedCrit && roll !== 20 && monster.behavior === 'agil' && rng() < 0.15) {
    hit = false;
    dodgedByAgility = true;
  }

  if (!hit) {
    return {
      hero: consumeTurnBuffs(heroAfterCost),
      monster,
      outcome: dodgedByAgility ? 'dodged' : 'miss',
      magical: magicalAttack,
      affinityPct: affinity,
      monsterDefeated: false,
    };
  }

  let forcaMult = buffs.forcaTurns && buffs.forcaTurns > 0 ? 1 + (buffs.forcaAmount ?? 0) : 1;
  if ((heroAfterCost.className === 'Bárbaro' || heroAfterCost.className === 'Barbaro') && heroAfterCost.hp < heroAfterCost.maxHp * 0.5) {
    forcaMult *= 1.35;
  }

  const base = 3 + randomInt(6, rng);
  let dmg: number;
  let nextMonster: CombatMonsterView;

  if (magicalAttack) {
    dmg = Math.round(base + d.dmgMagico + weaponAtkContribution(heroAfterCost, affinity) + otherEquipAtk(heroAfterCost));
    const mod = modifyDamageByAffinity(monster, monster.species.weakness, monster.species.resistance, dmg, 'magico', isMage);
    dmg = mod.dmg;
    nextMonster = { ...monster, ...mod.monster };
  } else {
    const physicalBase = isMage && attackStyle === 'physical' ? Math.round(d.dmgFisico * 0.5) : d.dmgFisico;
    dmg = Math.round((base + physicalBase + weaponAtkContribution(heroAfterCost, affinity) + otherEquipAtk(heroAfterCost)) * forcaMult);
    const mod = modifyDamageByAffinity(monster, monster.species.weakness, monster.species.resistance, dmg, 'fisico', false);
    dmg = mod.dmg;
    nextMonster = { ...monster, ...mod.monster };
  }

  const critChance = (d.critico + (bonus.critico ?? 0) + petCritico + (heroAfterCost.className === 'Arqueiro' ? 8 : 0)) / 100;
  const isCrit = guaranteedCrit || rng() < critChance || roll === 20;
  if (isCrit) dmg = Math.round(dmg * 1.6);

  nextMonster = { ...nextMonster, hp: nextMonster.hp - dmg };

  let afterHero: Hero = consumeTurnBuffs({ ...heroAfterCost, buffs: { ...buffs, critNext: false } });

  const procResult = applyWeaponProc(afterHero, nextMonster, rng);
  afterHero = procResult.hero;
  nextMonster = { ...nextMonster, ...procResult.monster };

  const passiveResult = applyHeroClassPassive(afterHero, nextMonster, dmg, rng);
  afterHero = passiveResult.hero;
  nextMonster = { ...nextMonster, ...passiveResult.monster };

  return {
    hero: afterHero,
    monster: nextMonster,
    outcome: 'hit',
    magical: magicalAttack,
    affinityPct: affinity,
    damage: dmg,
    isCrit,
    procTriggered: procResult.triggered,
    classPassiveTriggered: passiveResult.triggered,
    monsterDefeated: nextMonster.hp <= 0,
  };
}
