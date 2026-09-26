/**
 * A ação "Esquivar" — pedido do doc do Breno ("opções de ações durante
 * batalha"), com a regra escolhida pelo Pedro em 2026-09-26: **rola o d20,
 * como a fuga**. Com 12 ou mais, somado ao bônus de velocidade, o golpe
 * que o monstro der em você nesta rodada erra.
 *
 * Mesma forma de `attemptFlee` de propósito: é a mesma pergunta ("você é
 * rápido o bastante?"), com o mesmo dado na tela e o mesmo bônus. Só a
 * consequência muda — fugir tira você da luta; esquivar te deixa nela sem
 * levar o golpe.
 *
 * Só o julgamento mora aqui. Quem faz a esquiva valer é `applyMonsterHit`,
 * pela opção `esquivaCerta` — e só na rodada em que ela foi rolada. Não
 * vira buff guardado no herói: o campo de esquiva que existe é um só, e a
 * bênção de NPC já mora nele; gravar a ação ali apagaria a bênção.
 */

import type { Hero } from '../hero/hero.js';
import { fleeBonus } from './damage.js';
import type { FleeAttemptResult } from './flee.js';
import type { CombatMonster } from './monster-state.js';

/** Total mínimo (d20 + bônus de velocidade) pra se preparar a tempo. O mesmo da fuga. */
export const ESQUIVA_TARGET = 12;

export function attemptDodge(hero: Hero, monster: Pick<CombatMonster, 'speed'>, roll: number): FleeAttemptResult {
  if (!Number.isInteger(roll) || roll < 1 || roll > 20) {
    throw new RangeError(`rolagem ${roll} não existe num d20 (esquiva)`);
  }
  const bonus = fleeBonus(hero, monster);
  const total = roll + bonus;
  return { roll, bonus, total, success: total >= ESQUIVA_TARGET };
}
