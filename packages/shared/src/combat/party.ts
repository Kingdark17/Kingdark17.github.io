import type { Companion } from '../hero/hero.js';
import type { Hero } from '../hero/hero.js';
import { defaultRng, randomInt, type Rng } from '../rng.js';
import { setStatusField, type CombatMonster } from './monster-state.js';

export type PartyPassiveKind = 'ladino' | 'barbaro' | 'arqueiro' | 'necromante' | 'druida' | 'monge' | 'bardo' | 'cacador' | 'paladino';

export type PartyMemberOutcome =
  | { member: Companion; kind: 'healed_hero'; amount: number }
  | { member: Companion; kind: 'miss' }
  | { member: Companion; kind: 'hit'; amount: number; passive?: PartyPassiveKind };

export interface PartyTurnResult {
  hero: Hero;
  monster: CombatMonster;
  outcomes: PartyMemberOutcome[];
  totalDamage: number;
  defeated: boolean;
}

const HIT_CHANCE: Record<Companion['stance'], number> = {
  agressiva: 0.88,
  defensiva: 0.72,
  suporte: 0.82, // sem uso real: suporte já desvia pra cura antes de chegar aqui
  equilibrada: 0.82,
};

/**
 * Turno automático dos companheiros, agindo em sequência logo depois do
 * herói. Cada membro em postura "suporte" tenta curar antes de atacar
 * (Clérigo com chance maior); os demais atacam com bônus por postura e uma
 * chance de passiva de classe — mesma lista que `applyHeroClassPassive`,
 * mas rolada para o companheiro em vez do herói.
 *
 * Para no primeiro membro que derrota o monstro: membros seguintes na fila
 * são pulados, igual ao original (`monster.hp <= 0` interrompia o `forEach`
 * por dentro, não com early-return real — aqui o `continue` reproduz o
 * mesmo efeito).
 */
export function applyPartyTurn(
  hero: Hero,
  party: readonly Companion[],
  monster: CombatMonster,
  rng: Rng = defaultRng,
): PartyTurnResult {
  let nextHero = hero;
  let nextMonster = monster;
  const outcomes: PartyMemberOutcome[] = [];
  let totalDamage = 0;

  for (const member of party) {
    if (member.hp <= 0 || nextMonster.hp <= 0) continue;

    const stance = member.stance || 'equilibrada';
    const isCleric = member.className === 'Clérigo' || member.className === 'Clerigo';

    if (stance === 'suporte' && rng() < (isCleric ? 0.65 : 0.4)) {
      const heal = Math.max(4, Math.round((member.attrs?.sabedoria ?? 8) * 0.7));
      nextHero = { ...nextHero, hp: Math.min(nextHero.maxHp, nextHero.hp + heal) };
      outcomes.push({ member, kind: 'healed_hero', amount: heal });
      continue;
    }

    if (rng() >= HIT_CHANCE[stance]) {
      outcomes.push({ member, kind: 'miss' });
      continue;
    }

    let dmg = Math.max(2, (member.attack || 5) + randomInt(5, rng));
    if (stance === 'agressiva') dmg = Math.round(dmg * 1.3);
    if (stance === 'defensiva' || stance === 'suporte') dmg = Math.round(dmg * 0.8);
    if (member.className === 'Mago') dmg = Math.round(dmg * 1.2);

    let passive: PartyPassiveKind | undefined;
    if (member.className === 'Ladino' && rng() < 0.25) {
      dmg = Math.round(dmg * 1.65);
      passive = 'ladino';
    }
    if ((member.className === 'Bárbaro' || member.className === 'Barbaro') && member.hp < member.maxHp / 2) {
      dmg = Math.round(dmg * 1.35);
      passive = 'barbaro';
    }
    if (member.className === 'Arqueiro' && rng() < 0.25) {
      dmg = Math.round(dmg * 1.5);
      passive = 'arqueiro';
    }

    let status = nextMonster.status;
    if (member.className === 'Necromante' && rng() < 0.3) {
      status = setStatusField(status, 'enfraquecido', { turns: 2, amount: 0.2 });
      passive = 'necromante';
    }
    if (member.className === 'Druida' && rng() < 0.3) {
      status = setStatusField(status, 'veneno', { turns: 3, dmg: Math.max(2, Math.round(dmg * 0.2)) });
      passive = 'druida';
    }
    if (member.className === 'Monge' && rng() < 0.22) {
      status = setStatusField(status, 'atordoado', (status?.atordoado ?? 0) + 1);
      passive = 'monge';
    }
    if (member.className === 'Bardo' && rng() < 0.3) {
      status = setStatusField(status, 'vulneravel', { turns: 2, amount: 0.15 });
      passive = 'bardo';
    }
    if ((member.className === 'Caçador' || member.className === 'Cacador') && rng() < 0.3) {
      status = setStatusField(status, 'sangramento', { turns: 3, dmg: Math.max(2, Math.round(dmg * 0.2)) });
      passive = 'cacador';
    }
    if (member.className === 'Paladino' && rng() < 0.25) {
      const paladinHeal = Math.max(3, Math.round(dmg * 0.2));
      nextHero = { ...nextHero, hp: Math.min(nextHero.maxHp, nextHero.hp + paladinHeal) };
      passive = 'paladino';
    }

    nextMonster = { ...nextMonster, status, hp: nextMonster.hp - dmg };
    totalDamage += dmg;
    outcomes.push({ member, kind: 'hit', amount: dmg, passive });
  }

  return { hero: nextHero, monster: nextMonster, outcomes, totalDamage, defeated: nextMonster.hp <= 0 };
}
