/**
 * A cidade desenhada pelo Breno (2026-10-23): um mapa só, de 30 × 25 casas,
 * no lugar das salas da cidade (decisão do usuário: no site e no app). O
 * herói anda solto nele com a regra de sempre (`dungeon/room-walk.ts`, numa
 * planta do tamanho do mapa), e cada porta leva à sala da cidade que já
 * existia: a grade de `city.ts` continua no save, intacta, e entrar por uma
 * porta é ir pra sala dela e acioná-la (`jogo/cidade.ts`). Assim o save, o
 * co-op e quem joga com um personagem de antes não mudam.
 *
 * A arte mora em `img/cidade/` no site e em `Art/Jogo/Resources/Cidade` no
 * app, uma camada por arquivo, com os nomes dele.
 *
 * Decisões do usuário (2026-10-23):
 * - a Encantadora atende na igreja, e o Bram (o ferreiro que troca) dentro
 *   do ferreiro; a Erma, na cabana da vidente;
 * - as três masmorras têm entrada própria: a Floresta pelo caminho do sul,
 *   a Caverna pela caverna do norte, a Torre pela estrada do leste;
 * - os troncos no caminho da caverna barram quem não zerou a Floresta;
 * - a porta do ferreiro fica onde o desenho mostra (a colisão não a marca);
 * - o verde perto da caveira é um evento que ainda não existe, e o da frente
 *   da guilda é um poço dos desejos, ainda sem nada: o primeiro é chão; o
 *   segundo, sólido e sem ação.
 */

import { DIR_VECTORS, type Direction } from '../dungeon/graph.js';
import { TILE_UNITS, type RoomLayout, type RoomObject, type Walker } from '../dungeon/room-walk.js';
import type { CityCell } from './city.js';

export const CIDADE_COLS = 30;
export const CIDADE_ROWS = 25;

/**
 * A planta, casa por casa: `.` se pisa, `#` não. Saiu da colisão do Breno
 * com `scripts/planta-da-cidade.mjs`, que diz como (o desenho marca a borda,
 * e chão é o que se alcança a partir da praça). As casas dos pontos ficam
 * sólidas pelos próprios pontos; os troncos são chão aqui, e só barram
 * enquanto estão lá.
 */
export const PLANTA_DA_CIDADE: readonly string[] = [
  '##############################',
  '#########.####################',
  '########.....#..########.#####',
  '#########....#..########.#####',
  '##########.....########..#####',
  '###########...#########..#####',
  '##########.....########..#####',
  '#########...........####.#####',
  '#######..............##..#####',
  '######............##......####',
  '######.##.................####',
  '######.##...#...###.......####',
  '##..........#..............###',
  '##...##......................#',
  '###..##............###.......#',
  '##....#####....###...........#',
  '###...#####.....##...........#',
  '##........................####',
  '##....#..................#####',
  '##...##.................######',
  '######..####...........#######',
  '###.....###...........########',
  '#######.####.......###########',
  '###########...################',
  '##############################',
];

/** O que se aciona encostando. A Floresta, a Caverna e a Torre são as entradas de cada masmorra, com o id dela. */
export type PontoDaCidade =
  | 'taverna'
  | 'loja'
  | 'ferreiro'
  | 'arvore'
  | 'igreja'
  | 'guilda'
  | 'poco'
  | 'quadro'
  | 'vidente'
  | 'floresta'
  | 'caverna'
  | 'torre'
  | 'troncos';

/**
 * As casas de cada ponto, na colisão do Breno (verde e roxo), fora a porta
 * do ferreiro, que vem do desenho. Cada casa é sólida, e encostar nela aciona
 * o ponto.
 */
export const PONTOS_DA_CIDADE: readonly RoomObject[] = [
  { id: 'taverna', col: 2, row: 11 },
  { id: 'taverna', col: 3, row: 11 },
  { id: 'loja', col: 7, row: 11 },
  { id: 'loja', col: 8, row: 11 },
  { id: 'arvore', col: 12, row: 11 },
  { id: 'arvore', col: 12, row: 12 },
  { id: 'ferreiro', col: 16, row: 11 },
  { id: 'quadro', col: 19, row: 14 },
  { id: 'quadro', col: 20, row: 14 },
  { id: 'quadro', col: 21, row: 14 },
  { id: 'guilda', col: 15, row: 15 },
  { id: 'poco', col: 16, row: 16 },
  { id: 'poco', col: 17, row: 16 },
  { id: 'igreja', col: 8, row: 16 },
  { id: 'igreja', col: 9, row: 16 },
  { id: 'vidente', col: 10, row: 21 },
  { id: 'floresta', col: 12, row: 24 },
  { id: 'caverna', col: 12, row: 1 },
  { id: 'torre', col: 29, row: 13 },
  { id: 'torre', col: 29, row: 14 },
  { id: 'torre', col: 29, row: 15 },
  { id: 'troncos', col: 11, row: 5 },
  { id: 'troncos', col: 12, row: 5 },
  { id: 'troncos', col: 13, row: 5 },
  { id: 'troncos', col: 11, row: 6 },
  { id: 'troncos', col: 12, row: 6 },
  { id: 'troncos', col: 13, row: 6 },
];

/** Pixels da arte por casa: o mapa do Breno tem 960 × 800, 32 por casa. */
export const PIXELS_POR_CASA = 32;

/**
 * Uma camada da arte do Breno, e em que plano ela vai. `chao` fica debaixo
 * de tudo; `cima`, por cima de tudo (as árvores da borda e a grade das
 * pontes, que o herói só cruza por baixo); `meio` se ordena com o herói pelo
 * pé: ele passa na frente quando o pé dele está abaixo do topo da linha
 * `base` — a primeira linha de casas diante da porta —, e por trás quando
 * está acima.
 */
export interface CamadaDaCidade {
  /** O nome do arquivo, sem a extensão (o `loja_poção` dele vira `loja_pocao`). */
  arquivo: string;
  plano: 'chao' | 'meio' | 'cima';
  base: number;
  /** Só aparece enquanto os troncos fecham o caminho da caverna. */
  soComTroncos?: boolean;
}

/** As camadas, na ordem em que se desenham dentro de cada plano. */
export const CAMADAS_DA_CIDADE: readonly CamadaDaCidade[] = [
  { arquivo: '1_chao', plano: 'chao', base: 0 },
  { arquivo: 'bloqueio_masmorra', plano: 'meio', base: 7, soComTroncos: true },
  { arquivo: 'taverna', plano: 'meio', base: 12 },
  { arquivo: 'loja_pocao', plano: 'meio', base: 12 },
  { arquivo: 'ferreiro', plano: 'meio', base: 12 },
  { arquivo: '3_arvore_central', plano: 'meio', base: 13 },
  { arquivo: 'avisos_guilda', plano: 'meio', base: 15 },
  { arquivo: 'igreja', plano: 'meio', base: 17 },
  { arquivo: 'guilda', plano: 'meio', base: 17 },
  { arquivo: 'cabana_vidente', plano: 'meio', base: 22 },
  { arquivo: '2_arvores_masmorra', plano: 'cima', base: 0 },
  { arquivo: '4_ponte_lateral', plano: 'cima', base: 0 },
];

/** De que lado da porta o herói aparece, na ordem em que se procura: na frente (sul) primeiro. */
const LADOS_DA_CHEGADA: readonly Direction[] = ['S', 'W', 'E', 'N'];

/**
 * A planta da cidade na regra do andar. `troncosNoCaminho`: a Floresta ainda
 * não foi zerada, e os troncos fecham o caminho da caverna.
 */
export function plantaDaCidade(troncosNoCaminho: boolean): RoomLayout {
  const solid = PLANTA_DA_CIDADE.map((linha) => [...linha].map((casa) => casa === '#'));
  const objects = PONTOS_DA_CIDADE.filter((ponto) => troncosNoCaminho || ponto.id !== 'troncos').map((ponto) => ({ ...ponto }));
  for (const ponto of objects) (solid[ponto.row] as boolean[])[ponto.col] = true;
  return { doors: [], cols: CIDADE_COLS, rows: CIDADE_ROWS, solid, objects };
}

function pisa(col: number, row: number): boolean {
  return PLANTA_DA_CIDADE[row]?.[col] === '.';
}

/**
 * Onde o herói aparece diante de um ponto: na casa de chão ao lado dele, do
 * primeiro lado que tiver chão (sul, oeste, leste, norte), olhando pra longe
 * da porta. Ponto de mais de uma casa põe o herói no meio delas. Fica a meia
 * casa da porta, sem encostar: quem fecha a loja não a reabre ao aparecer.
 */
export function chegadaNoPonto(ponto: PontoDaCidade): Walker {
  const casas = PONTOS_DA_CIDADE.filter((p) => p.id === ponto);
  for (const lado of LADOS_DA_CHEGADA) {
    const vetor = DIR_VECTORS[lado];
    const livres = casas.filter((casa) => pisa(casa.col + vetor.x, casa.row + vetor.y));
    if (livres.length === 0) continue;
    const soma = livres.reduce((s, casa) => ({ col: s.col + casa.col + vetor.x, row: s.row + casa.row + vetor.y }), { col: 0, row: 0 });
    return {
      x: Math.round(((soma.col / livres.length) + 0.5) * TILE_UNITS),
      y: Math.round(((soma.row / livres.length) + 0.5) * TILE_UNITS),
      facing: lado,
    };
  }
  throw new Error(`ponto da cidade sem chão em volta: ${ponto}`);
}

/**
 * O ponto que corresponde a uma sala da cidade: onde quem carrega o jogo
 * nela aparece. O portão não está aqui — ele tem três entradas, e qual
 * depende da masmorra (`jogo/cidade.ts`). A sala de partida, a pracinha e o
 * que mais sobrar dão na árvore da praça.
 */
export function pontoDaSala(celula: Pick<CityCell, 'type' | 'npc'>): PontoDaCidade {
  switch (celula.type) {
    case 'tavern':
      return 'taverna';
    case 'shop':
      return 'loja';
    case 'blacksmith':
      return 'ferreiro';
    case 'encantadora':
      return 'igreja';
    case 'guild':
      return 'guilda';
    case 'questboard':
      return 'quadro';
    case 'npc':
      // A Erma atende na cabana; o Bram, dentro do ferreiro.
      if (celula.npc?.service === 'blessing') return 'vidente';
      if (celula.npc?.service === 'barter') return 'ferreiro';
      return 'arvore';
    default:
      return 'arvore';
  }
}
