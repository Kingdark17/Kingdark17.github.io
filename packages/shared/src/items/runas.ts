/**
 * As runas, só do app (decisões do usuário, 2026-10-17): pedras raras que
 * caem de baú e de chefe e dão uma habilidade à arma em que são engastadas.
 *
 * - **Quatro tipos:** ⚡ elétrica (o choque: dano a mais, e o monstro fica
 *   atordoado), 🔥 fogo (queima), ❄️ gelo (deixa lento) e 🩸 vampírica (cura
 *   quem bate com parte do golpe).
 * - **Três tiers** (I, II, III): o I cai em qualquer andar, o II a partir do
 *   30 e o III a partir do 60, e o chefe dá um tier acima. Quanto maior o
 *   tier, maior a chance e a força.
 * - **Os espaços da arma:** um em toda arma, mais um se ela for mítica, mais
 *   um se for do último degrau do material (aço mágico, madeira élfica) e
 *   mais um se for tier A ou acima — quatro no máximo. A mesma runa pode ir
 *   duas vezes, e as duas somam.
 * - **Engastar** é de graça; numa arma cheia, a runa nova destrói a do
 *   espaço escolhido. **Tirar** devolve a runa, mas ela pode quebrar: 40% no
 *   tier I, 25% no II, 10% no III. A arma que perde espaço (a reforja baixou
 *   o tier) devolve inteira a runa que sobrou.
 * - **Cai** do chefe (25%) e do baú da sala de tesouro e da sala secreta
 *   (5%), só quando quem pede é o app (`app`).
 * - **Só no app:** é a arena que aplica as runas (`aplicarRunas`). No site a
 *   arma vale só pelos atributos, e a runa fica parada nela.
 */

import type { Hero } from '../hero/hero.js';
import type { CombatMonster } from '../combat/monster-state.js';
import { setStatusField } from '../combat/monster-state.js';
import { defaultRng, randomInt, type Rng } from '../rng.js';
import { instantiate, itemCategory, type Item, type RunaNaArma } from './item.js';
import { ULTIMO_DEGRAU } from './materiais.js';
import { RARITIES, RARITY_IDS, type Rarity } from './rarity.js';
import { ROMANOS, templatesByCategory, type ItemTemplate, type RunaId } from './templates.js';
import { TIER_ORDER, tierRank } from './tiers.js';

export interface Runa {
  /** O ícone que a tela mostra. */
  icone: string;
  /** A chance de disparar no acerto, por tier (I, II, III). */
  chance: readonly number[];
  /**
   * A força do efeito, por tier: a fração do dano do golpe que vira choque,
   * queima por turno ou cura; no gelo, a chance de o monstro hesitar.
   */
  forca: readonly number[];
}

export const RUNAS: Readonly<Record<RunaId, Runa>> = {
  eletrica: { icone: '⚡', chance: [0.1, 0.15, 0.2], forca: [0.2, 0.35, 0.5] },
  fogo: { icone: '🔥', chance: [0.1, 0.15, 0.2], forca: [0.2, 0.3, 0.4] },
  gelo: { icone: '❄️', chance: [0.1, 0.15, 0.2], forca: [0.25, 0.35, 0.5] },
  vampirica: { icone: '🩸', chance: [0.1, 0.15, 0.2], forca: [0.2, 0.35, 0.5] },
};

/** Os tipos, na ordem em que disparam no golpe e em que o sorteio os escolhe. */
export const TIPOS_DE_RUNA: readonly RunaId[] = ['eletrica', 'fogo', 'gelo', 'vampirica'];

/** O andar de força a partir do qual cada tier cai: o I em qualquer um, o II no 30, o III no 60. */
export const ANDAR_DO_TIER: readonly number[] = [1, 30, 60];

/** A chance de o chefe deixar uma runa, e a de o baú (sala de tesouro e sala secreta) ter uma. */
export const CHANCE_DA_RUNA_NO_CHEFE = 0.25;
export const CHANCE_DA_RUNA_NO_BAU = 0.05;

/** A chance de a runa quebrar ao ser tirada da arma, por tier. */
export const QUEBRA_AO_TIRAR: readonly number[] = [0.4, 0.25, 0.1];

/** O valor da runa, sobre o do catálogo, por tier. */
export const VALOR_DO_TIER: readonly number[] = [1, 2, 4];

/** Os espaços de runa: um em toda arma e mais um por cada condição, até este teto. */
export const ESPACOS_MAXIMOS = 4;

/** A arma ganha um espaço a partir desta raridade, e outro a partir deste tier. */
export const RARIDADE_COM_ESPACO = 'mitico';
export const TIER_COM_ESPACO = 'A';

/** Duas runas iguais somam a chance, até este teto. */
export const CHANCE_MAXIMA_DA_RUNA = 0.9;

/** Quanto duram a queima e o gelo, em turnos (na arena, rodadas). */
export const TURNOS_DA_RUNA = 3;

function tierValido(tier: number | undefined): number {
  return Math.min(ROMANOS.length, Math.max(1, Math.trunc(tier ?? 1)));
}

function templateDaRuna(runa: RunaId): ItemTemplate {
  const template = templatesByCategory('runa').find((t) => t.runa === runa);
  if (!template) throw new Error(`runa sem modelo no catálogo: ${runa}`);
  return template;
}

/** O tipo da runa deste item, ou `null` se ele não é runa. */
export function runaDoItem(item: Pick<Item, 'templateId'>): RunaId | null {
  return templatesByCategory('runa').find((t) => t.id === item.templateId)?.runa ?? null;
}

/** O tier da runa deste item, de 1 a 3. */
export function tierDaRuna(item: Pick<Item, 'tierDaRuna'>): number {
  return tierValido(item.tierDaRuna);
}

/** O nome de uma runa engastada: "Runa de Fogo II". */
export function nomeDaRuna(runa: RunaNaArma): string {
  return `${templateDaRuna(runa.runa).name} ${ROMANOS[tierValido(runa.tier) - 1]}`;
}

/** As runas engastadas na arma, em ordem. */
export function runasDaArma(item: Pick<Item, 'runas'>): RunaNaArma[] {
  return item.runas ?? [];
}

/**
 * Quantos espaços de runa a peça tem: nenhum fora das armas; numa arma, um,
 * mais um se for mítica, mais um se for do último degrau do material e mais
 * um se for tier A ou acima.
 */
export function espacosDeRuna(item: Item): number {
  if (itemCategory(item) !== 'arma') return 0;
  let espacos = 1;
  if (RARITY_IDS.indexOf(item.rarity) >= RARITY_IDS.indexOf(RARIDADE_COM_ESPACO)) espacos += 1;
  if ((item.degrau ?? 1) >= ULTIMO_DEGRAU) espacos += 1;
  if (tierRank(item) >= TIER_ORDER.indexOf(TIER_COM_ESPACO)) espacos += 1;
  return Math.min(ESPACOS_MAXIMOS, espacos);
}

/** O item de uma runa: comum, com o tier no nome e no valor. Um número do `rng`, o do uid. */
export function criarRuna(runa: RunaId, tier: number, options: { rng?: Rng; now?: () => number } = {}): Item {
  const template = templateDaRuna(runa);
  const t = tierValido(tier);
  const item = instantiate(template, RARITIES[0] as Rarity, options);
  return { ...item, value: Math.round(template.value * (VALOR_DO_TIER[t - 1] as number)), tierDaRuna: t };
}

/** O tier mais alto que cai neste andar, sem contar o do chefe. */
export function tierMaximoNoAndar(andar: number): number {
  return Math.max(1, ANDAR_DO_TIER.filter((desde) => andar >= desde).length);
}

/**
 * Sorteia a runa que cai: o tipo, o tier (até o do andar; o chefe um acima,
 * até o III) e o uid — três números do `rng`.
 */
export function sortearRuna(andar: number, chefe = false, rng: Rng = defaultRng, now?: () => number): Item {
  const runa = TIPOS_DE_RUNA[randomInt(TIPOS_DE_RUNA.length, rng)] as RunaId;
  const tier = 1 + randomInt(tierMaximoNoAndar(andar), rng) + (chefe ? 1 : 0);
  return criarRuna(runa, tier, now ? { rng, now } : { rng });
}

/** A arma sem o campo das runas quando não sobra nenhuma. */
function comRunas(arma: Item, runas: RunaNaArma[]): Item {
  if (runas.length > 0) return { ...arma, runas };
  const { runas: _semRunas, ...resto } = arma;
  void _semRunas;
  return resto;
}

export type ResultadoDoEngaste =
  | { kind: 'engastou'; arma: Item }
  | { kind: 'substituiu'; arma: Item; destruida: RunaNaArma }
  | { kind: 'cheia' }
  | { kind: 'nao_e_arma' }
  | { kind: 'nao_e_runa' };

/**
 * Engasta a runa na arma: no primeiro espaço livre, ou — com a arma cheia —
 * no espaço `indice`, destruindo a runa que estava lá. Cheia e sem `indice`
 * (ou com um que não existe), não engasta.
 */
export function engastar(arma: Item, runa: Item, indice?: number): ResultadoDoEngaste {
  const espacos = espacosDeRuna(arma);
  if (espacos === 0) return { kind: 'nao_e_arma' };
  const tipo = runaDoItem(runa);
  if (!tipo) return { kind: 'nao_e_runa' };

  const nova: RunaNaArma = { runa: tipo, tier: tierDaRuna(runa) };
  const runas = runasDaArma(arma);
  if (runas.length < espacos) return { kind: 'engastou', arma: comRunas(arma, [...runas, nova]) };
  if (indice === undefined || !Number.isInteger(indice) || indice < 0 || indice >= runas.length) return { kind: 'cheia' };
  return {
    kind: 'substituiu',
    arma: comRunas(arma, runas.map((r, i) => (i === indice ? nova : r))),
    destruida: runas[indice] as RunaNaArma,
  };
}

export type ResultadoDaRetirada =
  | { kind: 'voltou'; arma: Item; runa: Item }
  | { kind: 'quebrou'; arma: Item; quebrada: RunaNaArma }
  | { kind: 'sem_runa' };

/**
 * Tira a runa do espaço `indice`. Um número do `rng` decide se ela quebra
 * (pelo tier); se não quebrou, ela volta como item (mais um número, o do uid).
 */
export function tirar(arma: Item, indice: number, rng: Rng = defaultRng, now?: () => number): ResultadoDaRetirada {
  const runas = runasDaArma(arma);
  const alvo = Number.isInteger(indice) && indice >= 0 ? runas[indice] : undefined;
  if (!alvo) return { kind: 'sem_runa' };

  const semEla = comRunas(arma, runas.filter((_, i) => i !== indice));
  if (rng() < (QUEBRA_AO_TIRAR[tierValido(alvo.tier) - 1] as number)) return { kind: 'quebrou', arma: semEla, quebrada: alvo };
  return { kind: 'voltou', arma: semEla, runa: criarRuna(alvo.runa, alvo.tier, now ? { rng, now } : { rng }) };
}

/**
 * Depois de a arma mudar de tier (a reforja): as runas além dos espaços dela
 * saem, as últimas primeiro, e voltam inteiras como itens. Sem sobra, não
 * gasta o `rng`.
 */
export function aposMudarDeTier(arma: Item, rng: Rng = defaultRng, now?: () => number): { arma: Item; devolvidas: Item[] } {
  const runas = runasDaArma(arma);
  const espacos = espacosDeRuna(arma);
  if (runas.length <= espacos) return { arma, devolvidas: [] };
  const devolvidas = runas.slice(espacos).map((r) => criarRuna(r.runa, r.tier, now ? { rng, now } : { rng }));
  return { arma: comRunas(arma, runas.slice(0, espacos)), devolvidas };
}

/** O efeito de um tipo de runa na arma: as iguais já somadas. */
export interface EfeitoDeRuna {
  runa: RunaId;
  chance: number;
  forca: number;
}

/** As runas da arma juntas por tipo, na ordem de `TIPOS_DE_RUNA`: as iguais somam a chance (com teto) e a força. */
export function efeitosDaArma(arma: Item | null | undefined): EfeitoDeRuna[] {
  const runas = arma ? runasDaArma(arma) : [];
  const efeitos: EfeitoDeRuna[] = [];
  for (const tipo of TIPOS_DE_RUNA) {
    let chance = 0;
    let forca = 0;
    let quantas = 0;
    for (const r of runas) {
      if (r.runa !== tipo) continue;
      const t = tierValido(r.tier) - 1;
      chance += RUNAS[tipo].chance[t] as number;
      forca += RUNAS[tipo].forca[t] as number;
      quantas += 1;
    }
    if (quantas > 0) efeitos.push({ runa: tipo, chance: Math.min(CHANCE_MAXIMA_DA_RUNA, chance), forca });
  }
  return efeitos;
}

/** Uma runa que disparou no golpe: o tipo e o número que a tela mostra (o choque, a queima, a cura; no gelo, a chance de hesitar). */
export interface DisparoDeRuna {
  runa: RunaId;
  valor: number;
}

/**
 * O acerto do herói passa pelas runas da arma — só no app: quem chama é a
 * arena, depois do `resolverGolpe`. Cada tipo sorteia uma vez, na ordem de
 * `TIPOS_DE_RUNA`, e o que disparou vale:
 * - **elétrica:** o choque tira a mais `forca` do dano do golpe (pelo menos
 *   1), e o monstro fica atordoado;
 * - **fogo:** queima por `TURNOS_DA_RUNA` turnos, `forca` do dano do golpe
 *   por turno (pelo menos 2);
 * - **gelo:** deixa o monstro lento por `TURNOS_DA_RUNA` turnos, com `forca`
 *   de chance de hesitar;
 * - **vampírica:** cura quem bate em `forca` do dano do golpe (pelo menos 1,
 *   até a vida cheia).
 */
export function aplicarRunas<M extends CombatMonster>(hero: Hero, monster: M, dano: number, rng: Rng = defaultRng): { hero: Hero; monster: M; disparos: DisparoDeRuna[] } {
  let heroi = hero;
  let monstro = monster;
  const disparos: DisparoDeRuna[] = [];
  for (const efeito of efeitosDaArma(hero.equip.arma)) {
    if (rng() >= efeito.chance) continue;
    switch (efeito.runa) {
      case 'eletrica': {
        const choque = Math.max(1, Math.round(dano * efeito.forca));
        const status = setStatusField(monstro.status, 'atordoado', (monstro.status?.atordoado ?? 0) + 1);
        monstro = { ...monstro, hp: Math.max(0, monstro.hp - choque), status };
        disparos.push({ runa: 'eletrica', valor: choque });
        break;
      }
      case 'fogo': {
        const queima = Math.max(2, Math.round(dano * efeito.forca));
        monstro = { ...monstro, status: setStatusField(monstro.status, 'queimadura', { turns: TURNOS_DA_RUNA, dmg: queima }) };
        disparos.push({ runa: 'fogo', valor: queima });
        break;
      }
      case 'gelo':
        monstro = { ...monstro, status: setStatusField(monstro.status, 'lento', { turns: TURNOS_DA_RUNA, amount: efeito.forca }) };
        disparos.push({ runa: 'gelo', valor: efeito.forca });
        break;
      case 'vampirica': {
        const cura = Math.max(0, Math.min(heroi.maxHp - heroi.hp, Math.max(1, Math.round(dano * efeito.forca))));
        heroi = { ...heroi, hp: heroi.hp + cura };
        disparos.push({ runa: 'vampirica', valor: cura });
        break;
      }
    }
  }
  return { hero: heroi, monster: monstro, disparos };
}
