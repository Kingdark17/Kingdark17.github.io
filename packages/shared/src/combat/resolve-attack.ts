import { classById, idDaClasse } from '../hero/catalog.js';
import { equipmentBonus } from '../hero/derived.js';
import { hasDebuffEffect, weaponAffinityPct, type Hero } from '../hero/hero.js';
import type { ProcTemplate } from '../items/templates.js';
import { defaultRng, randomInt, type Rng } from '../rng.js';
import { applyHeroClassPassive, type HeroClassPassiveResult } from './class-passives.js';
import { modifyDamageByAffinity, otherEquipAtk, weaponAtkContribution } from './damage.js';
import type { CombatMonsterView } from './monster-state.js';
import { applyWeaponProc } from './weapon-proc.js';

/**
 * `normal` e `physical` são o mesmo golpe pra quem não é mago; pro mago, o
 * `physical` é o golpe de cajado, com metade do dano físico. `ranged` é o
 * tiro de arco do arqueiro e do caçador — dano de golpe físico, dado de
 * classe.
 */
export type AttackStyle = 'normal' | 'magic' | 'physical' | 'ranged';

export type LadosDoDado = 6 | 20;

/**
 * **O dado que este ataque rola**: d6 no ataque que combina com a classe,
 * d20 em todo o resto — `ClassDef.ataquePrincipal`.
 *
 * Mora na engine, e não na tela, porque é regra: a tela pergunta aqui qual
 * dado girar, `resolveAttack` pergunta aqui como ler o número, e um servidor
 * que um dia conferir a jogada pergunta a mesma coisa. Três respostas
 * escritas em três lugares iam discordar.
 */
export function ladosDoAtaque(hero: Hero, estilo: AttackStyle): LadosDoDado {
  const principal = classById(idDaClasse(hero) ?? '')?.ataquePrincipal;
  if (estilo === 'magic') return principal === 'magico' ? 6 : 20;
  if (estilo === 'ranged') return principal === 'distancia' && hero.equip.arma?.templateId === 'arco' ? 6 : 20;
  return principal === 'fisico' ? 6 : 20;
}

export interface AtaqueDisponivel {
  estilo: AttackStyle;
  lados: LadosDoDado;
  /** Mana gasta ao atacar — só o ataque mágico cobra. */
  custo: number;
}

/**
 * Os botões de ataque desta classe, **o da classe primeiro**.
 *
 * "Todos têm a opção ataque físico", diz o doc — então o físico está sempre
 * na lista; quem tem outro ataque principal o tem **antes** dele. Pro
 * arqueiro de arco o físico em d20 perde sempre pro tiro em d6 (o dano é o
 * mesmo), mas é o que a regra pede, e é o único que sobra se ele largar o
 * arco.
 *
 * Substitui o `hero.className === 'Mago'` que a tela fazia: regra de
 * classe olha o id.
 */
export function ataquesDisponiveis(hero: Hero): AtaqueDisponivel[] {
  const principal = classById(idDaClasse(hero) ?? '')?.ataquePrincipal;
  const ataques: AtaqueDisponivel[] = [];
  if (principal === 'magico') ataques.push({ estilo: 'magic', lados: 6, custo: MAGIC_ATTACK_COST });
  if (principal === 'distancia' && hero.equip.arma?.templateId === 'arco') ataques.push({ estilo: 'ranged', lados: 6, custo: 0 });
  const fisico: AttackStyle = principal === 'magico' ? 'physical' : 'normal';
  ataques.push({ estilo: fisico, lados: ladosDoAtaque(hero, fisico), custo: 0 });
  return ataques;
}

/**
 * Converte um modificador escrito em pontos de d20 pro dado que está
 * rolando. O d20 fica **exatamente** como era (`pontos * 20 / 20`); o d6
 * recebe a mesma fatia de probabilidade, arredondada pra face inteira.
 */
function emFaces(pontosDeD20: number, lados: LadosDoDado): number {
  return Math.round((pontosDeD20 * lados) / 20);
}

/**
 * A face mínima pra acertar, antes de buff e debuff: 11 no d20 (50%), 3 no
 * d6 (67%). O d6 existe pra acertar **mais** — foi o pedido.
 */
const ALVO_DE_ACERTO: Record<LadosDoDado, number> = { 20: 11, 6: 3 };

export interface ResolveAttackOptions {
  rng?: Rng;
  /** Bônus de crítico vindo do sistema de pets (ainda não portado) — 0 se ausente. */
  petCriticoBonus?: number;
}

export interface ResolveAttackResult {
  hero: Hero;
  monster: CombatMonsterView;
  outcome: 'no_mana' | 'miss' | 'dodged' | 'hit';
  magical: boolean;
  affinityPct: number;
  damage?: number;
  isCrit?: boolean;
  procTriggered?: (ProcTemplate & { chance: number }) | null;
  classPassiveTriggered?: HeroClassPassiveResult['triggered'];
  monsterDefeated: boolean;
}

const MAGIC_ATTACK_COST = 5;

/** Decrementa os buffs de duração por turno — acontece tanto em acerto quanto em erro, `critNext` não. */
function consumeTurnBuffs(hero: Hero): Hero {
  const b = hero.buffs ?? {};
  return {
    ...hero,
    buffs: {
      ...b,
      precisaoTurns: b.precisaoTurns && b.precisaoTurns > 0 ? b.precisaoTurns - 1 : b.precisaoTurns,
      forcaTurns: b.forcaTurns && b.forcaTurns > 0 ? b.forcaTurns - 1 : b.forcaTurns,
    },
  };
}

/**
 * Resolve o ataque do herói contra o monstro atual: acerto/erro, dano
 * físico ou mágico, crítico, proc de arma e passiva de classe. Não decide
 * sozinho o que acontece depois (turno da equipe, status contínuo, turno do
 * monstro) — isso é responsabilidade de quem orquestra a rodada, chamando
 * esta função e as demais (`applyPartyTurn`, `tickMonsterDot`,
 * `applyMonsterHit`) em sequência, igual o `resolveAttack` original fazia
 * internamente antes de virar quatro funções puras separadas.
 *
 * Não chama `tickHeroStatus()` — isso é um passo anterior, comum também a
 * `usePower()`, e cabe a quem orquestra rodar antes de chegar aqui.
 */
export function resolveAttack(
  hero: Hero,
  monster: CombatMonsterView,
  roll: number,
  attackStyle: AttackStyle,
  options: ResolveAttackOptions = {},
): ResolveAttackResult {
  const rng = options.rng ?? defaultRng;
  const petCritico = options.petCriticoBonus ?? 0;

  // Um número fora do dado é defeito de quem chamou — a tela rolando d20
  // pra um ataque de d6. Corrigir em silêncio esconderia o defeito, e um
  // servidor que confira a jogada vai querer exatamente esta recusa. Vem
  // antes da mana: a rolagem é inválida com ou sem ela.
  const lados = ladosDoAtaque(hero, attackStyle);
  if (!Number.isInteger(roll) || roll < 1 || roll > lados) {
    throw new RangeError(`rolagem ${roll} não existe num d${lados} (ataque ${attackStyle})`);
  }

  const isMage = idDaClasse(hero) === 'mago';
  const magicalAttack = isMage && attackStyle === 'magic';

  if (magicalAttack && hero.mp < MAGIC_ATTACK_COST) {
    return { hero, monster, outcome: 'no_mana', magical: true, affinityPct: weaponAffinityPct(hero), monsterDefeated: false };
  }
  const heroAfterCost = magicalAttack ? { ...hero, mp: hero.mp - MAGIC_ATTACK_COST } : hero;

  const d = heroAfterCost.derived;
  const bonus = equipmentBonus(heroAfterCost.equip);
  const affinity = weaponAffinityPct(heroAfterCost);
  const buffs = heroAfterCost.buffs ?? {};
  const guaranteedCrit = !!buffs.critNext;

  // Precisão e Visão Fraca foram escritas em pontos de d20 e continuam
  // valendo neles; no d6 viram a fatia equivalente (ver `emFaces`). O mínimo
  // de 4 do d20 — errar só no 1, 2 e 3 — vira errar só no 1.
  let hitTarget = ALVO_DE_ACERTO[lados];
  if (buffs.precisaoTurns && buffs.precisaoTurns > 0) {
    hitTarget = Math.max(1 + emFaces(3, lados), hitTarget - emFaces(Math.floor((buffs.precisaoAmount ?? 0) / 5), lados));
  }
  const weapon = heroAfterCost.equip.arma;
  if (hasDebuffEffect(heroAfterCost, 'rangedPenalty') && weapon && (weapon.templateId === 'arco' || weapon.templateId === 'cajado')) {
    hitTarget += emFaces(2, lados);
  }

  // **O 6 do d6 não é crítico.** O 20 natural crita e fura a esquiva do
  // ágil; dar isso ao 6 triplicaria os críticos automáticos (5% → 16,7%), e
  // o pedido foi acertar mais, não critar mais.
  const vinteNatural = lados === 20 && roll === 20;

  let hit = roll >= hitTarget || guaranteedCrit;
  let dodgedByAgility = false;
  // O escudo de esquiva do "guaranteedCrit" também pula essa checagem — um
  // crítico garantido não pode ser esquivado pelo monstro.
  if (hit && !guaranteedCrit && !vinteNatural && monster.behavior === 'agil' && rng() < 0.15) {
    hit = false;
    dodgedByAgility = true;
  }

  if (!hit) {
    return {
      hero: consumeTurnBuffs(heroAfterCost),
      monster,
      outcome: dodgedByAgility ? 'dodged' : 'miss',
      magical: magicalAttack,
      affinityPct: affinity,
      monsterDefeated: false,
    };
  }

  let forcaMult = buffs.forcaTurns && buffs.forcaTurns > 0 ? 1 + (buffs.forcaAmount ?? 0) : 1;
  if (idDaClasse(heroAfterCost) === 'barbaro' && heroAfterCost.hp < heroAfterCost.maxHp * 0.5) {
    forcaMult *= 1.35;
  }

  // Canção de Batalha: ao contrário da força, vale pro golpe mágico também —
  // é música, não músculo. Quem a desconta é o turno da equipe, não este.
  const inspiracao = buffs.inspiracaoTurns && buffs.inspiracaoTurns > 0 ? 1 + (buffs.inspiracaoAmount ?? 0) : 1;

  const base = 3 + randomInt(6, rng);
  let dmg: number;
  let nextMonster: CombatMonsterView;

  if (magicalAttack) {
    dmg = Math.round((base + d.dmgMagico + weaponAtkContribution(heroAfterCost, affinity) + otherEquipAtk(heroAfterCost)) * inspiracao);
    const mod = modifyDamageByAffinity(monster, monster.species.weakness, monster.species.resistance, dmg, 'magico', isMage);
    dmg = mod.dmg;
    nextMonster = { ...monster, ...mod.monster };
  } else {
    const physicalBase = isMage && attackStyle === 'physical' ? Math.round(d.dmgFisico * 0.5) : d.dmgFisico;
    dmg = Math.round((base + physicalBase + weaponAtkContribution(heroAfterCost, affinity) + otherEquipAtk(heroAfterCost)) * forcaMult * inspiracao);
    const mod = modifyDamageByAffinity(monster, monster.species.weakness, monster.species.resistance, dmg, 'fisico', false);
    dmg = mod.dmg;
    nextMonster = { ...monster, ...mod.monster };
  }

  const critChance = (d.critico + (bonus.critico ?? 0) + petCritico + (idDaClasse(heroAfterCost) === 'arqueiro' ? 8 : 0)) / 100;
  const isCrit = guaranteedCrit || rng() < critChance || vinteNatural;
  if (isCrit) dmg = Math.round(dmg * 1.6);

  nextMonster = { ...nextMonster, hp: nextMonster.hp - dmg };

  let afterHero: Hero = consumeTurnBuffs({ ...heroAfterCost, buffs: { ...buffs, critNext: false } });

  const procResult = applyWeaponProc(afterHero, nextMonster, rng);
  afterHero = procResult.hero;
  nextMonster = { ...nextMonster, ...procResult.monster };

  const passiveResult = applyHeroClassPassive(afterHero, nextMonster, dmg, rng);
  afterHero = passiveResult.hero;
  nextMonster = { ...nextMonster, ...passiveResult.monster };

  return {
    hero: afterHero,
    monster: nextMonster,
    outcome: 'hit',
    magical: magicalAttack,
    affinityPct: affinity,
    damage: dmg,
    isCrit,
    procTriggered: procResult.triggered,
    classPassiveTriggered: passiveResult.triggered,
    monsterDefeated: nextMonster.hp <= 0,
  };
}
