/**
 * Os extras das salas (decisão do usuário, 2026-10-11: com o andar solto, as
 * salas ficaram "muito vazias"). Cada sala continua sendo do tipo dela
 * (monstros, NPC, loja…) e ganha 1 ou 2 extras nos cantos: um baú pequeno,
 * um vaso ou uma placa. E às vezes, no máximo uma por andar, uma parede
 * rachada que se abre pra uma sala secreta fora do mapa.
 *
 * Os prêmios são pequenos de propósito, pra explorar valer a pena sem
 * encher o jogo de item: o baú pequeno dá ouro ou uma poção, menos que o baú
 * da sala de tesouro; o vaso, de 1 a 5 moedas. O item bom fica na sala
 * secreta: um equipamento um degrau de raridade acima do normal do andar. A
 * placa dá uma dica do andar. Na sala de monstro, nada se pega antes de
 * vencer — quem decide isso é o jogo, ao encostar.
 *
 * O que muda de estado (baú aberto, vaso quebrado, parede aberta, baú da
 * secreta pego) vai na célula e, com ela, no save.
 */

import { randomItem, instantiate, type Item } from '../items/item.js';
import { RARITIES, pickRarity, type Rarity } from '../items/rarity.js';
import { EQUIPPABLE_CATEGORIES, templateById } from '../items/templates.js';
import { speciesById } from '../monsters/species.js';
import { pick, randomInt, type Rng } from '../rng.js';
import type { DungeonCell } from './generate.js';
import { DIR_ORDER, type Direction } from './graph.js';
import { DOOR_TILE } from './room-walk.js';

export type DungeonExtraKind = 'chest' | 'pot' | 'sign' | 'crack';

export interface DungeonExtra {
  kind: DungeonExtraKind;
  /** O quadrado do extra na sala (`room-walk.ts`). A parede rachada fica na parede, no vão de uma porta que não existe. */
  col: number;
  row: number;
  /** Baú pequeno: a poção que ele guarda; `null`, dá ouro ao abrir. */
  item?: Item | null;
  /** Baú aberto, vaso quebrado, parede aberta. */
  used?: boolean;
  /** Parede rachada: de que lado da sala ela fica. */
  side?: Direction;
  /** Parede rachada: o equipamento do baú da sala secreta. */
  secretItem?: Item;
  /** Parede rachada: o baú da sala secreta já foi aberto. */
  secretCollected?: boolean;
}

/**
 * Os cantos onde os extras ficam: fora da cruz do meio da sala (a coluna do
 * vão norte/sul e a linha do vão leste/oeste), que é o caminho entre as
 * portas e até o conteúdo. Nenhum fecha passagem nem fica onde o herói
 * chega.
 */
export const EXTRA_TILES = [
  { col: 1, row: 1 },
  { col: 2, row: 1 },
  { col: 6, row: 1 },
  { col: 7, row: 1 },
  { col: 1, row: 5 },
  { col: 2, row: 5 },
  { col: 6, row: 5 },
  { col: 7, row: 5 },
] as const;

/** Chance de o andar ter uma parede rachada (no máximo uma). */
export const CRACK_CHANCE = 0.4;

/** Chance do baú pequeno ser baú (o resto do sorteio é vaso; a placa é a sobra de cima). */
export const EXTRA_CHEST_CHANCE = 0.4;
export const EXTRA_POT_CHANCE = 0.4;

/** As poções que o baú pequeno pode guardar. */
export const EXTRA_POTIONS = ['pot_vida', 'pot_mana'] as const;

/**
 * Põe os extras nas salas de um andar já povoado. Roda por último na
 * geração: o resto do andar sai igual ao de antes pra mesma semente.
 * `floor` é o andar **de força** (o que decide ouro e item).
 */
export function placeExtras(rooms: DungeonCell[], floor: number, rng: Rng, now?: () => number, app = false): void {
  for (const cell of rooms) {
    const livres: { col: number; row: number }[] = EXTRA_TILES.map((t) => ({ col: t.col, row: t.row }));
    const quantos = rng() < 0.5 ? 1 : 2;
    const extras: DungeonExtra[] = [];
    for (let i = 0; i < quantos; i++) {
      const lugar = livres.splice(randomInt(livres.length, rng), 1)[0] as { col: number; row: number };
      const sorteio = rng();
      if (sorteio < EXTRA_CHEST_CHANCE) {
        extras.push({ kind: 'chest', ...lugar, item: rng() < 0.5 ? smallPotion(rng, now) : null, used: false });
      } else if (sorteio < EXTRA_CHEST_CHANCE + EXTRA_POT_CHANCE) {
        extras.push({ kind: 'pot', ...lugar, used: false });
      } else {
        extras.push({ kind: 'sign', ...lugar });
      }
    }
    cell.extras = extras;
  }

  if (rng() >= CRACK_CHANCE) return;
  const candidatas = rooms.filter((cell) => DIR_ORDER.some((d) => !cell.doors?.[d]));
  if (candidatas.length === 0) return;
  const cell = pick(candidatas, rng);
  const side = pick(
    DIR_ORDER.filter((d) => !cell.doors?.[d]),
    rng,
  );
  const vao = DOOR_TILE[side];
  (cell.extras ??= []).push({ kind: 'crack', col: vao.col, row: vao.row, side, used: false, secretItem: secretItem(floor, rng, now, app), secretCollected: false });
}

/** A poção do baú pequeno: vida ou mana, comum. */
function smallPotion(rng: Rng, now?: () => number): Item {
  const template = templateById(pick(EXTRA_POTIONS, rng));
  if (!template) throw new Error('poção do baú pequeno sumiu do catálogo');
  return instantiate(template, RARITIES[0] as Rarity, now ? { rng, now } : { rng });
}

/** O item da sala secreta: um equipamento um degrau acima da raridade que o andar sortearia. */
function secretItem(floor: number, rng: Rng, now?: () => number, app = false): Item {
  const normal = pickRarity(floor, rng);
  const acima = RARITIES[Math.min(RARITIES.indexOf(normal) + 1, RARITIES.length - 1)] as Rarity;
  return randomItem({ category: pick(EQUIPPABLE_CATEGORIES, rng), rarity: acima.id, floor, rng, now, app });
}

/** O ouro do baú pequeno, sorteado ao abrir: menos que o baú da sala de tesouro (8 a 25, mais 2 por andar). */
export function extraChestGold(floor: number, rng: Rng): number {
  return 3 + randomInt(8, rng) + floor;
}

/** As moedas de um vaso quebrado: de 1 a 5. */
export function potCoins(rng: Rng): number {
  return 1 + randomInt(5, rng);
}

/**
 * O que a placa diz: uma dica do andar, sempre a mesma pra mesma placa (sem
 * sorteio, então nada a guardar no save). As dicas possíveis são pra que
 * lado fica a escada, onde há parede oca e o que o guardião do andar teme;
 * qual delas cada placa dá sai da posição da sala.
 */
export function signHint(grid: DungeonCell[][], cell: DungeonCell): string {
  const salas = grid.flat();
  const dicas: string[] = [];

  const escada = salas.find((c) => c.type === 'stairs');
  if (escada && escada !== cell) dicas.push(`Uma seta riscada na madeira aponta o caminho: a escada fica ${rumo(cell, escada)}.`);

  const oca = salas.find((c) => c.extras?.some((e) => e.kind === 'crack' && !e.used));
  if (oca) {
    dicas.push(oca === cell ? 'Alguém escreveu, com pressa: "uma parede desta sala soa oca".' : `Alguém escreveu, com pressa: "há uma parede oca neste andar, ${rumo(cell, oca)}".`);
  }

  const chefe = salas.find((c) => c.type === 'boss' && !c.beaten);
  const fraqueza = chefe?.monsters?.[0] ? speciesById(chefe.monsters[0].speciesId)?.weakness : undefined;
  if (fraqueza === 'magico') dicas.push('Um aviso gasto: "o guardião deste andar teme a magia".');
  if (fraqueza === 'fisico') dicas.push('Um aviso gasto: "o guardião deste andar teme o aço".');

  if (dicas.length === 0) return 'A placa está gasta demais para ler.';
  // 5 e 7 são primos com 2 e com 3: com duas ou três dicas, placas vizinhas
  // em qualquer eixo dão dicas diferentes (com `y * 3`, três dicas davam a
  // mesma pra coluna inteira).
  return dicas[(cell.x * 5 + cell.y * 7) % dicas.length] as string;
}

/** Pra que lado fica `para`, visto de `de`: o rumo da grade, com as diagonais. */
function rumo(de: { x: number; y: number }, para: { x: number; y: number }): string {
  const dx = para.x - de.x;
  const dy = para.y - de.y;
  const vertical = dy < 0 ? 'norte' : 'sul';
  const horizontal = dx > 0 ? 'leste' : 'oeste';
  if (Math.abs(dx) >= 2 * Math.abs(dy)) return horizontal === 'leste' ? 'a leste' : 'a oeste';
  if (Math.abs(dy) >= 2 * Math.abs(dx)) return `ao ${vertical}`;
  return `a ${vertical === 'norte' ? 'nor' : 'su'}${horizontal === 'leste' ? 'deste' : 'doeste'}`;
}
