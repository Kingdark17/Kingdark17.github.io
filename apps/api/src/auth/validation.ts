/**
 * Validação de slot/save/transição — mesmos limites do `accounts.js`
 * original (`validSlot`/`validSave`/`validTransition`): nível só sobe até
 * +5 por save, ouro só sobe até +5000, andar só avança 1 por vez (exceto
 * voltando pra cidade no andar 1), inventário não cresce mais que 30 itens
 * por save (respeitando o teto de 250), atributos rastreados só sobem até
 * +10 e ficam entre 1 e 99.
 */

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
  if ((newFloor < oldFloor && !returnedToCity) || newFloor > oldFloor + 1) return false;

  if ((next.inventory ?? []).length > Math.max(250, (oldSave.inventory ?? []).length + 30)) return false;

  for (const key of TRACKED_ATTRS) {
    const before = Number((a.attrs ?? {})[key]) || 0;
    const after = Number((b.attrs ?? {})[key]) || 0;
    if (after < 1 || after > 99 || after > before + 10) return false;
  }
  return true;
}
