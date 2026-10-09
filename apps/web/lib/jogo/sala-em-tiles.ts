/**
 * Andar dentro da sala, de quadradinho em quadradinho. Doc do Breno
 * (2026-10): "Fazer o sistema do mapa parecido com o pokémon Antigo" e
 * "Faça movimentação 2D sobre o mapa, ao invés de pular de quadro em
 * quadro".
 *
 * Decisão do usuário (2026-10-09): cada sala vira uma área pequena onde o
 * herói anda passo a passo, e as portas nas bordas levam às salas
 * vizinhas. **As regras de sala não mudam**: passar pela porta é o mesmo
 * `mover` de antes — pergunta "deseja entrar?", combate, baú. O andar
 * dentro da sala é o caminho até a porta.
 *
 * Só geometria, sem React e sem PixiJS: quem desenha é `desenho-da-sala.ts`.
 * A posição dentro da sala não vai pro save — recarregar põe o herói no
 * meio da sala, como o original sempre fez.
 */

import { DIR_OPP, DIR_VECTORS, type Direction } from '@rpg-legend/shared';

export const LARGURA_DA_SALA = 9;
export const ALTURA_DA_SALA = 7;

/** Onde fica o conteúdo da sala (baú, monstro, escada…). Sólido: se contorna. */
export const CENTRO = { x: 4, y: 3 } as const;

export type Ladrilho = 'chao' | 'parede' | 'porta';

export interface PlantaDaSala {
  /** `[y][x]`. */
  ladrilhos: Ladrilho[][];
  /** O conteúdo da sala no centro, ou `null` em sala vazia. */
  objeto: { x: number; y: number } | null;
}

export interface PassoNaSala {
  x: number;
  y: number;
  olhando: Direction;
}

/** Os vãos de porta: no meio de cada parede, um por direção. */
const VAO: Record<Direction, { x: number; y: number }> = {
  N: { x: 4, y: 0 },
  S: { x: 4, y: ALTURA_DA_SALA - 1 },
  W: { x: 0, y: 3 },
  E: { x: LARGURA_DA_SALA - 1, y: 3 },
};

/**
 * A planta de uma sala: parede em volta, vão de porta onde a sala tem
 * porta (`celula.doors`), e o conteúdo no centro quando há.
 */
export function plantaDaSala(portas: Partial<Record<Direction, unknown>>, temObjeto: boolean): PlantaDaSala {
  const ladrilhos: Ladrilho[][] = [];
  for (let y = 0; y < ALTURA_DA_SALA; y++) {
    const linha: Ladrilho[] = [];
    for (let x = 0; x < LARGURA_DA_SALA; x++) {
      const borda = x === 0 || y === 0 || x === LARGURA_DA_SALA - 1 || y === ALTURA_DA_SALA - 1;
      linha.push(borda ? 'parede' : 'chao');
    }
    ladrilhos.push(linha);
  }
  for (const direcao of Object.keys(VAO) as Direction[]) {
    if (!portas[direcao]) continue;
    const vao = VAO[direcao];
    (ladrilhos[vao.y] as Ladrilho[])[vao.x] = 'porta';
  }
  return { ladrilhos, objeto: temObjeto ? { ...CENTRO } : null };
}

export type ResultadoDoPasso =
  /** Andou um quadradinho. */
  | { kind: 'andou'; passo: PassoNaSala }
  /** Parede ou o conteúdo da sala no caminho: só vira pra aquele lado. */
  | { kind: 'parado'; passo: PassoNaSala }
  /** Pisou no vão da porta: é a vez da sala vizinha (`mover` de sempre). */
  | { kind: 'porta'; direcao: Direction };

/** Qual porta é este vão. */
function portaEm(x: number, y: number): Direction | null {
  return (Object.keys(VAO) as Direction[]).find((d) => VAO[d].x === x && VAO[d].y === y) ?? null;
}

export function darPasso(planta: PlantaDaSala, atual: PassoNaSala, direcao: Direction): ResultadoDoPasso {
  const vetor = DIR_VECTORS[direcao];
  const x = atual.x + vetor.x;
  const y = atual.y + vetor.y;
  const virado: PassoNaSala = { ...atual, olhando: direcao };

  const ladrilho = planta.ladrilhos[y]?.[x];
  if (ladrilho === 'porta') {
    const porta = portaEm(x, y);
    // O vão só leva pra fora indo na direção dele: andar de lado num vão
    // não existe, porque o vão é cercado de parede.
    if (porta === direcao) return { kind: 'porta', direcao };
  }
  if (ladrilho !== 'chao') return { kind: 'parado', passo: virado };
  if (planta.objeto && planta.objeto.x === x && planta.objeto.y === y) return { kind: 'parado', passo: virado };
  return { kind: 'andou', passo: { x, y, olhando: direcao } };
}

/**
 * Onde o herói aparece numa sala. Quem andou pro norte chega pela porta
 * do sul, um passo pra dentro — em cima do vão ele sairia de novo no
 * próximo passo. Sem direção (carregar o jogo, portão, escada, totem),
 * logo abaixo do centro, olhando pra baixo.
 */
export function chegada(direcaoDoMovimento: Direction | null): PassoNaSala {
  if (!direcaoDoMovimento) return { x: CENTRO.x, y: CENTRO.y + 2, olhando: 'S' };
  const vao = VAO[DIR_OPP[direcaoDoMovimento]];
  const vetor = DIR_VECTORS[direcaoDoMovimento];
  return { x: vao.x + vetor.x, y: vao.y + vetor.y, olhando: direcaoDoMovimento };
}
