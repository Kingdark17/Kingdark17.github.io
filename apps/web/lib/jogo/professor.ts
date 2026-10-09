/**
 * O professor de classe numa sala da masmorra: ensina um poder da lista da
 * classe a quem tem vaga, e oferece troca a quem já tem os três da criação
 * antiga. A regra mora em `hero/teachers.ts`, na engine.
 *
 * "Agora não" sai sem marcar nada: o mestre continua na sala, e dá pra
 * voltar a falar com ele enquanto o jogador estiver no andar.
 */

import {
  classById,
  idDaClasse,
  learnFromTeacher,
  powerById,
  swappablePowers,
  swapWithTeacher,
  teacherFor,
  teacherMode,
  teacherOffer,
  type ClassDef,
  type DungeonCell,
  type Power,
  type TeacherMode,
} from '@rpg-legend/shared';

import { celulaAtual, substituirCelulaAtual, type EstadoNaMasmorra } from './estado';

export interface Professor {
  estado: EstadoNaMasmorra;
  classe: ClassDef;
  /** `null` quando não há o que ensinar a este herói: outra classe, ou ele já passou por este mestre. */
  modo: TeacherMode | null;
  log: string[];
  concluido: boolean;
}

function poderes(ids: string[]): Power[] {
  return ids.map((id) => powerById(id)).filter((poder): poder is Power => poder !== null);
}

export function abrirProfessor(estado: EstadoNaMasmorra): Professor | null {
  const sala = celulaAtual(estado) as DungeonCell | null;
  const classe = classById(sala?.teacher?.classId ?? '');
  if (!sala?.teacher || !classe) return null;

  const mestre = `O mestre ${classe.name.toLowerCase()}`;
  // No co-op o andar nasce com o mestre da classe de quem conduz.
  if (idDaClasse(estado.hero) !== classe.id) {
    return { estado, classe, modo: null, log: [`${mestre} acena com a cabeça: ele só ensina quem segue o caminho de ${classe.name}.`], concluido: true };
  }
  if (teacherFor(estado.hero, estado.floor)?.number !== sala.teacher.number) {
    return { estado, classe, modo: null, log: [`${mestre} reconhece você: o que ele tinha a ensinar, você já sabe.`], concluido: true };
  }

  const modo = teacherMode(estado.hero);
  const fala =
    modo === 'learn'
      ? `${mestre} se aproxima: "Sua maestria chegou longe. Escolha o que quer aprender."`
      : `${mestre} olha seus poderes: "Você já carrega três. Se quiser, troco um deles por um do nosso caminho."`;
  return { estado, classe, modo, log: [fala], concluido: false };
}

/** O que o mestre ensina: a lista da classe, menos o que o herói já tem. */
export function ofertas(professor: Professor): Power[] {
  return poderes(teacherOffer(professor.estado.hero));
}

/** Na troca, o que o herói pode esquecer: tudo menos o poder da classe. */
export function trocaveis(professor: Professor): Power[] {
  return poderes(swappablePowers(professor.estado.hero));
}

function ensinado(estado: EstadoNaMasmorra): EstadoNaMasmorra {
  const sala = celulaAtual(estado) as DungeonCell;
  return sala.teacher ? substituirCelulaAtual(estado, { ...sala, teacher: { ...sala.teacher, taught: true } }) : estado;
}

export function aprender(professor: Professor, powerId: string): Professor {
  const hero = learnFromTeacher(professor.estado.hero, powerId);
  if (!hero) return professor;
  const nome = powerById(powerId)?.name ?? powerId;
  return { ...professor, estado: ensinado({ ...professor.estado, hero }), log: [`Você aprende ${nome}. O mestre segue caminho.`], concluido: true };
}

export function trocar(professor: Professor, esquecer: string, aprenderId: string): Professor {
  const hero = swapWithTeacher(professor.estado.hero, esquecer, aprenderId);
  if (!hero) return professor;
  const antigo = powerById(esquecer)?.name ?? esquecer;
  const novo = powerById(aprenderId)?.name ?? aprenderId;
  return { ...professor, estado: ensinado({ ...professor.estado, hero }), log: [`Você troca ${antigo} por ${novo}. O mestre segue caminho.`], concluido: true };
}
