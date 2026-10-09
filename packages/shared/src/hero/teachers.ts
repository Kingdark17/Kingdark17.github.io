/**
 * Os professores de classe. Doc do Breno (2026-10): "Conforme o nível de
 * maestria, aparece um npc (da sua classe) para ensinar uma nova
 * habilidade/poder, o primeiro aparece entre os andares 25 e 50 e o
 * segundo entre os 75 e 80".
 *
 * As decisões do usuário (2026-10-09):
 * - o primeiro aparece nos andares 25 a 50 de **qualquer** masmorra, com
 *   maestria 4 ou mais; o segundo nos 75 a 80, com maestria 8. Quem já
 *   encontrou um não o encontra de novo;
 * - cada classe tem a sua lista de 3 poderes (aprovada como está, abaixo):
 *   o primeiro professor oferece os 3, o segundo os 2 que sobraram, e o
 *   jogador escolhe 1. Herói novo termina com 3 poderes: o da classe e os
 *   dois dos professores;
 * - quem já tinha personagem tem 3 poderes da criação antiga. Pra ele o
 *   professor **oferece troca**: um dos poderes extras por um da lista.
 *   Continua com 3.
 *
 * `Hero` entra só como tipo, pelo mesmo motivo de `mastery.ts`.
 */

import { classById, idDaClasse, powerById } from './catalog.js';
import type { Hero } from './hero.js';
import { masteryLevel } from './mastery.js';

/** A lista de cada classe, por id de poder. Aprovada pelo usuário em 2026-10-09. */
export const CLASS_TEACHER_POWERS: Readonly<Record<string, readonly string[]>> = {
  guerreiro: ['grito_de_guerra', 'golpe_atordoante', 'passo_veloz'],
  mago: ['rajada_glacial', 'escudo_arcano', 'maldicao_sombria'],
  ladino: ['passo_veloz', 'golpe_poderoso', 'esporos_venenosos'],
  clerigo: ['renovacao_natural', 'julgamento_sagrado', 'escudo_arcano'],
  barbaro: ['golpe_poderoso', 'golpe_atordoante', 'passo_veloz'],
  arqueiro: ['flecha_serrilhada', 'passo_veloz', 'furtividade_sombria'],
  paladino: ['cura_menor', 'escudo_arcano', 'golpe_poderoso'],
  necromante: ['esporos_venenosos', 'rajada_glacial', 'escudo_arcano'],
  druida: ['renovacao_natural', 'cura_menor', 'rajada_glacial'],
  monge: ['passo_veloz', 'golpe_poderoso', 'cura_menor'],
  bardo: ['passo_veloz', 'furtividade_sombria', 'cura_menor'],
  cacador: ['tiro_certeiro', 'esporos_venenosos', 'passo_veloz'],
};

export interface TeacherDef {
  number: 1 | 2;
  /** Primeiro e último andar em que ele pode aparecer, em qualquer masmorra. */
  floors: readonly [number, number];
  /** Nível de maestria que ele pede. */
  mastery: number;
  /** Chance de aparecer em cada andar da faixa; o último andar dela garante. */
  chance: number;
}

/**
 * As chances fazem o professor ser encontrado e não só esbarrado: na faixa
 * de 26 andares do primeiro, 10% por andar dá 93% de chance de ele surgir
 * antes do último; na de 6 andares do segundo, 25% dá 76%. Quem chega ao
 * último andar da faixa sem tê-lo visto o encontra ali.
 */
export const TEACHERS: readonly TeacherDef[] = [
  { number: 1, floors: [25, 50], mastery: 4, chance: 0.1 },
  { number: 2, floors: [75, 80], mastery: 8, chance: 0.25 },
];

function encontrados(hero: Pick<Hero, 'teachersMet'>): number {
  const n = hero.teachersMet;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function assinatura(hero: Pick<Hero, 'classId' | 'className'>): string | null {
  return classById(idDaClasse(hero) ?? '')?.signatureId ?? null;
}

/** Os poderes da lista da classe que o herói ainda não tem. */
export function teacherOffer(hero: Pick<Hero, 'classId' | 'className' | 'powerIds'>): string[] {
  const lista = CLASS_TEACHER_POWERS[idDaClasse(hero) ?? ''] ?? [];
  const tem = hero.powerIds ?? [];
  return lista.filter((id) => !tem.includes(id) && powerById(id));
}

export type TeacherMode = 'learn' | 'swap';

/**
 * Aprender, pra quem ainda tem vaga — o herói novo, com o poder da classe e
 * o que os professores anteriores deram. Trocar, pra quem já tem os 3 da
 * criação antiga.
 */
export function teacherMode(hero: Pick<Hero, 'powerIds' | 'teachersMet'>): TeacherMode {
  const vagas = 1 + encontrados(hero) + 1;
  return (hero.powerIds?.length ?? 0) >= vagas ? 'swap' : 'learn';
}

/** Os poderes que o herói pode dar na troca: todos menos o da classe. */
export function swappablePowers(hero: Pick<Hero, 'classId' | 'className' | 'powerIds'>): string[] {
  const daClasse = assinatura(hero);
  return (hero.powerIds ?? []).filter((id) => id !== daClasse);
}

/** O professor que este herói pode encontrar neste andar, se algum. */
export function teacherFor(hero: Pick<Hero, 'classId' | 'className' | 'powerIds' | 'teachersMet' | 'masteryBattles'>, floor: number): TeacherDef | null {
  if (idDaClasse(hero) === null) return null;
  const professor = TEACHERS[encontrados(hero)];
  if (!professor) return null;
  if (floor < professor.floors[0] || floor > professor.floors[1]) return null;
  if (masteryLevel(hero.masteryBattles ?? 0) < professor.mastery) return null;
  // Lista esgotada (o veterano que já tinha os três): não há o que ensinar.
  if (teacherOffer(hero).length === 0) return null;
  if (teacherMode(hero) === 'swap' && swappablePowers(hero).length === 0) return null;
  return professor;
}

/** Se ele aparece neste andar. O último andar da faixa garante. */
export function teacherAppears(professor: TeacherDef, floor: number, roll: number): boolean {
  return floor >= professor.floors[1] || roll < professor.chance;
}

function comPoderes(hero: Hero, powerIds: string[]): Hero {
  return {
    ...hero,
    powerIds,
    powerNames: powerIds.map((id) => powerById(id)?.name).filter((nome): nome is string => !!nome),
    teachersMet: encontrados(hero) + 1,
  };
}

/** Aprende um poder da lista. `null` se não pode: não é a vez de aprender, ou o poder não está na oferta. */
export function learnFromTeacher(hero: Hero, powerId: string): Hero | null {
  if (teacherMode(hero) !== 'learn' || !teacherOffer(hero).includes(powerId)) return null;
  return comPoderes(hero, [...(hero.powerIds ?? []), powerId]);
}

/** Troca um poder extra por um da lista, no mesmo lugar. `null` se a troca não vale. */
export function swapWithTeacher(hero: Hero, giveUp: string, learn: string): Hero | null {
  if (teacherMode(hero) !== 'swap' || !swappablePowers(hero).includes(giveUp) || !teacherOffer(hero).includes(learn)) return null;
  return comPoderes(
    hero,
    (hero.powerIds ?? []).map((id) => (id === giveUp ? learn : id)),
  );
}
