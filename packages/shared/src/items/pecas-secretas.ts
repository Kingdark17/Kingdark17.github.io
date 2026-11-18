/**
 * As peças secretas (doc do Breno de 2026-11-15, rodada 6; decidido com o
 * usuário): só o app as vende, e o efeito delas só a luta do app aplica (as
 * rodadas 6b e 6c). O site conhece as peças (o mesmo personagem roda nos
 * dois) e as usa pelos atributos.
 *
 * - O **negociante secreto** é uma sala da masmorra, depois de zerar a
 *   Floresta: cada andar novo tem `CHANCE_DO_NEGOCIANTE` de trazer um, só pra
 *   quem tem peça secreta da classe (o Arqueiro e o Caçador, o Monge e o
 *   Guerreiro). Ele vende 1 peça da classe do herói, por um preço fixo; a
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
  { id: 'aljava_paralisante', classes: ['arqueiro', 'cacador'], preco: 900 },
  { id: 'aljava_flamejante', classes: ['arqueiro', 'cacador'], preco: 900 },
  { id: 'aljava_explosiva', classes: ['arqueiro', 'cacador'], preco: 1800, raro: 5 },
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

/**
 * As aljavas na luta do app (rodada 6b, decidido com o usuário): com uma
 * delas ao lado do arco, o alcance tem 1 bloco a mais, e cada flecha que
 * acerta faz o efeito da aljava, contando as flechadas da luta.
 *
 * - **Paralisante**: todo acerto encurta o monstro como o Vento do Mago (1
 *   bloco, sem acumular, até o fim da luta); a cada `paralisiaACada`, o alvo
 *   fica atordoado `paralisia` passos (5 s; o chefe não).
 * - **Flamejante**: todo acerto deixa o monstro fraco (os próximos
 *   `golpesFracos` golpes dele saem `fraqueza`% mais fracos); a cada
 *   `incendioACada`, o alvo fica `incendio` passos (10 s) incendiado, levando
 *   `incendioPorSegundo`% do dano daquela flechada a cada segundo.
 * - **Explosiva**: o alvo explode, e quem está a até `raioDaExplosao` blocos
 *   leva o mesmo dano da flechada, sem resistência nem escudo (a armadura),
 *   e é empurrado `empurraoDaExplosao` bloco pra longe; a cada
 *   `cadeiaACada`, quem a explosão pega também explode, em cadeia: cada um
 *   explode uma vez só e leva no máximo `estourosPorInimigo` estouros (o alvo
 *   da flecha já conta um).
 */
export const REGRAS_DAS_ALJAVAS = {
  alcance: 1,
  paralisiaACada: 5,
  paralisia: 300,
  fraqueza: 20,
  golpesFracos: 3,
  incendioACada: 6,
  incendio: 600,
  incendioPorSegundo: 50,
  raioDaExplosao: 2,
  cadeiaACada: 10,
  empurraoDaExplosao: 1,
  estourosPorInimigo: 2,
} as const;

/** As aljavas (as que só vão ao lado do arco). */
export const ALJAVAS: readonly string[] = ['aljava_paralisante', 'aljava_flamejante', 'aljava_explosiva'];

/** A aljava ao lado do arco: o modelo dela, se o herói tem o arco na mão e uma aljava na secundária; senão `null`. */
export function aljavaNoArco(quem: { equip?: { arma?: { templateId?: string } | null; secundaria?: { templateId?: string } | null } | null }): string | null {
  if (quem.equip?.arma?.templateId !== 'arco') return null;
  const aljava = quem.equip?.secundaria?.templateId;
  return aljava && ALJAVAS.includes(aljava) ? aljava : null;
}

/**
 * As armas novas na luta do app (rodada 6c, decidido com o usuário): cada uma
 * vale pra classe dona dela (as do Monge pro Monge, a lança pro Guerreiro), e
 * o alcance dela soma ao do estilo.
 *
 * - **Bastão** (duas mãos): +3 de alcance; no estilo Dash, o chute que
 *   acerta atordoa 30% das vezes; o ki (segurando K) e as cargas da
 *   Concentração vêm 50% mais rápido.
 * - **Leque** (em qualquer mão): +20% no multiplicador do crítico; no estilo
 *   Empurrão, o empurrão vai 2 blocos mais longe. Com **dois leques**: +20% de
 *   velocidade, e a explosão de ki empurra 2 blocos e bate 30% mais forte.
 * - **Kusarigama** (duas mãos): +4 de alcance; o golpe pega também uma área de
 *   3 casas de largura e 2 de fundo no alvo (ele e a fileira atrás dele), com
 *   o dano inteiro; o revestimento de ki segura 50% (e não 30%).
 * - **Lança**: +1 de alcance; a cada golpe, 10% de o próximo ter a faixa do
 *   crítico 30% maior. O Guerreiro de lança ou de chapéu bate +10% (não soma).
 * - **Chapéu do espadachim** (o Monge e o Espadachim, que juntam ki): o botão
 *   gasta 50 de ki e espera 40 s; o chapéu voa até a parede e volta pro herói,
 *   acertando quem está no caminho na ida e outra vez na volta, a 40% do golpe
 *   (o primeiro que ele pega leva o golpe, os outros o mesmo dano).
 */
export const REGRAS_DAS_ARMAS_NOVAS = {
  alcanceDoBastao: 3,
  atordoaNoChute: 30,
  kiComOBastao: 15,
  passosPorCargaComOBastao: 120,
  criticoDoLeque: 20,
  empurraoDoLeque: 2,
  velocidadeComDoisLeques: 20,
  empurraoDaExplosaoComDoisLeques: 2,
  explosaoComDoisLeques: 30,
  alcanceDaKusarigama: 4,
  larguraDaKusarigama: 3,
  fundoDaKusarigama: 2,
  escudoComAKusarigama: 50,
  alcanceDaLanca: 1,
  chanceDaLanca: 10,
  faixaDaLanca: 30,
  danoDoGuerreiro: 10,
  kiDoChapeu: 50,
  recargaDoChapeu: 2400,
  forcaDoChapeu: 40,
  velocidadeDoChapeu: 128,
  raioDoChapeu: 576,
  vidaDoChapeu: 600,
} as const;

type ComEquipamento = {
  equip?: { arma?: { templateId?: string } | null; secundaria?: { templateId?: string } | null; acessorio?: { templateId?: string } | null } | null;
};

/** A peça `id` numa das mãos. */
export function naMao(quem: ComEquipamento, id: string): boolean {
  return quem.equip?.arma?.templateId === id || quem.equip?.secundaria?.templateId === id;
}

/** Um leque em cada mão. */
export function comDoisLeques(quem: ComEquipamento): boolean {
  return quem.equip?.arma?.templateId === 'leque' && quem.equip?.secundaria?.templateId === 'leque';
}

/** O chapéu do espadachim no acessório. */
export function comOChapeu(quem: ComEquipamento): boolean {
  return quem.equip?.acessorio?.templateId === CHAPEU_DO_ESPADACHIM;
}
