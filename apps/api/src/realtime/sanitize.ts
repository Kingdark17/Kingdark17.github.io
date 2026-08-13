/**
 * Validação/saneamento autoritativo do relay de sala multiplayer — porta
 * de `sanitizeParty`/`sanitizeHero`/`sanitizeProfile`/`publicProfiles` no
 * `server.js` original. Reaproveita `equipmentCap`/`equipmentStat`/
 * `xpForLevel`/`ATTR_KEYS` de `@rpg-legend/shared` pro cálculo de
 * HP/MP — mesma fórmula que `derivedStats()` já unificou entre cliente e
 * servidor (ver o doc comment de `hero/derived.ts`); só a parte de
 * anti-cheat propriamente dita (nível/atributos/ouro só crescem dentro
 * de um teto por submissão) é específica desse relay e não existe em
 * `packages/shared`.
 *
 * Funções puras: recebem o candidato bruto (JSON não-confiável) e o
 * estado anteriormente aceito, devolvem o estado saneado. Não fazem I/O
 * — quem chama (`RoomRegistry`) é responsável por guardar o resultado.
 */

import { ATTR_KEYS, equipmentCap, equipmentStat, xpForLevel, type Equipment } from '@rpg-legend/shared';

import { clampInt, cloneJson } from './numeric';

const GOD_ATTR = 999;
const GOD_HP = 999999;
const GOD_MP = 999999;
const GOD_GOLD = 999999999;
const MAX_PARTY_SIZE = 2;

export interface SanitizedHeroRecord {
  hero: Record<string, unknown>;
  baseAttrs: number;
}

export function sanitizeParty(party: unknown): Record<string, unknown>[] {
  const list = Array.isArray(party) ? party : [];
  return list.slice(0, MAX_PARTY_SIZE).map((member) => {
    const clean = cloneJson((member ?? {}) as Record<string, unknown>);
    clean.maxHp = clampInt(clean.maxHp, 1, 1000);
    clean.hp = clampInt(clean.hp, 0, clean.maxHp as number);
    clean.attack = clampInt(clean.attack, 1, 250);
    clean.combatsLeft = clean.temporary ? clampInt(clean.combatsLeft, 0, 10) : clean.combatsLeft;
    return clean;
  });
}

export function sanitizeHero(candidate: unknown, previousRecord: SanitizedHeroRecord | null, adminFlag: boolean): SanitizedHeroRecord {
  const hero = cloneJson((candidate ?? {}) as Record<string, unknown>);
  const previous = previousRecord?.hero;

  if (adminFlag) {
    const attrs: Record<string, number> = { ...((hero.attrs as Record<string, number>) ?? {}) };
    for (const key of ATTR_KEYS) attrs[key] = GOD_ATTR;
    hero.attrs = attrs;
    hero.level = clampInt(hero.level, 1, 9999) || 1;
    hero.maxHp = GOD_HP;
    hero.maxMp = GOD_MP;
    hero.hp = GOD_HP;
    hero.mp = GOD_MP;
    hero.xpNext = xpForLevel(hero.level as number);
    hero.xp = clampInt(hero.xp, 0, hero.xpNext as number);
    hero.attrPoints = clampInt(hero.attrPoints, 0, 999);
    hero.gold = GOD_GOLD;
    hero.killCount = clampInt(hero.killCount, 0, 100000000);
    if (hero.derived && typeof hero.derived === 'object') {
      hero.derived = { ...(hero.derived as Record<string, unknown>), maxHp: GOD_HP, maxMp: GOD_MP };
    }
    return { hero, baseAttrs: ATTR_KEYS.length * GOD_ATTR };
  }

  const previousLevel = previous ? clampInt(previous.level, 1, 500) : 1;
  hero.level = previous ? clampInt(hero.level, previousLevel, previousLevel + 5) : 1;

  const attrs: Record<string, number> = { ...((hero.attrs as Record<string, number>) ?? {}) };
  for (const key of ATTR_KEYS) attrs[key] = clampInt(attrs[key], 1, previous ? 99 : 20);
  hero.attrs = attrs;

  const total = ATTR_KEYS.reduce((sum, key) => sum + attrs[key], 0);
  const baseline = previousRecord?.baseAttrs ? previousRecord.baseAttrs : Math.min(total, 100);
  const allowedTotal = baseline + Math.max(0, (hero.level as number) - 1) * 2;
  if (total > allowedTotal) {
    let excess = total - allowedTotal;
    for (const key of [...ATTR_KEYS].reverse()) {
      const cut = Math.min(excess, Math.max(0, attrs[key] - 1));
      attrs[key] -= cut;
      excess -= cut;
    }
  }

  const cap = equipmentCap(hero.level as number);
  const equip = (hero.equip ?? {}) as Equipment;
  const calculatedHp = 20 + (hero.level as number) * 5 + attrs.constituicao * 10 + equipmentStat(equip, 'vida', cap);
  const calculatedMp = 10 + (hero.level as number) * 2 + attrs.intelecto * 5 + equipmentStat(equip, 'mana', cap);
  hero.maxHp = calculatedHp;
  hero.maxMp = calculatedMp;
  hero.hp = clampInt(hero.hp, 0, calculatedHp);
  hero.mp = clampInt(hero.mp, 0, calculatedMp);
  hero.xpNext = xpForLevel(hero.level as number);
  hero.xp = clampInt(hero.xp, 0, (hero.xpNext as number) - 1);
  hero.attrPoints = clampInt(hero.attrPoints, 0, Math.max(0, ((hero.level as number) - 1) * 2));
  hero.gold = previous ? clampInt(hero.gold, 0, clampInt(previous.gold, 0, 100000000) + 5000) : clampInt(hero.gold, 0, 100);
  hero.killCount = previous
    ? clampInt(hero.killCount, clampInt(previous.killCount, 0, 1000000), clampInt(previous.killCount, 0, 1000000) + 20)
    : 0;
  if (hero.derived && typeof hero.derived === 'object') {
    hero.derived = { ...(hero.derived as Record<string, unknown>), maxHp: calculatedHp, maxMp: calculatedMp };
  }

  return { hero, baseAttrs: baseline };
}

export interface SanitizedProfile {
  name: string;
  hero: Record<string, unknown>;
  inventory: unknown[];
  party: Record<string, unknown>[];
  baseAttrs: number;
}

export function sanitizeProfile(profile: unknown, previousRecord: SanitizedHeroRecord | null, adminFlag: boolean): SanitizedProfile {
  const source = (profile ?? {}) as Record<string, unknown>;
  const result = sanitizeHero(source.hero, previousRecord, adminFlag);
  return {
    name: String(source.name || 'Aventureiro').slice(0, 20),
    hero: result.hero,
    inventory: Array.isArray(source.inventory) ? cloneJson(source.inventory).slice(0, 120) : [],
    party: sanitizeParty(source.party),
    baseAttrs: result.baseAttrs,
  };
}

export interface PublicProfile {
  name: string;
  hero: Record<string, unknown>;
  inventory: unknown[];
  party: Record<string, unknown>[];
}

export function toPublicProfile(profile: SanitizedProfile): PublicProfile {
  return { name: profile.name, hero: profile.hero, inventory: profile.inventory, party: profile.party };
}
