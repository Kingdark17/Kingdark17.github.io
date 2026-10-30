/**
 * Andar dentro de uma sala, solto, no estilo Binding of Isaac (decisão do
 * usuário, 2026-10-11: "parece mais um jogo de tabuleiro essa movimentação,
 * eu gostaria de algo mais natural"). Substitui o passo de quadradinho em
 * quadradinho do mapa 2D.
 *
 * O herói anda em qualquer direção, inclusive na diagonal, com a força do
 * joystick (ou das teclas). Encostado numa parede ele escorrega ao longo
 * dela; o conteúdo da sala é sólido e se contorna. As portas são os vãos no
 * meio de cada parede: atravessar um vão é a vez da sala vizinha, e encostar
 * no conteúdo (baú, NPC, loja…) é o que o aciona — quem decide o que isso
 * faz é o jogo, não esta regra.
 *
 * **Tudo em números inteiros.** Uma sala tem `ROOM_COLS × ROOM_ROWS`
 * quadrados de `TILE_UNITS` unidades, o herói anda um passo de simulação por
 * vez (`WALK_TICKS_PER_SECOND`), e o joystick chega como inteiro de
 * `-STICK_MAX` a `STICK_MAX`. Com inteiros, o TS do site e o C# do app dão o
 * mesmo resultado em qualquer máquina — nem o arredondamento muda. Quem
 * desenha converte unidade em pixel e o passo fixo em tempo de tela.
 *
 * A posição dentro da sala não vai pro save: é caminho até a porta.
 */

import { DIR_OPP, DIR_ORDER, DIR_VECTORS, type Direction } from './graph.js';

/**
 * 9 × 9 desde a sala da Floresta do Breno (2026-10-24: a arte veio em 9 × 9,
 * e o usuário decidiu que todas as masmorras passam a ter esse tamanho; até
 * então eram 9 × 7).
 */
export const ROOM_COLS = 9;
export const ROOM_ROWS = 9;

/** Unidades por quadrado. 960 divide por 2, 3, 4, 5, 6 e 8 — sobra espaço pra afinar velocidade e tamanho sem fração. */
export const TILE_UNITS = 960;

/** Passos de simulação por segundo. Quem desenha acumula o tempo da tela e roda quantos passos couberem. */
export const WALK_TICKS_PER_SECOND = 60;

/** Unidades por passo com o joystick no fim: 64 × 60 / 960 = 4 quadrados por segundo. */
export const HERO_SPEED = 64;

/** Meia largura da base do herói (o pé), que é o que bate na parede: 0,3 de quadrado. */
export const HERO_HALF = 288;

/** Quão perto do conteúdo conta como encostar nele. */
export const TOUCH_REACH = 48;

/** O joystick no fim, em cada eixo. */
export const STICK_MAX = 127;

/**
 * Até onde, de lado, o herói que empurra a parede ao lado de um vão é
 * levado pra dentro dele. Sem isso, entrar por uma porta de um quadrado com
 * o polegar exige mira de pixel.
 */
export const DOOR_ASSIST = 480;

/** O quadrado do conteúdo da sala (baú, monstro, loja…): o centro. */
export const CONTENT_TILE = { col: 4, row: 4 } as const;

/** O vão de cada porta: no meio de cada parede. A parede rachada dos extras fica no vão de uma porta que não existe. */
export const DOOR_TILE: Record<Direction, { col: number; row: number }> = {
  N: { col: 4, row: 0 },
  S: { col: 4, row: ROOM_ROWS - 1 },
  W: { col: 0, row: 4 },
  E: { col: ROOM_COLS - 1, row: 4 },
};

/**
 * Uma porta da sala: a casa do vão mais pra dentro, no meio dele (é onde a
 * parede rachada fica e por onde se chega), a largura do vão em casas e a
 * grossura da parede daquele lado. A sala de sempre tem vãos de 1 casa numa
 * parede de 1; a da Torre, de 3, e a parede de cima dela tem 2.
 */
export interface PortaDaSala {
  col: number;
  row: number;
  largura: number;
  fundo: number;
}

/**
 * O formato de uma sala: o tamanho, o meio (onde fica o conteúdo) e as
 * portas. Cada masmorra pode ter o seu (`geometriaDaSala`; a Torre do Breno
 * é 11 × 12); sem um, vale `GEOMETRIA_PADRAO`.
 */
export interface GeometriaDaSala {
  cols: number;
  rows: number;
  conteudo: { col: number; row: number };
  portas: Record<Direction, PortaDaSala>;
  /**
   * Onde ficam os extras, na ordem de `EXTRA_TILES` (os andares gravam as
   * casas da sala de sempre). Ausente, ficam onde foram gravados.
   */
  extras?: readonly { col: number; row: number }[];
}

/** A sala de sempre: 9 × 9, o conteúdo no meio e um vão de 1 casa no meio de cada parede. */
export const GEOMETRIA_PADRAO: GeometriaDaSala = {
  cols: ROOM_COLS,
  rows: ROOM_ROWS,
  conteudo: CONTENT_TILE,
  portas: {
    N: { col: 4, row: 0, largura: 1, fundo: 1 },
    S: { col: 4, row: ROOM_ROWS - 1, largura: 1, fundo: 1 },
    W: { col: 0, row: 4, largura: 1, fundo: 1 },
    E: { col: ROOM_COLS - 1, row: 4, largura: 1, fundo: 1 },
  },
};

/** É a sala de sempre? A planta dela não leva o tamanho nem as portas, como sempre foi. */
export function geometriaPadrao(geometria: GeometriaDaSala): boolean {
  if (geometria.cols !== ROOM_COLS || geometria.rows !== ROOM_ROWS) return false;
  return DIR_ORDER.every((lado) => {
    const porta = geometria.portas[lado];
    const padrao = GEOMETRIA_PADRAO.portas[lado];
    return porta.col === padrao.col && porta.row === padrao.row && porta.largura === 1 && porta.fundo === 1;
  });
}

/** As casas do vão da porta `lado`: a largura dela, em toda a grossura da parede. */
export function casasDoVao(geometria: GeometriaDaSala, lado: Direction): { col: number; row: number }[] {
  const porta = geometria.portas[lado];
  const meia = Math.trunc((porta.largura - 1) / 2);
  const casas: { col: number; row: number }[] = [];
  for (let k = -meia; k <= meia; k++) {
    for (let f = 0; f < porta.fundo; f++) {
      if (lado === 'N') casas.push({ col: porta.col + k, row: f });
      else if (lado === 'S') casas.push({ col: porta.col + k, row: geometria.rows - 1 - f });
      else if (lado === 'W') casas.push({ col: f, row: porta.row + k });
      else casas.push({ col: geometria.cols - 1 - f, row: porta.row + k });
    }
  }
  return casas;
}

/** Algo da sala que se aciona encostando. Ocupa um quadrado inteiro, sólido. */
export interface RoomObject {
  id: string;
  col: number;
  row: number;
}

export interface RoomLayout {
  /** As portas da sala, na ordem de `DIR_ORDER`. */
  doors: Direction[];
  /**
   * O tamanho, quando não é o da sala (`ROOM_COLS × ROOM_ROWS`): a cidade
   * desenhada é uma planta grande só (`city/mapa-da-cidade.ts`). Ausente nas
   * salas, que continuam como sempre foram.
   */
  cols?: number;
  rows?: number;
  /** As portas, quando não são as da sala de sempre (a Torre: vãos de 3, parede de cima de 2). */
  portas?: Record<Direction, PortaDaSala>;
  /** `[row][col]`: parede, ou quadrado ocupado por um objeto. */
  solid: boolean[][];
  objects: RoomObject[];
}

/** O herói na sala: a posição é o centro da base, em unidades. */
export interface Walker {
  x: number;
  y: number;
  /** Pra onde o desenho olha. Muda com a direção mais forte do joystick. */
  facing: Direction;
}

/** O joystick (ou as teclas): inteiros de `-STICK_MAX` a `STICK_MAX`. `y` positivo é pra baixo, como na tela. */
export interface WalkInput {
  x: number;
  y: number;
}

export interface WalkStep {
  walker: Walker;
  /** Atravessou o vão desta porta: é a vez da sala vizinha. */
  exit: Direction | null;
  /** O objeto em que o herói está encostado agora, se algum. */
  touching: string | null;
}

/**
 * A planta da sala: parede em volta, vão onde há porta e os objetos, cada
 * um tomando o seu quadrado. `walls` são as casas de dentro que a arte da
 * masmorra faz de parede (os cantos da Caverna, `paredesDaSala`), e
 * `geometria` o formato da sala (`geometriaDaSala`): a porta abre o vão
 * inteiro dela. Fora da sala de sempre, a planta leva o tamanho e as portas.
 */
export function roomLayout(
  doors: Partial<Record<Direction, unknown>>,
  objects: readonly RoomObject[],
  walls: readonly { col: number; row: number }[] = [],
  geometria: GeometriaDaSala = GEOMETRIA_PADRAO,
): RoomLayout {
  const { cols, rows } = geometria;
  const solid: boolean[][] = [];
  for (let row = 0; row < rows; row++) {
    const linha: boolean[] = [];
    for (let col = 0; col < cols; col++) linha.push(col === 0 || row === 0 || col === cols - 1 || row === rows - 1);
    solid.push(linha);
  }
  for (const parede of walls) (solid[parede.row] as boolean[])[parede.col] = true;
  const abertas: Direction[] = [];
  for (const direcao of DIR_ORDER) {
    if (!doors[direcao]) continue;
    abertas.push(direcao);
    for (const vao of casasDoVao(geometria, direcao)) (solid[vao.row] as boolean[])[vao.col] = false;
  }
  for (const objeto of objects) (solid[objeto.row] as boolean[])[objeto.col] = true;
  const planta: RoomLayout = { doors: abertas, solid, objects: objects.map((o) => ({ ...o })) };
  if (geometriaPadrao(geometria)) return planta;
  const portas = {} as Record<Direction, PortaDaSala>;
  for (const lado of DIR_ORDER) portas[lado] = { ...geometria.portas[lado] };
  return { ...planta, cols, rows, portas };
}

/**
 * Do joystick (de -1 a 1 em cada eixo, como os navegadores e a Unity dão)
 * pro inteiro da regra. Fora da faixa, encosta no limite.
 */
export function stickInput(x: number, y: number): WalkInput {
  const limitar = (v: number) => Math.trunc(Math.max(-1, Math.min(1, v)) * STICK_MAX);
  return { x: limitar(x), y: limitar(y) };
}

/**
 * Onde o herói aparece numa sala. Quem andou pro norte chega pelo vão do sul,
 * um quadrado pra dentro; sem direção (carregar o jogo, portão, escada,
 * totem), logo abaixo do centro, olhando pra baixo. `geometria`: o formato
 * da sala (o vão e o centro dela).
 */
export function roomArrival(movedTowards: Direction | null, geometria: GeometriaDaSala = GEOMETRIA_PADRAO): Walker {
  if (!movedTowards) return { x: centro(geometria.conteudo.col), y: centro(geometria.conteudo.row + 2), facing: 'S' };
  const vao = geometria.portas[DIR_OPP[movedTowards]];
  const vetor = DIR_VECTORS[movedTowards];
  return { x: centro(vao.col + vetor.x), y: centro(vao.row + vetor.y), facing: movedTowards };
}

/** Um passo de simulação. */
export function walkTick(layout: RoomLayout, walker: Walker, input: WalkInput): WalkStep {
  let ix = Math.trunc(input.x);
  let iy = Math.trunc(input.y);
  // Teclas na diagonal (ou joystick no canto) não andam mais rápido que reto.
  const quadrado = ix * ix + iy * iy;
  if (quadrado > STICK_MAX * STICK_MAX) {
    const comprimento = Math.sqrt(quadrado);
    ix = Math.trunc((ix * STICK_MAX) / comprimento);
    iy = Math.trunc((iy * STICK_MAX) / comprimento);
  }
  const dx = Math.trunc((ix * HERO_SPEED) / STICK_MAX);
  const dy = Math.trunc((iy * HERO_SPEED) / STICK_MAX);

  let x = walker.x;
  let y = walker.y;
  const emX = moverEmX(layout, x, y, dx);
  x = emX.pos;
  const emY = moverEmY(layout, x, y, dy);
  y = emY.pos;

  // Ajuda na porta: barrado indo pra uma parede que tem vão, perto dele,
  // escorrega de lado em direção ao vão.
  if (emY.barrado) x = ajudaNaPorta(layout, x, y, dy < 0 ? 'N' : 'S', 'x');
  if (emX.barrado) y = ajudaNaPorta(layout, x, y, dx < 0 ? 'W' : 'E', 'y');

  const facing = ix === 0 && iy === 0 ? walker.facing : Math.abs(ix) > Math.abs(iy) ? (ix > 0 ? 'E' : 'W') : iy > 0 ? 'S' : 'N';
  return { walker: { x, y, facing }, exit: saida(layout, x, y), touching: encostado(layout, x, y) };
}

// ---------- por dentro ----------

function centro(quadrado: number): number {
  return quadrado * TILE_UNITS + TILE_UNITS / 2;
}

/** Divisão inteira pra baixo, também com negativo (a base perto da borda de cima). */
function quadradoDe(unidades: number): number {
  return Math.floor(unidades / TILE_UNITS);
}

function colunas(layout: RoomLayout): number {
  return layout.cols ?? ROOM_COLS;
}

function linhas(layout: RoomLayout): number {
  return layout.rows ?? ROOM_ROWS;
}

function solido(layout: RoomLayout, col: number, row: number): boolean {
  if (row < 0 || row >= linhas(layout) || col < 0 || col >= colunas(layout)) return true;
  return (layout.solid[row] as boolean[])[col] as boolean;
}

/** A coluna inteira de quadrados que a base cobre, de `y - HERO_HALF` a `y + HERO_HALF - 1`, tem algo sólido? */
function colunaBarra(layout: RoomLayout, col: number, y: number): boolean {
  for (let row = quadradoDe(y - HERO_HALF); row <= quadradoDe(y + HERO_HALF - 1); row++) if (solido(layout, col, row)) return true;
  return false;
}

function linhaBarra(layout: RoomLayout, row: number, x: number): boolean {
  for (let col = quadradoDe(x - HERO_HALF); col <= quadradoDe(x + HERO_HALF - 1); col++) if (solido(layout, col, row)) return true;
  return false;
}

/**
 * Anda `dx` no eixo x e para encostado no que for sólido. Um passo nunca
 * passa de um quadrado (`HERO_SPEED < TILE_UNITS`), então só a coluna da
 * frente precisa ser olhada.
 */
function moverEmX(layout: RoomLayout, x: number, y: number, dx: number): { pos: number; barrado: boolean } {
  if (dx === 0) return { pos: x, barrado: false };
  const novo = x + dx;
  if (dx > 0) {
    const col = quadradoDe(novo + HERO_HALF - 1);
    return colunaBarra(layout, col, y) ? { pos: col * TILE_UNITS - HERO_HALF, barrado: true } : { pos: novo, barrado: false };
  }
  const col = quadradoDe(novo - HERO_HALF);
  return colunaBarra(layout, col, y) ? { pos: (col + 1) * TILE_UNITS + HERO_HALF, barrado: true } : { pos: novo, barrado: false };
}

function moverEmY(layout: RoomLayout, x: number, y: number, dy: number): { pos: number; barrado: boolean } {
  if (dy === 0) return { pos: y, barrado: false };
  const novo = y + dy;
  if (dy > 0) {
    const row = quadradoDe(novo + HERO_HALF - 1);
    return linhaBarra(layout, row, x) ? { pos: row * TILE_UNITS - HERO_HALF, barrado: true } : { pos: novo, barrado: false };
  }
  const row = quadradoDe(novo - HERO_HALF);
  return linhaBarra(layout, row, x) ? { pos: (row + 1) * TILE_UNITS + HERO_HALF, barrado: true } : { pos: novo, barrado: false };
}

/**
 * Quem empurra a parede `lado`, colado nela e a até `DOOR_ASSIST` do meio
 * do vão daquele lado, desliza no outro eixo em direção ao vão, no máximo
 * `HERO_SPEED` por passo e sem atravessar nada sólido. Devolve a coordenada
 * nova do eixo que desliza.
 */
function ajudaNaPorta(layout: RoomLayout, x: number, y: number, lado: Direction, eixo: 'x' | 'y'): number {
  const atual = eixo === 'x' ? x : y;
  if (!layout.doors.includes(lado)) return atual;
  const porta = layout.portas?.[lado] ?? GEOMETRIA_PADRAO.portas[lado];
  // Colado na parede: a base encosta no primeiro quadrado depois do chão (a parede tem `fundo` casas).
  const colado =
    lado === 'N' ? y - HERO_HALF === porta.fundo * TILE_UNITS
    : lado === 'S' ? y + HERO_HALF === (linhas(layout) - porta.fundo) * TILE_UNITS
    : lado === 'W' ? x - HERO_HALF === porta.fundo * TILE_UNITS
    : x + HERO_HALF === (colunas(layout) - porta.fundo) * TILE_UNITS;
  if (!colado) return atual;
  const meio = centro(eixo === 'x' ? porta.col : porta.row);
  const falta = meio - atual;
  // O vão largo puxa de mais longe: o alcance cresce meia casa por casa a mais de vão.
  const alcance = DOOR_ASSIST + ((porta.largura - 1) * TILE_UNITS) / 2;
  if (falta === 0 || Math.abs(falta) > alcance) return atual;
  const passo = Math.sign(falta) * Math.min(Math.abs(falta), HERO_SPEED);
  return eixo === 'x' ? moverEmX(layout, x, y, passo).pos : moverEmY(layout, x, y, passo).pos;
}

/** Passou da metade do vão de uma porta, pra fora: atravessou. */
function saida(layout: RoomLayout, x: number, y: number): Direction | null {
  const meio = TILE_UNITS / 2;
  for (const direcao of layout.doors) {
    if (direcao === 'N' && y < meio) return 'N';
    if (direcao === 'S' && y > linhas(layout) * TILE_UNITS - meio) return 'S';
    if (direcao === 'W' && x < meio) return 'W';
    if (direcao === 'E' && x > colunas(layout) * TILE_UNITS - meio) return 'E';
  }
  return null;
}

/** O primeiro objeto (na ordem da planta) a até `TOUCH_REACH` da base. */
function encostado(layout: RoomLayout, x: number, y: number): string | null {
  const esquerda = x - HERO_HALF - TOUCH_REACH;
  const direita = x + HERO_HALF + TOUCH_REACH;
  const topo = y - HERO_HALF - TOUCH_REACH;
  const base = y + HERO_HALF + TOUCH_REACH;
  for (const objeto of layout.objects) {
    const ox = objeto.col * TILE_UNITS;
    const oy = objeto.row * TILE_UNITS;
    if (esquerda < ox + TILE_UNITS && direita > ox && topo < oy + TILE_UNITS && base > oy) return objeto.id;
  }
  return null;
}
