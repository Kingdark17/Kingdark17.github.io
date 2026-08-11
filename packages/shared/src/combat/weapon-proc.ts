import type { Hero } from '../hero/hero.js';
import { itemView } from '../items/item.js';
import type { ProcTemplate } from '../items/templates.js';
import { defaultRng, type Rng } from '../rng.js';
import { setStatusField, type CombatMonster } from './monster-state.js';

export interface WeaponProcResult {
  hero: Hero;
  monster: CombatMonster;
  /** O proc que disparou (com a chance já rolada), ou `null` se não ativou. Para a camada de narração. */
  triggered: (ProcTemplate & { chance: number }) | null;
}

/**
 * Rola o proc da arma equipada (queimadura, atordoar, sangramento, mana
 * grátis, cura no acerto). Sem arma ou sem proc no template, não faz nada.
 * Não muta `hero` nem `monster`.
 */
export function applyWeaponProc(hero: Hero, monster: CombatMonster, rng: Rng = defaultRng): WeaponProcResult {
  const weapon = hero.equip.arma;
  const none: WeaponProcResult = { hero, monster, triggered: null };
  if (!weapon) return none;

  const view = itemView(weapon);
  if (!view.proc) return none;
  if (rng() >= view.proc.chance) return none;

  const d = hero.derived;
  let status = monster.status ?? {};
  let nextHero = hero;

  switch (view.proc.effect) {
    case 'queimadura':
      status = setStatusField(status, 'queimadura', { turns: 3, dmg: Math.max(2, Math.round(d.dmgFisico * 0.3)) });
      break;
    case 'sangramento':
      status = setStatusField(status, 'sangramento', { turns: 3, dmg: Math.max(2, Math.round(d.dmgFisico * 0.25)) });
      break;
    case 'atordoar':
      status = setStatusField(status, 'atordoado', (status.atordoado ?? 0) + 1);
      break;
    case 'mana_gratis':
      nextHero = { ...hero, mp: Math.min(hero.maxMp, hero.mp + 6) };
      break;
    case 'cura_no_acerto':
      nextHero = { ...hero, hp: Math.min(hero.maxHp, hero.hp + Math.max(3, Math.round(d.curaBonus * 0.5) + 4)) };
      break;
  }

  return { hero: nextHero, monster: { ...monster, status }, triggered: view.proc };
}
