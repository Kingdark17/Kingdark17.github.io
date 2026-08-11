import type { Hero } from '../hero/hero.js';

export interface HeroStatusTickResult {
  hero: Hero;
  damage: number;
  defeated: boolean;
}

/** Aplica o veneno ativo no herói (recebido de um monstro venenoso ou do Assassino) no início do turno. */
export function tickHeroStatus(hero: Hero): HeroStatusTickResult {
  const buffs = hero.buffs ?? {};
  if (!buffs.poisonTurns || buffs.poisonTurns <= 0) return { hero, damage: 0, defeated: false };

  const dmg = buffs.poisonDmg ?? 2;
  const hp = Math.max(0, hero.hp - dmg);
  const nextHero: Hero = { ...hero, hp, buffs: { ...buffs, poisonTurns: buffs.poisonTurns - 1 } };

  return { hero: nextHero, damage: dmg, defeated: hp <= 0 };
}
