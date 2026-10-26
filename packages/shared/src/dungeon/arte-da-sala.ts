/**
 * A arte desenhada das salas da masmorra (2026-10-24: a Floresta do Breno,
 * no site e no app; 2026-10-25: a Caverna). Como a cidade, cada camada é um
 * arquivo do tamanho da sala inteira — 9 × 9 casas de 32 px —, desenhada
 * por cima da anterior: o chão, o que só aparece quando a sala tem porta
 * daquele lado (o caminho da Floresta, a passagem da Caverna), e o que passa
 * por cima do herói. A masmorra sem arte continua com os quadradinhos
 * coloridos.
 *
 * A arte mora em `img/salas/<masmorra>/` no site e em
 * `Art/Jogo/Resources/Salas/<masmorra>` no app, com os nomes dele.
 */

import type { DungeonId } from './dungeons.js';
import type { Direction } from './graph.js';

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
    { arquivo: '6_floresta_cima', plano: 'cima' },
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
    { arquivo: '7_caverna_frente', plano: 'cima' },
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
};

/**
 * O que desenhar numa sala da masmorra com estas portas: as camadas da
 * arte dela, sem os caminhos das portas que a sala não tem. `null` quando a
 * masmorra ainda não tem arte (quem desenha usa os quadradinhos).
 */
export function camadasDaSala(dungeon: DungeonId, portas: readonly Direction[]): CamadaDaSala[] | null {
  const camadas = CAMADAS_DAS_SALAS[dungeon];
  if (!camadas) return null;
  return camadas.filter((camada) => !camada.porta || portas.includes(camada.porta)).map((camada) => ({ ...camada }));
}

/** As casas de dentro que são parede nas salas desta masmorra (nenhuma fora dela, ou quando a arte não fecha nada). */
export function paredesDaSala(dungeon: DungeonId | null): CasaDaSala[] {
  if (!dungeon) return [];
  return (PAREDES_DAS_SALAS[dungeon] ?? []).map((casa) => ({ ...casa }));
}
