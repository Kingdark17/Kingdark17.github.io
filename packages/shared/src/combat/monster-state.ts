import type { MonsterInstance } from '../monsters/generate.js';

/** Status contínuo: causa dano fixo por turno até `turns` zerar. */
export interface DotStatus {
  turns: number;
  dmg: number;
}

/** Status que aplica um multiplicador enquanto ativo. */
export interface AmountStatus {
  turns: number;
  amount: number;
}

/**
 * Status ativos num monstro durante o combate. `atordoado` é só um contador
 * de turnos perdidos — o original guardava um número solto, não `{turns}`,
 * porque zera no MESMO turno em que consome (não decrementa por rodada como
 * os outros).
 */
export interface MonsterStatus {
  queimadura?: DotStatus;
  sangramento?: DotStatus;
  veneno?: DotStatus;
  atordoado?: number;
  enfraquecido?: AmountStatus;
  vulneravel?: AmountStatus;
  lento?: AmountStatus;
}

/**
 * Monstro durante um combate: a instância gerada (`MonsterInstance`) mais o
 * estado que só existe enquanto a luta dura. Nenhum destes campos é
 * escrito por `generate()`/`generateBoss()` — nascem quando o combate começa
 * e não sobrevivem a ele (o original nunca salva um combate em andamento).
 */
export interface CombatMonster extends MonsterInstance {
  status?: MonsterStatus;
  attackCount?: number;
  /** Golpes restantes que a Muralha Sombria do Guardião ainda vai reduzir. */
  guardHits?: number;
  /** Marca que o próximo golpe do herói recebido envenena — proc do Assassino. */
  poisonStrike?: boolean;
  /** Já disparou o enrage de mini-chefe abaixo de 50% de vida (dispara uma vez só). */
  rageTriggered?: boolean;
}

export function freshCombatMonster(monster: MonsterInstance): CombatMonster {
  return { ...monster, status: {}, attackCount: 0 };
}

/**
 * Escreve (ou remove, se `value` for `undefined`) um campo de status sem
 * mutar o objeto original. O original fazia `delete monster.status[key]`
 * quando os turnos zeravam — aqui isso vira "não incluir a chave no objeto
 * novo", que é o equivalente imutável.
 */
export function setStatusField<K extends keyof MonsterStatus>(
  status: MonsterStatus | undefined,
  key: K,
  value: MonsterStatus[K],
): MonsterStatus {
  const next: MonsterStatus = { ...status };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

/** Decrementa `turns` em 1; devolve `undefined` quando chega a zero (status acaba). */
export function decrementField<T extends DotStatus | AmountStatus>(status: T | undefined): T | undefined {
  if (!status) return undefined;
  const turns = status.turns - 1;
  return turns > 0 ? { ...status, turns } : undefined;
}
