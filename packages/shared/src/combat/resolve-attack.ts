import { classById, idDaClasse } from '../hero/catalog.js';
import { equipmentBonus } from '../hero/derived.js';
import { hasDebuffEffect, weaponAffinityPct, type Hero } from '../hero/hero.js';
import { masteryDamageMult } from '../hero/mastery.js';
import type { ProcTemplate } from '../items/templates.js';
import { defaultRng, type Rng } from '../rng.js';
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

/**
 * O ataque em duas partes, como no combate do Undertale (doc do Breno,
 * regras do usuário em 2026-10-09): **o d20 é o dado de dano** de todo
 * ataque, e **a barra de mira decide o acerto e a força**. Antes o dado
 * visível só decidia o acerto (d6 no ataque da classe, d20 no resto) e o
 * dano tinha um d6 escondido; os dois papéis trocaram de dono.
 *
 * Tudo isto mora na engine, e não na tela, porque é regra: a tela pergunta
 * aqui o tamanho da zona pra desenhar a barra, `resolveAttack` pergunta a
 * mesma coisa pra ler onde ela parou, e um servidor que um dia conferir a
 * jogada também. Três respostas escritas em três lugares iam discordar.
 */
export const LADOS_DO_DANO = 20;

/**
 * Largura da zona de acerto, em fração da barra. A vantagem do ataque da
 * classe, que era rolar d6 e acertar com 3+ (67%), virou zona maior: os
 * mesmos 2/3 contra a metade dos outros, que era o 11+ do d20.
 */
const ZONA_DA_CLASSE = 2 / 3;
const ZONA_COMUM = 1 / 2;
/** O teto da Precisão: era errar só no 1, 2 e 3 do d20. */
const ZONA_MAXIMA = 0.85;
/** Um ponto de d20 é 5% da barra — é nessa moeda que Precisão e Visão Fraca foram escritas. */
const FATIA_POR_PONTO = 0.05;

/** A faixa do centro que crita: o papel do 20 natural, com a mesma largura (5%). */
export const FAIXA_CRITICA = 0.05;
/** A força do golpe na borda da zona e no centro. */
export const FORCA_NA_BORDA = 0.5;
export const FORCA_NO_CENTRO = 1.5;

/**
 * Se este é o ataque que combina com a classe (`ClassDef.ataquePrincipal`).
 * O tiro só conta com arco na mão.
 */
export function ehAtaqueDaClasse(hero: Hero, estilo: AttackStyle): boolean {
  const principal = classById(idDaClasse(hero) ?? '')?.ataquePrincipal;
  if (estilo === 'magic') return principal === 'magico';
  if (estilo === 'ranged') return principal === 'distancia' && hero.equip.arma?.templateId === 'arco';
  return principal === 'fisico';
}

/**
 * **A largura da zona de acerto deste ataque agora**, em fração da barra:
 * 2/3 no ataque da classe e metade nos outros, mais a Precisão (5% por
 * ponto, até 85%) e menos a Visão Fraca com arco ou cajado (10%). Mesma
 * ordem e mesmas fatias de quando eram pontos no d20.
 */
export function zonaDoAtaque(hero: Hero, estilo: AttackStyle): number {
  const buffs = hero.buffs ?? {};
  let zona = ehAtaqueDaClasse(hero, estilo) ? ZONA_DA_CLASSE : ZONA_COMUM;
  if (buffs.precisaoTurns && buffs.precisaoTurns > 0) {
    zona = Math.min(ZONA_MAXIMA, zona + FATIA_POR_PONTO * Math.floor((buffs.precisaoAmount ?? 0) / 5));
  }
  const arma = hero.equip.arma;
  if (hasDebuffEffect(hero, 'rangedPenalty') && arma && (arma.templateId === 'arco' || arma.templateId === 'cajado')) {
    zona -= 2 * FATIA_POR_PONTO;
  }
  return Math.max(2 * FAIXA_CRITICA, zona);
}

export interface AtaqueDisponivel {
  estilo: AttackStyle;
  /** O ataque que combina com a classe — vem primeiro e tem a zona maior. */
  daClasse: boolean;
  /** Largura da zona de acerto, em fração da barra (`zonaDoAtaque`). */
  zona: number;
  /** Mana gasta ao atacar — só o ataque mágico cobra. */
  custo: number;
}

/**
 * Os botões de ataque desta classe, **o da classe primeiro**.
 *
 * "Todos têm a opção ataque físico", diz o doc — então o físico está sempre
 * na lista; quem tem outro ataque principal o tem **antes** dele. Pro
 * arqueiro de arco o físico perde sempre pro tiro (o dano é o mesmo e a
 * zona é menor), mas é o que a regra pede, e é o único que sobra se ele
 * largar o arco.
 *
 * Substitui o `hero.className === 'Mago'` que a tela fazia: regra de
 * classe olha o id.
 */
export function ataquesDisponiveis(hero: Hero): AtaqueDisponivel[] {
  const principal = classById(idDaClasse(hero) ?? '')?.ataquePrincipal;
  const estilos: AttackStyle[] = [];
  if (principal === 'magico') estilos.push('magic');
  if (principal === 'distancia' && hero.equip.arma?.templateId === 'arco') estilos.push('ranged');
  estilos.push(principal === 'magico' ? 'physical' : 'normal');
  return estilos.map((estilo) => ({
    estilo,
    daClasse: ehAtaqueDaClasse(hero, estilo),
    zona: zonaDoAtaque(hero, estilo),
    custo: estilo === 'magic' ? MAGIC_ATTACK_COST : 0,
  }));
}

/** O que o jogador fez no ataque: a face do d20 de dano e onde a barra parou. */
export interface JogadaDeAtaque {
  /** Face do d20 de dano, de 1 a 20. */
  dado: number;
  /**
   * Onde o cursor parou, de 0 (começo da barra) a 1 (fim). `null` quando ele
   * passou do fim sem toque — como no Undertale, isso é erro.
   */
  mira: number | null;
}

/** O que a barra disse: acertou, com que força, e se parou na faixa do crítico. */
export interface LeituraDaMira {
  acerto: boolean;
  /** Multiplicador do dano: 0,5 na borda da zona, 1,5 no centro. 0 no erro. */
  forca: number;
  critico: boolean;
}

const ERROU: LeituraDaMira = { acerto: false, forca: 0, critico: false };

/**
 * Lê a barra. A zona fica no meio dela; fora, erra. Dentro, a força cresce
 * em linha reta da borda (0,5×) até o centro (1,5×), arredondada a duas
 * casas pra tela e regra mostrarem o mesmo número.
 */
export function lerMira(zona: number, mira: number | null): LeituraDaMira {
  if (mira === null) return ERROU;
  const distancia = Math.abs(mira - 0.5);
  const meia = zona / 2;
  if (distancia > meia) return ERROU;
  const forca = FORCA_NO_CENTRO - (FORCA_NO_CENTRO - FORCA_NA_BORDA) * (distancia / meia);
  return { acerto: true, forca: Math.round(forca * 100) / 100, critico: distancia <= FAIXA_CRITICA / 2 };
}

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
  /** O que a barra disse — a tela mostra a força, o log não precisa repetir. */
  mira: LeituraDaMira;
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
  jogada: JogadaDeAtaque,
  attackStyle: AttackStyle,
  options: ResolveAttackOptions = {},
): ResolveAttackResult {
  const rng = options.rng ?? defaultRng;
  const petCritico = options.petCriticoBonus ?? 0;

  // Número fora do dado ou mira fora da barra é defeito de quem chamou.
  // Corrigir em silêncio esconderia o defeito, e um servidor que confira a
  // jogada vai querer exatamente esta recusa. Vem antes da mana: a jogada é
  // inválida com ou sem ela.
  const { dado, mira } = jogada;
  if (!Number.isInteger(dado) || dado < 1 || dado > LADOS_DO_DANO) {
    throw new RangeError(`rolagem ${dado} não existe num d${LADOS_DO_DANO} (ataque ${attackStyle})`);
  }
  if (mira !== null && (!Number.isFinite(mira) || mira < 0 || mira > 1)) {
    throw new RangeError(`mira ${mira} fora da barra (ataque ${attackStyle})`);
  }

  const leitura = lerMira(zonaDoAtaque(hero, attackStyle), mira);
  const isMage = idDaClasse(hero) === 'mago';
  const magicalAttack = isMage && attackStyle === 'magic';

  if (magicalAttack && hero.mp < MAGIC_ATTACK_COST) {
    return { hero, monster, outcome: 'no_mana', magical: true, affinityPct: weaponAffinityPct(hero), mira: leitura, monsterDefeated: false };
  }
  const heroAfterCost = magicalAttack ? { ...hero, mp: hero.mp - MAGIC_ATTACK_COST } : hero;

  const d = heroAfterCost.derived;
  const bonus = equipmentBonus(heroAfterCost.equip);
  const affinity = weaponAffinityPct(heroAfterCost);
  const buffs = heroAfterCost.buffs ?? {};
  const guaranteedCrit = !!buffs.critNext;

  let hit = leitura.acerto || guaranteedCrit;
  let dodgedByAgility = false;
  // O crítico garantido e a faixa do crítico pulam esta checagem, como o 20
  // natural pulava: golpe crítico não é esquivado pelo monstro ágil.
  if (hit && !guaranteedCrit && !leitura.critico && monster.behavior === 'agil' && rng() < 0.15) {
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
      mira: leitura,
      monsterDefeated: false,
    };
  }

  // O crítico garantido acerta mesmo com a barra fora da zona; aí ela não
  // pesa pra nenhum lado (1×), em vez de virar a força de um erro.
  const forcaDaMira = leitura.acerto ? leitura.forca : 1;

  let forcaMult = buffs.forcaTurns && buffs.forcaTurns > 0 ? 1 + (buffs.forcaAmount ?? 0) : 1;
  if (idDaClasse(heroAfterCost) === 'barbaro' && heroAfterCost.hp < heroAfterCost.maxHp * 0.5) {
    forcaMult *= 1.35;
  }

  // Canção de Batalha: ao contrário da força, vale pro golpe mágico também —
  // é música, não músculo. Quem a desconta é a rodada, não o golpe (ver
  // `passarRodadaDaCancao`).
  const inspiracao = buffs.inspiracaoTurns && buffs.inspiracaoTurns > 0 ? 1 + (buffs.inspiracaoAmount ?? 0) : 1;

  // Maestria: +2% por nível, só com a arma que a classe domina na mão.
  const maestria = masteryDamageMult(heroAfterCost);

  // O d20 de dano entra onde ficava o d6 escondido (`3 + 0..5`, que é
  // `2 + d6`): a base passa a ser `2 + d20`.
  const base = 2 + dado;
  let dmg: number;
  let nextMonster: CombatMonsterView;

  if (magicalAttack) {
    dmg = Math.round(
      (base + d.dmgMagico + weaponAtkContribution(heroAfterCost, affinity) + otherEquipAtk(heroAfterCost)) * inspiracao * maestria * forcaDaMira,
    );
    const mod = modifyDamageByAffinity(monster, monster.species.weakness, monster.species.resistance, dmg, 'magico', isMage);
    dmg = mod.dmg;
    nextMonster = { ...monster, ...mod.monster };
  } else {
    const physicalBase = isMage && attackStyle === 'physical' ? Math.round(d.dmgFisico * 0.5) : d.dmgFisico;
    dmg = Math.round(
      (base + physicalBase + weaponAtkContribution(heroAfterCost, affinity) + otherEquipAtk(heroAfterCost)) *
        forcaMult *
        inspiracao *
        maestria *
        forcaDaMira,
    );
    const mod = modifyDamageByAffinity(monster, monster.species.weakness, monster.species.resistance, dmg, 'fisico', false);
    dmg = mod.dmg;
    nextMonster = { ...monster, ...mod.monster };
  }

  const critChance = (d.critico + (bonus.critico ?? 0) + petCritico + (idDaClasse(heroAfterCost) === 'arqueiro' ? 8 : 0)) / 100;
  const isCrit = guaranteedCrit || rng() < critChance || leitura.critico;
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
    mira: leitura,
    damage: dmg,
    isCrit,
    procTriggered: procResult.triggered,
    classPassiveTriggered: passiveResult.triggered,
    monsterDefeated: nextMonster.hp <= 0,
  };
}
