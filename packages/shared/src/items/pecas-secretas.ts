/**
 * As peças secretas (doc do Breno de 2026-11-15, rodada 6; decidido com o
 * usuário): só o app as vende, e o efeito delas só a luta do app aplica (as
 * rodadas 6b e 6c). O site conhece as peças (o mesmo personagem roda nos
 * dois) e as usa pelos atributos.
 *
 * - O **negociante secreto** é uma sala da masmorra, depois de zerar a
 *   Floresta: cada andar novo tem `CHANCE_DO_NEGOCIANTE` de trazer um, só pra
 *   quem tem peça secreta da classe (o Arqueiro, o Monge e o Guerreiro; o
 *   Caçador depois). Ele vende 1 peça da classe do herói, por um preço fixo; a
 *   aljava explosiva só está com 1 de cada 5. Comprou, ele vai embora.
 * - O **chapéu do espadachim** não é do negociante: a loja da cidade (o
 *   ferreiro do app) o tem de vez em quando, depois de zerar a Floresta.
 * - O Monge com uma das armas dele na mão tem **+50% de vida, em todo lugar**
 *   (como a vida do Cavaleiro).
 */

import { idDaClasse, type IdentidadeDeClasse } from '../hero/catalog.js';
import { randomInt, type Rng } from '../rng.js';

export interface PecaSecreta {
  /** O modelo da peça (`items/templates.ts`). */
  id: string;
  /** As classes pra quem o negociante a vende. */
  classes: readonly string[];
  /** O preço fixo, em ouro. */
  preco: number;
  /** A peça rara: só 1 de cada tantos negociantes a tem. Ausente, comum. */
  raro?: number;
}

export const PECAS_SECRETAS: readonly PecaSecreta[] = [
  { id: 'aljava_paralisante', classes: ['arqueiro'], preco: 900 },
  { id: 'aljava_flamejante', classes: ['arqueiro'], preco: 900 },
  { id: 'aljava_explosiva', classes: ['arqueiro'], preco: 1800, raro: 5 },
  { id: 'bastao', classes: ['monge'], preco: 1000 },
  { id: 'leque', classes: ['monge'], preco: 1000 },
  { id: 'kusarigama', classes: ['monge'], preco: 1000 },
  { id: 'lanca', classes: ['guerreiro'], preco: 800 },
];

/** A chance (%) de um andar novo trazer o negociante (depois de zerar a Floresta). */
export const CHANCE_DO_NEGOCIANTE = 5;

/** O chapéu do espadachim: o modelo, o preço na loja e a chance (0 a 1) de o ferreiro do app tê-lo. */
export const CHAPEU_DO_ESPADACHIM = 'chapeu_espadachim';
export const PRECO_DO_CHAPEU = 1200;
export const CHANCE_DO_CHAPEU = 0.05;

/** A raridade das peças secretas: rara (o valor do modelo é o preço ÷ 1,7, então vendida rende a metade). */
export const RARIDADE_DAS_PECAS_SECRETAS = 'raro';

/** As armas do Monge, e a vida a mais (%) do Monge que usa uma delas. */
export const ARMAS_DO_MONGE: readonly string[] = ['bastao', 'leque', 'kusarigama'];
export const VIDA_COM_A_ARMA_DO_MONGE = 50;

/** A peça secreta pelo id do modelo. */
export function pecaSecreta(id: string | undefined): PecaSecreta | null {
  return PECAS_SECRETAS.find((p) => p.id === id) ?? null;
}

/** As peças secretas que o negociante vende pra esta classe. */
export function pecasDaClasse(quem: IdentidadeDeClasse): PecaSecreta[] {
  const id = idDaClasse(quem);
  return id ? PECAS_SECRETAS.filter((p) => p.classes.includes(id)) : [];
}

/** A chance (%) de o negociante aparecer pra este herói: só pra quem tem peça secreta da classe. A Floresta zerada quem confere é quem gera o andar. */
export function chanceDoNegociante(quem: IdentidadeDeClasse): number {
  return pecasDaClasse(quem).length > 0 ? CHANCE_DO_NEGOCIANTE : 0;
}

/**
 * A peça que um negociante traz: as raras da classe entram antes, 1 vez em
 * `raro`; senão, uma comum sorteada. Sem peça pra classe, `null`.
 */
export function sortearPecaSecreta(quem: IdentidadeDeClasse, rng: Rng): PecaSecreta | null {
  const pecas = pecasDaClasse(quem);
  if (pecas.length === 0) return null;
  for (const rara of pecas.filter((p) => p.raro)) {
    if (rng() * (rara.raro as number) < 1) return rara;
  }
  const comuns = pecas.filter((p) => !p.raro);
  if (comuns.length === 0) return null;
  return comuns[randomInt(comuns.length, rng)] as PecaSecreta;
}

/** A vida máxima com a arma do Monge: +50% pro Monge com o bastão, o leque ou a kusarigama numa das mãos (em todo lugar). */
export function vidaComAArma(
  vida: number,
  quem: IdentidadeDeClasse & { equip?: { arma?: { templateId?: string } | null; secundaria?: { templateId?: string } | null } | null },
): number {
  if (idDaClasse(quem) !== 'monge') return vida;
  const naMao = [quem.equip?.arma?.templateId, quem.equip?.secundaria?.templateId];
  if (!naMao.some((id) => !!id && ARMAS_DO_MONGE.includes(id))) return vida;
  return Math.round((vida * (100 + VIDA_COM_A_ARMA_DO_MONGE)) / 100);
}
