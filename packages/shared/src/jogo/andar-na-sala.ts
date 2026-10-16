/**
 * O andar solto dentro da sala, do lado de quem joga (decisão do usuário,
 * 2026-10-11: andar livre estilo Isaac, joystick no celular, igual no site
 * e no app). A regra — velocidade, parede, vão de porta, encostar no
 * conteúdo — é de `dungeon/room-walk.ts`, a mesma que o app usa em C#. Aqui
 * ficam só as duas pontas de quem joga:
 *
 * - o relógio: a tela desenha no ritmo do monitor, e a regra anda em passos
 *   fixos (`WALK_TICKS_PER_SECOND`). Cada quadro roda os passos que couberem
 *   no tempo que passou;
 * - a entrada: as teclas seguradas e o joystick viram um só vetor.
 *
 * Sem DOM e sem PixiJS: quem desenha no site é `desenho-da-sala.ts` (em
 * `apps/web/lib/jogo`), e quem decide o que uma porta ou um encostão faz é
 * a tela de exploração.
 */

import { DIR_VECTORS, type Direction } from '../dungeon/graph.js';
import { CONTENT_TILE, WALK_TICKS_PER_SECOND, roomLayout, stickInput, walkTick, type RoomLayout, type RoomObject, type Walker } from '../dungeon/room-walk.js';

/** Quanto tempo de tela vale um passo de simulação. */
export const MS_POR_PASSO = 1000 / WALK_TICKS_PER_SECOND;

/**
 * Teto de passos num quadro. A aba que volta do fundo (ou um quadro que
 * travou) não pode simular meio segundo de uma vez: o herói atravessaria a
 * sala num piscar. O atraso acima disso é jogado fora.
 */
export const MAX_PASSOS_POR_QUADRO = 6;

/** O id do conteúdo da sala (baú, monstro, loja…) na planta. */
export const ID_DO_CONTEUDO = 'conteudo';

export interface Vetor {
  x: number;
  y: number;
}

export const PARADO: Vetor = { x: 0, y: 0 };

/**
 * A planta da sala na regra da engine: portas e objetos. Com `true`, só o
 * conteúdo no centro; com a lista, o que vier (conteúdo e extras, ver
 * `objetosDaSala` em `extras.ts`).
 */
export function plantaDaSala(portas: Partial<Record<Direction, unknown>>, objetos: boolean | readonly RoomObject[]): RoomLayout {
  if (typeof objetos !== 'boolean') return roomLayout(portas, objetos);
  return roomLayout(portas, objetos ? [{ id: ID_DO_CONTEUDO, ...CONTENT_TILE }] : []);
}

/** Quantos passos cabem no tempo que passou, e o que sobra pro próximo quadro. */
export function passosDoQuadro(sobra: number, decorridoMs: number): { passos: number; sobra: number } {
  const total = sobra + Math.max(0, decorridoMs);
  const cabem = Math.floor(total / MS_POR_PASSO);
  if (cabem > MAX_PASSOS_POR_QUADRO) return { passos: MAX_PASSOS_POR_QUADRO, sobra: 0 };
  return { passos: cabem, sobra: total - cabem * MS_POR_PASSO };
}

/** As teclas seguradas como vetor: duas juntas são diagonal, opostas se anulam. */
export function vetorDasTeclas(teclas: Iterable<Direction>): Vetor {
  let x = 0;
  let y = 0;
  for (const direcao of teclas) {
    x += DIR_VECTORS[direcao].x;
    y += DIR_VECTORS[direcao].y;
  }
  return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
}

/** O joystick manda enquanto está sendo usado; parado, valem as teclas. */
export function entradaCombinada(teclas: Iterable<Direction>, joystick: Vetor): Vetor {
  return joystick.x !== 0 || joystick.y !== 0 ? joystick : vetorDasTeclas(teclas);
}

/**
 * Onde o herói está e em que encosta, junto da sala a que isso pertence.
 * Mora na tela de exploração, e não na cena: a cena desmonta quando uma
 * loja ou uma luta abre por cima, e quem fecha a loja tem que continuar no
 * balcão — não voltar pra porta por onde entrou.
 */
export interface PosicaoNaSala {
  sala: string | null;
  walker: Walker;
  tocando: string | null;
}

export interface QuadroDoAndar {
  walker: Walker;
  /** A porta atravessada neste quadro: o andar para nela, e é a vez da sala vizinha. */
  saida: Direction | null;
  /** O objeto em que o herói acabou de encostar (não estava encostado antes): o andar para nele. */
  encostou: string | null;
  /** Em que objeto ele está encostado no fim do quadro. */
  tocando: string | null;
  /** Saiu do lugar neste quadro — pro desenho balançar o boneco. */
  andou: boolean;
}

/**
 * Os passos de um quadro. Para no primeiro que atravessar uma porta ou
 * encostar num objeto novo: o que vem depois disso é a tela que decide
 * (trocar de sala, abrir o baú), e simular além dali seria andar por cima
 * da decisão.
 *
 * Encostar só conta na passagem de "não encostado" pra "encostado": quem
 * fecha a loja continua colado no balcão, e a loja não pode abrir de novo
 * até ele se afastar e voltar.
 */
export function andarNoQuadro(planta: RoomLayout, walker: Walker, entrada: Vetor, passos: number, tocandoAntes: string | null): QuadroDoAndar {
  const input = stickInput(entrada.x, entrada.y);
  let atual = walker;
  let tocando = tocandoAntes;
  let andou = false;
  for (let i = 0; i < passos; i++) {
    const passo = walkTick(planta, atual, input);
    if (passo.walker.x !== atual.x || passo.walker.y !== atual.y) andou = true;
    atual = passo.walker;
    if (passo.exit) return { walker: atual, saida: passo.exit, encostou: null, tocando: passo.touching, andou };
    const encostou = passo.touching !== null && passo.touching !== tocando ? passo.touching : null;
    tocando = passo.touching;
    if (encostou) return { walker: atual, saida: null, encostou, tocando, andou };
  }
  return { walker: atual, saida: null, encostou: null, tocando, andou };
}
