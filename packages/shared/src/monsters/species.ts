export const BEHAVIORS = [
  'agressivo',
  'agil',
  'defensivo',
  'venenoso',
  'lento',
  'magico',
] as const;

export type Behavior = (typeof BEHAVIORS)[number];

export const AFFINITY_TYPES = ['fisico', 'magico', 'nenhuma'] as const;

export type AffinityType = (typeof AFFINITY_TYPES)[number];

export interface Species {
  id: string;
  name: string;
  icon: string;
  behavior: Behavior;
  baseHp: number;
  baseSpeed: number;
  baseDmg: number;
  weakness: AffinityType;
  resistance: AffinityType;
  ability: string;
  abilityDesc: string;
}

export const SPECIES: readonly Species[] = [
  {
    id: 'goblin',
    name: 'Goblin',
    icon: '👹',
    behavior: 'agressivo',
    baseHp: 10,
    baseSpeed: 8,
    baseDmg: 3,
    weakness: 'magico',
    resistance: 'nenhuma',
    ability: 'Ataque Impulsivo',
    abilityDesc: 'Pode causar dano extra.',
  },
  {
    id: 'lobo_sombras',
    name: 'Lobo das Sombras',
    icon: '🐺',
    behavior: 'agil',
    baseHp: 9,
    baseSpeed: 13,
    baseDmg: 3,
    weakness: 'magico',
    resistance: 'fisico',
    ability: 'Reflexos Rápidos',
    abilityDesc: 'Tem chance de evitar ataques comuns.',
  },
  {
    id: 'esqueleto',
    name: 'Esqueleto Errante',
    icon: '💀',
    behavior: 'defensivo',
    baseHp: 13,
    baseSpeed: 6,
    baseDmg: 2,
    weakness: 'magico',
    resistance: 'fisico',
    ability: 'Ossos Reforçados',
    abilityDesc: 'Reduz parte do dano físico recebido.',
  },
  {
    id: 'aranha',
    name: 'Aranha Gigante',
    icon: '🕷️',
    behavior: 'venenoso',
    baseHp: 8,
    baseSpeed: 11,
    baseDmg: 4,
    weakness: 'fisico',
    resistance: 'nenhuma',
    ability: 'Picada Venenosa',
    abilityDesc: 'Pode envenenar o herói por 3 turnos.',
  },
  {
    id: 'slime',
    name: 'Slime Corrosivo',
    icon: '🟢',
    behavior: 'defensivo',
    baseHp: 15,
    baseSpeed: 4,
    baseDmg: 2,
    weakness: 'magico',
    resistance: 'fisico',
    ability: 'Corpo Gelatinoso',
    abilityDesc: 'Reduz parte do dano físico recebido.',
  },
  {
    id: 'orc',
    name: 'Orc Selvagem',
    icon: '👹',
    behavior: 'agressivo',
    baseHp: 14,
    baseSpeed: 7,
    baseDmg: 4,
    weakness: 'magico',
    resistance: 'nenhuma',
    ability: 'Fúria Selvagem',
    abilityDesc: 'Pode causar dano extra.',
  },
  {
    id: 'morcego',
    name: 'Morcego Vampírico',
    icon: '🦇',
    behavior: 'agil',
    baseHp: 7,
    baseSpeed: 14,
    baseDmg: 2,
    weakness: 'fisico',
    resistance: 'magico',
    ability: 'Voo Errático',
    abilityDesc: 'Tem chance de evitar ataques comuns.',
  },
  {
    id: 'zumbi',
    name: 'Zumbi Cambaleante',
    icon: '🧟',
    behavior: 'lento',
    baseHp: 16,
    baseSpeed: 3,
    baseDmg: 3,
    weakness: 'magico',
    resistance: 'fisico',
    ability: 'Golpe Pesado',
    abilityDesc: 'A cada 3 ataques, causa dano elevado.',
  },
  {
    id: 'elemental_fogo',
    name: 'Elemental de Fogo',
    icon: '🔥',
    behavior: 'magico',
    baseHp: 11,
    baseSpeed: 9,
    baseDmg: 5,
    weakness: 'fisico',
    resistance: 'magico',
    ability: 'Chama Arcana',
    abilityDesc: 'Pode queimar e drenar mana.',
  },
  {
    id: 'espectro_gelado',
    name: 'Espectro Gelado',
    icon: '❄️',
    behavior: 'magico',
    baseHp: 12,
    baseSpeed: 10,
    baseDmg: 4,
    weakness: 'fisico',
    resistance: 'magico',
    ability: 'Toque Gélido',
    abilityDesc: 'Pode drenar mana do herói.',
  },
];

const SPECIES_BY_ID = new Map(SPECIES.map((s) => [s.id, s]));

export function speciesById(id: string): Species | null {
  return SPECIES_BY_ID.get(id) ?? null;
}

export interface EnemyClass {
  id: string;
  name: string;
  icon: string;
  power: string;
  powerDesc: string;
  hpMult: number;
  dmgMult: number;
  speedMult: number;
}

export const ENEMY_CLASSES: readonly EnemyClass[] = [
  {
    id: 'brutamontes',
    name: 'Brutamontes',
    icon: '💥',
    power: 'Impacto Brutal',
    powerDesc: 'A cada 3 ataques causa 70% mais dano.',
    hpMult: 1.15,
    dmgMult: 1.2,
    speedMult: 0.9,
  },
  {
    id: 'assassino',
    name: 'Assassino',
    icon: '🗡️',
    power: 'Lâmina Tóxica',
    powerDesc: 'A cada 3 ataques causa dano extra e aplica veneno.',
    hpMult: 0.9,
    dmgMult: 1.15,
    speedMult: 1.25,
  },
  {
    id: 'xama',
    name: 'Xamã',
    icon: '🔮',
    power: 'Regeneração Profana',
    powerDesc: 'A cada 3 ataques recupera parte da própria Vida.',
    hpMult: 1,
    dmgMult: 1.05,
    speedMult: 1,
  },
  {
    id: 'guardiao',
    name: 'Guardião',
    icon: '🛡️',
    power: 'Muralha Sombria',
    powerDesc: 'A cada 3 ataques reduz o dano dos próximos golpes.',
    hpMult: 1.35,
    dmgMult: 0.95,
    speedMult: 0.8,
  },
  {
    id: 'feiticeiro',
    name: 'Feiticeiro',
    icon: '🧙',
    power: 'Ruptura Arcana',
    powerDesc: 'A cada 3 ataques drena Mana e aumenta o dano mágico.',
    hpMult: 0.95,
    dmgMult: 1.18,
    speedMult: 1.05,
  },
];

const ENEMY_CLASSES_BY_ID = new Map(ENEMY_CLASSES.map((c) => [c.id, c]));

export function enemyClassById(id: string): EnemyClass | null {
  return ENEMY_CLASSES_BY_ID.get(id) ?? null;
}

/** Prefixos que variam o nome do monstro conforme o andar aumenta. */
export interface TierAdjective {
  min: number;
  max: number;
  label: string;
}

export const TIER_ADJECTIVES: readonly TierAdjective[] = [
  { min: 1, max: 3, label: '' },
  { min: 4, max: 7, label: 'Corrompido' },
  { min: 8, max: 12, label: 'Ancestral' },
  { min: 13, max: 18, label: 'Amaldiçoado' },
  { min: 19, max: 99, label: 'Lendário' },
];

export function tierLabelFor(floor: number): string {
  for (const t of TIER_ADJECTIVES) {
    if (floor >= t.min && floor <= t.max) return t.label;
  }
  return '';
}

export const BOSS_TITLES = [
  'o Devorador',
  'o Flagelo',
  'Senhor das Trevas',
  'o Ímpio',
  'o Eterno',
  'Rei dos Ossos',
  'a Calamidade',
] as const;
