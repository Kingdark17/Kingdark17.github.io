import type { Hero } from '../hero/hero.js';
import { defaultRng, type Rng } from '../rng.js';
import { setStatusField, type CombatMonster } from './monster-state.js';

export type HeroClassPassiveKind =
  | 'ladino'
  | 'necromante'
  | 'druida'
  | 'monge'
  | 'bardo'
  | 'cacador'
  | 'paladino'
  | 'clerigo';

export interface HeroClassPassiveResult {
  hero: Hero;
  monster: CombatMonster;
  /** `null` quando a classe do herói não tem passiva reativa ou o rolo não ativou. */
  triggered: { kind: HeroClassPassiveKind; amount: number } | null;
}

/**
 * Passiva única de cada classe, disparada ao acertar um golpe — espelha
 * `CLASS_PASSIVES` (catalog.ts), que só descreve o texto. Só uma passiva pode
 * disparar por ataque porque cada herói tem uma classe só; não precisa de
 * else-if para ficar mutuamente exclusivo, mas o original usa e mantemos
 * a mesma forma pela fidelidade.
 */
export function applyHeroClassPassive(
  hero: Hero,
  monster: CombatMonster,
  dmg: number,
  rng: Rng = defaultRng,
): HeroClassPassiveResult {
  const cls = hero.className;
  const none: HeroClassPassiveResult = { hero, monster, triggered: null };

  if (cls === 'Ladino' && rng() < 0.25) {
    const extra = Math.max(1, Math.round(dmg * 0.5));
    return { hero, monster: { ...monster, hp: monster.hp - extra }, triggered: { kind: 'ladino', amount: extra } };
  }
  if (cls === 'Necromante' && rng() < 0.3) {
    const status = setStatusField(monster.status, 'enfraquecido', { turns: 2, amount: 0.2 });
    return { hero, monster: { ...monster, status }, triggered: { kind: 'necromante', amount: 0.2 } };
  }
  if (cls === 'Druida' && rng() < 0.3) {
    const veneno = { turns: 3, dmg: Math.max(2, Math.round(dmg * 0.2)) };
    const status = setStatusField(monster.status, 'veneno', veneno);
    return { hero, monster: { ...monster, status }, triggered: { kind: 'druida', amount: veneno.dmg } };
  }
  if (cls === 'Monge' && rng() < 0.22) {
    const status = setStatusField(monster.status, 'atordoado', (monster.status?.atordoado ?? 0) + 1);
    return { hero, monster: { ...monster, status }, triggered: { kind: 'monge', amount: 1 } };
  }
  if (cls === 'Bardo' && rng() < 0.3) {
    const status = setStatusField(monster.status, 'vulneravel', { turns: 2, amount: 0.15 });
    return { hero, monster: { ...monster, status }, triggered: { kind: 'bardo', amount: 0.15 } };
  }
  if ((cls === 'Caçador' || cls === 'Cacador') && rng() < 0.3) {
    const sangramento = { turns: 3, dmg: Math.max(2, Math.round(dmg * 0.2)) };
    const status = setStatusField(monster.status, 'sangramento', sangramento);
    return { hero, monster: { ...monster, status }, triggered: { kind: 'cacador', amount: sangramento.dmg } };
  }
  if (cls === 'Paladino' && rng() < 0.25) {
    const heal = Math.max(3, Math.round(dmg * 0.2));
    return { hero: { ...hero, hp: Math.min(hero.maxHp, hero.hp + heal) }, monster, triggered: { kind: 'paladino', amount: heal } };
  }
  if (cls === 'Clérigo' && rng() < 0.2) {
    const heal = Math.max(2, Math.round(dmg * 0.15));
    return { hero: { ...hero, hp: Math.min(hero.maxHp, hero.hp + heal) }, monster, triggered: { kind: 'clerigo', amount: heal } };
  }

  return none;
}

/**
 * Poder de classe de inimigo, ativado a cada 3º ataque do monstro
 * (`attackCount % 3 === 0`). IMPORTANTE: quem chama precisa incrementar
 * `attackCount` ANTES de chamar esta função — o original faz
 * `monster.attackCount++` e só depois checa o módulo, então o gatilho é no
 * 3º, 6º, 9º ataque, nunca no primeiro (que fica em 1, não em 0).
 *
 * A checagem por `enemyClassId` (em vez do `indexOf('Brutamontes')` que o
 * original fazia na string `'Chefe Brutamontes'`) é possível porque a
 * instância guarda o id estável, não o nome já formatado — um dos ganhos
 * concretos de ter `enemyClassId` separado do rótulo de exibição.
 */
export function triggerEnemyClassPower(monster: CombatMonster, hero: Hero): { monster: CombatMonster; hero: Hero; attackMult: number; triggered: string | null } {
  const none = { monster, hero, attackMult: 1, triggered: null };
  if (!monster.attackCount || monster.attackCount % 3 !== 0) return none;

  switch (monster.enemyClassId) {
    case 'brutamontes':
      return { monster, hero, attackMult: 1.7, triggered: 'brutamontes' };
    case 'assassino':
      return { monster: { ...monster, poisonStrike: true }, hero, attackMult: 1.4, triggered: 'assassino' };
    case 'xama': {
      const heal = Math.max(4, Math.round(monster.maxHp * 0.14));
      return { monster: { ...monster, hp: Math.min(monster.maxHp, monster.hp + heal) }, hero, attackMult: 1, triggered: 'xama' };
    }
    case 'guardiao':
      return { monster: { ...monster, guardHits: 2 }, hero, attackMult: 1, triggered: 'guardiao' };
    case 'feiticeiro': {
      const drain = Math.min(hero.mp, Math.max(4, Math.round(monster.dmg * 0.6)));
      return { monster, hero: { ...hero, mp: hero.mp - drain }, attackMult: 1.3, triggered: 'feiticeiro' };
    }
    default:
      return none;
  }
}
