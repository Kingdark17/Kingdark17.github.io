/**
 * Tentativa de fuga. Porta de `attemptFlee()` em `js/combat.js` — só o
 * julgamento do d20; o que acontece depois (sair do combate, ou levar o
 * turno do monstro na cara) é do orquestrador.
 *
 * A rolagem entra por parâmetro em vez de ser sorteada aqui: o dado é
 * mostrado na tela antes do resultado, e o servidor precisa poder conferir
 * a jogada com o mesmo número que o cliente usou.
 */

import { FUGA_COM_PERNA_QUEBRADA } from '../hero/ferimentos.js';
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
  // A perna quebrada tira da rolagem (`hero/ferimentos.ts`); o bônus mostrado continua o da velocidade.
  const total = roll + bonus - (hero.ferimentos?.perna ? FUGA_COM_PERNA_QUEBRADA : 0);
  return { roll, bonus, total, success: total >= FLEE_TARGET };
}
