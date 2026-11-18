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
 * (Empurrão, Dash/chute, Concentração). Rodada 5b: os do Druida
 * (Metamorfose, Florescimento, Raízes Ocultas), que um espírito ancestral
 * ensina. Rodada 5c: os elementos do Mago (Fogo, Terra, Vento, Água, e os
 * raros Arcano e Escuridão), **um só e pra sempre** (o doc do Breno; decisão
 * do usuário): depois do primeiro, o mestre do Mago não aparece mais e a
 * guilda não troca.
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
  {
    id: 'metamorfose',
    classe: 'druida',
    nome: 'Metamorfose',
    icone: '🐾',
    desc: 'Ataca com a garra do espírito, a até 2 blocos, com +20% de dano, e o apoio no aliado cura 20%. No 15º golpe da luta acende a aura de fera: +20% de dano e 20% de resistência.',
  },
  {
    id: 'florescimento',
    classe: 'druida',
    nome: 'Florescimento',
    icone: '🌸',
    desc: 'O ataque no chão vazio planta flores (4 × 4, a até 4 blocos) que curam 3% da vida por segundo e seguram veneno e sangramento; até 2. Nos monstros, a flor shuriken: +10% de dano, a até 3 blocos.',
  },
  {
    id: 'raizes',
    classe: 'druida',
    nome: 'Raízes Ocultas',
    icone: '🌱',
    desc: 'As vinhas pegam qualquer monstro da sala. Todo 3º golpe bate +20% e deixa o alvo mais lento; todo 9º prende o alvo 4 s (o chefe não). Do 18º golpe da luta em diante, o veneno tira 15% da vida que resta e você anda 10% mais rápido.',
  },
  {
    id: 'fogo',
    classe: 'mago',
    nome: 'Fogo',
    icone: '🔥',
    desc: 'Todo disparo queima o alvo por 1 turno (5% da vida dele). A cada 5 disparos, a bola de fogo queima todos em volta do alvo (3 × 3) por 2 turnos.',
  },
  { id: 'terra', classe: 'mago', nome: 'Terra', icone: '🪨', desc: 'Disparos de rocha com +30% de dano. Do 20º disparo da luta em diante, o revestimento de pedra segura 20% do dano.' },
  {
    id: 'vento',
    classe: 'mago',
    nome: 'Vento',
    icone: '🌀',
    desc: 'O monstro atingido golpeia de 1 bloco mais perto pelo resto da luta, e você anda 15% mais rápido por 3 s. A cada 5 disparos, o vento empurra o alvo 2 blocos; se ele bater em algo, cai atordoado por 5 s (o chefe não).',
  },
  {
    id: 'agua',
    classe: 'mago',
    nome: 'Água',
    icone: '💧',
    desc: 'O jato acerta todos no caminho até o alvo. A cada 10 disparos, um redemoinho no alvo puxa quem está a até 5 blocos (até 3 blocos), prende 2 s e deixa 25% mais lento por 5 s (o chefe não).',
  },
  {
    id: 'arcano',
    classe: 'mago',
    nome: 'Arcano',
    icone: '✨',
    raro: 8,
    desc: 'Disparos com +35% de dano que deixam o alvo 20% mais lento. A cada 5, os Grilhões Arcanos prendem o alvo 4 s (o chefe não) e batem +30%. Do 15º disparo da luta em diante, cada um dá 10 de mana e soma +10% de dano.',
  },
  {
    id: 'escuridao',
    classe: 'mago',
    nome: 'Escuridão',
    icone: '🌑',
    raro: 10,
    desc: 'A orbe sombria bate +15%. A cada 8 disparos, a escuridão cobre 5 × 5 em volta do alvo por 10 s: quem está nela bate 20% mais fraco e acerta 25% menos. Do 24º disparo da luta em diante, cada um engole 15% da vida que resta do alvo (até 300 no chefe).',
  },
];

/** As classes que aprendem um estilo só, pra sempre (o Mago, rodada 5c). */
export const ESTILO_UNICO: readonly string[] = ['mago'];

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

export const REGRAS_DA_METAMORFOSE = {
  /** A garra pega a até tantos blocos do herói, com tanto (%) de dano a mais; a Purificação cura tanto (pontos de %) a mais. */
  alcance: 2,
  dano: 20,
  purificacao: 10,
  /** A aura de fera acende no golpe de número `golpesDaAura` da luta: tanto (%) de dano e de resistência a mais. */
  golpesDaAura: 15,
  aura: 20,
  resistencia: 20,
} as const;

export const REGRAS_DO_FLORESCIMENTO = {
  /** A flor shuriken: a até tantos blocos do herói, com tanto (%) de dano a mais. */
  alcance: 3,
  dano: 10,
  /** As flores: plantadas a até `plantio` blocos, com `lado` casas de lado; curam `cura` (%) da vida máxima por segundo; no máximo `maximo`. */
  plantio: 4,
  lado: 4,
  cura: 3,
  maximo: 2,
} as const;

export const REGRAS_DAS_RAIZES = {
  /** Todo golpe de número múltiplo de `forteACada` bate `dano` (%) a mais e deixa o alvo `lento` (%) mais lento. */
  forteACada: 3,
  dano: 20,
  lento: 20,
  /** Todo golpe múltiplo de `prendeACada` prende o alvo por `preso` passos (o chefe não). */
  prendeACada: 9,
  preso: 240,
  /** Do golpe `golpesDoVeneno` da luta em diante: o veneno tira `veneno` (%) da vida que resta, e o herói anda `velocidade` (%) mais rápido. */
  golpesDoVeneno: 18,
  veneno: 15,
  velocidade: 10,
} as const;

/**
 * Quem ensina o estilo na sala: o mestre de estilo, ou, pros do Druida, um
 * espírito ancestral (o doc do Breno). O nome, o ícone da sala e as falas.
 */
export function quemEnsina(estilo: string | undefined): { nome: string; icone: string; deLonge: string; naSala: string; foiEmbora: string; pergunta: string } {
  if (estiloPorId(estilo)?.classe === 'druida') {
    return {
      nome: 'Espírito ancestral',
      icone: '🌿',
      deLonge: 'um espírito ancestral',
      naSala: 'Um espírito ancestral flutua no meio da sala, em silêncio.',
      foiEmbora: 'O espírito ancestral voltou pra mata.',
      pergunta: 'Um espírito ancestral espera nesta sala. Deseja se aproximar?',
    };
  }
  return {
    nome: 'Mestre de estilo',
    icone: '🥋',
    deLonge: 'um mestre meditando',
    naSala: 'No meio da sala, um mestre de estilo medita de olhos fechados.',
    foiEmbora: 'O mestre já seguiu caminho.',
    pergunta: 'Um mestre de estilo medita nesta sala. Deseja falar com ele?',
  };
}

export const REGRAS_DO_FOGO = {
  /** Todo disparo queima o alvo `turnos` turnos, com `queimadura` (%) da vida máxima dele por turno; o disparo de número múltiplo de `bolaACada` queima o 3 × 3 em volta dele por `turnosDaBola`. */
  turnos: 1,
  queimadura: 5,
  bolaACada: 5,
  ladoDaBola: 3,
  turnosDaBola: 2,
} as const;

export const REGRAS_DA_TERRA = {
  /** O dano a mais (%), e do disparo `golpesDaPedra` da luta em diante a resistência (%). */
  dano: 30,
  golpesDaPedra: 20,
  resistencia: 20,
} as const;

export const REGRAS_DO_VENTO = {
  /** O monstro atingido golpeia de `encurta` blocos mais perto (até o mínimo de meio bloco); o Mago anda `velocidade` (%) mais rápido por `ventania` passos. */
  encurta: 1,
  velocidade: 15,
  ventania: 180,
  /** O disparo múltiplo de `empurraACada` empurra o alvo `empurrao` blocos; se bater em algo, `atordoa` passos atordoado (o chefe não). */
  empurraACada: 5,
  empurrao: 2,
  atordoa: 300,
} as const;

export const REGRAS_DA_AGUA = {
  /** O jato: `largura` casas de largura do Mago ao alvo. */
  largura: 1,
  /** O disparo múltiplo de `redemoinhoACada`: puxa quem está a até `raio` blocos do alvo, até `puxa` blocos, prende `preso` passos e deixa `lento` (%) mais lento por `lerdo` passos depois (o chefe não). */
  redemoinhoACada: 10,
  raio: 5,
  puxa: 3,
  preso: 120,
  lento: 25,
  lerdo: 300,
} as const;

export const REGRAS_DO_ARCANO = {
  /** O dano a mais (%) e a lentidão (%) do disparo. */
  dano: 35,
  lento: 20,
  /** Os Grilhões: o disparo múltiplo de `grilhoesACada` prende `preso` passos (o chefe não) e bate `danoDosGrilhoes` (%) a mais. */
  grilhoesACada: 5,
  preso: 240,
  danoDosGrilhoes: 30,
  /** Do disparo `golpesDoArcano` da luta em diante: cada um dá `mana` e soma `porGolpe` (%) de dano por disparo depois dele. */
  golpesDoArcano: 15,
  mana: 10,
  porGolpe: 10,
} as const;

export const REGRAS_DA_ESCURIDAO = {
  /** O dano a mais (%) da orbe. */
  dano: 15,
  /** O disparo múltiplo de `areaACada` cobre `lado` × `lado` casas em volta do alvo por `duracao` passos: quem está dentro bate `fraqueza` (%) mais fraco e acerta `erra` (%) menos. */
  areaACada: 8,
  lado: 5,
  duracao: 600,
  fraqueza: 20,
  erra: 25,
  /** Do disparo `golpesDaFome` da luta em diante, cada um engole `engole` (%) da vida que resta do alvo (no chefe, no máximo `tetoNoChefe`). */
  golpesDaFome: 24,
  engole: 15,
  tetoNoChefe: 300,
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
  const daClasse = estilosDaClasse(quem);
  // O Mago aprende um só (rodada 5c): com um, não falta mais nada.
  if (estiloUnico(quem) && daClasse.some((e) => tem.includes(e.id))) return [];
  return daClasse.filter((e) => !tem.includes(e.id));
}

/** A classe aprende um estilo só, pra sempre (o Mago). */
export function estiloUnico(quem: QuemTemEstilo): boolean {
  return ESTILO_UNICO.includes(idDaClasse(quem) ?? '');
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
  // O Mago que já tem o dele não aprende outro.
  if (estiloUnico(quem) && estilosQueFaltam(quem).length === 0) return quem;
  return { ...quem, estilos: [...(quem.estilos ?? []), id], estilo: id };
}

/** Escolhe o estilo ativo na guilda, entre os que o herói tem; `undefined` volta a lutar sem estilo. */
export function trocarEstilo<T extends QuemTemEstilo>(quem: T, id: string | undefined): T {
  // O do Mago é pra sempre: a guilda não troca nem tira.
  if (estiloUnico(quem)) return quem;
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
