/**
 * O texto da maestria de classe: o medidor do cartão de guilda e a linha
 * do diário quando ela sobe. A regra mora em `mastery.ts`, na engine.
 */

import { classById, idDaClasse, masteryProgress, masteryWeapons, MASTERY_DAMAGE_PER_LEVEL, templateById, wieldsMasteryWeapon, type Hero } from '@rpg-legend/shared';

/**
 * As armas da classe pelo nome curto, em minúscula: "espada", "machado ou
 * marreta". O nome do modelo tem sobrenome ("Machado de Guerra", "Adaga
 * Sombria"), e a primeira palavra é a arma.
 */
export function armasDaMaestria(hero: Pick<Hero, 'classId' | 'className'>): string {
  const classe = classById(idDaClasse(hero) ?? '');
  if (!classe) return '';
  const nomes = masteryWeapons(classe).map((id) => (templateById(id)?.name ?? id).split(' ')[0].toLowerCase());
  return nomes.join(' ou ');
}

function porcento(fracao: number): string {
  return `+${Math.round(fracao * 100)}%`;
}

export interface MaestriaNoCartao {
  nivel: number;
  /** Vitórias no nível atual e quantas o próximo pede. No teto, 1 de 1 pra barra sair cheia. */
  atual: number;
  maximo: number;
  /** O que vai à direita da barra: "12/30", ou "máx." no teto. */
  contagem: string;
  /** A linha embaixo da barra, que diz o bônus e de que arma ele depende. */
  bonus: string;
}

/** `null` pro Aprendiz: a maestria é da classe, e ele ainda não tem. */
export function maestriaNoCartao(hero: Hero): MaestriaNoCartao | null {
  const armas = armasDaMaestria(hero);
  if (!armas) return null;

  const progresso = masteryProgress(hero);
  const atual = progresso.maxed ? 1 : progresso.intoLevel;
  const maximo = progresso.maxed ? 1 : progresso.toNext;

  let bonus: string;
  if (progresso.level === 0) bonus = `${porcento(MASTERY_DAMAGE_PER_LEVEL)} de dano por nível, com ${armas}`;
  else if (wieldsMasteryWeapon(hero)) bonus = `${porcento(progresso.bonus)} de dano com ${armas}`;
  else bonus = `${porcento(progresso.bonus)} de dano só com ${armas}`;

  return { nivel: progresso.level, atual, maximo, contagem: progresso.maxed ? 'máx.' : `${atual}/${maximo}`, bonus };
}

/** A linha do diário quando a maestria sobe. */
export function maestriaSubiu(hero: Hero, nivel: number): string {
  return `Sua maestria de ${hero.className} chegou ao nível ${nivel}: ${porcento(nivel * MASTERY_DAMAGE_PER_LEVEL)} de dano com ${armasDaMaestria(hero)}.`;
}
