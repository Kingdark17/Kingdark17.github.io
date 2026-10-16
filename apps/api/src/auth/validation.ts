/**
 * Validação de slot/save/transição — mesmos limites do `accounts.js`
 * original (`validSlot`/`validSave`/`validTransition`): nível só sobe até
 * +5 por save, ouro só sobe até +5000, andar só avança 1 por vez (exceto
 * voltando pra cidade no andar 1 ou entrando pelo portão), inventário não
 * cresce mais que 30 itens por save (respeitando o teto de 250), atributos
 * rastreados só sobem até +10 e ficam entre 1 e 99.
 */

import { entryFloors, legacyProgress, normalizeProgress, normalizeRun, type DungeonProgress } from '@rpg-legend/shared';

export const MAX_SLOTS = 4;

export function isValidSlot(value: unknown): boolean {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_SLOTS;
}

export interface SaveHero {
  name?: unknown;
  attrs?: Record<string, unknown>;
  equip?: unknown;
  level?: unknown;
  gold?: unknown;
}

export interface SaveData {
  hero?: SaveHero;
  inventory?: unknown[];
  party?: unknown[];
  floor?: unknown;
  mapMode?: unknown;
  masmorra?: unknown;
  progresso?: unknown;
}

export function isValidSave(data: unknown): data is SaveData {
  if (!data || typeof data !== 'object') return false;
  const save = data as SaveData;
  const hero = save.hero;
  const floor = Number(save.floor);
  return !!(
    hero &&
    typeof hero.name === 'string' &&
    hero.attrs &&
    hero.equip &&
    Array.isArray(save.inventory) &&
    Array.isArray(save.party) &&
    floor >= 1 &&
    floor <= 10000
  );
}

const TRACKED_ATTRS = ['forca', 'destreza', 'constituicao', 'intelecto', 'sabedoria', 'carisma'] as const;

/** O progresso como a engine lê o save (`retomarSave`): sem `progresso`, os totens já passados pelo andar. */
function progressOf(save: SaveData): DungeonProgress {
  return save.progresso ? normalizeProgress(save.progresso) : legacyProgress(Number(save.floor) || 1);
}

/**
 * O portão entra pelo andar 1 ou por um totem que o save anterior já tinha.
 * Não é pular andar: a saída da masmorra guarda o andar onde o herói estava,
 * então voltar pelo portão faz o número descer. Não exige que o save
 * anterior seja da cidade — a gravação espera a pessoa parar, e quem sai e
 * entra de novo rápido chega aqui sem a cidade ter sido gravada.
 */
function enteredByGate(oldSave: SaveData, next: SaveData, newFloor: number): boolean {
  return next.mapMode === 'dungeon' && entryFloors(progressOf(oldSave), normalizeRun(next.masmorra)).includes(newFloor);
}

/**
 * Só se toca um totem estando no andar dele, e o andar anda um por save:
 * um totem que o save anterior não tinha é o andar de um dos dois saves.
 * Sem isto, totens forjados abririam o portão pra qualquer andar.
 */
function totemsAreReachable(oldSave: SaveData, next: SaveData, oldFloor: number, newFloor: number): boolean {
  if (!next.progresso) return true;
  const before = progressOf(oldSave).totems;
  for (const [run, floors] of Object.entries(normalizeProgress(next.progresso).totems)) {
    for (const floor of floors) {
      if (!(before[run] ?? []).includes(floor) && floor !== oldFloor && floor !== newFloor) return false;
    }
  }
  return true;
}

export function isValidTransition(oldSave: SaveData | null | undefined, next: SaveData): boolean {
  if (!oldSave) return true;

  const a = oldSave.hero ?? {};
  const b = next.hero ?? {};
  const oldLevel = Number(a.level) || 1;
  const newLevel = Number(b.level) || 1;
  const oldGold = Number(a.gold) || 0;
  const newGold = Number(b.gold) || 0;
  if (newLevel < oldLevel || newLevel > oldLevel + 5) return false;
  if (newGold < 0 || newGold > oldGold + 5000) return false;

  const oldFloor = Number(oldSave.floor) || 1;
  const newFloor = Number(next.floor) || 1;
  const returnedToCity = (next.mapMode === 'city' || next.mapMode === 'town') && newFloor === 1;
  const throughGate = enteredByGate(oldSave, next, newFloor);
  if (!throughGate && ((newFloor < oldFloor && !returnedToCity) || newFloor > oldFloor + 1)) return false;
  if (!totemsAreReachable(oldSave, next, oldFloor, newFloor)) return false;

  if ((next.inventory ?? []).length > Math.max(250, (oldSave.inventory ?? []).length + 30)) return false;

  for (const key of TRACKED_ATTRS) {
    const before = Number((a.attrs ?? {})[key]) || 0;
    const after = Number((b.attrs ?? {})[key]) || 0;
    if (after < 1 || after > 99 || after > before + 10) return false;
  }
  return true;
}
