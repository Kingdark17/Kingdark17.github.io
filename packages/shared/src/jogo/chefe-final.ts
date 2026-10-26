/**
 * O chefe final: o do andar 100 de cada masmorra, em cada dificuldade
 * (decisão do usuário, 2026-10-25). O Breno zerou a Floresta, achou a
 * batalha final fraca, igual às outras, e pediu pra "mudar o sistema de
 * batalha com boss". O usuário decidiu:
 *
 * - ele é 30% mais forte que um chefe principal (`FORCA_DO_CHEFE_FINAL`, na
 *   geração do andar);
 * - **duas fases**. Na primeira ele luta sozinho e solta um poder a cada 3
 *   golpes. Com metade da vida, chama 4 lacaios — monstros comuns da
 *   masmorra, da força do andar, que não dão ouro — e não toma dano até
 *   todos caírem. Aí fica furioso: mais rápido, e um poder a cada 2 golpes;
 * - os poderes, um de cada vez: o Golpe Devastador (o dobro do dano, com
 *   aviso, sempre no herói) e o Rugido (pega o herói e todos os
 *   companheiros).
 *
 * O golpe que o levaria além da metade para nela: a segunda fase sempre
 * acontece, nem um golpe enorme a pula.
 *
 * O que ele precisa lembrar mora nele, na sala (`chamou`, `furia`,
 * `poderes`): o save no meio da luta guarda a fase, e a partida em dupla vê
 * os lacaios porque eles moram em `cell.monsters`, como o resto. Aqui fica a
 * regra; o turno de cada luta (a do site, `combate.ts`, e a arena do app,
 * `luta/arena.ts`) chama daqui.
 */

import type { CombatMonster, CombatMonsterView } from '../combat/monster-state.js';
import { freshCombatMonster } from '../combat/monster-state.js';
import { hitPartyMember, landHitOnHero, startMonsterAttack } from '../combat/monster-hit.js';
import { dungeonById } from '../dungeon/dungeons.js';
import type { DungeonCell } from '../dungeon/generate.js';
import type { Companion, Hero } from '../hero/hero.js';
import { generate, monsterView, type MonsterInstance } from '../monsters/generate.js';
import { defaultRng, type Rng } from '../rng.js';
import { celulaAtual, substituirCelulaAtual, type EstadoNaMasmorra } from './estado.js';
import { gravarMonstro, vivoNaSala, type PassoDaLuta } from './fim-da-luta.js';

/** Quantos lacaios ele chama com metade da vida. */
export const LACAIOS_DO_CHEFE = 4;

/** Um poder a cada este tanto de golpes; na fúria, a cada `PODER_A_CADA_NA_FURIA`. */
export const PODER_A_CADA = 3;
export const PODER_A_CADA_NA_FURIA = 2;

/** Na fúria a velocidade cresce isto (a fuga e a esquiva medem contra ela). */
export const VELOCIDADE_NA_FURIA = 1.5;

/** O Golpe Devastador bate com esta força a mais. */
export const FORCA_DO_DEVASTADOR = 2;

export type PoderDoChefe = 'devastador' | 'rugido';

export interface PoderDoChefeDef {
  nome: string;
  icone: string;
}

export const PODERES_DO_CHEFE: Readonly<Record<PoderDoChefe, PoderDoChefeDef>> = {
  devastador: { nome: 'Golpe Devastador', icone: '💥' },
  rugido: { nome: 'Rugido', icone: '📢' },
};

// ---------- leitura ----------

/** Os índices dos lacaios de pé nesta sala. */
export function lacaiosDePe(sala: DungeonCell): number[] {
  return (sala.monsters ?? []).map((_, indice) => indice).filter((indice) => !!sala.monsters?.[indice]?.lacaio && vivoNaSala(sala, indice));
}

/** O monstro `indice` é o chefe final com lacaios de pé: golpe nenhum o fere. */
export function protegido(sala: DungeonCell, indice: number): boolean {
  return !!sala.monsters?.[indice]?.chefeFinal && lacaiosDePe(sala).length > 0;
}

/**
 * O poder que o próximo golpe do chefe final solta, ou `null` (golpe comum,
 * ou não é o chefe final). É o aviso: a tela mostra antes de ele bater. Conta
 * pelos golpes da luta (`attackCount`, que o atordoado não gasta) e alterna
 * pelos poderes que ele já soltou.
 */
export function poderDaVez(monstro: MonsterInstance & { attackCount?: number }): PoderDoChefe | null {
  if (!monstro.chefeFinal) return null;
  const proximo = (monstro.attackCount ?? 0) + 1;
  const cada = monstro.furia ? PODER_A_CADA_NA_FURIA : PODER_A_CADA;
  if (proximo % cada !== 0) return null;
  return (monstro.poderes ?? 0) % 2 === 0 ? 'devastador' : 'rugido';
}

// ---------- o golpe no chefe ----------

/** Como o monstro ficou depois de um golpe nele, com a regra do chefe final. */
export interface Ferida {
  estado: EstadoNaMasmorra;
  /** O monstro como ficou gravado na sala. */
  monstro: CombatMonster;
  /** Caiu de verdade: o protegido não cai, e o que chamou os lacaios parou na metade. */
  caiu: boolean;
  /** Era o chefe protegido pelos lacaios: o golpe não fez nada. */
  protegido: boolean;
  /** Os índices, na sala, dos lacaios que ele acabou de chamar (quase sempre vazio). */
  lacaios: number[];
}

/**
 * Grava o monstro `indice` depois de um golpe — do herói, de um poder, da
 * equipe, do dano contínuo, de uma runa —, com a regra do chefe final:
 * protegido, a vida volta ao que era; chegando à metade pela primeira vez,
 * ela para ali e os lacaios entram no fim da sala. Pra qualquer outro
 * monstro é só `gravarMonstro`. O `rng` só anda quando os lacaios nascem.
 */
export function ferirMonstro(estado: EstadoNaMasmorra, indice: number, depois: CombatMonster, rng: Rng = defaultRng): Ferida {
  const sala = celulaAtual(estado) as DungeonCell;
  const antes = sala.monsters?.[indice] as CombatMonster | undefined;
  const comum = (monstro: CombatMonster): Ferida => ({ estado: gravarMonstro(estado, indice, monstro), monstro, caiu: monstro.hp <= 0, protegido: false, lacaios: [] });
  // Sem dano (o dano contínuo que não correu, um golpe que só pôs status), não há o que proteger nem metade a cruzar.
  if (!antes?.chefeFinal || depois.hp >= antes.hp) return comum(depois);

  if (lacaiosDePe(sala).length > 0) {
    const intacto: CombatMonster = { ...depois, hp: antes.hp };
    return { ...comum(intacto), protegido: true };
  }

  const metade = Math.max(1, Math.floor(antes.maxHp / 2));
  if (antes.chamou || depois.hp > metade) return comum(depois);

  const parado: CombatMonster = { ...depois, hp: metade, chamou: true };
  const comChefe = gravarMonstro(estado, indice, parado);
  const especies = dungeonById(estado.masmorra.dungeon)?.species ?? [];
  const novos: CombatMonster[] = [];
  for (let i = 0; i < LACAIOS_DO_CHEFE; i++) {
    novos.push(freshCombatMonster({ ...generate(antes.floor, { rng, species: especies }), gold: 0, lacaio: true }));
  }
  const salaDoChefe = celulaAtual(comChefe) as DungeonCell;
  const primeiro = (salaDoChefe.monsters ?? []).length;
  return {
    estado: substituirCelulaAtual(comChefe, { ...salaDoChefe, monsters: [...(salaDoChefe.monsters ?? []), ...novos] }),
    monstro: parado,
    caiu: false,
    protegido: false,
    lacaios: novos.map((_, i) => primeiro + i),
  };
}

/**
 * Depois de um abate: se caiu o último lacaio e o chefe final ainda está de
 * pé, ele fica furioso — mais rápido, e um poder a cada 2 golpes. Sem nada a
 * mudar, devolve o mesmo estado e o diário vazio.
 */
export function enfurecer(estado: EstadoNaMasmorra): PassoDaLuta {
  const sala = celulaAtual(estado) as DungeonCell;
  const indice = (sala.monsters ?? []).findIndex((monstro, i) => !!monstro.chefeFinal && vivoNaSala(sala, i));
  const chefe = sala.monsters?.[indice] as CombatMonster | undefined;
  if (!chefe?.chamou || chefe.furia || lacaiosDePe(sala).length > 0) return { estado, log: [] };
  const furioso: CombatMonster = { ...chefe, furia: true, speed: Math.round(chefe.speed * VELOCIDADE_NA_FURIA) };
  return { estado: gravarMonstro(estado, indice, furioso), log: [textoDaFuria(monsterView(chefe).name)] };
}

// ---------- o golpe do chefe ----------

/** Um companheiro atingido pelo Rugido. */
export interface CompanheiroAtingido {
  /** O índice na equipe. */
  indice: number;
  damage: number;
  defeated: boolean;
}

/** O golpe do chefe final que solta um poder, na luta por turnos. */
export interface PoderSolto {
  monster: CombatMonsterView;
  hero: Hero;
  party: Companion[];
  /**
   * `stunned`/`lento_skip`: perdeu o golpe, e o poder fica pro próximo.
   * `dodged`: o herói desviou (o Rugido ainda pega os companheiros).
   */
  outcome: 'stunned' | 'lento_skip' | 'dodged' | 'hit_hero';
  /** No herói. */
  damage: number;
  /** Os companheiros que o Rugido pegou. */
  companheiros: CompanheiroAtingido[];
  heroDefeated: boolean;
  poisonApplied: boolean;
  manaDrained: number;
}

export interface OpcoesDoPoder {
  rng?: Rng;
  petEsquivaBonus?: number;
  /** O herói rolou "Esquivar" com sucesso: o poder erra ele (o Rugido ainda pega os companheiros). */
  esquivaCerta?: boolean;
}

/**
 * O chefe final solta `poder` (o que `poderDaVez` disse): o começo do golpe
 * é o de sempre (`startMonsterAttack`: atordoado ou lento perde a vez); o
 * Golpe Devastador vai no herói com o dobro da força, e o Rugido pega cada
 * companheiro de pé e depois o herói. Conta o poder no chefe.
 */
export function soltarPoder(hero: Hero, party: readonly Companion[], monstro: CombatMonsterView, poder: PoderDoChefe, opcoes: OpcoesDoPoder = {}): PoderSolto {
  const rng = opcoes.rng ?? defaultRng;
  const inicio = startMonsterAttack(monstro, hero, rng);
  const vazio = { damage: 0, companheiros: [], heroDefeated: false, poisonApplied: false, manaDrained: 0 };
  if (inicio.outcome !== 'ready') return { ...vazio, monster: inicio.monster, hero: inicio.hero, party: [...party], outcome: inicio.outcome };

  const contado: CombatMonsterView = { ...inicio.monster, poderes: (inicio.monster.poderes ?? 0) + 1 };
  const companheiros: CompanheiroAtingido[] = [];
  let equipe = [...party];
  if (poder === 'rugido') {
    equipe = party.map((membro, indice) => {
      if (membro.hp <= 0) return membro;
      const golpe = hitPartyMember(membro, contado, inicio.attackMult, rng);
      companheiros.push({ indice, damage: golpe.damage, defeated: golpe.defeated });
      return golpe.member;
    });
  }

  if (opcoes.esquivaCerta) return { ...vazio, companheiros, monster: contado, hero: inicio.hero, party: equipe, outcome: 'dodged' };
  const forca = poder === 'devastador' ? inicio.attackMult * FORCA_DO_DEVASTADOR : inicio.attackMult;
  const golpe = landHitOnHero(inicio.hero, contado, forca, rng, opcoes.petEsquivaBonus ?? 0);
  if (golpe.dodged) return { ...vazio, companheiros, monster: golpe.monster, hero: golpe.hero, party: equipe, outcome: 'dodged' };
  return {
    monster: golpe.monster,
    hero: golpe.hero,
    party: equipe,
    outcome: 'hit_hero',
    damage: golpe.damage,
    companheiros,
    heroDefeated: golpe.hero.hp <= 0,
    poisonApplied: golpe.poisonApplied,
    manaDrained: golpe.manaDrained,
  };
}

// ---------- o que o diário diz ----------

export function textoDosLacaios(nome: string): string {
  return `${nome} chama ${LACAIOS_DO_CHEFE} lacaios! Enquanto eles estiverem de pé, nenhum golpe o fere.`;
}

export function textoProtegido(nome: string): string {
  return `${nome} está protegido pelos lacaios: o golpe não faz efeito.`;
}

export function textoDaFuria(nome: string): string {
  return `${nome} fica furioso! Agora ele é mais rápido e solta poderes com mais frequência.`;
}

/** O aviso de que o próximo golpe dele é um poder. */
export function textoDoAviso(nome: string, poder: PoderDoChefe): string {
  const { nome: nomeDoPoder, icone } = PODERES_DO_CHEFE[poder];
  return `⚠️ ${nome} se prepara: o próximo golpe é ${poder === 'rugido' ? 'um' : 'o'} ${icone} ${nomeDoPoder}!`;
}
