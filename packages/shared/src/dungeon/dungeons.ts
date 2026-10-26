/**
 * As masmorras: Floresta, Caverna e Torre. Doc do Breno (2026-10): "Fazer
 * mais dungeons ex: Floresta iniciantes, Caverna media, Torre final, todas
 * com três níveis de dificuldade interna, com nivel min pra entrar em cada
 * uma" e "Aumentar a dificuldade da dungeon quando a floresta for zerada".
 *
 * As decisões do usuário (2026-10-09):
 * - as três são **separadas**, cada uma do andar 1 ao 100, e zerar é vencer
 *   o chefe do andar 100;
 * - a dificuldade é escolhida no portão (Normal, Difícil, Pesadelo), e
 *   zerar uma libera a seguinte da mesma masmorra;
 * - cada uma pede um nível mínimo, além de a anterior estar zerada no
 *   Normal (eram 1, 15 e 30; desde 2026-10-25, 1, 70 e 140, ver abaixo);
 * - a força segue a escada que ele descreveu — "a Floresta no Pesadelo tem
 *   a dificuldade dos 4 primeiros andares da Caverna no Normal, e a Caverna
 *   no Pesadelo a dos 4 primeiros da Torre" — **só nos começos**: dentro de
 *   cada masmorra a força sobe andar a andar como sempre subiu;
 * - um totem nos andares 20, 40, 60 e 80 guarda o ponto de volta, por
 *   masmorra e dificuldade;
 * - os monstros de hoje se dividem por masmorra, com repetição.
 *
 * Em 2026-10-25, depois de o Breno zerar a Floresta (nível 80, "nivel min
 * dos bixo da caverna deve ser 70 no modo normal"), o usuário decidiu: os
 * monstros ganham nível (`monsterLevel`), a Caverna Normal começa com
 * monstros de nível 70, a escada continua valendo (o degrau cresceu, ver
 * `FLOORS_PER_DUNGEON`) e a entrada pede o nível dos monstros do primeiro
 * andar: 70 a Caverna, 140 a Torre.
 *
 * Aqui só tem regra e dado. Gerar o andar é de `generate.ts`; o portão, o
 * totem e o save são de quem orquestra.
 */

export type DungeonId = 'floresta' | 'caverna' | 'torre';
export type DifficultyId = 'normal' | 'dificil' | 'pesadelo';

export interface DungeonDef {
  id: DungeonId;
  name: string;
  icon: string;
  /** O nível dos monstros do primeiro andar no Normal (`monsterLevel(effectiveFloor(normal, 1))`). */
  minLevel: number;
  /** A masmorra que precisa estar zerada, no Normal, antes desta abrir. */
  requires: DungeonId | null;
  /** Ids de `monsters/species.ts` que aparecem aqui. */
  species: readonly string[];
}

export const DUNGEONS: readonly DungeonDef[] = [
  { id: 'floresta', name: 'Floresta', icon: '🌲', minLevel: 1, requires: null, species: ['goblin', 'lobo_sombras', 'aranha', 'slime'] },
  { id: 'caverna', name: 'Caverna', icon: '🦇', minLevel: 70, requires: 'floresta', species: ['morcego', 'esqueleto', 'orc', 'zumbi', 'aranha'] },
  { id: 'torre', name: 'Torre', icon: '🗼', minLevel: 140, requires: 'caverna', species: ['elemental_fogo', 'espectro_gelado', 'esqueleto', 'orc'] },
];

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
}

export const DIFFICULTIES: readonly DifficultyDef[] = [
  { id: 'normal', name: 'Normal' },
  { id: 'dificil', name: 'Difícil' },
  { id: 'pesadelo', name: 'Pesadelo' },
];

export const DUNGEON_FLOORS = 100;
export const TOTEM_FLOORS: readonly number[] = [20, 40, 60, 80];

/** Onde o jogador está descendo: qual masmorra, em que dificuldade. */
export interface DungeonRun {
  dungeon: DungeonId;
  difficulty: DifficultyId;
}

export const DEFAULT_RUN: DungeonRun = { dungeon: 'floresta', difficulty: 'normal' };

export function dungeonById(id: string): DungeonDef | null {
  return DUNGEONS.find((d) => d.id === id) ?? null;
}

export function difficultyById(id: string): DifficultyDef | null {
  return DIFFICULTIES.find((d) => d.id === id) ?? null;
}

/** O que veio do save ou da rede: o que não for masmorra e dificuldade conhecidas vira Floresta Normal. */
export function normalizeRun(raw: unknown): DungeonRun {
  const candidato = (raw ?? {}) as Partial<Record<keyof DungeonRun, unknown>>;
  const dungeon = typeof candidato.dungeon === 'string' ? dungeonById(candidato.dungeon) : null;
  const difficulty = typeof candidato.difficulty === 'string' ? difficultyById(candidato.difficulty) : null;
  return { dungeon: dungeon?.id ?? DEFAULT_RUN.dungeon, difficulty: difficulty?.id ?? DEFAULT_RUN.difficulty };
}

/** "Floresta · Difícil". */
export function runName(run: DungeonRun): string {
  return `${dungeonById(run.dungeon)?.name ?? run.dungeon} · ${difficultyById(run.difficulty)?.name ?? run.difficulty}`;
}

export function runKey(run: DungeonRun): string {
  return `${run.dungeon}:${run.difficulty}`;
}

// ---------- força ----------

/**
 * O degrau de força de uma masmorra numa dificuldade: Floresta Normal 0,
 * Difícil 1, Pesadelo 2; Caverna Normal 2… O Pesadelo de uma é o mesmo
 * degrau do Normal da seguinte — é a regra do usuário escrita em número.
 */
export function tierOf(run: DungeonRun): number {
  const masmorra = Math.max(0, DUNGEONS.findIndex((d) => d.id === run.dungeon));
  const dificuldade = Math.max(0, DIFFICULTIES.findIndex((d) => d.id === run.difficulty));
  return masmorra * 2 + dificuldade;
}

/**
 * Andares de força entre o começo de uma masmorra e o da seguinte, no
 * Normal; cada dificuldade sobe meio disso, e o Pesadelo de uma cai no
 * Normal da seguinte (a escada do usuário). Com 77, a Caverna Normal começa
 * na força 78 — monstros de nível 70, o que o Breno pediu — e a Torre Normal
 * na 155, nível 140. Até 2026-10-25 eram 7 andares por degrau (a Caverna
 * começava na força 15).
 */
export const FLOORS_PER_DUNGEON = 77;

/** Quantos andares de força o degrau desta masmorra nesta dificuldade soma: 0, 39, 77, 116, 154, 193, 231. */
export function tierOffset(run: DungeonRun): number {
  return Math.floor((tierOf(run) * FLOORS_PER_DUNGEON + 1) / 2);
}

/**
 * O andar que os monstros, o ouro e os itens enxergam. Dentro da masmorra
 * sobe um por andar, como sempre subiu; o degrau só muda onde ela começa.
 */
export function effectiveFloor(run: DungeonRun, floor: number): number {
  return floor + tierOffset(run);
}

export function isTotemFloor(floor: number): boolean {
  return TOTEM_FLOORS.includes(floor);
}

// ---------- progresso ----------

/** O que o personagem já conquistou nas masmorras. Mora no save, ao lado do andar. */
export interface DungeonProgress {
  /** `runKey` das masmorras e dificuldades já zeradas (chefe do andar 100 vencido). */
  cleared: string[];
  /** Andares de totem já tocados, por `runKey`. */
  totems: Record<string, number[]>;
}

export function emptyProgress(): DungeonProgress {
  return { cleared: [], totems: {} };
}

/** O que veio do save: só chave conhecida e andar de totem de verdade sobrevivem. */
export function normalizeProgress(raw: unknown): DungeonProgress {
  const candidato = (raw ?? {}) as { cleared?: unknown; totems?: unknown };
  const chaves = new Set(DUNGEONS.flatMap((d) => DIFFICULTIES.map((f) => runKey({ dungeon: d.id, difficulty: f.id }))));

  const cleared = Array.isArray(candidato.cleared) ? candidato.cleared.filter((c): c is string => typeof c === 'string' && chaves.has(c)) : [];
  const totems: Record<string, number[]> = {};
  if (candidato.totems && typeof candidato.totems === 'object') {
    for (const [chave, andares] of Object.entries(candidato.totems as Record<string, unknown>)) {
      if (!chaves.has(chave) || !Array.isArray(andares)) continue;
      const validos = [...new Set(andares.filter((a): a is number => typeof a === 'number' && isTotemFloor(a)))].sort((a, b) => a - b);
      if (validos.length) totems[chave] = validos;
    }
  }
  return { cleared: [...new Set(cleared)], totems };
}

export function isCleared(progress: DungeonProgress, run: DungeonRun): boolean {
  return progress.cleared.includes(runKey(run));
}

export type LockReason =
  | { kind: 'level'; minLevel: number }
  | { kind: 'previous_dungeon'; dungeon: DungeonId }
  | { kind: 'previous_difficulty'; difficulty: DifficultyId };

/** Por que esta masmorra nesta dificuldade está fechada, ou `null` se abre. */
export function lockReason(progress: DungeonProgress, heroLevel: number, run: DungeonRun): LockReason | null {
  const masmorra = dungeonById(run.dungeon);
  if (!masmorra) return null;
  if (heroLevel < masmorra.minLevel) return { kind: 'level', minLevel: masmorra.minLevel };
  if (masmorra.requires && !isCleared(progress, { dungeon: masmorra.requires, difficulty: 'normal' })) {
    return { kind: 'previous_dungeon', dungeon: masmorra.requires };
  }
  const indice = DIFFICULTIES.findIndex((d) => d.id === run.difficulty);
  const anterior = indice > 0 ? DIFFICULTIES[indice - 1] : undefined;
  if (anterior && !isCleared(progress, { dungeon: run.dungeon, difficulty: anterior.id })) {
    return { kind: 'previous_difficulty', difficulty: anterior.id };
  }
  return null;
}

/** Por onde dá pra entrar: o andar 1 e os totens já tocados, em ordem. */
export function entryFloors(progress: DungeonProgress, run: DungeonRun): number[] {
  return [1, ...(progress.totems[runKey(run)] ?? [])];
}

export function touchTotem(progress: DungeonProgress, run: DungeonRun, floor: number): DungeonProgress {
  if (!isTotemFloor(floor)) return progress;
  const chave = runKey(run);
  const tocados = progress.totems[chave] ?? [];
  if (tocados.includes(floor)) return progress;
  return { ...progress, totems: { ...progress.totems, [chave]: [...tocados, floor].sort((a, b) => a - b) } };
}

export function markCleared(progress: DungeonProgress, run: DungeonRun): DungeonProgress {
  if (isCleared(progress, run)) return progress;
  return { ...progress, cleared: [...progress.cleared, runKey(run)] };
}

/**
 * O save de antes das masmorras: a masmorra sem fim vira a Floresta Normal,
 * e quem estava no andar 37 ganha o totem do 20, que já passou (decisão do
 * usuário, 2026-10-09).
 */
export function legacyProgress(floor: number): DungeonProgress {
  const andar = Number.isFinite(floor) ? floor : 1;
  const passados = TOTEM_FLOORS.filter((t) => t <= andar);
  return passados.length ? { cleared: [], totems: { [runKey(DEFAULT_RUN)]: [...passados] } } : emptyProgress();
}
