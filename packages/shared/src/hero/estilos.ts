/**
 * Os estilos de luta (doc do Breno de 2026-11-15, rodada 5; decidido com o
 * usuário): só o app os ensina e só a luta do app usa os efeitos (menos a
 * vida do Cavaleiro, que vale em todo lugar, como a da classe).
 *
 * - O mestre é uma sala da masmorra (como o professor), depois de zerar a
 *   Floresta: cada andar novo tem a chance da classe (`CHANCE_DO_MESTRE`) de
 *   trazer um, se o herói ainda tem estilo pra aprender.
 * - Cada mestre ensina **um estilo sorteado** entre os que o herói ainda não
 *   tem (os raros do Mago com a chance deles).
 * - O herói pode ter vários (`Hero.estilos`), e escolhe o ativo na guilda
 *   (`Hero.estilo`).
 *
 * Rodada 5a: os do Guerreiro (Espadachim, Cavaleiro) e os do Monge
 * (Empurrão, Dash/chute, Concentração).
 */

import { idDaClasse, type IdentidadeDeClasse } from './catalog.js';
import { randomInt, type Rng } from '../rng.js';

export interface EstiloDef {
  id: string;
  classe: string;
  nome: string;
  icone: string;
  desc: string;
  /** O estilo raro: entra no sorteio 1 vez em tantas. Ausente, comum. */
  raro?: number;
}

export const ESTILOS: readonly EstiloDef[] = [
  {
    id: 'espadachim',
    classe: 'guerreiro',
    nome: 'Espadachim',
    icone: '🗡️',
    desc: 'O golpe avança até 3 blocos rumo ao alvo e dá 1 s de imunidade (a cada 5 s); colado no alvo, atordoa 2 s. Segurando K junta ki, e com 300 solta o Corte Invernal.',
  },
  { id: 'cavaleiro', classe: 'guerreiro', nome: 'Cavaleiro', icone: '🛡️', desc: '+40% de vida, crítico +30% de dano e 1 chance em 5 de desviar dos golpes.' },
  { id: 'empurrao', classe: 'monge', nome: 'Empurrão', icone: '👐', desc: '+25% de dano; o golpe pega também quem está a 1 bloco do alvo, e cada um pode ser empurrado e atordoado.' },
  { id: 'chute', classe: 'monge', nome: 'Dash/chute', icone: '🦶', desc: 'Avança num chute até o alvo, a até 5 blocos; erra 1 vez em 10, e o crítico dá +40% de dano.' },
  { id: 'concentracao', classe: 'monge', nome: 'Concentração', icone: '🧘', desc: 'A cada 3 s sem atacar junta uma carga (até 3); cada carga dá +50% no próximo golpe. +1 de alcance.' },
];

/** A chance (%) de um andar trazer o mestre, por classe (depois de zerar a Floresta). */
export const CHANCE_DO_MESTRE: Readonly<Record<string, number>> = { guerreiro: 15, monge: 15, druida: 15, mago: 10 };

export const REGRAS_DO_ESPADACHIM = {
  /** O avanço: até tantos blocos, com tantos passos de imunidade depois, no máximo a cada `recarga` passos. */
  avanco: 3,
  imunidade: 60,
  recarga: 300,
  /** Colado no alvo: em vez de avançar, atordoa tantos passos (a mesma recarga). */
  atordoa: 120,
  /** Segurando K: ki por segundo; o Corte Invernal gasta `corte`, é uma faixa de tantas casas de largura que anda tantos blocos, na força (%) do golpe. */
  kiPorSegundo: 3,
  corte: 300,
  larguraDoCorte: 3,
  alcanceDoCorte: 6,
  forcaDoCorte: 80,
} as const;

export const REGRAS_DO_CAVALEIRO = {
  /** A vida a mais (%), o crítico a mais (pontos de %) e a chance (%) de desviar. */
  vida: 40,
  critico: 30,
  desvio: 20,
} as const;

export const REGRAS_DO_EMPURRAO = {
  /** O dano a mais (%), quem está a até tantos blocos do alvo também leva, e a chance (%) de empurrar e atordoar. */
  dano: 25,
  raio: 1,
  chance: 25,
} as const;

export const REGRAS_DO_CHUTE = {
  /** O chute alcança tantos blocos (avança até o alvo), erra tanto (%) e o crítico dá tanto (pontos de %) a mais. */
  alcance: 5,
  erro: 10,
  critico: 40,
} as const;

export const REGRAS_DA_CONCENTRACAO = {
  /** Uma carga a cada tantos passos sem atacar (3 s), até o teto; cada carga dá tanto (%) no próximo golpe; e o alcance a mais. */
  passosPorCarga: 180,
  tetoDeCargas: 3,
  porCarga: 50,
  alcance: 1,
} as const;

/** O estilo pelo id. */
export function estiloPorId(id: string | undefined): EstiloDef | null {
  return ESTILOS.find((e) => e.id === id) ?? null;
}

/** Os estilos da classe do herói (os desta rodada). */
export function estilosDaClasse(quem: IdentidadeDeClasse): EstiloDef[] {
  const id = idDaClasse(quem);
  return ESTILOS.filter((e) => e.classe === id);
}

export interface QuemTemEstilo extends IdentidadeDeClasse {
  estilos?: string[];
  estilo?: string;
}

/** O estilo ativo do herói: o escolhido, se é dele e da classe dele; senão nenhum. */
export function estiloAtivo(quem: QuemTemEstilo): EstiloDef | null {
  const estilo = estiloPorId(quem.estilo);
  if (!estilo || estilo.classe !== idDaClasse(quem) || !(quem.estilos ?? []).includes(estilo.id)) return null;
  return estilo;
}

/** O id do estilo ativo (ou `undefined`). */
export function idDoEstilo(quem: QuemTemEstilo): string | undefined {
  return estiloAtivo(quem)?.id;
}

/** Os estilos da classe que o herói ainda não aprendeu. */
export function estilosQueFaltam(quem: QuemTemEstilo): EstiloDef[] {
  const tem = quem.estilos ?? [];
  return estilosDaClasse(quem).filter((e) => !tem.includes(e.id));
}

/**
 * O estilo que um mestre ensina: um sorteado entre os que faltam. Cada raro
 * que falta entra antes, 1 vez em `raro`; senão, um comum que falta. Sem
 * nada pra ensinar (ou só raros que não saíram), `null`.
 */
export function sortearEstilo(quem: QuemTemEstilo, rng: Rng): string | null {
  const faltam = estilosQueFaltam(quem);
  if (faltam.length === 0) return null;
  for (const raro of faltam.filter((e) => e.raro)) {
    if (rng() * (raro.raro as number) < 1) return raro.id;
  }
  const comuns = faltam.filter((e) => !e.raro);
  if (comuns.length === 0) return null;
  return (comuns[randomInt(comuns.length, rng)] as EstiloDef).id;
}

/** Aprende o estilo (e ele vira o ativo). Já sabia, ou não é da classe: o mesmo herói. */
export function aprenderEstilo<T extends QuemTemEstilo>(quem: T, id: string): T {
  const estilo = estiloPorId(id);
  if (!estilo || estilo.classe !== idDaClasse(quem) || (quem.estilos ?? []).includes(id)) return quem;
  return { ...quem, estilos: [...(quem.estilos ?? []), id], estilo: id };
}

/** Escolhe o estilo ativo na guilda, entre os que o herói tem; `undefined` volta a lutar sem estilo. */
export function trocarEstilo<T extends QuemTemEstilo>(quem: T, id: string | undefined): T {
  if (id === undefined) {
    const { estilo: _e, ...resto } = quem;
    return resto as T;
  }
  if (!(quem.estilos ?? []).includes(id) || estiloPorId(id)?.classe !== idDaClasse(quem)) return quem;
  return { ...quem, estilo: id };
}

/** A vida máxima com o estilo: o Cavaleiro tem 40% a mais (em todo lugar, como a da classe). */
export function vidaComOEstilo(vida: number, quem: QuemTemEstilo): number {
  return idDoEstilo(quem) === 'cavaleiro' ? Math.round((vida * (100 + REGRAS_DO_CAVALEIRO.vida)) / 100) : vida;
}

/** O mestre pode aparecer pra este herói: a classe tem mestre e ainda falta estilo. A Floresta zerada quem confere é quem gera o andar. */
export function chanceDoMestre(quem: QuemTemEstilo): number {
  const id = idDaClasse(quem);
  if (!id || estilosQueFaltam(quem).length === 0) return 0;
  return CHANCE_DO_MESTRE[id] ?? 0;
}
