/**
 * Os números de cada classe na luta, do doc do Breno de 2026-11-15
 * ("Equilíbrio de Classes"), decidido com o usuário:
 *
 * - **O alcance** do ataque comum, em blocos (casas): só a luta do app
 *   (`luta/arena.ts`) o usa, e os poderes continuam acertando de qualquer
 *   lugar. O Bárbaro tem o alcance da arma pesada (o machadão, a marreta, a
 *   maça); sem classe (o Aprendiz), o arco e o cajado vão longe e o resto é
 *   corpo a corpo.
 * - **A vida**, em % da de sempre: vale **em todo lugar**, no site e no app
 *   (`derivedStats`), pra o mesmo personagem ter a mesma vida nos dois.
 * - **O dano e a velocidade (de andar)**, em %: só na luta do app, porque
 *   não ficam no save.
 *
 * O texto do Breno não dá número pra "baixo" e "alto"; os de cá foram a
 * proposta aceita pelo usuário: vida baixa 80%, alta 130%; dano baixo 85%,
 * "padrão/baixo" e "médio/baixo" 92%, "padrão/alto" 110%; velocidade baixa
 * 80% (o Paladino tem os −40% escritos). O alcance do Clérigo não estava no
 * texto: 5, como o Bardo (decisão do usuário). Tudo em inteiros, pra o C#
 * dar a mesma conta.
 */

import { idDaClasse, type IdentidadeDeClasse } from './catalog.js';
import { aljavaNoArco, REGRAS_DAS_ALJAVAS } from '../items/pecas-secretas.js';
import {
  idDoEstilo,
  REGRAS_DA_AGUA,
  REGRAS_DA_CONCENTRACAO,
  REGRAS_DA_ESCURIDAO,
  REGRAS_DA_METAMORFOSE,
  REGRAS_DA_TERRA,
  REGRAS_DO_ARCANO,
  REGRAS_DO_FOGO,
  REGRAS_DO_VENTO,
  REGRAS_DAS_RAIZES,
  REGRAS_DO_CAVALEIRO,
  REGRAS_DO_CHUTE,
  REGRAS_DO_EMPURRAO,
  REGRAS_DO_ESPADACHIM,
  REGRAS_DO_FLORESCIMENTO,
  type QuemTemEstilo,
} from './estilos.js';

export interface ClasseDeLuta {
  /** O alcance do ataque comum, em blocos. */
  alcance: number;
  /** A vida, em % da de sempre. */
  vida: number;
  /** O dano do herói na luta do app, em %. */
  dano: number;
  /** A velocidade de andar na luta do app, em %. */
  velocidade: number;
  /** A mana máxima, em % da de sempre: vale em todo lugar, como a vida (o Mago guarda +20%; rodada 4a). */
  mana: number;
}

/** A classe que o texto não muda: tudo no padrão, corpo a corpo. */
export const CLASSE_PADRAO: ClasseDeLuta = { alcance: 1, vida: 100, dano: 100, velocidade: 100, mana: 100 };

export const CLASSES_DE_LUTA: Readonly<Record<string, ClasseDeLuta>> = {
  arqueiro: { alcance: 12, vida: 100, dano: 92, velocidade: 110, mana: 100 },
  bardo: { alcance: 5, vida: 80, dano: 85, velocidade: 120, mana: 100 },
  necromante: { alcance: 7, vida: 80, dano: 85, velocidade: 100, mana: 100 },
  monge: { alcance: 1, vida: 100, dano: 100, velocidade: 100, mana: 100 },
  guerreiro: { alcance: 2, vida: 100, dano: 92, velocidade: 100, mana: 100 },
  ladino: { alcance: 1, vida: 100, dano: 110, velocidade: 130, mana: 100 },
  barbaro: { alcance: 1, vida: 100, dano: 100, velocidade: 80, mana: 100 },
  druida: { alcance: 2, vida: 100, dano: 100, velocidade: 100, mana: 100 },
  cacador: { alcance: 4, vida: 100, dano: 100, velocidade: 100, mana: 100 },
  clerigo: { alcance: 5, vida: 80, dano: 92, velocidade: 120, mana: 100 },
  paladino: { alcance: 2, vida: 130, dano: 85, velocidade: 60, mana: 100 },
  mago: { alcance: 7, vida: 80, dano: 100, velocidade: 100, mana: 120 },
};

/** O alcance do Bárbaro pela arma pesada: o machadão (corte de 4), a marreta (o tremor 5 × 5 em volta dele) e a maça (a bola de ferro, 6). */
export const ALCANCE_DO_BARBARO: Readonly<Record<string, number>> = { machado: 4, marreta: 2, maca: 6 };

/** Sem classe (o Aprendiz): o arco e o cajado vão longe; o resto é corpo a corpo. */
export const ALCANCE_SEM_CLASSE: Readonly<Record<string, number>> = { arco: 7, cajado: 7 };

/**
 * As mãos do Monge (doc do Breno de 2026-11-15: "monge usa as mãos"): sem
 * arma na mão principal, o golpe dele leva este ataque no lugar do da arma —
 * `base` e mais 1 a cada `aCadaNiveis` níveis. Número ainda por afinar.
 */
export const MAOS_DO_MONGE = { base: 3, aCadaNiveis: 2 } as const;

/** O ataque das mãos: só o Monge sem arma na mão principal; os outros, 0. */
export function ataqueDasMaos(quem: QuemLuta & { level?: number }): number {
  if (idDaClasse(quem) !== 'monge' || quem.equip?.arma) return 0;
  return MAOS_DO_MONGE.base + Math.floor(Math.max(1, quem.level ?? 1) / MAOS_DO_MONGE.aCadaNiveis);
}

export interface QuemLuta extends QuemTemEstilo {
  equip?: { arma?: { templateId: string } | null; secundaria?: { templateId: string } | null } | null;
}

/** Os números da classe do herói; sem classe (ou uma que o texto não traz), os do padrão. */
export function classeDeLuta(quem: IdentidadeDeClasse): ClasseDeLuta {
  const id = idDaClasse(quem);
  return (id && CLASSES_DE_LUTA[id]) || CLASSE_PADRAO;
}

/** O alcance do ataque comum do herói, em blocos: o da classe, o da arma pesada no Bárbaro, o da arma sem classe. */
export function alcanceDoHeroi(quem: QuemLuta): number {
  const id = idDaClasse(quem);
  const arma = quem.equip?.arma?.templateId ?? '';
  if (id === 'barbaro') return ALCANCE_DO_BARBARO[arma] ?? (CLASSES_DE_LUTA.barbaro as ClasseDeLuta).alcance;
  if (!id || !CLASSES_DE_LUTA[id]) return ALCANCE_SEM_CLASSE[arma] ?? CLASSE_PADRAO.alcance;
  // Os estilos do Monge (rodada 5a): o chute vai longe; a concentração dá +1.
  const estilo = idDoEstilo(quem);
  if (estilo === 'chute') return REGRAS_DO_CHUTE.alcance;
  if (estilo === 'concentracao') return (CLASSES_DE_LUTA[id] as ClasseDeLuta).alcance + REGRAS_DA_CONCENTRACAO.alcance;
  // Os do Druida (rodada 5b): a garra e a flor shuriken saem do herói.
  if (estilo === 'metamorfose') return REGRAS_DA_METAMORFOSE.alcance;
  if (estilo === 'florescimento') return REGRAS_DO_FLORESCIMENTO.alcance;
  // A aljava ao lado do arco (rodada 6b) dá 1 bloco a mais.
  return (CLASSES_DE_LUTA[id] as ClasseDeLuta).alcance + (aljavaNoArco(quem) ? REGRAS_DAS_ALJAVAS.alcance : 0);
}

/** A mana máxima com a classe: a de sempre vezes a % dela, arredondada (o Mago guarda +20%). */
export function manaComAClasse(mana: number, quem: IdentidadeDeClasse): number {
  const pct = classeDeLuta(quem).mana;
  return pct === 100 ? mana : Math.round((mana * pct) / 100);
}

/** A vida máxima com a classe: a de sempre vezes a % dela, arredondada. */
export function vidaComAClasse(vida: number, quem: IdentidadeDeClasse): number {
  const pct = classeDeLuta(quem).vida;
  return pct === 100 ? vida : Math.round((vida * pct) / 100);
}

// ---------- as classes refeitas na luta do app (rodada 3a, 2026-11-17) ----------
//
// O que cada classe do doc do Breno junta e faz dentro da luta do app
// (`luta/arena.ts`). Decisões do usuário: o crítico do Ladino é 2,25×; o
// combo do Guerreiro zera num golpe que acerta sem crítico, guarda o que já
// ganhou e não tem teto; a área do Bárbaro bate cheio no alvo e metade nos
// outros; e a classe refeita perde, na arena, a passiva antiga do site. Os
// efeitos se somam (o doc: "20% de dano + 10% de dano = 30% de dano").
// "Resistência" é a % de dano a menos no golpe que o herói leva.

/** As classes que o doc do Breno já refez na luta do app: lá elas ficam sem a passiva antiga do site. */
export const CLASSES_REFEITAS: readonly string[] = ['guerreiro', 'ladino', 'barbaro', 'paladino', 'arqueiro', 'bardo', 'clerigo', 'druida'];

export const REGRAS_DO_GUERREIRO = {
  /** O dano a mais (%) com o alvo a 1 bloco. */
  colado: 25,
  /** Críticos seguidos que fecham um combo, e o dano (%) que cada combo soma até o fim da luta. */
  criticosDoCombo: 3,
  combo: 20,
  /** A cada este tanto (%) da vida que falta, esta resistência (%). */
  degrauDaVida: 10,
  resistenciaPorDegrau: 5,
} as const;

export const REGRAS_DO_LADINO = {
  /** O multiplicador do crítico dele (o de sempre é 1,6). */
  critico: 2.25,
  /** Críticos (não precisam ser seguidos) que dão uma furtividade. */
  criticosDaFurtividade: 5,
  /** Cada furtividade dá esquiva (%) até o teto e ataque (%); passado o teto da esquiva, só o ataque menor. */
  esquiva: 20,
  tetoDaEsquiva: 60,
  ataque: 10,
  ataqueDepoisDoTeto: 5,
  /** Contra o chefe vale só este tanto (%) da furtividade. */
  contraOChefe: 50,
} as const;

export const REGRAS_DO_BARBARO = {
  /** A fúria: +1 a cada golpe levado, até o teto; cada uma dá dano (%) e resistência (%). */
  tetoDaFuria: 15,
  danoPorFuria: 13,
  resistenciaPorFuria: 3,
  /** Passos sem levar golpe até a fúria esfriar (15 s), e quanto ela perde. */
  calma: 900,
  perdeNaCalma: 2,
  /** A marreta: o tremor no quadrado em volta dele (lado em blocos) e o dano a mais (%). */
  ladoDoTremor: 5,
  marreta: 20,
  /** A maça: a bola destrói o quadrado em volta do alvo (lado em blocos) e pode empurrar (%). */
  ladoDaBola: 3,
  empurraNaMaca: 20,
  /** O machadão: o corte numa faixa (largura em blocos) até o alcance, e pode atordoar (%; o chefe não). */
  larguraDoCorte: 1,
  atordoaNoMachado: 30,
  /** Quem mais estiver na área leva este tanto (%) do dano do alvo. */
  nosOutros: 50,
} as const;

export const REGRAS_DO_PALADINO = {
  /** O golpe é um avanço: ele para a 1 bloco do alvo e o empurra este tanto (blocos). */
  empurrao: 1,
  /** O dano (%) que ele devolve a quem bateu; com a absorção no teto, a devolução grande. */
  devolve: 20,
  devolveNoTeto: 150,
  /** A absorção: junta tanto por golpe levado, até o teto; a partir de um tanto, a resistência (%). */
  absorvePorGolpe: 10,
  tetoDaAbsorcao: 300,
  absorcaoQueResiste: 100,
  resistencia: 20,
  /** Os monstros o escolhem como se ele estivesse este tanto (%) mais perto. */
  foco: 30,
} as const;

// ---------- rodada 3b (2026-11-17): Arqueiro, Bardo, Clérigo e Druida ----------
//
// Decisões do usuário: o aliado se escolhe com o cursor (ou a placa, no
// celular), e sozinho o herói mira nele mesmo; o Arqueiro bate 30% menos até
// 2 blocos e, parado há 3 s, ganha 12% por bloco dali pra frente; a mira dele
// é 2,3× maior; a cura do Bardo e a do Clérigo vão no aliado mirado e nele
// mesmo, sempre; a moral e a recarga do Poder da fé ficam só na memória do
// app (não vão pro save); o Poder da fé é um botão (em dupla, a Comunhão;
// sozinho, o Santo Egoísta); a Purificação é o ataque do Druida mirado num
// aliado.

export const REGRAS_DO_ARQUEIRO = {
  /** Até este tanto de blocos o alvo está perto, e o golpe sai com este tanto (%) a menos. */
  perto: 2,
  danoDePerto: 30,
  /** Mais longe, parado há `parado` passos (3 s): este tanto (%) por bloco, até o teto. */
  porBloco: 12,
  teto: 120,
  parado: 180,
  /** A área da mira do cursor dele, em % da de todo mundo. */
  mira: 230,
} as const;

export const REGRAS_DO_BARDO = {
  /** A cada golpe: cura este tanto (%) da vida que falta e dá este dano (%) a mais por `tempoDaForca` passos (6 s). */
  cura: 30,
  forca: 20,
  tempoDaForca: 360,
  /** Críticos no aliado (não precisam ser seguidos) que dão +1 de moral ao grupo, e o teto. */
  criticosDaMoral: 5,
  tetoDaMoral: 12,
} as const;

/**
 * A moral do grupo (o Bardo): cada degrau vale a partir do nível dele e se
 * soma aos de baixo (o doc: "acumulativo, não um por nível").
 */
export const REGRAS_DA_MORAL = {
  nivelDaVelocidade: 1,
  velocidade: 30,
  danoNaVelocidade: 10,
  nivelDaResistencia: 3,
  resistencia: 30,
  danoNaResistencia: 10,
  nivelSemQuebrar: 5,
  nivelDoCritico: 8,
  /** Soma ao multiplicador do crítico, em pontos de % (50: o 1,6 vira 2,1). */
  critico: 50,
  danoNoCritico: 5,
  nivelDaFaixa: 12,
  /** A faixa do crítico no evento da arma fica este tanto (%) maior. */
  faixaCritica: 50,
} as const;

export const REGRAS_DO_CLERIGO = {
  /** A cada golpe, cura este tanto (%) da vida máxima. */
  cura: 15,
  /** O golpe mágico dele num morto-vivo vale este tanto de vezes. */
  mortoVivo: 5,
  /** O Poder da fé: uma vez a cada `recargaDaFe` passos (7 min). */
  recargaDaFe: 25200,
  /** Cura este tanto (%) da vida máxima, e a vida não desce de `pisoDaVida` (%) enquanto dura. */
  curaDaFe: 40,
  pisoDaVida: 20,
  /** O dano levado nos últimos `janela` passos (30 s) dá a duração, em segundos, até o teto. */
  janela: 1800,
  tetoDaComunhao: 50,
  tetoDoEgoista: 40,
  /** O Santo Egoísta: a duração é o dano levado dividido por este tanto. */
  divisorDoEgoista: 3,
} as const;

/** As espécies que levam o golpe sagrado do Clérigo cheio (`REGRAS_DO_CLERIGO.mortoVivo`), com os chefes delas. */
export const MORTOS_VIVOS: readonly string[] = ['esqueleto', 'zumbi', 'espectro_gelado'];

export const REGRAS_DO_DRUIDA = {
  /** As vinhas pegam o monstro a até este tanto de blocos de uma parede ou de um herói. */
  vinhas: 2,
  /** Todo golpe deixa o monstro lento (% de passo a menos e de chance de hesitar) e envenenado (% da vida máxima por rodada). */
  lento: 10,
  veneno: 5,
  turnos: 2,
  /** A Purificação: cura este tanto (%) da vida máxima, e o ataque espera `semAtacar` passos (30 s). */
  purificacao: 10,
  semAtacar: 1800,
} as const;

// ---------- rodada 4a (2026-11-17): segurar K, o Mago e o Monge ----------
//
// Decisões do usuário: segurando K o herói fica parado e sem atacar (andar
// ou atacar solta); o disparo do Mago custa 40 de mana só na luta do app e a
// mana dele +20% vale em todo lugar (`manaComAClasse`); o revestimento de ki
// dura até o próximo golpe levado; a explosão de ki bate em volta, pela força
// do ki gasto. O ki que sobra fica na memória do app, como a moral.

export const REGRAS_DE_CANALIZAR = {
  /** Segurando K: a mana (o Mago, o Necromante) e o ki (o Monge) que entram por segundo. */
  manaPorSegundo: 5,
  kiPorSegundo: 10,
} as const;

export const REGRAS_DO_MONGE = {
  /** O ki: o teto, e quanto o revestimento gasta. */
  tetoDoKi: 300,
  revestir: 300,
  /** Revestido: o dano a mais (%), e o tanto (%) que o próximo golpe levado perde (e quebra o revestimento). */
  danoRevestido: 40,
  escudoRevestido: 30,
  /** A explosão: pega quem está a até tantos blocos, na força (%) do golpe com o ki cheio, e empurra tantos blocos. */
  raioDaExplosao: 2,
  forcaDaExplosao: 150,
  empurraNaExplosao: 1,
} as const;

export const REGRAS_DO_MAGO = {
  /** O disparo mágico na luta do app (no site continua o de sempre). */
  custoDoDisparo: 40,
} as const;

/** O que a classe junta segurando K: a mana (o Mago e o Necromante), o ki (o Monge e o Espadachim); `null`, nada. */
export function oQueCanaliza(quem: QuemTemEstilo): 'mana' | 'ki' | null {
  const id = idDaClasse(quem);
  if (id === 'mago' || id === 'necromante') return 'mana';
  if (id === 'guerreiro' && idDoEstilo(quem) === 'espadachim') return 'ki';
  return id === 'monge' ? 'ki' : null;
}

/** Quantos passos segurando K valem um ponto pra este herói: o Espadachim junta ki mais devagar (3/s). */
export function passosDoCanal(quem: QuemTemEstilo): number {
  const tipo = oQueCanaliza(quem);
  if (!tipo) return 0;
  if (idDaClasse(quem) === 'guerreiro') return Math.trunc(60 / REGRAS_DO_ESPADACHIM.kiPorSegundo);
  return passosPorPonto(tipo);
}

/** O crítico a mais do estilo, em pontos de % (o Cavaleiro +30, o chute +40); os outros, 0. */
export function criticoDoEstilo(quem: QuemTemEstilo): number {
  const estilo = idDoEstilo(quem);
  if (estilo === 'cavaleiro') return REGRAS_DO_CAVALEIRO.critico;
  if (estilo === 'chute') return REGRAS_DO_CHUTE.critico;
  return 0;
}

/** Quantos passos segurando K valem um ponto (de mana ou de ki). */
export function passosPorPonto(tipo: 'mana' | 'ki'): number {
  return Math.trunc(60 / (tipo === 'mana' ? REGRAS_DE_CANALIZAR.manaPorSegundo : REGRAS_DE_CANALIZAR.kiPorSegundo));
}

/** O custo do disparo mágico na arena: o do Mago; nos outros, `undefined` (o de sempre). */
export function custoDaMagia(quem: IdentidadeDeClasse): number | undefined {
  return idDaClasse(quem) === 'mago' ? REGRAS_DO_MAGO.custoDoDisparo : undefined;
}

/** A força da explosão de ki (como a da mira, de 0 a 1,5), pelo ki gasto. */
export function forcaDaExplosao(ki: number): number {
  const r = REGRAS_DO_MONGE;
  const ate = Math.max(0, Math.min(r.tetoDoKi, Math.trunc(ki)));
  return Math.round((ate * r.forcaDaExplosao) / r.tetoDoKi) / 100;
}

/** A classe mira nos aliados (o Bardo, o Clérigo e o Druida). */
export function apoiaAliado(quem: IdentidadeDeClasse): boolean {
  const id = idDaClasse(quem);
  return id === 'bardo' || id === 'clerigo' || id === 'druida';
}

/** A espécie conta como morto-vivo. */
export function mortoVivo(speciesId: string): boolean {
  return MORTOS_VIVOS.includes(speciesId);
}

/** A área da mira do herói, em % da de todo mundo: a do Arqueiro é maior. */
export function miraDaClasse(quem: IdentidadeDeClasse): number {
  return idDaClasse(quem) === 'arqueiro' ? REGRAS_DO_ARQUEIRO.mira : 100;
}

/**
 * O dano a mais (%) do Arqueiro pela distância: até `perto` blocos, o de
 * perto (negativo) sempre; mais longe, parado há 3 s, `porBloco` por bloco
 * até o teto; andando, nada.
 */
export function danoDaDistancia(blocos: number, parado: number): number {
  const r = REGRAS_DO_ARQUEIRO;
  if (blocos <= r.perto) return -r.danoDePerto;
  if (parado < r.parado) return 0;
  return Math.min(r.teto, blocos * r.porBloco);
}

/** O que a moral `nivel` dá ao grupo, somando os degraus. */
export interface EfeitosDaMoral {
  /** Velocidade de andar (%), dano (%), resistência (%), o crítico (pontos de %) e a faixa do crítico (%) a mais. */
  velocidade: number;
  dano: number;
  resistencia: number;
  semQuebrar: boolean;
  critico: number;
  faixaCritica: number;
}

export function efeitosDaMoral(nivel: number): EfeitosDaMoral {
  const r = REGRAS_DA_MORAL;
  const efeitos: EfeitosDaMoral = { velocidade: 0, dano: 0, resistencia: 0, semQuebrar: false, critico: 0, faixaCritica: 0 };
  if (nivel >= r.nivelDaVelocidade) {
    efeitos.velocidade += r.velocidade;
    efeitos.dano += r.danoNaVelocidade;
  }
  if (nivel >= r.nivelDaResistencia) {
    efeitos.resistencia += r.resistencia;
    efeitos.dano += r.danoNaResistencia;
  }
  if (nivel >= r.nivelSemQuebrar) efeitos.semQuebrar = true;
  if (nivel >= r.nivelDoCritico) {
    efeitos.critico += r.critico;
    efeitos.dano += r.danoNoCritico;
  }
  if (nivel >= r.nivelDaFaixa) efeitos.faixaCritica += r.faixaCritica;
  return efeitos;
}

/** A moral do grupo: o nível e os críticos no aliado desde o último. Mora na memória do app, de luta em luta, até a volta pra cidade. */
export interface Moral {
  nivel?: number;
  criticos?: number;
}

/** Um crítico do Bardo num aliado: conta, e a cada `criticosDaMoral` o grupo sobe um nível (até o teto). `subiu`: o nível novo. */
export function contarCriticoNoAliado(moral: Moral): { moral: Moral; subiu?: number } {
  const r = REGRAS_DO_BARDO;
  const nivel = moral.nivel ?? 0;
  if (nivel >= r.tetoDaMoral) return { moral };
  const criticos = (moral.criticos ?? 0) + 1;
  if (criticos < r.criticosDaMoral) return { moral: { ...moral, criticos } };
  return { moral: { nivel: nivel + 1, criticos: 0 }, subiu: nivel + 1 };
}

/**
 * A cura do apoio num herói com esta vida: o Bardo, uma parte da vida que
 * falta; o Clérigo, uma parte da vida máxima; o Druida (a Purificação), uma
 * parte da vida máxima. Pelo menos 1 se falta vida; nunca passa do máximo.
 */
export function curaDoApoio(tipo: 'bardo' | 'clerigo' | 'purificar' | 'comunhao', vida: { hp: number; maxHp: number }, mais = 0): number {
  const falta = Math.max(0, vida.maxHp - vida.hp);
  if (falta <= 0) return 0;
  // `mais`: os pontos de % a mais (a Purificação da Metamorfose, rodada 5b).
  const pct =
    (tipo === 'bardo' ? REGRAS_DO_BARDO.cura : tipo === 'clerigo' ? REGRAS_DO_CLERIGO.cura : tipo === 'purificar' ? REGRAS_DO_DRUIDA.purificacao : REGRAS_DO_CLERIGO.curaDaFe) +
    mais;
  const base = tipo === 'bardo' ? falta : vida.maxHp;
  return Math.min(falta, Math.max(1, Math.trunc((base * pct) / 100)));
}

/**
 * A duração do Poder da fé, em passos, pelo dano levado nos últimos 30 s:
 * a Comunhão divide pelo dobro de quantos são, até 50 s; o Santo Egoísta,
 * por 3, até 40 s.
 */
export function duracaoDaFe(comunhao: boolean, danoLevado: number, quantos: number): number {
  const r = REGRAS_DO_CLERIGO;
  const dano = Math.max(0, Math.trunc(danoLevado));
  if (comunhao) return Math.min(r.tetoDaComunhao * 60, Math.trunc((dano * 60) / (2 * Math.max(1, quantos))));
  return Math.min(r.tetoDoEgoista * 60, Math.trunc((dano * 60) / r.divisorDoEgoista));
}

/** O que a classe junta durante uma luta do app; some quando ela acaba. Ausente é zero. */
export interface ContadoresDaClasse {
  /** Guerreiro: os críticos seguidos agora, e o dano (%) que os combos já somaram. */
  seguidos?: number;
  combo?: number;
  /** Ladino: os críticos desde a última furtividade, e a furtividade. */
  criticos?: number;
  furtividade?: number;
  /** Bárbaro: a fúria, e os passos desde o último golpe levado. */
  furia?: number;
  calmo?: number;
  /** Paladino: a absorção. */
  absorcao?: number;
  /** Arqueiro: os passos parado (sem andar), até `REGRAS_DO_ARQUEIRO.parado`. */
  parado?: number;
  /** Os estilos (rodada 5a): a espera do avanço do Espadachim e a imunidade dele; as cargas da Concentração e os passos sem golpear. */
  recargaDoEstilo?: number;
  imune?: number;
  cargas?: number;
  semGolpe?: number;
  /** Os estilos do Druida (rodada 5b) e do Mago (5c): quantos ataques (os disparos, no Mago) ele já deu nesta luta. */
  golpes?: number;
  /** O Vento do Mago (rodada 5c): os passos que ainda faltam do passo mais ligeiro. */
  ventania?: number;
  /** A aljava ao lado do arco (rodada 6b): as flechas que já acertaram nesta luta. */
  flechadas?: number;
}

/** A classe já foi refeita pelo doc do Breno: na arena ela fica sem a passiva antiga do site. */
export function classeRefeita(quem: IdentidadeDeClasse): boolean {
  const id = idDaClasse(quem);
  return !!id && CLASSES_REFEITAS.includes(id);
}

/** O multiplicador do crítico na arena: o do Ladino; nos outros, `undefined` (o de sempre). */
export function criticoDaClasse(quem: IdentidadeDeClasse): number | undefined {
  return idDaClasse(quem) === 'ladino' ? REGRAS_DO_LADINO.critico : undefined;
}

/** A furtividade `n` em esquiva e ataque (%), antes do corte contra o chefe. */
function furtividadeEm(n: number): { esquiva: number; ataque: number } {
  const r = REGRAS_DO_LADINO;
  const ateOTeto = Math.min(n, Math.trunc(r.tetoDaEsquiva / r.esquiva));
  return { esquiva: ateOTeto * r.esquiva, ataque: ateOTeto * r.ataque + (n - ateOTeto) * r.ataqueDepoisDoTeto };
}

/** O que vale contra o chefe: a parte dele, arredondada pra baixo. */
function contraOChefe(valor: number, chefe: boolean): number {
  return chefe ? Math.trunc((valor * REGRAS_DO_LADINO.contraOChefe) / 100) : valor;
}

/**
 * O dano a mais (%) do ataque comum na arena, que se soma ao dano da classe:
 * o Guerreiro colado no alvo e os combos dele, a furtividade do Ladino (a
 * metade contra o chefe), a fúria do Bárbaro e a marreta.
 */
export function bonusDoAtaque(quem: QuemLuta, c: ContadoresDaClasse, alvo: { colado: boolean; chefe: boolean; blocos?: number }): number {
  switch (idDaClasse(quem)) {
    case 'arqueiro':
      return danoDaDistancia(alvo.blocos ?? 0, c.parado ?? 0);
    case 'guerreiro':
      return (alvo.colado ? REGRAS_DO_GUERREIRO.colado : 0) + (c.combo ?? 0);
    case 'druida':
      return danoDoDruida(quem, c.golpes ?? 0);
    case 'monge': {
      // Os estilos do Monge: o Empurrão bate mais; a Concentração gasta as cargas no golpe.
      const estilo = idDoEstilo(quem);
      if (estilo === 'empurrao') return REGRAS_DO_EMPURRAO.dano;
      if (estilo === 'concentracao') return (c.cargas ?? 0) * REGRAS_DA_CONCENTRACAO.porCarga;
      return 0;
    }
    case 'ladino':
      return contraOChefe(furtividadeEm(c.furtividade ?? 0).ataque, alvo.chefe);
    case 'barbaro':
      return (c.furia ?? 0) * REGRAS_DO_BARBARO.danoPorFuria + (quem.equip?.arma?.templateId === 'marreta' ? REGRAS_DO_BARBARO.marreta : 0);
    default:
      return 0;
  }
}

/**
 * O dano a mais (%) do ataque do Druida com estilo, no golpe de número
 * `golpe` da luta: a garra (e a aura de fera), a flor shuriken, e o golpe
 * forte das Raízes (todo 3º).
 */
export function danoDoDruida(quem: QuemTemEstilo, golpe: number): number {
  switch (idDoEstilo(quem)) {
    case 'metamorfose':
      return REGRAS_DA_METAMORFOSE.dano + (auraDeFera(golpe) ? REGRAS_DA_METAMORFOSE.aura : 0);
    case 'florescimento':
      return REGRAS_DO_FLORESCIMENTO.dano;
    case 'raizes':
      return golpeForte(golpe) ? REGRAS_DAS_RAIZES.dano : 0;
    default:
      return 0;
  }
}

/** O golpe de número `golpe` é o da vez de quem age a cada `n` (o 5º, o 10º…). */
export function aCadaGolpe(golpe: number, n: number): boolean {
  return golpe > 0 && golpe % n === 0;
}

/**
 * O dano a mais (%) do disparo do Mago com elemento (rodada 5c), no disparo
 * de número `golpe` da luta: a rocha da Terra, o Arcano (com os Grilhões e o
 * que soma do 15º em diante) e a orbe da Escuridão.
 */
export function danoDoMago(quem: QuemTemEstilo, golpe: number): number {
  switch (idDoEstilo(quem)) {
    case 'terra':
      return REGRAS_DA_TERRA.dano;
    case 'arcano': {
      const r = REGRAS_DO_ARCANO;
      return r.dano + (aCadaGolpe(golpe, r.grilhoesACada) ? r.danoDosGrilhoes : 0) + Math.max(0, golpe - r.golpesDoArcano) * r.porGolpe;
    }
    case 'escuridao':
      return REGRAS_DA_ESCURIDAO.dano;
    default:
      return 0;
  }
}

/** Quantos disparos faltam pro próximo de número múltiplo de `n` (o 5º, o 10º…): no múltiplo, `n`. */
function faltamPro(golpes: number, n: number): number {
  return n - (golpes % n);
}

/** A aura de fera da Metamorfose está acesa (do golpe `golpesDaAura` da luta em diante). */
export function auraDeFera(golpes: number): boolean {
  return golpes >= REGRAS_DA_METAMORFOSE.golpesDaAura;
}

/** O golpe de número `golpe` das Raízes é o forte (todo 3º). */
export function golpeForte(golpe: number): boolean {
  return golpe > 0 && golpe % REGRAS_DAS_RAIZES.forteACada === 0;
}

/** O golpe de número `golpe` das Raízes prende o alvo (todo 9º). */
export function golpeQuePrende(golpe: number): boolean {
  return golpe > 0 && golpe % REGRAS_DAS_RAIZES.prendeACada === 0;
}

/** As Raízes já estão fundas (do golpe `golpesDoVeneno` da luta em diante): o veneno forte e o passo mais ligeiro. */
export function raizesFundas(golpes: number): boolean {
  return golpes >= REGRAS_DAS_RAIZES.golpesDoVeneno;
}

/** A esquiva a mais (%) contra o golpe de um monstro: a furtividade do Ladino (a metade contra o chefe) e o desvio do Cavaleiro. */
export function esquivaDaClasse(quem: QuemTemEstilo, c: ContadoresDaClasse, chefe: boolean): number {
  if (idDoEstilo(quem) === 'cavaleiro') return REGRAS_DO_CAVALEIRO.desvio;
  if (idDaClasse(quem) !== 'ladino') return 0;
  return contraOChefe(furtividadeEm(c.furtividade ?? 0).esquiva, chefe);
}

/**
 * A resistência da classe: a % de dano a menos no golpe que o herói leva. O
 * Guerreiro pela vida que falta, o Bárbaro pela fúria, o Paladino pela
 * absorção.
 */
export function resistenciaDaClasse(quem: QuemTemEstilo & { hp: number; maxHp: number }, c: ContadoresDaClasse): number {
  switch (idDaClasse(quem)) {
    case 'druida':
      // A aura de fera da Metamorfose (rodada 5b).
      return idDoEstilo(quem) === 'metamorfose' && auraDeFera(c.golpes ?? 0) ? REGRAS_DA_METAMORFOSE.resistencia : 0;
    case 'mago':
      // O revestimento de pedra da Terra (rodada 5c).
      return idDoEstilo(quem) === 'terra' && (c.golpes ?? 0) >= REGRAS_DA_TERRA.golpesDaPedra ? REGRAS_DA_TERRA.resistencia : 0;
    case 'guerreiro': {
      if (!(quem.maxHp > 0)) return 0;
      const falta = Math.max(0, quem.maxHp - quem.hp);
      return Math.floor((falta * 100) / (quem.maxHp * REGRAS_DO_GUERREIRO.degrauDaVida)) * REGRAS_DO_GUERREIRO.resistenciaPorDegrau;
    }
    case 'barbaro':
      return (c.furia ?? 0) * REGRAS_DO_BARBARO.resistenciaPorFuria;
    case 'paladino':
      return (c.absorcao ?? 0) >= REGRAS_DO_PALADINO.absorcaoQueResiste ? REGRAS_DO_PALADINO.resistencia : 0;
    default:
      return 0;
  }
}

/** O que um acerto mudou: os contadores novos e, se subiu, o combo (o total em %) ou a furtividade. */
export interface AcertoDaClasse {
  contadores: ContadoresDaClasse;
  combo?: number;
  furtividade?: number;
}

/**
 * Um golpe do herói acertou: o Guerreiro conta os críticos seguidos (um
 * acerto sem crítico zera a contagem, e o combo já ganho fica) e o Ladino
 * conta os críticos até a próxima furtividade. `null`: a classe não conta.
 */
export function contarAcerto(quem: IdentidadeDeClasse, c: ContadoresDaClasse, critico: boolean): AcertoDaClasse | null {
  switch (idDaClasse(quem)) {
    case 'guerreiro': {
      if (!critico) return { contadores: { ...c, seguidos: 0 } };
      const seguidos = (c.seguidos ?? 0) + 1;
      if (seguidos < REGRAS_DO_GUERREIRO.criticosDoCombo) return { contadores: { ...c, seguidos } };
      const combo = (c.combo ?? 0) + REGRAS_DO_GUERREIRO.combo;
      return { contadores: { ...c, seguidos: 0, combo }, combo };
    }
    case 'ladino': {
      if (!critico) return null;
      const criticos = (c.criticos ?? 0) + 1;
      if (criticos < REGRAS_DO_LADINO.criticosDaFurtividade) return { contadores: { ...c, criticos } };
      const furtividade = (c.furtividade ?? 0) + 1;
      return { contadores: { ...c, criticos: 0, furtividade }, furtividade };
    }
    default:
      return null;
  }
}

/** O herói levou um golpe com dano: a fúria do Bárbaro sobe e a absorção do Paladino junta. `null`: a classe não conta. */
export function contarGolpeLevado(quem: IdentidadeDeClasse, c: ContadoresDaClasse): ContadoresDaClasse | null {
  switch (idDaClasse(quem)) {
    case 'barbaro':
      return { ...c, furia: Math.min(REGRAS_DO_BARBARO.tetoDaFuria, (c.furia ?? 0) + 1), calmo: 0 };
    case 'paladino':
      return { ...c, absorcao: Math.min(REGRAS_DO_PALADINO.tetoDaAbsorcao, (c.absorcao ?? 0) + REGRAS_DO_PALADINO.absorvePorGolpe) };
    default:
      return null;
  }
}

/** Um passo da luta: a fúria do Bárbaro esfria depois de um tempo sem levar golpe. `null`: nada muda. */
export function esfriar(quem: IdentidadeDeClasse, c: ContadoresDaClasse): ContadoresDaClasse | null {
  if (idDaClasse(quem) !== 'barbaro' || !(c.furia ?? 0)) return null;
  const calmo = (c.calmo ?? 0) + 1;
  if (calmo < REGRAS_DO_BARBARO.calma) return { ...c, calmo };
  return { ...c, furia: Math.max(0, (c.furia ?? 0) - REGRAS_DO_BARBARO.perdeNaCalma), calmo: 0 };
}

/** Um passo da luta: o Arqueiro conta o tempo parado (andou, zera; até o necessário pro bônus). `null`: nada muda. */
export function contarParado(quem: IdentidadeDeClasse, c: ContadoresDaClasse, andou: boolean): ContadoresDaClasse | null {
  if (idDaClasse(quem) !== 'arqueiro') return null;
  const antes = c.parado ?? 0;
  const parado = andou ? 0 : Math.min(REGRAS_DO_ARQUEIRO.parado, antes + 1);
  return parado === antes && c.parado !== undefined ? null : { ...c, parado };
}

/** O dano (%) que a classe devolve a quem bateu: o Paladino, mais com a absorção no teto; os outros, 0. */
export function devolucaoDaClasse(quem: IdentidadeDeClasse, c: ContadoresDaClasse): number {
  if (idDaClasse(quem) !== 'paladino') return 0;
  return (c.absorcao ?? 0) >= REGRAS_DO_PALADINO.tetoDaAbsorcao ? REGRAS_DO_PALADINO.devolveNoTeto : REGRAS_DO_PALADINO.devolve;
}

/** O herói atrai os monstros: o Paladino (`REGRAS_DO_PALADINO.foco`). */
export function puxaOsMonstros(quem: IdentidadeDeClasse): boolean {
  return idDaClasse(quem) === 'paladino';
}

/** O que a linha da classe mostra além dos contadores: a moral do grupo e, no Clérigo e no Druida, o tempo das coisas deles (em passos). */
export interface ExtrasDaClasse {
  moral?: number;
  /** Clérigo: quanto falta pro Poder da fé voltar, e quanto ainda dura o que está de pé. */
  recargaDaFe?: number;
  fe?: number;
  /** Druida: quanto o ataque ainda espera depois da Purificação, e quantas flores do Florescimento estão no chão. */
  semAtacar?: number;
  flores?: number;
  /** Monge: o ki, e se está revestido. */
  ki?: number;
  revestido?: boolean;
  /** Segurando K neste passo (puxando mana ou juntando ki). */
  canalizando?: boolean;
  /** Necromante: quanto falta pra Magia Proibida voltar, e se ela está selada até zerar a masmorra. */
  recargaDaMagia?: number;
  magiaSelada?: boolean;
}

/** Passos em segundos, arredondando pra cima; e em "m:ss" a partir de um minuto. */
function tempo(passos: number): string {
  const s = Math.ceil(passos / 60);
  return s >= 60 ? `${Math.trunc(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s} s`;
}

/**
 * A linha da classe embaixo das barras, só na luta: o combo, a furtividade,
 * a fúria, a absorção, a mira firme do Arqueiro, o Poder da fé, a espera do
 * Druida — e a moral do grupo, de quem tiver. Sem nada a mostrar, vazia.
 */
export function textosDaClasse(quem: IdentidadeDeClasse & { hp: number; maxHp: number }, c: ContadoresDaClasse, extras: ExtrasDaClasse = {}): string[] {
  const textos = textosSoDaClasse(quem, c, extras);
  if (extras.canalizando) textos.push(oQueCanaliza(quem) === 'ki' ? '🌀 Juntando ki' : '🌀 Puxando mana');
  if ((extras.moral ?? 0) > 0) textos.push(`🎵 Moral ${extras.moral}`);
  return textos;
}

function textosSoDaClasse(quem: IdentidadeDeClasse & { hp: number; maxHp: number }, c: ContadoresDaClasse, extras: ExtrasDaClasse): string[] {
  switch (idDaClasse(quem)) {
    case 'arqueiro': {
      const textos = [(c.parado ?? 0) >= REGRAS_DO_ARQUEIRO.parado ? '🏹 Mira firme' : '🏹 Fique parado pra mirar'];
      // A aljava (rodada 6b): quanto falta pra flechada da vez.
      const flechadas = c.flechadas ?? 0;
      const r = REGRAS_DAS_ALJAVAS;
      const aljava = aljavaNoArco(quem as QuemLuta);
      if (aljava === 'aljava_paralisante') textos.push(`🕸️ Paralisia em ${faltamPro(flechadas, r.paralisiaACada)}`);
      else if (aljava === 'aljava_flamejante') textos.push(`🔥 Incêndio em ${faltamPro(flechadas, r.incendioACada)}`);
      else if (aljava === 'aljava_explosiva') textos.push(`💥 Cadeia em ${faltamPro(flechadas, r.cadeiaACada)}`);
      return textos;
    }
    case 'clerigo':
      if ((extras.fe ?? 0) > 0) return [`✝️ Fé ${tempo(extras.fe as number)}`];
      return [(extras.recargaDaFe ?? 0) > 0 ? `✝️ Fé em ${tempo(extras.recargaDaFe as number)}` : '✝️ Fé pronta'];
    case 'druida': {
      const textos = (extras.semAtacar ?? 0) > 0 ? [`🌿 Ataque em ${tempo(extras.semAtacar as number)}`] : [];
      // Os estilos (rodada 5b): a garra até a aura, as flores no chão, os golpes das Raízes.
      const golpes = c.golpes ?? 0;
      const estilo = idDoEstilo(quem as QuemTemEstilo);
      if (estilo === 'metamorfose')
        textos.push(auraDeFera(golpes) ? '🐾 Aura de fera' : `🐾 Garra ${golpes}/${REGRAS_DA_METAMORFOSE.golpesDaAura}`);
      else if (estilo === 'florescimento') textos.push(`🌸 Flores ${extras.flores ?? 0}/${REGRAS_DO_FLORESCIMENTO.maximo}`);
      else if (estilo === 'raizes') textos.push(`🌱 Raízes ${golpes}${raizesFundas(golpes) ? ' · veneno forte' : ''}`);
      return textos;
    }
    case 'monge': {
      const textos = [`☯️ Ki ${extras.ki ?? 0}/${REGRAS_DO_MONGE.tetoDoKi}${extras.revestido ? ' · Revestido' : ''}`];
      if (idDoEstilo(quem as QuemTemEstilo) === 'concentracao') textos.push(`🧘 Cargas ${c.cargas ?? 0}/${REGRAS_DA_CONCENTRACAO.tetoDeCargas}`);
      return textos;
    }
    case 'mago': {
      // Os elementos (rodada 5c): quanto falta pro disparo da vez, e o que já acendeu.
      const golpes = c.golpes ?? 0;
      switch (idDoEstilo(quem as QuemTemEstilo)) {
        case 'fogo':
          return [`🔥 Bola de fogo em ${faltamPro(golpes, REGRAS_DO_FOGO.bolaACada)}`];
        case 'terra':
          return [golpes >= REGRAS_DA_TERRA.golpesDaPedra ? '🪨 Revestimento de pedra' : `🪨 Pedra ${golpes}/${REGRAS_DA_TERRA.golpesDaPedra}`];
        case 'vento':
          return [`🌀 Empurrão em ${faltamPro(golpes, REGRAS_DO_VENTO.empurraACada)}${(c.ventania ?? 0) > 0 ? ' · ventania' : ''}`];
        case 'agua':
          return [`💧 Redemoinho em ${faltamPro(golpes, REGRAS_DA_AGUA.redemoinhoACada)}`];
        case 'arcano': {
          const r = REGRAS_DO_ARCANO;
          return [
            golpes >= r.golpesDoArcano
              ? `✨ Arcano +${Math.max(0, golpes - r.golpesDoArcano) * r.porGolpe}%`
              : `✨ Grilhões em ${faltamPro(golpes, r.grilhoesACada)} · ${golpes}/${r.golpesDoArcano}`,
          ];
        }
        case 'escuridao': {
          const r = REGRAS_DA_ESCURIDAO;
          return [golpes >= r.golpesDaFome ? '🌑 Fome da escuridão' : `🌑 Escuridão em ${faltamPro(golpes, r.areaACada)} · ${golpes}/${r.golpesDaFome}`];
        }
        default:
          return [];
      }
    }
    case 'necromante':
      if (extras.magiaSelada) return ['☠️ Magia selada'];
      return [(extras.recargaDaMagia ?? 0) > 0 ? `☠️ Magia em ${tempo(extras.recargaDaMagia as number)}` : '☠️ Magia pronta'];
    case 'guerreiro': {
      const resistencia = resistenciaDaClasse(quem, c);
      const combo = `⚔️ Combo +${c.combo ?? 0}% · ${c.seguidos ?? 0}/${REGRAS_DO_GUERREIRO.criticosDoCombo}`;
      const textos = resistencia > 0 ? [combo, `🛡️ Resistência ${resistencia}%`] : [combo];
      // O Espadachim: o avanço e o ki do Corte Invernal.
      if (idDoEstilo(quem as QuemTemEstilo) === 'espadachim') {
        textos.push((c.recargaDoEstilo ?? 0) > 0 ? `🗡️ Avanço em ${tempo(c.recargaDoEstilo as number)}` : '🗡️ Avanço pronto');
        textos.push(`☯️ Ki ${extras.ki ?? 0}/${REGRAS_DO_ESPADACHIM.corte}`);
      }
      return textos;
    }
    case 'ladino':
      return [`🗡️ Furtividade ${c.furtividade ?? 0} · ${c.criticos ?? 0}/${REGRAS_DO_LADINO.criticosDaFurtividade}`];
    case 'barbaro':
      return [`🔥 Fúria ${c.furia ?? 0}/${REGRAS_DO_BARBARO.tetoDaFuria}`];
    case 'paladino':
      return [`🛡️ Absorção ${c.absorcao ?? 0}/${REGRAS_DO_PALADINO.tetoDaAbsorcao}`];
    default:
      return [];
  }
}
