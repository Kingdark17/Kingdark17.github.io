/**
 * Uso de poder no combate. Porta de `usePower()` em `js/combat.js`, só a
 * parte pura: custo de mana, dano/cura/buff e o status que o poder deixa no
 * monstro.
 *
 * Chama-se `castPower` e não `usePower` por um motivo bem prático: o
 * prefixo `use` é reservado a hooks no lint do React, e o `apps/web`
 * reprova qualquer chamada de `useAlgumaCoisa()` fora de componente. O nome
 * do original está aqui no comentário pra quem for comparar os dois lados.
 *
 * Igual a `resolveAttack`, **não** decide o que vem depois (turno da
 * equipe, dano contínuo, turno do monstro) nem chama `tickHeroStatus()` —
 * isso é do orquestrador da rodada. O original misturava tudo dentro da
 * mesma função porque ela também mexia no DOM.
 */

import type { Power } from '../hero/catalog.js';
import { hasDebuffEffect, type Companion, type Hero } from '../hero/hero.js';
import { masteryDamageMult } from '../hero/mastery.js';
import { defaultRng, randomInt, type Rng } from '../rng.js';
import { modifyDamageByAffinity } from './damage.js';
import { criarEsqueleto, esqueletosDePe, MAX_ESQUELETOS } from './invocacao.js';
import type { CombatMonsterView } from './monster-state.js';
import { applyPowerStatus } from './status-effects.js';

/** `summon`: ergueu um esqueleto (`summoned`); `summon_full`: já há o máximo de pé, e nada foi gasto. */
export type UsePowerOutcome = 'no_mana' | 'damage' | 'heal' | 'buff' | 'summon' | 'summon_full';

export interface UsePowerOptions {
  rng?: Rng;
  /** Bônus percentual de cura vindo do sistema de pets (ainda não portado) — 0 se ausente. */
  petCuraBonus?: number;
  /** Chance de 0 a 100 do pet poupar a mana do poder (ainda não portado) — 0 se ausente. */
  petManaSaveChance?: number;
}

export interface UsePowerResult {
  hero: Hero;
  party: Companion[];
  monster: CombatMonsterView;
  outcome: UsePowerOutcome;
  /** Custo já com a penalidade de fraqueza aplicada — é o número que a tela mostra no botão. */
  manaCost: number;
  savedMana: boolean;
  damage?: number;
  /** Vida devolvida ao herói: pela cura, ou pelo dreno de um poder com `healRatio`. */
  healed?: number;
  allyHealed?: number;
  /** O esqueleto que o poder ergueu (já no fim de `party`). */
  summoned?: Companion;
  monsterDefeated: boolean;
}

const PENALIDADE_DE_MANA = 1.2;

/** O mesmo número que o botão do poder precisa mostrar antes de o jogador clicar. */
export function powerManaCost(hero: Hero, power: Pick<Power, 'cost'>): number {
  return Math.ceil(power.cost * (hasDebuffEffect(hero, 'manaCostPenalty') ? PENALIDADE_DE_MANA : 1));
}

export function castPower(
  hero: Hero,
  party: readonly Companion[],
  monster: CombatMonsterView,
  power: Power,
  options: UsePowerOptions = {},
): UsePowerResult {
  const rng = options.rng ?? defaultRng;
  const manaCost = powerManaCost(hero, power);

  // O esqueleto do necromante: com o máximo de pé, avisa sem gastar a mana.
  if (power.type === 'invocar' && esqueletosDePe(party) >= MAX_ESQUELETOS) {
    return { hero, party: [...party], monster, outcome: 'summon_full', manaCost, savedMana: false, monsterDefeated: false };
  }

  if (hero.mp < manaCost) {
    return { hero, party: [...party], monster, outcome: 'no_mana', manaCost, savedMana: false, monsterDefeated: false };
  }

  const savedMana = (options.petManaSaveChance ?? 0) > 0 && rng() * 100 < (options.petManaSaveChance ?? 0);
  const heroAfterCost: Hero = savedMana ? hero : { ...hero, mp: hero.mp - manaCost };
  const d = heroAfterCost.derived;

  if (power.type === 'invocar') {
    const esqueleto = criarEsqueleto(heroAfterCost, party);
    return { hero: heroAfterCost, party: [...party, esqueleto], monster, outcome: 'summon', manaCost, savedMana, summoned: esqueleto, monsterDefeated: false };
  }

  if (power.type === 'dano_fisico' || power.type === 'dano_magico') {
    const base = power.type === 'dano_fisico' ? d.dmgFisico : d.dmgMagico;
    // Maestria: +2% por nível com a arma da classe na mão, como no golpe.
    // Fica no golpe do poder; o dano contínuo que ele deixa não muda.
    const bruto = Math.round((Math.round(base * (power.power ?? 1)) + randomInt(6, rng)) * masteryDamageMult(heroAfterCost));
    const mod = modifyDamageByAffinity(
      monster,
      monster.species.weakness,
      monster.species.resistance,
      bruto,
      power.type === 'dano_magico' ? 'magico' : 'fisico',
      false,
    );

    const atingido: CombatMonsterView = { ...monster, ...mod.monster, hp: monster.hp - mod.dmg };
    const comStatus = applyPowerStatus(power, atingido, d) as CombatMonsterView;

    // Dreno: parte do dano volta como vida. `Math.max(1, ...)` é do original —
    // um dreno nunca cura zero.
    const drenado = power.healRatio ? Math.max(1, Math.round(mod.dmg * power.healRatio)) : 0;
    const comVida: Hero = drenado ? { ...heroAfterCost, hp: Math.min(heroAfterCost.maxHp, heroAfterCost.hp + drenado) } : heroAfterCost;

    return {
      hero: comVida,
      party: [...party],
      monster: comStatus,
      outcome: 'damage',
      manaCost,
      savedMana,
      damage: mod.dmg,
      healed: drenado || undefined,
      monsterDefeated: comStatus.hp <= 0,
    };
  }

  if (power.type === 'cura') {
    const penalidade = hasDebuffEffect(heroAfterCost, 'healingPenalty') ? 0.75 : 1;
    const heal = Math.round((10 * (power.power ?? 1) + d.curaBonus) * penalidade * (1 + (options.petCuraBonus ?? 0) / 100));
    const allyHeal = Math.max(1, Math.round(heal * 0.7));

    return {
      hero: { ...heroAfterCost, hp: Math.min(heroAfterCost.maxHp, heroAfterCost.hp + heal) },
      party: party.map((membro) => (membro.hp > 0 ? { ...membro, hp: Math.min(membro.maxHp, membro.hp + allyHeal) } : { ...membro })),
      monster,
      outcome: 'heal',
      manaCost,
      savedMana,
      healed: heal,
      allyHealed: allyHeal,
      monsterDefeated: false,
    };
  }

  return {
    hero: { ...heroAfterCost, buffs: applyBuff(heroAfterCost, power) },
    party: [...party],
    monster,
    outcome: 'buff',
    manaCost,
    savedMana,
    monsterDefeated: false,
  };
}

function applyBuff(hero: Hero, power: Power): Hero['buffs'] {
  const buffs = { ...(hero.buffs ?? {}) };

  switch (power.type) {
    case 'buff_crit':
      buffs.critNext = true;
      break;
    case 'buff_precisao':
      buffs.precisaoTurns = power.turns;
      buffs.precisaoAmount = power.amount;
      break;
    case 'buff_forca':
      buffs.forcaTurns = power.turns;
      buffs.forcaAmount = power.amount;
      break;
    case 'buff_esquiva':
      buffs.esquivaTurns = power.turns;
      buffs.esquivaAmount = power.amount;
      break;
    case 'escudo':
      buffs.shield = power.amount;
      break;
    case 'buff_grupo':
      // Mora no herói, mas vale pra equipe: `applyPartyTurn` lê daqui.
      buffs.inspiracaoTurns = power.turns;
      buffs.inspiracaoAmount = power.amount;
      break;
  }

  return buffs;
}
