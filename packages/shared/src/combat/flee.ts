/**
 * Tentativa de fuga. Porta de `attemptFlee()` em `js/combat.js` — só o
 * julgamento do d20; o que acontece depois (sair do combate, ou levar o
 * turno do monstro na cara) é do orquestrador.
 *
 * A rolagem entra por parâmetro em vez de ser sorteada aqui: o dado é
 * mostrado na tela antes do resultado, e o servidor precisa poder conferir
 * a jogada com o mesmo número que o cliente usou.
 */

import type { Hero } from '../hero/hero.js';
import { fleeBonus } from './damage.js';
import type { CombatMonster } from './monster-state.js';

/** Total mínimo (d20 + bônus de velocidade) para escapar. */
export const FLEE_TARGET = 12;

export interface FleeAttemptResult {
  roll: number;
  bonus: number;
  total: number;
  success: boolean;
}

export function attemptFlee(hero: Hero, monster: Pick<CombatMonster, 'speed'>, roll: number): FleeAttemptResult {
  const bonus = fleeBonus(hero, monster);
  const total = roll + bonus;
  return { roll, bonus, total, success: total >= FLEE_TARGET };
}
