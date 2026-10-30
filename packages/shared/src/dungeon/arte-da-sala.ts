/**
 * A arte desenhada das salas da masmorra (2026-10-24: a Floresta do Breno,
 * no site e no app; 2026-10-25: a Caverna; 2026-10-30: a Torre). Como a
 * cidade, cada camada é um arquivo do tamanho da sala inteira, em casas de
 * 32 px, desenhada por cima da anterior: o chão, o que só aparece quando a
 * sala tem porta daquele lado (o caminho da Floresta, a passagem da Caverna,
 * o tapete da Torre) ou quando não tem (a parede que fecha o vão da Torre),
 * e o que passa por cima do herói.
 *
 * A Floresta e a Caverna têm 9 × 9 casas, a sala de sempre. A Torre veio com
 * 11 × 12, paredes mais grossas e portas de 3 casas, e o usuário decidiu
 * (2026-10-30) que só ela fica nesse formato: `GEOMETRIAS_DAS_SALAS`.
 *
 * A arte mora em `img/salas/<masmorra>/` no site e em
 * `Art/Jogo/Resources/Salas/<masmorra>` no app, com os nomes dele.
 */

import type { DungeonId } from './dungeons.js';
import type { Direction } from './graph.js';
import { GEOMETRIA_PADRAO, HERO_HALF, TILE_UNITS, type GeometriaDaSala, type Walker } from './room-walk.js';

/** Pixels da arte por casa da sala (a sala do Breno tem 288 × 288). */
export const PIXELS_DA_SALA = 32;

/**
 * Uma camada da sala e o plano dela: `chao` fica debaixo do herói e do que
 * está na sala; `cima`, por cima de tudo (as copas de baixo e das laterais,
 * que o herói só cruza por baixo).
 */
export interface CamadaDaSala {
  /** O nome do arquivo, sem a extensão. */
  arquivo: string;
  plano: 'chao' | 'cima';
  /** Só aparece quando a sala tem porta deste lado: o caminho até ela, ou a passagem. */
  porta?: Direction;
  /** Só aparece quando a sala NÃO tem porta deste lado: a parede que fecha o vão (a Torre). */
  semPorta?: Direction;
  /**
   * Só nas de `cima`: as casas em que a arte tem desenho bastante pra esconder o herói (`#`, mais da metade dos
   * pixels), uma linha por fileira, medidas pelo `scripts/cobertura-das-salas.ts`. É o que diz se a camada está
   * cobrindo o herói (`cobreOHeroiNaSala`). Arte nova → rodar o script e colar.
   */
  cobre?: readonly string[];
}

/** As camadas de cada masmorra que tem arte, na ordem em que se desenham. */
export const CAMADAS_DAS_SALAS: Partial<Record<DungeonId, readonly CamadaDaSala[]>> = {
  floresta: [
    { arquivo: '1_grama', plano: 'chao' },
    // O do norte redesenha os troncos de cima e as árvores dos lados por cima do caminho.
    { arquivo: '2_caminho_cima', plano: 'chao', porta: 'N' },
    { arquivo: '3_caminho_direita', plano: 'chao', porta: 'E' },
    { arquivo: '4_caminho_esquerda', plano: 'chao', porta: 'W' },
    { arquivo: '5_caminho_baixo', plano: 'chao', porta: 'S' },
    {
      arquivo: '6_floresta_cima',
      plano: 'cima',
      cobre: ['.........', '.........', '.........', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#########'],
    },
  ],
  caverna: [
    { arquivo: '1_caverna_chao', plano: 'chao' },
    // A parede de cima, com as tochas: fica atrás do herói.
    { arquivo: '2_caverna_atras', plano: 'chao' },
    { arquivo: '3_portal_acima', plano: 'chao', porta: 'N' },
    { arquivo: '4_portal_direita', plano: 'chao', porta: 'E' },
    { arquivo: '5_portal_esquerda', plano: 'chao', porta: 'W' },
    // Na ordem dele, debaixo da parede da frente: só o alto do arco aparece.
    { arquivo: '6_portal_baixo', plano: 'chao', porta: 'S' },
    {
      arquivo: '7_caverna_frente',
      plano: 'cima',
      cobre: ['.........', '.........', '.........', '.........', '.........', '#.......#', '#.......#', '###...###', '#########'],
    },
  ],
  // Os nomes são os dele, com o "direirta". Falta a camada 7 (a porta de baixo
  // fechada): a parede de baixo já é inteira, e o usuário mandou seguir sem ela.
  torre: [
    { arquivo: '1_fundo_torre', plano: 'chao' },
    { arquivo: '2_tapete_direirta', plano: 'chao', porta: 'E' },
    { arquivo: '3_tapete_cima', plano: 'chao', porta: 'N' },
    { arquivo: '4_tapete_baixo', plano: 'chao', porta: 'S' },
    { arquivo: '5_tapete_esquerda', plano: 'chao', porta: 'W' },
    { arquivo: '6_close_cima', plano: 'chao', semPorta: 'N' },
    {
      arquivo: '8_frente_torre',
      plano: 'cima',
      cobre: [
        '...........',
        '...........',
        '.#.......#.',
        '...........',
        '...........',
        '...........',
        '##.......##',
        '##.......##',
        '##.......##',
        '#.........#',
        '#..#...#..#',
        '###########',
      ],
    },
    // O arco do vão de cima, por cima de quem passa por ele.
    {
      arquivo: '9_portal_frente',
      plano: 'cima',
      porta: 'N',
      cobre: ['....#.#....', '...........', '...........', '...........', '...........', '...........', '...........', '...........', '...........', '...........', '...........', '...........'],
    },
    {
      arquivo: '10_close_esquerda',
      plano: 'cima',
      semPorta: 'W',
      cobre: ['...........', '...........', '...........', '#..........', '#..........', '#..........', '...........', '...........', '...........', '...........', '...........', '...........'],
    },
    {
      arquivo: '11_close_direita',
      plano: 'cima',
      semPorta: 'E',
      cobre: ['...........', '...........', '...........', '..........#', '..........#', '..........#', '...........', '...........', '...........', '...........', '...........', '...........'],
    },
  ],
};

/** Uma casa da sala. */
export interface CasaDaSala {
  col: number;
  row: number;
}

/**
 * As casas de dentro que a arte faz de parede, além da borda que toda sala
 * tem. A colisão do Breno da Caverna fecha os quatro cantos, que o desenho
 * arredonda.
 */
export const PAREDES_DAS_SALAS: Partial<Record<DungeonId, readonly CasaDaSala[]>> = {
  caverna: [
    { col: 1, row: 1 },
    { col: 7, row: 1 },
    { col: 1, row: 7 },
    { col: 7, row: 7 },
  ],
  // A parede de cima da Torre tem 2 casas (a linha 1 inteira; a porta de cima
  // abre o vão nela), e os pilares: dois junto da parede de cima e quatro dos
  // lados.
  torre: [
    { col: 1, row: 1 },
    { col: 2, row: 1 },
    { col: 3, row: 1 },
    { col: 4, row: 1 },
    { col: 5, row: 1 },
    { col: 6, row: 1 },
    { col: 7, row: 1 },
    { col: 8, row: 1 },
    { col: 9, row: 1 },
    { col: 3, row: 2 },
    { col: 7, row: 2 },
    { col: 1, row: 4 },
    { col: 9, row: 4 },
    { col: 1, row: 8 },
    { col: 9, row: 8 },
  ],
};

/**
 * O formato da sala de cada masmorra que não é a de sempre (`GEOMETRIA_PADRAO`).
 * A Torre, pela colisão do Breno: 11 × 12, o pentagrama no meio, vãos de 3
 * casas (o de cima numa parede de 2), e os extras onde o chão está livre.
 */
export const GEOMETRIAS_DAS_SALAS: Partial<Record<DungeonId, GeometriaDaSala>> = {
  torre: {
    cols: 11,
    rows: 12,
    conteudo: { col: 5, row: 6 },
    portas: {
      N: { col: 5, row: 1, largura: 3, fundo: 2 },
      S: { col: 5, row: 11, largura: 3, fundo: 1 },
      W: { col: 0, row: 6, largura: 3, fundo: 1 },
      E: { col: 10, row: 6, largura: 3, fundo: 1 },
    },
    extras: [
      { col: 2, row: 2 },
      { col: 2, row: 3 },
      { col: 8, row: 3 },
      { col: 8, row: 2 },
      { col: 1, row: 10 },
      { col: 2, row: 10 },
      { col: 8, row: 10 },
      { col: 9, row: 10 },
    ],
  },
};

/** O formato das salas desta masmorra: o dela, ou o de sempre. */
export function geometriaDaSala(dungeon: DungeonId | null): GeometriaDaSala {
  return (dungeon ? GEOMETRIAS_DAS_SALAS[dungeon] : undefined) ?? GEOMETRIA_PADRAO;
}

/**
 * O que desenhar numa sala da masmorra com estas portas: as camadas da
 * arte dela, sem os caminhos das portas que a sala não tem e sem as paredes
 * que fecham os vãos das que tem. `null` quando a masmorra ainda não tem
 * arte (quem desenha usa os quadradinhos).
 */
export function camadasDaSala(dungeon: DungeonId, portas: readonly Direction[]): CamadaDaSala[] | null {
  const camadas = CAMADAS_DAS_SALAS[dungeon];
  if (!camadas) return null;
  return camadas
    .filter((camada) => (!camada.porta || portas.includes(camada.porta)) && (!camada.semPorta || !portas.includes(camada.semPorta)))
    .map((camada) => ({ ...camada }));
}

/**
 * O corpo do herói desenhado na sala, em unidades, a partir do pé: o boneco tem 1,25 casa de altura no site e no app
 * (`LADO * 1.25`, 1200 unidades), e o corpo, como na cidade, vai de 2/60 a 54/60 dela acima do pé, com 13/60 pra
 * cada lado.
 */
const CORPO_NA_SALA = { meiaLargura: 260, de: 40, ate: 1080 };

/**
 * Se a camada de cima está por cima do desenho do herói: aí ela fica meio transparente, como as construções da cidade
 * (decisão do usuário, 2026-10-30), pra ele não sumir debaixo das copas da Floresta ao cruzar uma porta, atrás da
 * parede da frente da Caverna ou dos pilares da Torre. `walker` contado do canto desta sala; o da sala vizinha, na
 * masmorra emendada, fica além da borda dela.
 */
export function cobreOHeroiNaSala(camada: CamadaDaSala, walker: Pick<Walker, 'x' | 'y'>): boolean {
  if (camada.plano !== 'cima' || !camada.cobre) return false;
  const esquerda = walker.x - CORPO_NA_SALA.meiaLargura;
  const direita = walker.x + CORPO_NA_SALA.meiaLargura;
  const pe = walker.y + HERO_HALF;
  const topo = pe - CORPO_NA_SALA.ate;
  const baixo = pe - CORPO_NA_SALA.de;
  return camada.cobre.some((linha, row) =>
    [...linha].some(
      (casa, col) =>
        casa === '#' && col * TILE_UNITS < direita && (col + 1) * TILE_UNITS > esquerda && row * TILE_UNITS < baixo && (row + 1) * TILE_UNITS > topo,
    ),
  );
}

/**
 * As casas onde a arte põe um enfeite na parede: as tochas da Caverna, duas
 * em cima e duas logo acima da parede da frente. Dá pra andar nelas, mas um
 * extra ali fica na frente do enfeite, e então ele anda rumo ao meio da sala,
 * como o do canto (decisão do usuário, 2026-10-26).
 */
export const ENFEITES_DAS_SALAS: Partial<Record<DungeonId, readonly CasaDaSala[]>> = {
  caverna: [
    { col: 2, row: 1 },
    { col: 6, row: 1 },
    { col: 2, row: 6 },
    { col: 6, row: 6 },
  ],
};

/** As casas de enfeite das salas desta masmorra (nenhuma fora dela, ou quando a arte não tem). */
export function enfeitesDaSala(dungeon: DungeonId | null): CasaDaSala[] {
  if (!dungeon) return [];
  return (ENFEITES_DAS_SALAS[dungeon] ?? []).map((casa) => ({ ...casa }));
}

/** As casas de dentro que são parede nas salas desta masmorra (nenhuma fora dela, ou quando a arte não fecha nada). */
export function paredesDaSala(dungeon: DungeonId | null): CasaDaSala[] {
  if (!dungeon) return [];
  return (PAREDES_DAS_SALAS[dungeon] ?? []).map((casa) => ({ ...casa }));
}
