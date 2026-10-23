/**
 * Os encantamentos, só do app (decisões do usuário, 2026-10-17 e 18): a
 * Encantadora da cidade fortifica uma armadura em troca de ouro.
 *
 * - **Quatro fortificações:** 🛡️ robustez (menos dano dos monstros que
 *   batem de perto ou investem), 🔮 resistência mágica (menos dano dos
 *   monstros mágicos, os que atiram de longe, e chance de evitar o dreno de
 *   mana), 🧪 resistência a veneno (chance de não ser envenenado) e 💪 vigor
 *   (um escudo de vida no começo de cada luta, que apanha primeiro e some no
 *   fim — a vida máxima do personagem não muda, nem no site nem no app).
 * - **Só armaduras** (elmo, peitoral, perneira, botas e escudo), **uma por
 *   peça**: encantar de novo troca a fortificação.
 * - **Três níveis** (I, II, III), só ouro: 100, 300 e 800.
 * - **Peças com a mesma fortificação somam**, até um teto.
 * - **Só no app:** é a arena que aplica (`defesasDoHeroi`, `escudoDoVigor`).
 *   No site a peça vale só pelos atributos, e a sala da Encantadora fica
 *   fechada.
 */

import type { Hero } from '../hero/hero.js';
import { EQUIP_SLOTS } from '../hero/stats.js';
import { itemCategory, type EncantamentoId, type EncantamentoNaPeca, type Item } from './item.js';
import { ROMANOS } from './templates.js';

export interface Fortificacao {
  nome: string;
  /** O ícone que a tela mostra. */
  icone: string;
  /**
   * A força, por nível (I, II, III): a fração de dano a menos (robustez e
   * resistência mágica), a chance de não ser envenenado, ou a fração da vida
   * máxima que vira escudo (vigor).
   */
  forca: readonly number[];
  /** Peças com a mesma fortificação somam a força até aqui. */
  teto: number;
}

export const ENCANTAMENTOS: Readonly<Record<EncantamentoId, Fortificacao>> = {
  robustez: { nome: 'Robustez', icone: '🛡️', forca: [0.05, 0.1, 0.15], teto: 0.3 },
  resistencia_magica: { nome: 'Resistência Mágica', icone: '🔮', forca: [0.15, 0.25, 0.35], teto: 0.6 },
  resistencia_veneno: { nome: 'Resistência a Veneno', icone: '🧪', forca: [0.3, 0.5, 0.75], teto: 0.9 },
  vigor: { nome: 'Vigor', icone: '💪', forca: [0.1, 0.15, 0.2], teto: 0.4 },
};

/** As fortificações, na ordem em que a Encantadora as oferece. */
export const TIPOS_DE_ENCANTAMENTO: readonly EncantamentoId[] = ['robustez', 'resistencia_magica', 'resistencia_veneno', 'vigor'];

/** A resistência mágica também evita o dreno de mana: a chance por nível, e o teto da soma. */
export const EVITA_DRENO: readonly number[] = [0.25, 0.5, 0.75];
export const TETO_DO_DRENO = 0.9;

/** O preço de cada nível, em ouro. */
export const CUSTO_DO_ENCANTAMENTO: readonly number[] = [100, 300, 800];

/** O que a arena desconta e evita no herói, somando as peças vestidas (cada soma com o teto dela). */
export interface DefesasDoHeroi {
  /** A fração de dano a menos dos monstros que não são mágicos. */
  robustez: number;
  /** A fração de dano a menos dos monstros mágicos. */
  resistenciaMagica: number;
  /** A chance de o dreno de mana não pegar. */
  evitaDreno: number;
  /** A chance de não ser envenenado. */
  resistenciaVeneno: number;
  /** A fração da vida máxima que vira escudo no começo da luta. */
  vigor: number;
}

function nivelValido(nivel: number | undefined): number {
  return Math.min(ROMANOS.length, Math.max(1, Math.trunc(nivel ?? 1)));
}

function percentual(fracao: number): string {
  return `${Math.round(fracao * 100)}%`;
}

/** Só armadura recebe encantamento (o escudo é armadura). */
export function podeEncantar(item: Pick<Item, 'templateId'>): boolean {
  return itemCategory(item) === 'armadura';
}

/** O encantamento da peça, ou `null`. */
export function encantamentoDaPeca(item: Pick<Item, 'encantamento'>): EncantamentoNaPeca | null {
  return item.encantamento ?? null;
}

/** O nome de um encantamento: "Robustez II". */
export function nomeDoEncantamento(encantamento: EncantamentoNaPeca): string {
  return `${ENCANTAMENTOS[encantamento.tipo].nome} ${ROMANOS[nivelValido(encantamento.nivel) - 1]}`;
}

/** O preço do nível, em ouro. */
export function custoDoEncantamento(nivel: number): number {
  return CUSTO_DO_ENCANTAMENTO[nivelValido(nivel) - 1] as number;
}

/** O que a fortificação faz no nível, com os números dele. */
export function efeitoDoEncantamento(tipo: EncantamentoId, nivel: number): string {
  const n = nivelValido(nivel) - 1;
  const forca = percentual(ENCANTAMENTOS[tipo].forca[n] as number);
  switch (tipo) {
    case 'robustez':
      return `-${forca} de dano dos monstros que batem de perto ou investem.`;
    case 'resistencia_magica':
      return `-${forca} de dano dos monstros mágicos, e ${percentual(EVITA_DRENO[n] as number)} de chance de evitar o dreno de mana.`;
    case 'resistencia_veneno':
      return `${forca} de chance de não ser envenenado.`;
    case 'vigor':
      return `No começo de cada luta, um escudo de ${forca} da vida máxima, que apanha primeiro.`;
  }
}

/** A peça com a fortificação no nível pedido, no lugar da que houver. Fora das armaduras, `null`. */
export function encantarPeca(peca: Item, tipo: EncantamentoId, nivel: number): Item | null {
  if (!podeEncantar(peca)) return null;
  return { ...peca, encantamento: { tipo, nivel: nivelValido(nivel) } };
}

/** As fortificações das armaduras vestidas, somadas por tipo (na ordem dos slots), cada uma até o teto. */
export function defesasDoHeroi(hero: Pick<Hero, 'equip'>): DefesasDoHeroi {
  const soma: Record<EncantamentoId, number> = { robustez: 0, resistencia_magica: 0, resistencia_veneno: 0, vigor: 0 };
  let evitaDreno = 0;
  for (const slot of EQUIP_SLOTS) {
    const peca = hero.equip[slot];
    if (!peca?.encantamento || !podeEncantar(peca)) continue;
    const { tipo } = peca.encantamento;
    const n = nivelValido(peca.encantamento.nivel) - 1;
    soma[tipo] += ENCANTAMENTOS[tipo].forca[n] as number;
    if (tipo === 'resistencia_magica') evitaDreno += EVITA_DRENO[n] as number;
  }
  return {
    robustez: Math.min(ENCANTAMENTOS.robustez.teto, soma.robustez),
    resistenciaMagica: Math.min(ENCANTAMENTOS.resistencia_magica.teto, soma.resistencia_magica),
    evitaDreno: Math.min(TETO_DO_DRENO, evitaDreno),
    resistenciaVeneno: Math.min(ENCANTAMENTOS.resistencia_veneno.teto, soma.resistencia_veneno),
    vigor: Math.min(ENCANTAMENTOS.vigor.teto, soma.vigor),
  };
}

/** O escudo do vigor no começo da luta: a fração da vida máxima, arredondada. Sem vigor, 0. */
export function escudoDoVigor(hero: Pick<Hero, 'equip' | 'maxHp'>): number {
  return Math.round(hero.maxHp * defesasDoHeroi(hero).vigor);
}
