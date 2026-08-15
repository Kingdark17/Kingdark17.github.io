/**
 * Cidade inicial: layout FIXO de salas (mesmo mapa pra todo mundo, sempre,
 * sem RNG) — loja, ferreiro, taverna, quadro de missões, 2 NPCs e o portão
 * da masmorra. Porta de `js/city.js`, mesmo recorte de sempre: geração e
 * apresentação pura entram, `handleEnter()` (DOM, `RPG.Shop`/`RPG.Quests`/
 * `RPG.UI` diretos) fica de fora — exceto a única regra de verdade
 * escondida ali dentro, o descanso da taverna, que sai como `restAtTavern`.
 *
 * Os 3 NPCs daqui usam justamente os serviços `barter`/`blessing`/`recruit`
 * que `npc/npc-services.ts` já resolve mas que nenhum NPC de masmorra
 * jamais sorteia (lá só `heal`/`reveal` aparecem) — fecha esse gap.
 */

import type { Companion, Hero } from '../hero/hero.js';
import type { Item } from '../items/item.js';
import type { NpcService } from '../npc/npc-services.js';
import { DIR_OPP, DIR_VECTORS, type Direction, type RoomCell } from '../dungeon/graph.js';

export type CityRoomType = 'void' | 'start' | 'normal' | 'gate' | 'shop' | 'blacksmith' | 'tavern' | 'questboard' | 'npc';

export interface CityNpc {
  name: string;
  role: string;
  service: NpcService;
  icon: string;
  lines: string[];
  serviceUsed: boolean;
}

export interface CityCell extends RoomCell {
  type: CityRoomType;
  npc?: CityNpc;
  /**
   * Estoque da loja/ferreiro, sorteado na primeira visita e guardado na
   * própria sala — igual `ensureStock()` em `js/shop.js`. Fica no save de
   * propósito: sair e voltar não deve rolar um estoque novo de graça,
   * senão o botão de renovar (que cobra ouro) não teria razão de existir.
   */
  forSale?: Item[];
}

export interface CityLayout {
  grid: CityCell[][];
  rooms: CityCell[];
  start: CityCell;
}

interface CityNpcTemplate {
  name: string;
  role: string;
  service: NpcService;
  icon: string;
  lines: string[];
}

/** Igual a `js/city.js`'s `NPC_TEMPLATES`. */
const NPC_TEMPLATES: CityNpcTemplate[] = [
  {
    name: 'Velho Ferreiro Bram',
    role: 'Ferreiro',
    service: 'barter',
    icon: '🔨',
    lines: [
      'Ah, um aventureiro... Minha forja anda fria, mas ainda faço bons trabalhos.',
      'Cuidado com as galerias mais fundas. Ouvi rugidos vindos de lá ontem à noite.',
      'Se encontrar minério raro por aí, traga para mim. Faço um bom preço.',
    ],
  },
  {
    name: 'Erma, a Vidente',
    role: 'Mística',
    service: 'blessing',
    icon: '🔮',
    lines: [
      'As sombras sussurram seu nome, viajante...',
      'Vejo três caminhos à sua frente: um de ferro, um de fogo e um de silêncio.',
      'Escolha com sabedoria. Nem todo tesouro vale o preço cobrado.',
    ],
  },
  {
    name: 'Capitão Doran',
    role: 'Guarda da Cidade',
    service: 'recruit',
    icon: '🪖',
    lines: [
      'Parado! ...Ah, é apenas um aventureiro. Pode passar.',
      'A masmorra fica logo adiante. Já perdemos batedores lá esta semana.',
      'Cada andar que você descer será mais perigoso que o anterior. Vá com cuidado.',
    ],
  },
];

function pickNpc(index: number): CityNpc {
  const source = NPC_TEMPLATES[index % NPC_TEMPLATES.length] as CityNpcTemplate;
  return { name: source.name, role: source.role, service: source.service, icon: source.icon, lines: [...source.lines], serviceUsed: false };
}

interface LayoutSpec {
  x: number;
  y: number;
  type: CityRoomType;
  npcIndex?: number;
}

/** Coordenadas relativas ao centro de uma grade 6x6 (início em 3,3). */
const LAYOUT: LayoutSpec[] = [
  { x: 3, y: 3, type: 'start' },
  { x: 3, y: 2, type: 'normal' },
  { x: 3, y: 1, type: 'gate' },
  { x: 2, y: 3, type: 'shop' },
  { x: 1, y: 3, type: 'blacksmith' },
  { x: 4, y: 3, type: 'tavern' },
  { x: 5, y: 3, type: 'questboard' },
  { x: 3, y: 4, type: 'npc', npcIndex: 0 },
  { x: 3, y: 5, type: 'npc', npcIndex: 1 },
  { x: 2, y: 2, type: 'normal' },
  { x: 4, y: 2, type: 'normal' },
];

const LAYOUT_DOORS: Array<[number, number, Direction]> = [
  [3, 3, 'N'],
  [3, 2, 'N'],
  [3, 3, 'W'],
  [2, 3, 'W'],
  [3, 3, 'E'],
  [4, 3, 'E'],
  [3, 3, 'S'],
  [3, 4, 'S'],
  [3, 2, 'W'],
  [3, 2, 'E'],
];

/** Gera o layout fixo da cidade inicial. Determinístico — sem `Rng`, igual o original (é o mesmo mapa sempre). */
export function generateCityLayout(rows: number, cols: number): CityLayout {
  const grid: CityCell[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: CityCell[] = [];
    for (let x = 0; x < cols; x++) row.push({ type: 'void', x, y, doors: {} });
    grid.push(row);
  }

  for (const spec of LAYOUT) {
    const cell = grid[spec.y]?.[spec.x];
    if (!cell) continue;
    cell.type = spec.type;
    if (spec.type === 'npc' && spec.npcIndex !== undefined) cell.npc = pickNpc(spec.npcIndex);
  }

  for (const [x, y, dir] of LAYOUT_DOORS) {
    const v = DIR_VECTORS[dir];
    const cell = grid[y]?.[x];
    const target = grid[y + v.y]?.[x + v.x];
    if (!cell || !target) continue;
    cell.doors[dir] = true;
    target.doors[DIR_OPP[dir]] = true;
  }

  const rooms = LAYOUT.map((spec) => grid[spec.y]?.[spec.x]).filter((cell): cell is CityCell => !!cell);
  const start = grid[3]?.[3] as CityCell;
  return { grid, rooms, start };
}

/** Restaura Vida e Mana do herói e Vida da equipe inteira — a única regra por trás da taverna. */
export function restAtTavern(hero: Hero, party: readonly Companion[]): { hero: Hero; party: Companion[] } {
  const nextHero: Hero = { ...hero, hp: hero.maxHp, mp: hero.maxMp };
  const nextParty = party.map((m) => ({ ...m, hp: m.maxHp }));
  return { hero: nextHero, party: nextParty };
}

// ---------- apresentação pura ----------
// Prefixo "city" pra não colidir com as mesmas funções de `dungeon/generate.ts`.

export function cityIconFor(cell: CityCell): string {
  if (cell.type === 'npc') return '🧙';
  if (cell.type === 'shop') return '🏵';
  if (cell.type === 'blacksmith') return '🔨';
  if (cell.type === 'tavern') return '🍺';
  if (cell.type === 'questboard') return '📜';
  if (cell.type === 'gate') return '🌟';
  if (cell.type === 'start') return '🚀';
  return '';
}

export function cityShortLabel(cell: CityCell): string {
  const labels: Partial<Record<CityRoomType, string>> = {
    npc: 'um NPC',
    shop: 'uma loja',
    blacksmith: 'a forja de um ferreiro',
    tavern: 'uma taverna',
    questboard: 'um quadro de missões',
    gate: 'o portão da masmorra',
    start: 'o ponto de partida',
    normal: 'uma sala vazia',
  };
  return labels[cell.type] ?? 'uma sala';
}

export function cityRoomDesc(cell: CityCell): string {
  const descs: Partial<Record<CityRoomType, string>> = {
    npc: 'Um morador da cidade está por aqui.',
    shop: 'Um vendedor organiza suas mercadorias.',
    blacksmith: 'O calor da forja aquece o ar; um ferreiro trabalha o metal.',
    tavern: 'Risadas e cheiro de cerveja escapam pela porta entreaberta.',
    questboard: 'Um quadro coberto de pergaminhos e anúncios está afixado na parede.',
    gate: 'Um portão de pedra antiga marca a entrada da masmorra.',
    start: 'Este foi o ponto onde você chegou à cidade.',
    normal: 'Uma pracinha tranquila, sem nada de especial.',
  };
  return descs[cell.type] ?? '';
}

export function cityEntryText(cell: CityCell): string {
  if (cell.type === 'npc') return `Você avista ${cell.npc?.name}. Deseja se aproximar e conversar?`;
  if (cell.type === 'shop') return 'Um vendedor itinerante oferece suas mercadorias. Deseja negociar?';
  if (cell.type === 'blacksmith') return 'A forja do ferreiro está acesa. Deseja ver os equipamentos?';
  if (cell.type === 'tavern') return 'Uma taverna aconchegante convida a um descanso. Deseja entrar?';
  if (cell.type === 'questboard') return 'Um quadro de missões está afixado na parede. Deseja ver os anúncios?';
  if (cell.type === 'gate') return 'Um portão misterioso leva à masmorra. Deseja atravessar?';
  return 'Deseja entrar?';
}
