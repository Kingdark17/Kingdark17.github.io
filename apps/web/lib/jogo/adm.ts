/**
 * Painel ADM — porta de `js/admin-panel.js`. Edita vida, mana, ouro,
 * nível, XP e atributos do personagem na hora, e tem o "modo infinito"
 * com o inventário completo.
 *
 * Só a conta administradora enxerga isto, e quem decide isso é o servidor
 * (`isAdmin` vem do `/api/account/me`). A tela não é a tranca: o save
 * ainda passa pelo `sanitize` do Nest, que é quem de fato limita o que
 * pode subir pra nuvem.
 *
 * **Divergência de propósito:** o original chamava `applyGodMode(true)`
 * sozinho toda vez que um admin entrava no jogo, e mandava pra nuvem em
 * seguida. Aqui o modo infinito só acontece no clique. Reescrever o save
 * de alguém sem pedir é o tipo de coisa que não dá pra desfazer.
 */

import {
  instantiate,
  RARITIES,
  recomputeDerived,
  TEMPLATES,
  xpForLevel,
  type AttrKey,
  type Hero,
  type Item,
  type Rng,
  defaultRng,
} from '@rpg-legend/shared';

import type { EstadoDoJogo } from './estado';

export interface Adm {
  estado: EstadoDoJogo;
  log: string[];
}

/** Os números do "modo infinito" do original. */
const INFINITO = { atributo: 999, hp: 999_999, mp: 999_999, ouro: 999_999_999 };

const CATEGORIAS_EQUIPAVEIS = ['arma', 'armadura', 'acessorio'];
const CONSUMIVEIS_POR_TIPO = 20;

/** Os campos editáveis, na ordem em que aparecem na tela. */
export interface FichaDoAdm {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  gold: number;
  level: number;
  xp: number;
  attrPoints: number;
  forca: number;
  destreza: number;
  constituicao: number;
  intelecto: number;
  sabedoria: number;
  carisma: number;
}

export const ATRIBUTOS_DA_FICHA: AttrKey[] = ['forca', 'destreza', 'constituicao', 'intelecto', 'sabedoria', 'carisma'];

export function abrirAdm(estado: EstadoDoJogo): Adm {
  return { estado, log: [] };
}

export function fichaDe(hero: Hero): FichaDoAdm {
  return {
    hp: hero.hp,
    maxHp: hero.maxHp,
    mp: hero.mp,
    maxMp: hero.maxMp,
    gold: hero.gold,
    level: hero.level,
    xp: hero.xp,
    attrPoints: hero.attrPoints ?? 0,
    forca: hero.attrs.forca,
    destreza: hero.attrs.destreza,
    constituicao: hero.attrs.constituicao,
    intelecto: hero.attrs.intelecto,
    sabedoria: hero.attrs.sabedoria,
    carisma: hero.attrs.carisma,
  };
}

/**
 * Aplica a ficha. Vida e mana máximas digitadas mandam por cima do
 * cálculo automático — é justamente pra isso que o painel existe —, então
 * o `recomputeDerived` roda antes e o valor digitado sobrescreve depois.
 */
export function aplicar(adm: Adm, ficha: FichaDoAdm): Adm {
  const base = adm.estado.hero;

  const comAtributos: Hero = {
    ...base,
    attrs: {
      forca: minimo(ficha.forca, 1),
      destreza: minimo(ficha.destreza, 1),
      constituicao: minimo(ficha.constituicao, 1),
      intelecto: minimo(ficha.intelecto, 1),
      sabedoria: minimo(ficha.sabedoria, 1),
      carisma: minimo(ficha.carisma, 1),
    },
    level: minimo(ficha.level, 1),
    xp: minimo(ficha.xp, 0),
    xpNext: xpForLevel(minimo(ficha.level, 1)),
    attrPoints: minimo(ficha.attrPoints, 0),
    gold: minimo(ficha.gold, 0),
  };

  const recalculado = recomputeDerived(comAtributos);
  const maxHp = minimo(ficha.maxHp, 1);
  const maxMp = minimo(ficha.maxMp, 0);

  const hero: Hero = {
    ...recalculado,
    maxHp,
    maxMp,
    hp: Math.min(maxHp, minimo(ficha.hp, 0)),
    mp: Math.min(maxMp, minimo(ficha.mp, 0)),
    derived: { ...recalculado.derived, maxHp, maxMp },
  };

  return { estado: { ...adm.estado, hero }, log: ['Alterações aplicadas. O jogo salva sozinho em seguida.'] };
}

/** Tudo no talo e uma cópia mítica de cada equipamento, mais consumíveis. */
export function modoInfinito(adm: Adm, rng: Rng = defaultRng): Adm {
  const cheio = aplicar(adm, {
    ...fichaDe(adm.estado.hero),
    hp: INFINITO.hp,
    maxHp: INFINITO.hp,
    mp: INFINITO.mp,
    maxMp: INFINITO.mp,
    gold: INFINITO.ouro,
    forca: INFINITO.atributo,
    destreza: INFINITO.atributo,
    constituicao: INFINITO.atributo,
    intelecto: INFINITO.atributo,
    sabedoria: INFINITO.atributo,
    carisma: INFINITO.atributo,
  });

  const inventory = comTudo(cheio.estado.inventory, rng);
  const quantos = inventory.length - cheio.estado.inventory.length;

  return {
    estado: { ...cheio.estado, inventory },
    log: [`Modo infinito ligado.${quantos > 0 ? ` ${quantos} item(ns) entraram na mochila.` : ''}`],
  };
}

/**
 * Idempotente, igual ao `grantEverything()` do original: só acrescenta o
 * que falta. Clicar duas vezes não enche a mochila de duplicata.
 */
function comTudo(inventory: readonly Item[], rng: Rng): Item[] {
  const melhorRaridade = RARITIES[RARITIES.length - 1]!;
  const comum = RARITIES[0]!;
  const acrescentados: Item[] = [];

  const miticosQueTem = new Set(inventory.filter((item) => item.rarity === melhorRaridade.id).map((item) => item.templateId));

  for (const template of TEMPLATES) {
    if (!CATEGORIAS_EQUIPAVEIS.includes(template.category) || miticosQueTem.has(template.id)) continue;
    acrescentados.push(instantiate(template, melhorRaridade, { rng }));
  }

  for (const template of TEMPLATES) {
    if (template.category !== 'consumivel') continue;
    let quantos = inventory.filter((item) => item.templateId === template.id).length;
    while (quantos < CONSUMIVEIS_POR_TIPO) {
      acrescentados.push(instantiate(template, comum, { rng }));
      quantos++;
    }
  }

  return acrescentados.length ? [...inventory, ...acrescentados] : (inventory as Item[]);
}

function minimo(valor: number, piso: number): number {
  return Number.isFinite(valor) ? Math.max(piso, Math.trunc(valor)) : piso;
}
