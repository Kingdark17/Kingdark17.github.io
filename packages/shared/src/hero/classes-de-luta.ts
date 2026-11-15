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
