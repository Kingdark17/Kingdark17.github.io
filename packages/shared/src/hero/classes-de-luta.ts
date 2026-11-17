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

export interface ClasseDeLuta {
  /** O alcance do ataque comum, em blocos. */
  alcance: number;
  /** A vida, em % da de sempre. */
  vida: number;
  /** O dano do herói na luta do app, em %. */
  dano: number;
  /** A velocidade de andar na luta do app, em %. */
  velocidade: number;
}

/** A classe que o texto não muda: tudo no padrão, corpo a corpo. */
export const CLASSE_PADRAO: ClasseDeLuta = { alcance: 1, vida: 100, dano: 100, velocidade: 100 };

export const CLASSES_DE_LUTA: Readonly<Record<string, ClasseDeLuta>> = {
  arqueiro: { alcance: 12, vida: 100, dano: 92, velocidade: 110 },
  bardo: { alcance: 5, vida: 80, dano: 85, velocidade: 120 },
  necromante: { alcance: 7, vida: 80, dano: 85, velocidade: 100 },
  monge: { alcance: 1, vida: 100, dano: 100, velocidade: 100 },
  guerreiro: { alcance: 2, vida: 100, dano: 92, velocidade: 100 },
  ladino: { alcance: 1, vida: 100, dano: 110, velocidade: 130 },
  barbaro: { alcance: 1, vida: 100, dano: 100, velocidade: 80 },
  druida: { alcance: 2, vida: 100, dano: 100, velocidade: 100 },
  cacador: { alcance: 4, vida: 100, dano: 100, velocidade: 100 },
  clerigo: { alcance: 5, vida: 80, dano: 92, velocidade: 120 },
  paladino: { alcance: 2, vida: 130, dano: 85, velocidade: 60 },
  mago: { alcance: 7, vida: 80, dano: 100, velocidade: 100 },
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

export interface QuemLuta extends IdentidadeDeClasse {
  equip?: { arma?: { templateId: string } | null } | null;
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
  return (CLASSES_DE_LUTA[id] as ClasseDeLuta).alcance;
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
export const CLASSES_REFEITAS: readonly string[] = ['guerreiro', 'ladino', 'barbaro', 'paladino'];

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
export function bonusDoAtaque(quem: QuemLuta, c: ContadoresDaClasse, alvo: { colado: boolean; chefe: boolean }): number {
  switch (idDaClasse(quem)) {
    case 'guerreiro':
      return (alvo.colado ? REGRAS_DO_GUERREIRO.colado : 0) + (c.combo ?? 0);
    case 'ladino':
      return contraOChefe(furtividadeEm(c.furtividade ?? 0).ataque, alvo.chefe);
    case 'barbaro':
      return (c.furia ?? 0) * REGRAS_DO_BARBARO.danoPorFuria + (quem.equip?.arma?.templateId === 'marreta' ? REGRAS_DO_BARBARO.marreta : 0);
    default:
      return 0;
  }
}

/** A esquiva a mais (%) contra o golpe de um monstro: a furtividade do Ladino (a metade contra o chefe). */
export function esquivaDaClasse(quem: IdentidadeDeClasse, c: ContadoresDaClasse, chefe: boolean): number {
  if (idDaClasse(quem) !== 'ladino') return 0;
  return contraOChefe(furtividadeEm(c.furtividade ?? 0).esquiva, chefe);
}

/**
 * A resistência da classe: a % de dano a menos no golpe que o herói leva. O
 * Guerreiro pela vida que falta, o Bárbaro pela fúria, o Paladino pela
 * absorção.
 */
export function resistenciaDaClasse(quem: IdentidadeDeClasse & { hp: number; maxHp: number }, c: ContadoresDaClasse): number {
  switch (idDaClasse(quem)) {
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

/** O dano (%) que a classe devolve a quem bateu: o Paladino, mais com a absorção no teto; os outros, 0. */
export function devolucaoDaClasse(quem: IdentidadeDeClasse, c: ContadoresDaClasse): number {
  if (idDaClasse(quem) !== 'paladino') return 0;
  return (c.absorcao ?? 0) >= REGRAS_DO_PALADINO.tetoDaAbsorcao ? REGRAS_DO_PALADINO.devolveNoTeto : REGRAS_DO_PALADINO.devolve;
}

/** O herói atrai os monstros: o Paladino (`REGRAS_DO_PALADINO.foco`). */
export function puxaOsMonstros(quem: IdentidadeDeClasse): boolean {
  return idDaClasse(quem) === 'paladino';
}

/** A linha da classe embaixo das barras, só na luta: o combo, a furtividade, a fúria ou a absorção. Sem nada a mostrar, vazia. */
export function textosDaClasse(quem: IdentidadeDeClasse & { hp: number; maxHp: number }, c: ContadoresDaClasse): string[] {
  switch (idDaClasse(quem)) {
    case 'guerreiro': {
      const resistencia = resistenciaDaClasse(quem, c);
      const combo = `⚔️ Combo +${c.combo ?? 0}% · ${c.seguidos ?? 0}/${REGRAS_DO_GUERREIRO.criticosDoCombo}`;
      return resistencia > 0 ? [combo, `🛡️ Resistência ${resistencia}%`] : [combo];
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
