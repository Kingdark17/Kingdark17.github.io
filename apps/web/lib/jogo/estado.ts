/**
 * O estado de jogo que vive dentro do save e as transições de lugar:
 * cidade → portão → masmorra, escada pra baixo, saída de volta pra cidade.
 *
 * Os nomes dos campos são os do save original (`rpg-legend/js/save.js`) e
 * os mesmos que o relay de multiplayer transmite — mudar qualquer um
 * quebra compatibilidade com o save que já está na nuvem das contas de
 * verdade.
 *
 * `EstadoDoJogo` é união discriminada por `mapMode`: na cidade o mapa é de
 * `CityCell`, na masmorra é de `DungeonCell`. É o mesmo par que o original
 * escolhia em tempo de execução com `currentModule()` (`ui.js`), só que
 * agora o compilador cobra a escolha certa.
 *
 * Sem React e sem DOM, com `Rng` injetável: dá pra testar cidade, portão e
 * descida inteiros sem montar tela.
 */

import {
  DIR_VECTORS,
  defaultRng,
  generateCityLayout,
  generateDungeonFloor,
  hydrateSavedHero,
  inBounds,
  isBossFloor,
  onFloorReached,
  type CityCell,
  type Companion,
  type Direction,
  type DungeonCell,
  type Hero,
  type Item,
  type Quest,
  type Rng,
  type RoomCell,
} from '@rpg-legend/shared';

import type { Tutorial } from './tutorial';

/** Mesmo tamanho de grade do original (`main.js`: mapRows/mapCols = 6). */
export const LINHAS_DO_MAPA = 6;
export const COLUNAS_DO_MAPA = 6;

/** Atravessar o portão sempre recomeça do andar 1, igual `enterDungeon()`. */
export const PRIMEIRO_ANDAR = 1;

export interface Posicao {
  x: number;
  y: number;
}

export type CelulaDoMapa = CityCell | DungeonCell;

/** Tudo que não depende de onde o jogador está. `cityMap`/`cityStart` guardam a cidade enquanto ele está na masmorra, pra ela não ser regerada na volta (o original faz igual). */
interface EstadoBase {
  hero: Hero;
  party: Companion[];
  inventory: Item[];
  quests: Quest[];
  floor: number;
  mapRows: number;
  mapCols: number;
  cityMap: CityCell[][] | null;
  cityStart: Posicao | null;
  pos: Posicao;
  /** Progresso dos Primeiros Passos. Ausente em save antigo — `tutorialDe()` cuida disso. */
  tutorial?: Tutorial;
}

export interface EstadoNaCidade extends EstadoBase {
  mapMode: 'city';
  map: CityCell[][];
}

export interface EstadoNaMasmorra extends EstadoBase {
  mapMode: 'dungeon';
  map: DungeonCell[][];
}

export type EstadoDoJogo = EstadoNaCidade | EstadoNaMasmorra;

/** O save de um personagem recém-criado ainda não tem mapa nem posição. */
export interface SaveCarregado {
  hero: Hero;
  floor: number;
  party?: Companion[];
  inventory?: Item[];
  quests?: Quest[];
  mapMode?: 'city' | 'dungeon';
  map?: CelulaDoMapa[][] | null;
  mapRows?: number;
  mapCols?: number;
  cityMap?: CityCell[][] | null;
  cityStart?: Posicao | null;
  pos?: Posicao | null;
  tutorial?: Tutorial;
}

function comuns(save: SaveCarregado): Omit<EstadoBase, 'pos'> {
  return {
    hero: save.hero,
    party: save.party ?? [],
    inventory: save.inventory ?? [],
    quests: save.quests ?? [],
    floor: save.floor,
    mapRows: save.mapRows ?? LINHAS_DO_MAPA,
    mapCols: save.mapCols ?? COLUNAS_DO_MAPA,
    cityMap: save.cityMap ?? null,
    cityStart: save.cityStart ?? null,
    // Só entra no estado se o save já tinha — assim o save de quem nunca
    // mexeu no tutorial não ganha um campo novo à toa.
    ...(save.tutorial ? { tutorial: save.tutorial } : {}),
  };
}

function temCidade(save: SaveCarregado): save is SaveCarregado & { cityMap: CityCell[][]; cityStart: Posicao } {
  return Array.isArray(save.cityMap) && save.cityMap.length > 0 && !!save.cityStart;
}

/**
 * Retoma o save no lugar onde ele foi gravado. Quem estava na masmorra
 * volta pra ela com o mesmo andar, os mesmos baús já abertos e os mesmos
 * monstros — é o que `applySave()` (`ui.js`) faz quando o save traz `map` e
 * `pos`. Save antigo sem mapa cai no caminho de gerar um andar novo.
 */
export function retomarSave(entrada: SaveCarregado, rng: Rng = defaultRng): EstadoDoJogo {
  // Único ponto em que o save vem de fora, e por isso o único lugar que
  // normaliza: `hydrateSavedHero` resolve aqui a identidade que os saves
  // antigos não têm (`classId`, `raceId`, `powerIds`, a partir dos nomes
  // gravados). Depois deste ponto o resto do jogo só olha id — que é o que
  // deixa o nome mudar de idioma sem mexer em regra nenhuma.
  //
  // Não fica em `comuns()` de propósito: aquilo também roda em transição
  // de dentro do jogo (`voltarParaCidade`), e refazer o herói a cada saída
  // de masmorra não é normalizar, é mexer no que já estava certo.
  const save: SaveCarregado = { ...entrada, hero: hydrateSavedHero(entrada.hero) };

  if (save.mapMode !== 'dungeon') return entrarNaCidade(save);

  if (Array.isArray(save.map) && save.map.length > 0 && save.pos) {
    // O save vem da nuvem como JSON solto: `mapMode: 'dungeon'` é a única
    // garantia de que a grade é de salas de masmorra, igual no original.
    const mapa = marcarVisitada(save.map as DungeonCell[][], save.pos);
    return { ...comuns(save), mapMode: 'dungeon', map: mapa, pos: save.pos };
  }

  return gerarAndar(comuns(save), save.floor, rng);
}

/**
 * Prepara o estado pra jogar na cidade. Gera o layout só quando ainda não
 * existe um guardado — voltar da masmorra tem que cair na mesma cidade,
 * com as mesmas salas já visitadas, e no ponto de partida dela.
 */
export function entrarNaCidade(save: SaveCarregado): EstadoNaCidade {
  const base = comuns(save);

  const { grid, inicio } = temCidade(save)
    ? { grid: save.cityMap, inicio: save.cityStart }
    : (() => {
        const layout = generateCityLayout(base.mapRows, base.mapCols);
        return { grid: layout.grid, inicio: { x: layout.start.x, y: layout.start.y } };
      })();

  const posicao = save.mapMode === 'city' && save.pos ? save.pos : inicio;
  const mapa = marcarVisitada(grid, posicao);

  return { ...base, mapMode: 'city', map: mapa, cityMap: mapa, cityStart: inicio, pos: posicao };
}

/** O portão da cidade: sempre entra pelo andar 1, como `enterDungeon()`. */
export function entrarNaMasmorra(estado: EstadoNaCidade, rng: Rng = defaultRng): EstadoNaMasmorra {
  return gerarAndar(estado, PRIMEIRO_ANDAR, rng);
}

/** A saída da masmorra devolve o jogador à cidade guardada, no ponto de partida dela. O andar atual não é zerado — só o portão faz isso. */
export function voltarParaCidade(estado: EstadoNaMasmorra): EstadoNaCidade {
  return entrarNaCidade(estado);
}

export type ResultadoDaEscada = { kind: 'selado' } | { kind: 'desceu'; estado: EstadoNaMasmorra };

/**
 * Descer as escadas. Em andar de chefe com o chefe vivo, o caminho fica
 * selado — sem isso dava pra pular todo chefe do jogo andando em volta.
 */
export function descerEscada(estado: EstadoNaMasmorra, rng: Rng = defaultRng): ResultadoDaEscada {
  if (isBossFloor(estado.floor) && temChefeVivo(estado)) return { kind: 'selado' };
  return { kind: 'desceu', estado: avancarAndar(estado, rng) };
}

/**
 * Gera o próximo andar sem passar pela escada. É o que o original faz
 * depois de derrotar um chefe (`advanceAfterBoss`): o caminho se abre e o
 * grupo desce sozinho.
 */
export function avancarAndar(estado: EstadoNaMasmorra, rng: Rng = defaultRng): EstadoNaMasmorra {
  return gerarAndar(estado, estado.floor + 1, rng);
}

export function temChefeVivo(estado: EstadoNaMasmorra): boolean {
  return estado.map.some((linha) => linha.some((celula) => celula.type === 'boss' && !celula.beaten));
}

function gerarAndar(base: Omit<EstadoBase, 'pos'>, floor: number, rng: Rng): EstadoNaMasmorra {
  const andar = generateDungeonFloor(floor, base.mapRows, base.mapCols, { rng });
  const inicio = { x: andar.start.x, y: andar.start.y };

  return {
    ...base,
    quests: onFloorReached(base.quests, floor),
    floor,
    mapMode: 'dungeon',
    map: marcarVisitada(andar.grid, inicio),
    pos: inicio,
  };
}

function alterarCelula<C extends RoomCell>(grid: C[][], posicao: Posicao, mudanca: Partial<RoomCell>): C[][] {
  return grid.map((linha, y) => linha.map((celula, x) => (x === posicao.x && y === posicao.y ? { ...celula, ...mudanca } : celula)));
}

/** Entrar numa sala marca visitada e revelada — o original faz os dois juntos em `resetPlayerToStart`/`movePlayerTo`. */
function marcarVisitada<C extends RoomCell>(grid: C[][], posicao: Posicao): C[][] {
  return alterarCelula(grid, posicao, { visited: true, revealed: true });
}

export function celulaEm(estado: EstadoDoJogo, posicao: Posicao): CelulaDoMapa | null {
  return estado.map[posicao.y]?.[posicao.x] ?? null;
}

export function celulaAtual(estado: EstadoDoJogo): CelulaDoMapa | null {
  return celulaEm(estado, estado.pos);
}

export function vizinhaEm(estado: EstadoDoJogo, direcao: Direction): Posicao | null {
  const atual = celulaAtual(estado);
  if (!atual?.doors?.[direcao]) return null;

  const vetor = DIR_VECTORS[direcao];
  const destino = { x: atual.x + vetor.x, y: atual.y + vetor.y };
  if (!inBounds(destino.x, destino.y, estado.mapCols, estado.mapRows)) return null;

  return celulaEm(estado, destino) ? destino : null;
}

/** Só dá pra sair por porta aberta, e só pra dentro da grade. */
export function podeAndar(estado: EstadoDoJogo, direcao: Direction): boolean {
  return vizinhaEm(estado, direcao) !== null;
}

/**
 * Devolve o mesmo estado quando o passo não é possível — quem chama não
 * precisa checar antes. As sobrecargas existem porque andar nunca troca de
 * lugar: quem entrou na cidade continua na cidade.
 */
export function andar(estado: EstadoNaCidade, direcao: Direction): EstadoNaCidade;
export function andar(estado: EstadoNaMasmorra, direcao: Direction): EstadoNaMasmorra;
export function andar(estado: EstadoDoJogo, direcao: Direction): EstadoDoJogo;
export function andar(estado: EstadoDoJogo, direcao: Direction): EstadoDoJogo {
  const destino = vizinhaEm(estado, direcao);
  if (!destino) return estado;

  if (estado.mapMode === 'city') {
    const mapa = marcarVisitada(estado.map, destino);
    return { ...estado, pos: destino, map: mapa, cityMap: mapa };
  }
  return { ...estado, pos: destino, map: marcarVisitada(estado.map, destino) };
}

/**
 * Sala que fez o jogo perguntar "deseja entrar?" já aparece no minimapa
 * mesmo que ele diga não — o original marca `revealed` antes do prompt.
 */
export function revelar(estado: EstadoNaCidade, posicao: Posicao): EstadoNaCidade;
export function revelar(estado: EstadoNaMasmorra, posicao: Posicao): EstadoNaMasmorra;
export function revelar(estado: EstadoDoJogo, posicao: Posicao): EstadoDoJogo;
export function revelar(estado: EstadoDoJogo, posicao: Posicao): EstadoDoJogo {
  if (estado.mapMode === 'city') {
    const mapa = alterarCelula(estado.map, posicao, { revealed: true });
    return { ...estado, map: mapa, cityMap: mapa };
  }
  return { ...estado, map: alterarCelula(estado.map, posicao, { revealed: true }) };
}

/**
 * Troca a sala onde o jogador está: baú aberto e mímico revelado na
 * masmorra, estoque da loja na cidade. Na cidade o `cityMap` acompanha,
 * porque ele e o `map` são o mesmo mapa.
 */
export function substituirCelulaAtual(estado: EstadoNaCidade, celula: CityCell): EstadoNaCidade;
export function substituirCelulaAtual(estado: EstadoNaMasmorra, celula: DungeonCell): EstadoNaMasmorra;
export function substituirCelulaAtual(estado: EstadoDoJogo, celula: CelulaDoMapa): EstadoDoJogo {
  const troca = <C extends RoomCell>(grade: C[][], nova: C): C[][] =>
    grade.map((linha, y) => linha.map((atual, x) => (x === estado.pos.x && y === estado.pos.y ? nova : atual)));

  if (estado.mapMode === 'city') {
    const mapa = troca(estado.map, celula as CityCell);
    return { ...estado, map: mapa, cityMap: mapa };
  }
  return { ...estado, map: troca(estado.map, celula as DungeonCell) };
}
