/**
 * Sorteio da criação de personagem — porta de `rollEverything()`/
 * `rerollPowers()`/`rerollAttrsIfReady()` em `rpg-legend/js/ui.js`.
 *
 * Fica fora do componente React de propósito: é regra de jogo, não de
 * tela, e recebe o `Rng` injetado igual ao resto da engine. Isso mantém a
 * mesma disciplina de `packages/shared` — nada aqui depende de React nem
 * do DOM.
 *
 * Não foi movido pra `packages/shared` porque o servidor não valida
 * criação de personagem: ele valida o save resultante. Se um dia validar,
 * este arquivo é que muda de lugar.
 *
 * Comportamento fiel ao jogo em produção: raça e classe o jogador escolhe
 * OU sorteia; os dois poderes extras, a fraqueza e os atributos são
 * sempre sorteados. (O `CLAUDE.md` descreve os poderes como escolhidos
 * pelo jogador — o código do jogo não faz isso.)
 */

import {
  CLASSES,
  DEBUFFS,
  POWERS,
  RACES,
  defaultRng,
  rollAttrs,
  type Attributes,
  type ClassDef,
  type Debuff,
  type Power,
  type Race,
  type Rng,
} from '@rpg-legend/shared';

export const QUANTIDADE_DE_PODERES_EXTRAS = 2;

export interface Criacao {
  nome: string;
  raca: Race | null;
  classe: ClassDef | null;
  poderes: Power[];
  fraqueza: Debuff | null;
  atributos: Attributes | null;
}

export function criacaoVazia(nome: string): Criacao {
  return { nome, raca: null, classe: null, poderes: [], fraqueza: null, atributos: null };
}

function sortear<T>(lista: readonly T[], rng: Rng): T {
  return lista[Math.floor(rng() * lista.length)];
}

/** Dois poderes distintos, nunca o de assinatura da classe (que já vem de graça). */
export function sortearPoderes(classe: ClassDef, rng: Rng = defaultRng): Power[] {
  const disponiveis = POWERS.filter((poder) => poder.id !== classe.signatureId);
  const embaralhados = [...disponiveis].sort(() => rng() - 0.5);
  return embaralhados.slice(0, QUANTIDADE_DE_PODERES_EXTRAS);
}

/**
 * Uma fraqueza qualquer. Existe separado do `rolarTudo` porque a tela
 * deixa regirar só esta seção — e quem regira a fraqueza precisa regirar
 * os atributos junto, que dependem dela.
 */
export function sortearFraqueza(rng: Rng = defaultRng): Debuff {
  return sortear(DEBUFFS, rng);
}

/** Os atributos dependem de raça, classe e fraqueza: só rola quando os três existem. */
export function rolarAtributosSePossivel(criacao: Criacao, rng: Rng = defaultRng): Attributes | null {
  if (!criacao.raca || !criacao.classe || !criacao.fraqueza) return null;
  return rollAttrs(criacao.raca, criacao.classe, criacao.fraqueza, rng);
}

/** O "Rolar Tudo" do original: sorteia raça, classe, poderes, fraqueza e atributos. */
export function rolarTudo(nome: string, rng: Rng = defaultRng): Criacao {
  const raca = sortear(RACES, rng);
  const classe = sortear(CLASSES, rng);
  const fraqueza = sortear(DEBUFFS, rng);
  const parcial: Criacao = { nome, raca, classe, poderes: sortearPoderes(classe, rng), fraqueza, atributos: null };
  return { ...parcial, atributos: rolarAtributosSePossivel(parcial, rng) };
}

export type FaltaParaComecar = 'nome' | 'raca' | 'classe' | 'sorteio';

/** O que ainda falta pra poder começar, na ordem em que o jogador resolve. */
export function faltaParaComecar(criacao: Criacao): FaltaParaComecar | null {
  if (!criacao.nome.trim()) return 'nome';
  if (!criacao.raca) return 'raca';
  if (!criacao.classe) return 'classe';
  if (criacao.poderes.length !== QUANTIDADE_DE_PODERES_EXTRAS || !criacao.fraqueza || !criacao.atributos) return 'sorteio';
  return null;
}
