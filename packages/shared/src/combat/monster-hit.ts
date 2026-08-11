import { equipmentBonus } from '../hero/derived.js';
import { hasDebuffEffect, type Companion, type Hero } from '../hero/hero.js';
import { defaultRng, randomInt, type Rng } from '../rng.js';
import { triggerEnemyClassPower } from './class-passives.js';
import { decrementField, setStatusField, type CombatMonsterView } from './monster-state.js';

export interface MonsterHitOptions {
  rng?: Rng;
  /** Bônus de esquiva vindo do sistema de pets (ainda não portado) — 0 se ausente. */
  petEsquivaBonus?: number;
}

export type MonsterHitOutcome = 'stunned' | 'lento_skip' | 'hit_party' | 'dodged' | 'hit_hero';

export interface MonsterHitResult {
  monster: CombatMonsterView;
  hero: Hero;
  party: Companion[];
  outcome: MonsterHitOutcome;
  damage?: number;
  /** Índice do companheiro atingido, quando `outcome === 'hit_party'`. */
  targetIndex?: number;
  heroDefeated: boolean;
  partyMemberDefeated?: boolean;
  enemyClassPowerTriggered?: string | null;
  /** O enrage de mini-chefe (abaixo de 50% de vida) disparou NESTE turno. */
  rageTriggered?: boolean;
  poisonApplied?: boolean;
  manaDrained?: number;
  defensivePassiveTriggered?: boolean;
  shieldConsumed?: boolean;
}

interface AttackMultiplierResult {
  monster: CombatMonsterView;
  hero: Hero;
  attackMult: number;
  /** `true` quando o status "lento" fez o monstro perder o turno inteiro. */
  skip: boolean;
  rageTriggered: boolean;
  enemyClassPowerTriggered: string | null;
}

/**
 * Combina os multiplicadores de dano do ataque do monstro nesta rodada:
 * enfraquecimento reduz, "lento" pode fazer o monstro pular o turno,
 * comportamento agressivo/lento e o poder de classe de inimigo aumentam.
 * Também dispara o enrage de mini-chefe (permanente, +3 de dano) na primeira
 * vez que a vida cruza 50%.
 */
function resolveAttackMultiplier(monster: CombatMonsterView, hero: Hero, rng: Rng): AttackMultiplierResult {
  let nextMonster: CombatMonsterView = { ...monster, attackCount: (monster.attackCount ?? 0) + 1 };

  let rageTriggered = false;
  if (nextMonster.isBoss && !nextMonster.isMainBoss && nextMonster.hp <= nextMonster.maxHp / 2 && !nextMonster.rageTriggered) {
    nextMonster = { ...nextMonster, rageTriggered: true, dmg: nextMonster.dmg + 3 };
    rageTriggered = true;
  }

  let attackMult = 1;
  let status = nextMonster.status;

  const enfraquecido = status?.enfraquecido;
  if (enfraquecido && enfraquecido.turns > 0) {
    attackMult *= 1 - (enfraquecido.amount || 0.25);
    status = setStatusField(status, 'enfraquecido', decrementField(enfraquecido));
  }

  const lentoStatus = status?.lento;
  if (lentoStatus && lentoStatus.turns > 0) {
    const skip = rng() < (lentoStatus.amount || 0.2);
    status = setStatusField(status, 'lento', decrementField(lentoStatus));
    nextMonster = { ...nextMonster, status };
    if (skip) {
      return { monster: nextMonster, hero, attackMult, skip: true, rageTriggered, enemyClassPowerTriggered: null };
    }
  }
  nextMonster = { ...nextMonster, status };

  if (monster.behavior === 'agressivo' && rng() < 0.25) attackMult = 1.45;
  if (monster.behavior === 'lento' && (nextMonster.attackCount ?? 0) % 3 === 0) attackMult = 1.7;
  if (nextMonster.isMainBoss && (nextMonster.attackCount ?? 0) % 3 === 0) attackMult = 1.9;

  const classPower = triggerEnemyClassPower(nextMonster, hero);
  nextMonster = { ...nextMonster, ...classPower.monster };
  attackMult *= classPower.attackMult;

  return {
    monster: nextMonster,
    hero: classPower.hero,
    attackMult,
    skip: false,
    rageTriggered,
    enemyClassPowerTriggered: classPower.triggered,
  };
}

/** Sorteia se o monstro mira num companheiro defensor, num companheiro qualquer, ou no herói (`null`). */
function selectTargetPool(party: readonly Companion[], rng: Rng): Companion[] | null {
  const livingParty = party.filter((m) => m.hp > 0);
  const defenders = livingParty.filter((m) => (m.stance || 'equilibrada') === 'defensiva' || m.className === 'Guerreiro');

  if (defenders.length && rng() < 0.55) return defenders;
  if (livingParty.length && rng() < 0.3) return livingParty;
  return null;
}

interface HeroDamageResult {
  hero: Hero;
  dodged: boolean;
  damage: number;
  poisonApplied: boolean;
  manaDrained: number;
  defensivePassiveTriggered: boolean;
  shieldConsumed: boolean;
}

/** Ataque do monstro contra o próprio herói: esquiva, defesa, vulnerabilidades e os efeitos que o golpe aplica de volta. */
function resolveHeroDamage(hero: Hero, monster: CombatMonsterView, attackMult: number, rng: Rng, petEsquiva: number): HeroDamageResult {
  const d = hero.derived;
  const buffs = hero.buffs ?? {};
  const dodge = d.esquiva + petEsquiva + (buffs.esquivaTurns && buffs.esquivaTurns > 0 ? buffs.esquivaAmount || 0 : 0);
  let nextHero: Hero = {
    ...hero,
    buffs: { ...buffs, esquivaTurns: buffs.esquivaTurns && buffs.esquivaTurns > 0 ? buffs.esquivaTurns - 1 : buffs.esquivaTurns },
  };

  if (rng() * 100 < dodge) {
    return { hero: nextHero, dodged: true, damage: 0, poisonApplied: false, manaDrained: 0, defensivePassiveTriggered: false, shieldConsumed: false };
  }

  const bonus = equipmentBonus(nextHero.equip);
  let dmg = Math.max(
    1,
    Math.round((1 + randomInt(6, rng) + monster.dmg - Math.floor((bonus.defesa || 0) / 3) - Math.floor(d.resistMagica / 4)) * attackMult),
  );

  if (hasDebuffEffect(nextHero, 'fireVulnerability') && (monster.behavior === 'magico' || monster.name.includes('Fogo'))) {
    dmg = Math.max(1, Math.round(dmg * 1.25));
  }
  if (hasDebuffEffect(nextHero, 'physicalVulnerability')) dmg = Math.max(1, Math.round(dmg * 1.2));

  let defensivePassiveTriggered = false;
  if (nextHero.className === 'Guerreiro' && rng() < 0.2) {
    dmg = Math.max(1, Math.round(dmg * 0.6));
    defensivePassiveTriggered = true;
  }

  let shieldConsumed = false;
  const shieldBuffs = nextHero.buffs ?? {};
  if (shieldBuffs.shield && shieldBuffs.shield > 0) {
    dmg = Math.max(1, Math.round(dmg * (1 - shieldBuffs.shield)));
    nextHero = { ...nextHero, buffs: { ...shieldBuffs, shield: 0 } };
    shieldConsumed = true;
  }

  nextHero = { ...nextHero, hp: Math.max(0, nextHero.hp - dmg) };

  let poisonApplied = false;
  if (monster.poisonStrike) {
    const buffsNow = nextHero.buffs ?? {};
    nextHero = { ...nextHero, buffs: { ...buffsNow, poisonTurns: 3, poisonDmg: Math.max(2, Math.round(monster.dmg * 0.35)) } };
    poisonApplied = true;
  }
  if (monster.behavior === 'venenoso' && rng() < 0.35) {
    const buffsNow = nextHero.buffs ?? {};
    const poisonDmg = Math.max(2, Math.round(Math.floor(monster.dmg / 3) * (hasDebuffEffect(nextHero, 'poisonVulnerability') ? 1.5 : 1)));
    nextHero = { ...nextHero, buffs: { ...buffsNow, poisonTurns: 3, poisonDmg } };
    poisonApplied = true;
  }

  let manaDrained = 0;
  if (monster.behavior === 'magico' && rng() < 0.35) {
    manaDrained = Math.min(nextHero.mp, 3 + Math.floor(monster.dmg / 3));
    nextHero = { ...nextHero, mp: nextHero.mp - manaDrained };
  }

  return { hero: nextHero, dodged: false, damage: dmg, poisonApplied, manaDrained, defensivePassiveTriggered, shieldConsumed };
}

/**
 * Resolve o turno de ataque do monstro: atordoamento, enrage de mini-chefe,
 * multiplicadores de comportamento e de classe de inimigo, escolha de alvo
 * (companheiro defensor, companheiro qualquer ou o próprio herói), esquiva,
 * dano final e os efeitos que o golpe pode aplicar de volta (veneno, dreno
 * de mana). Não decide o que vem depois (derrota, próximo turno) — isso é
 * do orquestrador, igual `resolveAttack`.
 */
export function applyMonsterHit(
  hero: Hero,
  party: readonly Companion[],
  monster: CombatMonsterView,
  options: MonsterHitOptions = {},
): MonsterHitResult {
  const rng = options.rng ?? defaultRng;
  const petEsquiva = options.petEsquivaBonus ?? 0;

  if (monster.status?.atordoado && monster.status.atordoado > 0) {
    const status = setStatusField(monster.status, 'atordoado', monster.status.atordoado - 1);
    return { monster: { ...monster, status }, hero, party: [...party], outcome: 'stunned', heroDefeated: false };
  }

  const mult = resolveAttackMultiplier(monster, hero, rng);
  if (mult.skip) {
    return {
      monster: mult.monster,
      hero: mult.hero,
      party: [...party],
      outcome: 'lento_skip',
      heroDefeated: false,
      rageTriggered: mult.rageTriggered,
    };
  }

  const targetPool = selectTargetPool(party, rng);
  if (targetPool) {
    const target = targetPool[randomInt(targetPool.length, rng)] as Companion;
    const targetIndex = party.indexOf(target);
    const partyDmg = Math.max(1, Math.round((1 + randomInt(6, rng) + mult.monster.dmg - 1) * mult.attackMult));
    const updatedTarget: Companion = { ...target, hp: Math.max(0, target.hp - partyDmg) };
    const nextParty = party.map((m, i) => (i === targetIndex ? updatedTarget : m));

    return {
      monster: mult.monster,
      hero: mult.hero,
      party: nextParty,
      outcome: 'hit_party',
      damage: partyDmg,
      targetIndex,
      heroDefeated: false,
      partyMemberDefeated: updatedTarget.hp <= 0,
      enemyClassPowerTriggered: mult.enemyClassPowerTriggered,
      rageTriggered: mult.rageTriggered,
    };
  }

  const heroHit = resolveHeroDamage(mult.hero, mult.monster, mult.attackMult, rng, petEsquiva);
  if (heroHit.dodged) {
    return {
      monster: mult.monster,
      hero: heroHit.hero,
      party: [...party],
      outcome: 'dodged',
      heroDefeated: false,
      enemyClassPowerTriggered: mult.enemyClassPowerTriggered,
      rageTriggered: mult.rageTriggered,
    };
  }

  const finalMonster: CombatMonsterView = mult.monster.poisonStrike ? { ...mult.monster, poisonStrike: false } : mult.monster;

  return {
    monster: finalMonster,
    hero: heroHit.hero,
    party: [...party],
    outcome: 'hit_hero',
    damage: heroHit.damage,
    heroDefeated: heroHit.hero.hp <= 0,
    enemyClassPowerTriggered: mult.enemyClassPowerTriggered,
    rageTriggered: mult.rageTriggered,
    poisonApplied: heroHit.poisonApplied,
    manaDrained: heroHit.manaDrained,
    defensivePassiveTriggered: heroHit.defensivePassiveTriggered,
    shieldConsumed: heroHit.shieldConsumed,
  };
}
