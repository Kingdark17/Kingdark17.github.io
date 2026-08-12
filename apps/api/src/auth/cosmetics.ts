/**
 * Catálogo de cosméticos e visão pública do usuário — mesmos itens, preços
 * e regra de admin do `accounts.js` original (`PROFILE_CATALOG`,
 * `cosmeticsFor`, `safeUser`). `adminUsername` entra como parâmetro em vez
 * de ser lido de `process.env.ADMIN_USERNAME` direto, mesmo motivo de
 * `save-signature.ts`: manter a lógica pura e testável.
 *
 * `UserRow` usa os nomes de campo em camelCase do schema Drizzle
 * (`db/schema.ts`), não os snake_case da query crua do servidor original.
 */

export const PROFILE_FRAMES = ['none', 'bronze', 'silver', 'gold', 'arcane', 'emerald', 'crimson', 'obsidian', 'celestial', 'rgb'] as const;
export const PROFILE_COLORS = [
  '#e8d7a5',
  '#ffffff',
  '#6ee7ff',
  '#8cff98',
  '#d8a4ff',
  '#ff8f8f',
  '#ffd166',
  '#ff9f43',
  '#ff72c6',
  '#4fffe1',
  '#b8ff5a',
  'rainbow',
] as const;
export const PROFILE_PETS = ['none', 'chicken', 'cat', 'fox', 'owl', 'slime', 'wolf', 'fairy', 'baby_dragon', 'admin_dragon'] as const;

export type CosmeticType = 'frame' | 'color' | 'pet';

export interface ProfileCatalogItem {
  id: string;
  type: CosmeticType;
  value: string;
  name: string;
  icon: string;
  price: number;
  adminOnly?: boolean;
}

export const PROFILE_CATALOG: ProfileCatalogItem[] = [
  { id: 'frame_bronze', type: 'frame', value: 'bronze', name: 'Moldura de Bronze', icon: '🟤', price: 100 },
  { id: 'frame_silver', type: 'frame', value: 'silver', name: 'Moldura de Prata', icon: '⚪', price: 250 },
  { id: 'frame_gold', type: 'frame', value: 'gold', name: 'Moldura Dourada', icon: '🟡', price: 600 },
  { id: 'frame_arcane', type: 'frame', value: 'arcane', name: 'Moldura Arcana', icon: '🔮', price: 1200 },
  { id: 'color_blue', type: 'color', value: '#6ee7ff', name: 'Nome Azul', icon: '🔵', price: 150 },
  { id: 'color_green', type: 'color', value: '#8cff98', name: 'Nome Verde', icon: '🟢', price: 150 },
  { id: 'color_purple', type: 'color', value: '#d8a4ff', name: 'Nome Roxo', icon: '🟣', price: 250 },
  { id: 'color_red', type: 'color', value: '#ff8f8f', name: 'Nome Vermelho', icon: '🔴', price: 250 },
  { id: 'color_gold', type: 'color', value: '#ffd166', name: 'Nome Dourado', icon: '✨', price: 500 },
  { id: 'pet_chicken', type: 'pet', value: 'chicken', name: 'Galinha Companheira', icon: '🐔', price: 500 },
  { id: 'pet_cat', type: 'pet', value: 'cat', name: 'Gato Sortudo', icon: '🐈', price: 650 },
  { id: 'pet_fox', type: 'pet', value: 'fox', name: 'Raposa Astuta', icon: '🦊', price: 900 },
  { id: 'pet_owl', type: 'pet', value: 'owl', name: 'Coruja Arcana', icon: '🦉', price: 900 },
  { id: 'pet_slime', type: 'pet', value: 'slime', name: 'Slime Amigável', icon: '🟢', price: 750 },
  { id: 'frame_emerald', type: 'frame', value: 'emerald', name: 'Moldura Esmeralda', icon: '💚', price: 850 },
  { id: 'frame_crimson', type: 'frame', value: 'crimson', name: 'Moldura Carmesim', icon: '❤️', price: 950 },
  { id: 'frame_obsidian', type: 'frame', value: 'obsidian', name: 'Moldura Obsidiana', icon: '🖤', price: 1400 },
  { id: 'frame_celestial', type: 'frame', value: 'celestial', name: 'Moldura Celestial', icon: '🌟', price: 1800 },
  { id: 'frame_rgb', type: 'frame', value: 'rgb', name: 'Moldura RGB do ADM', icon: '🌈', price: 0, adminOnly: true },
  { id: 'color_orange', type: 'color', value: '#ff9f43', name: 'Nome Laranja', icon: '🟠', price: 200 },
  { id: 'color_pink', type: 'color', value: '#ff72c6', name: 'Nome Rosa', icon: '🩷', price: 300 },
  { id: 'color_cyan', type: 'color', value: '#4fffe1', name: 'Nome Ciano', icon: '💠', price: 350 },
  { id: 'color_lime', type: 'color', value: '#b8ff5a', name: 'Nome Lima', icon: '🍀', price: 350 },
  { id: 'color_rgb', type: 'color', value: 'rainbow', name: 'Nome RGB do ADM', icon: '🌈', price: 0, adminOnly: true },
  { id: 'pet_wolf', type: 'pet', value: 'wolf', name: 'Lobo Guardião', icon: '🐺', price: 1100 },
  { id: 'pet_fairy', type: 'pet', value: 'fairy', name: 'Fada Curandeira', icon: '🧚', price: 1250 },
  { id: 'pet_baby_dragon', type: 'pet', value: 'baby_dragon', name: 'Dragão Filhote', icon: '🐲', price: 1800 },
  { id: 'pet_admin_dragon', type: 'pet', value: 'admin_dragon', name: 'Dragão Lendário do ADM', icon: '🐉', price: 0, adminOnly: true },
];

export interface Cosmetics {
  frames: string[];
  colors: string[];
  pets: string[];
}

export function defaultCosmetics(): Cosmetics {
  return { frames: ['none'], colors: ['#e8d7a5', '#ffffff'], pets: ['none'] };
}

export interface UserRow {
  id: number;
  username: string;
  email: string | null;
  emailVerified: boolean;
  avatarUrl: string;
  profileFrame: string;
  nameColor: string;
  pet: string;
  cosmetics: unknown;
  createdAt: Date;
}

export function isAdmin(row: Pick<UserRow, 'username'> | null | undefined, adminUsername: string): boolean {
  const normalizedAdmin = adminUsername.trim().toLowerCase();
  return !!(row && String(row.username || '').trim().toLowerCase() === normalizedAdmin);
}

export function cosmeticsFor(row: UserRow | null | undefined, adminUsername: string): Cosmetics {
  const source = row && row.cosmetics && typeof row.cosmetics === 'object' ? (row.cosmetics as Partial<Cosmetics>) : defaultCosmetics();
  const owned: Cosmetics = {
    frames: Array.isArray(source.frames) ? [...source.frames] : ['none'],
    colors: Array.isArray(source.colors) ? [...source.colors] : ['#e8d7a5'],
    pets: Array.isArray(source.pets) ? [...source.pets] : ['none'],
  };
  if (isAdmin(row, adminUsername)) {
    if (!owned.frames.includes('rgb')) owned.frames.push('rgb');
    if (!owned.colors.includes('rainbow')) owned.colors.push('rainbow');
    if (!owned.pets.includes('admin_dragon')) owned.pets.push('admin_dragon');
  }
  return owned;
}

export interface SafeUser {
  id: number;
  username: string;
  isAdmin: boolean;
  email: string | null;
  emailVerified: boolean;
  avatarUrl: string;
  frame: string;
  nameColor: string;
  pet: string;
  cosmetics: Cosmetics;
  createdAt: Date;
}

export function safeUser(row: UserRow, adminUsername: string): SafeUser {
  return {
    id: row.id,
    username: row.username,
    isAdmin: isAdmin(row, adminUsername),
    email: row.email || null,
    emailVerified: !!row.emailVerified,
    avatarUrl: row.avatarUrl || '',
    frame: row.profileFrame || 'none',
    nameColor: row.nameColor || '#e8d7a5',
    pet: row.pet || 'none',
    cosmetics: cosmeticsFor(row, adminUsername),
    createdAt: row.createdAt,
  };
}
