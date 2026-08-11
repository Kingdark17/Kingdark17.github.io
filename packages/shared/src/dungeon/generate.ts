/**
 * Geração do conteúdo de um andar da masmorra: sorteia o grafo de salas
 * (`./graph.ts`) e povoa cada sala com NPC, evento, tesouro, monstros ou
 * chefe. Porta de `js/dungeon.js`, mas só a parte pura — `handleEnter()`,
 * `refreshPresentation()` e as chamadas de DOM/áudio do original ficam de
 * fora: pertencem a uma camada de orquestração futura, não ao motor.
 *
 * Salas de evento saem com o evento sorteado pronto (`../events/events.js`,
 * já portado), mas não resolvido — `resolveEvent()` é chamado depois, quando
 * o jogador escolhe uma opção, não na geração do andar.
 */

import { randomEventTemplate, type EventTemplateId } from '../events/events.js';
import { generate as generateMonster, generateBoss, monsterView, type MonsterInstance } from '../monsters/generate.js';
import { randomItem, type Item } from '../items/item.js';
import { defaultRng, pick, randomInt, type Rng } from '../rng.js';
import { distancesFrom, generateRoomGraph, DIR_VECTORS, type Direction, type RoomCell, type RoomGraph } from './graph.js';

export type DungeonRoomType = 'void' | 'start' | 'normal' | 'npc' | 'event' | 'treasure' | 'monster' | 'boss' | 'stairs' | 'exit';

export type NpcService = 'reveal' | 'heal';

interface NpcTemplate {
  name: string;
  role: string;
  service: NpcService;
  icon: string;
  lines: string[];
}

/** Igual a `js/dungeon.js`'s `NPC_TEMPLATES` — só os dois NPCs que a masmorra sorteia hoje. */
const NPC_TEMPLATES: NpcTemplate[] = [
  {
    name: 'Erma, a Vidente',
    role: 'Mística Errante',
    service: 'reveal',
    icon: '🔮',
    lines: [
      'Você se aventura fundo demais — ou talvez não o bastante...',
      'Os corredores mudam quando ninguém observa.',
      'Cuidado com o que dorme nas profundezas.',
    ],
  },
  {
    name: 'Prisioneiro Esquecido',
    role: 'Sobrevivente',
    service: 'heal',
    icon: '🧍',
    lines: [
      'Você... você é real? Há quanto tempo estou aqui...',
      'Os monstros ficam mais fortes quanto mais fundo você vai. Tome cuidado.',
      'Se encontrar a saída, corra e não olhe para trás.',
    ],
  },
];

export interface DungeonNpc {
  name: string;
  role: string;
  service: NpcService;
  icon: string;
  lines: string[];
  serviceUsed: boolean;
}

export interface DungeonEventStub {
  templateId: EventTemplateId;
}

export type DungeonTreasureBonus = { gold: number } | { item: Item };

export interface DungeonCell extends RoomCell {
  type: DungeonRoomType;
  npc?: DungeonNpc;
  event?: DungeonEventStub;
  resolved?: boolean;
  monsters?: MonsterInstance[];
  monsterIndex?: number;
  beaten?: boolean;
  bonusTreasure?: DungeonTreasureBonus;
  isMimic?: boolean;
  giveGold?: boolean;
  item?: Item | null;
  collected?: boolean;
  distanceFromStart?: number;
  startBranch?: string;
}

export interface DungeonFloor {
  grid: DungeonCell[][];
  rooms: DungeonCell[];
  start: DungeonCell;
}

/** Chefe a cada 5 andares (mini-chefe); chefe principal fica a cargo de quem chama decidir via `floor % 10`, igual ao original delegava pra fora do gerador de andar. */
export function isBossFloor(floor: number): boolean {
  return floor % 5 === 0;
}

/** Quantos monstros aparecem juntos numa sala — às vezes mais de um, mais provável a partir do andar 4. */
export function monsterGroupSize(floor: number, rng: Rng = defaultRng): number {
  let n = 1;
  if (rng() < 0.35) n = 2;
  if (floor >= 4 && rng() < 0.2) n = 3;
  return Math.min(3, n);
}

/**
 * Acha, a partir de uma sala distante, o ponto mais próximo do início onde a
 * rota se ramifica (onde duas salas distantes deixariam de compartilhar
 * caminho). Usado para não deixar escada e saída na mesma ramificação.
 */
function startBranch(grid: RoomCell[][], distances: Record<string, number>, cell: RoomCell): string {
  let current = cell;
  let guard = 0;
  while ((distances[`${current.x},${current.y}`] || 0) > 1 && guard++ < 100) {
    const currentDistance = distances[`${current.x},${current.y}`] as number;
    let previous: RoomCell | null = null;
    for (const dir of Object.keys(current.doors || {}) as Direction[]) {
      const v = DIR_VECTORS[dir];
      const candidate = grid[current.y + v.y]?.[current.x + v.x];
      if (candidate && distances[`${candidate.x},${candidate.y}`] === currentDistance - 1) {
        previous = candidate;
        break;
      }
    }
    if (!previous) break;
    current = previous;
  }
  return `${current.x},${current.y}`;
}

export interface DungeonGenerateOptions {
  rng?: Rng;
  /** Injetável para os `uid` de item gerados ficarem reproduzíveis em teste — mesmo padrão de `InstantiateOptions.now`. */
  now?: () => number;
}

interface DistantRoomsResult {
  res: RoomGraph;
  distances: Record<string, number>;
  distantRooms: DungeonCell[];
  pool: DungeonCell[];
}

/**
 * Gera grafos até existirem pelo menos duas salas "distantes" — longe tanto
 * pelo caminho real (portas) quanto visualmente na grade. Sem isso, escada e
 * saída podiam sair com caminho longo mas aparecer coladas ao jogador. O
 * `pool` (ordem embaralhada de todas as salas menos o início) sai já
 * calculado daqui porque o fallback pra grades pequenas filtra a partir
 * dele, igual o original fazia.
 */
function resolveDistantRooms(rows: number, cols: number, roomCount: number, rng: Rng): DistantRoomsResult {
  let res = generateRoomGraph(rows, cols, roomCount, rng);
  let distances = distancesFrom(res.grid, res.start, cols, rows);
  let distantRooms: RoomCell[] = [];
  let attempts = 0;

  while (attempts < 80 && distantRooms.length < 2) {
    attempts++;
    res = generateRoomGraph(rows, cols, roomCount, rng);
    distances = distancesFrom(res.grid, res.start, cols, rows);
    distantRooms = res.rooms.slice(1).filter((cell) => {
      const pathDistance = distances[`${cell.x},${cell.y}`] || 0;
      const visualDistance = Math.abs(cell.x - res.start.x) + Math.abs(cell.y - res.start.y);
      return pathDistance >= 4 && visualDistance >= 3;
    });
  }
  for (const cell of distantRooms) (cell as DungeonCell).startBranch = startBranch(res.grid, distances, cell);

  const pool = res.rooms.slice(1).sort(() => rng() - 0.5);

  if (distantRooms.length < 2) {
    distantRooms = pool.filter((cell) => (distances[`${cell.x},${cell.y}`] || 0) >= 3);
    for (const cell of distantRooms) (cell as DungeonCell).startBranch = startBranch(res.grid, distances, cell);
  }

  distantRooms = distantRooms.slice().sort((a, b) => {
    const pathDiff = (distances[`${b.x},${b.y}`] || 0) - (distances[`${a.x},${a.y}`] || 0);
    if (pathDiff) return pathDiff;
    const aVisual = Math.abs(a.x - res.start.x) + Math.abs(a.y - res.start.y);
    const bVisual = Math.abs(b.x - res.start.x) + Math.abs(b.y - res.start.y);
    return bVisual - aVisual;
  });

  return { res, distances, distantRooms: distantRooms as DungeonCell[], pool: pool as DungeonCell[] };
}

/** Reserva a sala mais distante disponível pra um tipo fixo (escada, saída), removendo-a de `distantRooms` e `pool`. */
function reserveDistant(
  distantRooms: DungeonCell[],
  pool: DungeonCell[],
  distances: Record<string, number>,
  type: DungeonRoomType,
  otherBranch?: string | null,
): DungeonCell | null {
  let pickIndex = 0;
  if (otherBranch) {
    pickIndex = distantRooms.findIndex((candidate) => candidate.startBranch !== otherBranch);
    if (pickIndex < 0) pickIndex = 0;
  }
  const cell = distantRooms.splice(pickIndex, 1)[0];
  if (!cell) return null;
  const index = pool.indexOf(cell);
  if (index >= 0) pool.splice(index, 1);
  cell.type = type;
  cell.distanceFromStart = distances[`${cell.x},${cell.y}`] || 0;
  return cell;
}

/** Gera os monstros de cada sala sorteada como `monster`, com chance de recompensa extra em salas com mais de um inimigo. */
function populateMonsterRooms(rooms: DungeonCell[], floor: number, rng: Rng, now?: () => number): void {
  for (const cell of rooms) {
    const groupSize = monsterGroupSize(floor, rng);
    cell.monsters = [];
    for (let i = 0; i < groupSize; i++) cell.monsters.push(generateMonster(floor, { rng }));
    cell.monsterIndex = 0;
    cell.beaten = false;
    if (groupSize > 1 && rng() < 0.35) {
      cell.bonusTreasure = rng() < 0.7 ? { gold: 10 + floor * 3 + randomInt(15, rng) } : { item: randomItem({ floor, rng, now }) };
    }
  }
}

function placeBoss(bossRoom: DungeonCell | undefined, floor: number, rng: Rng): void {
  if (!bossRoom) return;
  bossRoom.monsters = [generateBoss(floor, { rng })];
  bossRoom.monsterIndex = 0;
  bossRoom.beaten = false;
}

/** Preenche NPC/evento/tesouro nas salas já tipadas por `place()` — monstro e chefe já saem prontos de `populateMonsterRooms`/`placeBoss`. */
function populateRoomContent(rooms: DungeonCell[], floor: number, rng: Rng, now?: () => number): void {
  for (const cell of rooms) {
    if (cell.type === 'npc') {
      const template = pick(NPC_TEMPLATES, rng);
      cell.npc = { name: template.name, role: template.role, service: template.service, icon: template.icon, lines: [...template.lines], serviceUsed: false };
    }
    if (cell.type === 'event') {
      cell.event = { templateId: randomEventTemplate(rng).id };
      cell.resolved = false;
    }
    if (cell.type === 'treasure') {
      cell.isMimic = rng() < Math.min(0.25, 0.1 + floor * 0.008);
      cell.giveGold = rng() < 0.7;
      cell.item = cell.giveGold ? null : randomItem({ floor, rng, now });
      cell.collected = false;
    }
  }
}

/**
 * Gera um andar completo: grafo de salas, escada e saída reservadas nas
 * rotas mais distantes do início (pra obrigar exploração antes de descer ou
 * voltar), e o conteúdo de cada sala restante (NPC, evento, tesouro,
 * monstros, chefe em andar de chefe).
 */
export function generateDungeonFloor(floor: number, rows: number, cols: number, options: DungeonGenerateOptions = {}): DungeonFloor {
  const rng = options.rng ?? defaultRng;
  const { now } = options;
  const roomCount = Math.min(22, 9 + floor);

  const { res, distances, distantRooms, pool } = resolveDistantRooms(rows, cols, roomCount, rng);

  const stairsRoom = reserveDistant(distantRooms, pool, distances, 'stairs');
  reserveDistant(distantRooms, pool, distances, 'exit', stairsRoom?.startBranch);

  function place(type: DungeonRoomType, count: number): DungeonCell[] {
    const out: DungeonCell[] = [];
    for (let i = 0; i < count && pool.length; i++) {
      const c = pool.pop() as DungeonCell;
      c.type = type;
      out.push(c);
    }
    return out;
  }

  place('npc', 1 + (rng() < 0.5 ? 1 : 0));
  place('event', 1 + (floor >= 4 && rng() < 0.4 ? 1 : 0));
  place('treasure', 2 + Math.min(3, Math.floor(floor / 3)));

  // Sempre reserva salas para escada e saída; em andares de chefe, reserva
  // uma terceira sala para o chefe.
  const reservedRooms = isBossFloor(floor) ? 1 : 0;
  const monsterRoomCount = Math.min(pool.length - reservedRooms, 3 + Math.floor((floor - 1) * 1.3));
  populateMonsterRooms(place('monster', Math.max(2, monsterRoomCount)), floor, rng, now);

  if (isBossFloor(floor)) placeBoss(place('boss', 1)[0], floor, rng);

  populateRoomContent(res.rooms as DungeonCell[], floor, rng, now);

  return { grid: res.grid as DungeonCell[][], rooms: res.rooms as DungeonCell[], start: res.start as DungeonCell };
}

// ---------- apresentação pura (ícone/texto a partir da sala) ----------
// Sem DOM: só deriva string a partir do que já está na célula. O que toca
// `document`/`RPG.UI` (legenda do mapa, título da tela) fica em `handleEnter`
// e `refreshPresentation` no original — não migra pra cá.

export function iconFor(cell: DungeonCell): string {
  if (cell.type === 'npc') return '🧙';
  if (cell.type === 'treasure') return cell.collected ? '' : '🧰';
  if (cell.type === 'monster') return cell.beaten || !cell.monsters?.length ? '' : monsterView(cell.monsters[cell.monsterIndex || 0] as MonsterInstance).icon;
  if (cell.type === 'boss') return cell.beaten ? '' : '👑';
  if (cell.type === 'event') return cell.resolved ? '' : '❓';
  if (cell.type === 'stairs') return '⬇️';
  if (cell.type === 'exit') return '🚪';
  if (cell.type === 'start') return '🚀';
  return '';
}

export function shortLabel(cell: DungeonCell): string {
  if (cell.type === 'monster') {
    if (cell.beaten) return 'os restos de uma batalha';
    return (cell.monsters?.length ?? 0) > 1 ? 'um grupo de criaturas' : 'uma criatura hostil';
  }
  if (cell.type === 'boss') return cell.beaten ? 'um covil agora silencioso' : 'uma presença poderosa e perigosa';
  if (cell.type === 'event') return cell.resolved ? 'vestígios de um acontecimento' : 'algo incomum';
  const labels: Partial<Record<DungeonRoomType, string>> = {
    npc: 'alguém parado por perto',
    treasure: cell.collected ? 'um baú já vazio' : 'um baú fechado',
    stairs: 'escadas descendo',
    exit: 'o caminho de volta à cidade',
    start: 'o ponto de partida',
    normal: 'uma sala vazia',
  };
  return labels[cell.type] ?? 'uma sala';
}

export function roomDesc(cell: DungeonCell): string {
  if (cell.type === 'monster') {
    if (cell.beaten) return 'Os restos da batalha ainda marcam o chão desta sala.';
    const monsters = cell.monsters ?? [];
    return monsters.length > 1
      ? `${monsters.length} criaturas bloqueiam o caminho, observando cada movimento seu.`
      : `<b>${monsterView(monsters[0] as MonsterInstance).name}</b> bloqueia o caminho, observando cada movimento seu.`;
  }
  if (cell.type === 'boss') {
    return cell.beaten
      ? 'O covil do guardião agora está silencioso e vazio.'
      : `Uma presença imensa e hostil domina esta câmara: <b>${monsterView(cell.monsters?.[0] as MonsterInstance).name}</b>.`;
  }
  if (cell.type === 'event') return cell.resolved ? 'O acontecimento desta sala já chegou ao fim.' : 'Algo incomum nesta sala convida a uma escolha.';
  const descs: Partial<Record<DungeonRoomType, string>> = {
    npc: 'Alguém está parado por aqui.',
    treasure: cell.collected ? 'Um baú vazio jaz aberto no chão.' : 'Um baú de madeira reforçada repousa alguns passos à frente.',
    stairs: 'Escadas de pedra descem para a escuridão, mais fundo na masmorra.',
    exit: 'Um caminho iluminado sobe de volta em direção à cidade.',
    start: 'Foi aqui que você chegou a este andar.',
    normal: 'O ar aqui é frio e cheira a pedra úmida. Nada de especial nesta sala.',
  };
  return descs[cell.type] ?? '';
}

export function entryText(cell: DungeonCell): string {
  if (cell.type === 'npc') return `Você avista ${cell.npc?.name}. Deseja se aproximar e conversar?`;
  if (cell.type === 'treasure') return 'Um baú está logo à frente. Deseja abri-lo?';
  if (cell.type === 'monster') return `${(cell.monsters?.length ?? 0) > 1 ? 'Várias criaturas bloqueiam' : 'Uma criatura bloqueia'} o caminho. Deseja entrar na sala?`;
  if (cell.type === 'boss') return 'Uma presença poderosa emana desta sala. Deseja enfrentar o guardião?';
  if (cell.type === 'event') return 'Algo incomum aguarda nesta sala. Deseja investigar?';
  if (cell.type === 'stairs') return 'Escadas descem para um andar mais profundo da masmorra. Deseja descer?';
  if (cell.type === 'exit') return 'Um caminho leva de volta à cidade. Deseja sair da masmorra?';
  return 'Deseja entrar na sala?';
}
