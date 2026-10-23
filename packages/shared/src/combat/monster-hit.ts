import { idDaClasse } from '../hero/catalog.js';
import { equipmentBonus } from '../hero/derived.js';
import { hasDebuffEffect, type Companion, type Hero } from '../hero/hero.js';
import type { DefesasDoHeroi } from '../items/encantamentos.js';
import { defaultRng, randomInt, type Rng } from '../rng.js';
import { triggerEnemyClassPower } from './class-passives.js';
import { decrementField, setStatusField, type CombatMonsterView } from './monster-state.js';

export interface MonsterHitOptions {
  rng?: Rng;
  /** Bônus de esquiva vindo do sistema de pets (ainda não portado) — 0 se ausente. */
  petEsquivaBonus?: number;
  /**
   * O herói rolou "Esquivar" com sucesso nesta rodada (`attemptDodge`): se
   * o golpe for nele, erra. Vale **só esta rodada** — se o monstro estiver
   * atordoado, lento demais ou mirar um companheiro, a esquiva se perde,
   * como se perde um passo pro lado quando ninguém ataca.
   *
   * Opção, e não buff no herói, por causa do campo único de esquiva em
   * `HeroBuffs` — ver `combat/dodge.ts`.
   */
  esquivaCerta?: boolean;
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
  const defenders = livingParty.filter((m) => (m.stance || 'equilibrada') === 'defensiva' || idDaClasse(m) === 'guerreiro');

  if (defenders.length && rng() < 0.55) return defenders;
  if (livingParty.length && rng() < 0.3) return livingParty;
  return null;
}

/**
 * Em quem o golpe do monstro cai: um companheiro defensor (55% das vezes,
 * se houver), um companheiro qualquer (30%) ou o herói (`null`). Devolve o
 * índice na equipe.
 *
 * Separado de `applyMonsterHit` pra luta do app, onde o golpe no herói vai
 * pra caixa (e só pega se encostar) e o golpe no companheiro cai como no site.
 */
export function pickMonsterTarget(party: readonly Companion[], rng: Rng = defaultRng): number | null {
  const pool = selectTargetPool(party, rng);
  if (!pool) return null;
  return party.indexOf(pool[randomInt(pool.length, rng)] as Companion);
}

export interface HeroDamageResult {
  hero: Hero;
  dodged: boolean;
  damage: number;
  poisonApplied: boolean;
  manaDrained: number;
  defensivePassiveTriggered: boolean;
  shieldConsumed: boolean;
  /** A resistência a veneno da Encantadora segurou o veneno (só com `defesas`). */
  poisonResisted?: boolean;
  /** A resistência mágica da Encantadora segurou o dreno de mana (só com `defesas`). */
  drainResisted?: boolean;
}

/**
 * Ataque do monstro contra o próprio herói: esquiva, defesa, vulnerabilidades e os efeitos que o golpe aplica de volta.
 *
 * `defesas` são as fortificações da Encantadora (`items/encantamentos.ts`), que só a arena do app passa. Sem elas o
 * golpe é o de sempre, sem um número a mais do `rng`: os sorteios de resistir só acontecem quando há a resistência.
 */
function resolveHeroDamage(hero: Hero, monster: CombatMonsterView, attackMult: number, rng: Rng, petEsquiva: number, defesas?: DefesasDoHeroi): HeroDamageResult {
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

  // A armadura encantada: resistência mágica contra os monstros mágicos, robustez contra os outros.
  const reducao = defesas ? (monster.behavior === 'magico' ? defesas.resistenciaMagica : defesas.robustez) : 0;
  if (reducao > 0) dmg = Math.max(1, Math.round(dmg * (1 - reducao)));

  let defensivePassiveTriggered = false;
  if (idDaClasse(nextHero) === 'guerreiro' && rng() < 0.2) {
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

  const resisteAoVeneno = (): boolean => !!defesas && defesas.resistenciaVeneno > 0 && rng() < defesas.resistenciaVeneno;
  let poisonApplied = false;
  let poisonResisted = false;
  if (monster.poisonStrike && resisteAoVeneno()) {
    poisonResisted = true;
  } else if (monster.poisonStrike) {
    const buffsNow = nextHero.buffs ?? {};
    nextHero = { ...nextHero, buffs: { ...buffsNow, poisonTurns: 3, poisonDmg: Math.max(2, Math.round(monster.dmg * 0.35)) } };
    poisonApplied = true;
  }
  if (monster.behavior === 'venenoso' && rng() < 0.35) {
    if (resisteAoVeneno()) {
      poisonResisted = true;
    } else {
      const buffsNow = nextHero.buffs ?? {};
      const poisonDmg = Math.max(2, Math.round(Math.floor(monster.dmg / 3) * (hasDebuffEffect(nextHero, 'poisonVulnerability') ? 1.5 : 1)));
      nextHero = { ...nextHero, buffs: { ...buffsNow, poisonTurns: 3, poisonDmg } };
      poisonApplied = true;
    }
  }

  let manaDrained = 0;
  let drainResisted = false;
  if (monster.behavior === 'magico' && rng() < 0.35) {
    if (defesas && defesas.evitaDreno > 0 && rng() < defesas.evitaDreno) {
      drainResisted = true;
    } else {
      manaDrained = Math.min(nextHero.mp, 3 + Math.floor(monster.dmg / 3));
      nextHero = { ...nextHero, mp: nextHero.mp - manaDrained };
    }
  }

  // Os dois campos da Encantadora só aparecem quando valem: o golpe do site fica com a mesma cara.
  return {
    hero: nextHero,
    dodged: false,
    damage: dmg,
    poisonApplied,
    manaDrained,
    defensivePassiveTriggered,
    shieldConsumed,
    ...(poisonResisted ? { poisonResisted } : {}),
    ...(drainResisted ? { drainResisted } : {}),
  };
}

/** O começo do golpe do monstro: se ele perde a vez e, se não, com que força vem. */
export interface MonsterAttackStart {
  monster: CombatMonsterView;
  hero: Hero;
  /** `ready`: o golpe vem, com `attackMult`. Atordoado ou lento demais, não vem. */
  outcome: 'stunned' | 'lento_skip' | 'ready';
  attackMult: number;
  rageTriggered: boolean;
  enemyClassPowerTriggered: string | null;
}

/**
 * O começo do golpe do monstro, antes de saber em quem ele cai: atordoado
 * perde a vez (e gasta um turno do atordoamento, sem sortear); senão vêm o
 * enrage de mini-chefe, o enfraquecido, o lento (que pode fazer perder a
 * vez), o comportamento e o poder de classe de inimigo.
 *
 * Separado de `applyMonsterHit` pra luta em tempo real do app: lá o golpe
 * começa quando o aviso aparece e só cai em alguém se ele ainda estiver no
 * alcance quando o aviso acaba. A luta por turnos chama os dois de uma vez.
 */
export function startMonsterAttack(monster: CombatMonsterView, hero: Hero, rng: Rng = defaultRng): MonsterAttackStart {
  if (monster.status?.atordoado && monster.status.atordoado > 0) {
    const status = setStatusField(monster.status, 'atordoado', monster.status.atordoado - 1);
    return { monster: { ...monster, status }, hero, outcome: 'stunned', attackMult: 1, rageTriggered: false, enemyClassPowerTriggered: null };
  }
  const mult = resolveAttackMultiplier(monster, hero, rng);
  return {
    monster: mult.monster,
    hero: mult.hero,
    outcome: mult.skip ? 'lento_skip' : 'ready',
    attackMult: mult.attackMult,
    rageTriggered: mult.rageTriggered,
    enemyClassPowerTriggered: mult.enemyClassPowerTriggered,
  };
}

/** O golpe que caiu num companheiro: a vida dele depois e o dano. */
export interface PartyMemberHit {
  member: Companion;
  damage: number;
  defeated: boolean;
}

/** O golpe do monstro num companheiro: d6 mais o dano do monstro, na força do golpe. Sem esquiva nem defesa. */
export function hitPartyMember(member: Companion, monster: CombatMonsterView, attackMult: number, rng: Rng = defaultRng): PartyMemberHit {
  const damage = Math.max(1, Math.round((1 + randomInt(6, rng) + monster.dmg - 1) * attackMult));
  const atingido: Companion = { ...member, hp: Math.max(0, member.hp - damage) };
  return { member: atingido, damage, defeated: atingido.hp <= 0 };
}

/** O golpe que foi no herói, com o monstro depois dele (o veneno de golpe se gasta ao acertar). */
export interface HeroHit extends HeroDamageResult {
  monster: CombatMonsterView;
}

/**
 * O golpe do monstro no próprio herói: esquiva, defesa, vulnerabilidades,
 * escudo e o que o golpe deixa de volta (veneno, dreno de mana). Acertou, o
 * golpe envenenado do poder de classe se gasta.
 */
export function landHitOnHero(
  hero: Hero,
  monster: CombatMonsterView,
  attackMult: number,
  rng: Rng = defaultRng,
  petEsquiva = 0,
  defesas?: DefesasDoHeroi,
): HeroHit {
  const heroHit = resolveHeroDamage(hero, monster, attackMult, rng, petEsquiva, defesas);
  if (heroHit.dodged) return { ...heroHit, monster };
  return { ...heroHit, monster: monster.poisonStrike ? { ...monster, poisonStrike: false } : monster };
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

  const inicio = startMonsterAttack(monster, hero, rng);
  if (inicio.outcome === 'stunned') {
    return { monster: inicio.monster, hero, party: [...party], outcome: 'stunned', heroDefeated: false };
  }
  if (inicio.outcome === 'lento_skip') {
    return {
      monster: inicio.monster,
      hero: inicio.hero,
      party: [...party],
      outcome: 'lento_skip',
      heroDefeated: false,
      rageTriggered: inicio.rageTriggered,
    };
  }

  const targetIndex = pickMonsterTarget(party, rng);
  if (targetIndex !== null) {
    const target = party[targetIndex] as Companion;
    const golpe = hitPartyMember(target, inicio.monster, inicio.attackMult, rng);
    const nextParty = party.map((m, i) => (i === targetIndex ? golpe.member : m));

    return {
      monster: inicio.monster,
      hero: inicio.hero,
      party: nextParty,
      outcome: 'hit_party',
      damage: golpe.damage,
      targetIndex,
      heroDefeated: false,
      partyMemberDefeated: golpe.defeated,
      enemyClassPowerTriggered: inicio.enemyClassPowerTriggered,
      rageTriggered: inicio.rageTriggered,
    };
  }

  // A esquiva rolada pula o cálculo inteiro: não gasta o turno de Passo
  // Veloz nem o escudo, que ficam pro próximo golpe — não foram eles que
  // salvaram o herói.
  if (options.esquivaCerta) {
    return {
      monster: inicio.monster,
      hero: inicio.hero,
      party: [...party],
      outcome: 'dodged',
      heroDefeated: false,
      enemyClassPowerTriggered: inicio.enemyClassPowerTriggered,
      rageTriggered: inicio.rageTriggered,
    };
  }

  const heroHit = landHitOnHero(inicio.hero, inicio.monster, inicio.attackMult, rng, petEsquiva);
  if (heroHit.dodged) {
    return {
      monster: heroHit.monster,
      hero: heroHit.hero,
      party: [...party],
      outcome: 'dodged',
      heroDefeated: false,
      enemyClassPowerTriggered: inicio.enemyClassPowerTriggered,
      rageTriggered: inicio.rageTriggered,
    };
  }

  return {
    monster: heroHit.monster,
    hero: heroHit.hero,
    party: [...party],
    outcome: 'hit_hero',
    damage: heroHit.damage,
    heroDefeated: heroHit.hero.hp <= 0,
    enemyClassPowerTriggered: inicio.enemyClassPowerTriggered,
    rageTriggered: inicio.rageTriggered,
    poisonApplied: heroHit.poisonApplied,
    manaDrained: heroHit.manaDrained,
    defensivePassiveTriggered: heroHit.defensivePassiveTriggered,
    shieldConsumed: heroHit.shieldConsumed,
  };
}
