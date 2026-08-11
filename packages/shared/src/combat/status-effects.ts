import type { PowerStatus } from '../hero/catalog.js';
import type { DerivedStats } from '../hero/stats.js';
import { decrementField, setStatusField, type CombatMonster } from './monster-state.js';

export interface DotTickResult {
  monster: CombatMonster;
  /** Soma do dano de todos os status contínuos ativos neste turno — 0 se nenhum tiver disparado. */
  damage: number;
  defeated: boolean;
}

const DOT_KEYS = ['queimadura', 'sangramento', 'veneno'] as const;

/** Aplica o dano de queimadura/sangramento/veneno no início do turno e decrementa os contadores. */
export function tickMonsterDot(monster: CombatMonster): DotTickResult {
  if (!monster.status) return { monster, damage: 0, defeated: monster.hp <= 0 };

  let status = monster.status;
  let hp = monster.hp;
  let damage = 0;

  for (const key of DOT_KEYS) {
    const s = status[key];
    if (s && s.turns > 0) {
      hp -= s.dmg;
      damage += s.dmg;
      status = setStatusField(status, key, decrementField(s));
    }
  }

  return { monster: { ...monster, hp, status }, damage, defeated: hp <= 0 };
}

export interface PowerStatusInput {
  status?: PowerStatus;
  turns?: number;
  dotRatio?: number;
  amount?: number;
}

/**
 * Aplica o status de um poder ao monstro (queimadura, atordoado, vulnerável
 * etc). Poderes de dano contínuo escalam pelo maior entre dano físico e
 * mágico do herói, igual ao original — não pelo tipo do próprio poder.
 */
export function applyPowerStatus(
  power: PowerStatusInput,
  monster: CombatMonster,
  derived: Pick<DerivedStats, 'dmgMagico' | 'dmgFisico'>,
): CombatMonster {
  if (!power.status) return monster;

  let status = monster.status ?? {};
  if (power.status === 'atordoado') {
    status = setStatusField(status, 'atordoado', (status.atordoado ?? 0) + (power.turns ?? 1));
  } else if (power.status === 'veneno' || power.status === 'sangramento' || power.status === 'queimadura') {
    const dmg = Math.max(2, Math.round(Math.max(derived.dmgMagico, derived.dmgFisico) * (power.dotRatio ?? 0.2)));
    status = setStatusField(status, power.status, { turns: power.turns ?? 3, dmg });
  } else {
    status = setStatusField(status, power.status, { turns: power.turns ?? 3, amount: power.amount ?? 0.2 });
  }

  return { ...monster, status };
}
