/**
 * O estado de jogo que vive dentro do save, e as duas operações que a
 * tela de cidade precisa: entrar na cidade e andar.
 *
 * Os nomes dos campos são os do save original (`rpg-legend/js/save.js`) e
 * os mesmos que o relay de multiplayer transmite — mudar qualquer um
 * quebra compatibilidade com o save que já está na nuvem das contas de
 * verdade.
 *
 * Sem React e sem DOM, com `Rng` injetável: dá pra testar o movimento
 * inteiro sem montar tela.
 */

import {
  DIR_VECTORS,
  generateCityLayout,
  inBounds,
  type CityCell,
  type Companion,
  type Direction,
  type Hero,
  type Item,
} from '@rpg-legend/shared';

/** Mesmo tamanho de grade do original (`main.js`: mapRows/mapCols = 6). */
export const LINHAS_DO_MAPA = 6;
export const COLUNAS_DO_MAPA = 6;

export interface Posicao {
  x: number;
  y: number;
}

/**
 * `map` é a grade em uso; `cityMap`/`cityStart` guardam a cidade enquanto
 * o jogador está na masmorra, pra ela não ser regerada na volta (o
 * original faz igual).
 */
export interface EstadoDoJogo {
  hero: Hero;
  party: Companion[];
  inventory: Item[];
  quests: unknown[];
  floor: number;
  mapMode: 'city' | 'dungeon';
  map: CityCell[][];
  mapRows: number;
  mapCols: number;
  cityMap: CityCell[][] | null;
  cityStart: Posicao | null;
  pos: Posicao;
}

/** O save de um personagem recém-criado ainda não tem mapa nem posição. */
export type SaveCarregado = Partial<EstadoDoJogo> & Pick<EstadoDoJogo, 'hero' | 'floor'>;

function temCidade(save: SaveCarregado): save is SaveCarregado & { cityMap: CityCell[][]; cityStart: Posicao } {
  return Array.isArray(save.cityMap) && save.cityMap.length > 0 && !!save.cityStart;
}

/**
 * Prepara o estado pra jogar na cidade. Gera o layout só quando ainda não
 * existe um guardado — voltar da masmorra tem que cair na mesma cidade,
 * com as mesmas salas já visitadas.
 */
export function entrarNaCidade(save: SaveCarregado): EstadoDoJogo {
  const mapRows = save.mapRows ?? LINHAS_DO_MAPA;
  const mapCols = save.mapCols ?? COLUNAS_DO_MAPA;

  const { grid, inicio } = temCidade(save)
    ? { grid: save.cityMap, inicio: save.cityStart }
    : (() => {
        const layout = generateCityLayout(mapRows, mapCols);
        return { grid: layout.grid, inicio: { x: layout.start.x, y: layout.start.y } };
      })();

  const posicao = save.mapMode === 'city' && save.pos ? save.pos : inicio;
  const mapa = marcarVisitada(grid, posicao);

  return {
    hero: save.hero,
    party: save.party ?? [],
    inventory: save.inventory ?? [],
    quests: save.quests ?? [],
    floor: save.floor,
    mapMode: 'city',
    map: mapa,
    mapRows,
    mapCols,
    cityMap: mapa,
    cityStart: inicio,
    pos: posicao,
  };
}

function marcarVisitada(grid: CityCell[][], posicao: Posicao): CityCell[][] {
  return grid.map((linha, y) => linha.map((celula, x) => (x === posicao.x && y === posicao.y ? { ...celula, visited: true } : celula)));
}

export function celulaEm(estado: EstadoDoJogo, posicao: Posicao): CityCell | null {
  return estado.map[posicao.y]?.[posicao.x] ?? null;
}

export function celulaAtual(estado: EstadoDoJogo): CityCell | null {
  return celulaEm(estado, estado.pos);
}

/** Só dá pra sair por porta aberta, e só pra dentro da grade. */
export function podeAndar(estado: EstadoDoJogo, direcao: Direction): boolean {
  const atual = celulaAtual(estado);
  if (!atual?.doors?.[direcao]) return false;

  const vetor = DIR_VECTORS[direcao];
  const destino = { x: atual.x + vetor.x, y: atual.y + vetor.y };
  if (!inBounds(destino.x, destino.y, estado.mapCols, estado.mapRows)) return false;

  return !!celulaEm(estado, destino);
}

/** Devolve o mesmo estado quando o passo não é possível — quem chama não precisa checar antes. */
export function andar(estado: EstadoDoJogo, direcao: Direction): EstadoDoJogo {
  if (!podeAndar(estado, direcao)) return estado;

  const vetor = DIR_VECTORS[direcao];
  const destino = { x: estado.pos.x + vetor.x, y: estado.pos.y + vetor.y };
  const mapa = marcarVisitada(estado.map, destino);

  return { ...estado, pos: destino, map: mapa, cityMap: mapa };
}
