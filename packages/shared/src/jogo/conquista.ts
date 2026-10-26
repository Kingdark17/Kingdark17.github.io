/**
 * O que se ganha ao zerar uma masmorra numa dificuldade — vencer o chefe
 * final do andar 100 (`chefe-final.ts`). O Breno reclamou que zerar a
 * Floresta "n teve nem mensagem especial", e o usuário decidiu (2026-10-25):
 * uma tela de vitória com prêmio, e o prêmio são as três coisas:
 *
 * - **o baú do chefe**: uma peça de equipar lendária garantida (arma,
 *   armadura ou acessório), da força do andar, e muito ouro, a cada vez que
 *   se zera;
 * - **um título no cartão de guilda**, o da maior conquista. Sai do que o
 *   save já guarda (`progresso.cleared`): não há campo novo;
 * - o item único de cada masmorra, que ainda vai ser desenhado (e o Breno
 *   faz a arte). Não está aqui.
 *
 * O ouro respeita o teto da API (+5000 por gravação, `isValidTransition`):
 * no fim da Torre no Pesadelo, o chefe paga 2066 e o baú 1993.
 */

import { DIFFICULTIES, DUNGEONS, dungeonById, tierOf, type DifficultyId, type DungeonProgress, type DungeonRun } from '../dungeon/dungeons.js';
import { addItem } from '../inventory/inventory.js';
import { randomItem, type Item } from '../items/item.js';
import { EQUIPPABLE_CATEGORIES } from '../items/templates.js';
import { defaultRng, pick, type Rng } from '../rng.js';
import { andarDeForca, type EstadoNaMasmorra } from './estado.js';

/** A primeira palavra do título, pela dificuldade: palavras que servem pra qualquer herói. */
export const TITULOS: Readonly<Record<DifficultyId, string>> = {
  normal: 'Sobrevivente',
  dificil: 'Terror',
  pesadelo: 'Lenda',
};

/** A raridade do item do baú do chefe. */
export const RARIDADE_DO_BAU = 'lendario';

/** O ouro do baú: uma base e um tanto por andar de força. */
export const OURO_DO_BAU = { base: 1000, porAndar: 3 } as const;

/** "Sobrevivente da Floresta", "Lenda da Torre". */
export function tituloDe(run: DungeonRun): string {
  return `${TITULOS[run.difficulty] ?? TITULOS.normal} da ${dungeonById(run.dungeon)?.name ?? run.dungeon}`;
}

/**
 * O título que o cartão mostra: o da conquista mais difícil (o degrau de
 * força mais alto; no empate, a masmorra mais adiante). `null` pra quem
 * ainda não zerou nada.
 */
export function tituloDoHeroi(progresso: DungeonProgress): string | null {
  let melhor: DungeonRun | null = null;
  for (const masmorra of DUNGEONS) {
    for (const dificuldade of DIFFICULTIES) {
      const run: DungeonRun = { dungeon: masmorra.id, difficulty: dificuldade.id };
      if (!progresso.cleared.includes(`${run.dungeon}:${run.difficulty}`)) continue;
      if (!melhor || tierOf(run) >= tierOf(melhor)) melhor = run;
    }
  }
  return melhor ? tituloDe(melhor) : null;
}

export function ouroDoBau(andarDeForca: number): number {
  return OURO_DO_BAU.base + OURO_DO_BAU.porAndar * andarDeForca;
}

/** A vitória que a tela mostra: o que foi zerado e o que se ganhou. */
export interface Conquista {
  masmorra: DungeonRun;
  /** "Floresta · Normal". */
  nome: string;
  /** O chefe vencido. */
  chefe: string;
  /** O item do baú do chefe. */
  item: Item;
  ouro: number;
  titulo: string;
  /** O que abriu no portão (a dificuldade seguinte, a próxima masmorra). */
  abertos: string[];
}

/**
 * Abre o baú do chefe: a peça lendária (a categoria sorteada antes, pra não
 * cair material nem poção; da força do andar, com material no app) vai pra
 * mochila, e o ouro pro herói.
 */
export function abrirBauDoChefe(estado: EstadoNaMasmorra, rng: Rng = defaultRng, now?: () => number, app = false): { estado: EstadoNaMasmorra; item: Item; ouro: number } {
  const forca = andarDeForca(estado);
  const category = pick(EQUIPPABLE_CATEGORIES, rng);
  const item = randomItem({ category, rarity: RARIDADE_DO_BAU, floor: forca, rng, ...(now ? { now } : {}), ...(app ? { app, chefe: true } : {}) });
  const ouro = ouroDoBau(forca);
  return { estado: { ...estado, hero: { ...estado.hero, gold: estado.hero.gold + ouro }, inventory: addItem(estado.inventory, item) }, item, ouro };
}
