/**
 * Tipos centrais do herói, compartilhados por cliente e servidor.
 *
 * Este arquivo é a razão de ser do pacote: antes da migração, `js/player.js`
 * e `server/server.js` mantinham duas definições paralelas dos mesmos dados,
 * e qualquer mudança precisava ser espelhada à mão nos dois lugares.
 */

export const ATTR_KEYS = [
  'forca',
  'destreza',
  'constituicao',
  'intelecto',
  'sabedoria',
  'carisma',
] as const;

export type AttrKey = (typeof ATTR_KEYS)[number];

export type Attributes = Record<AttrKey, number>;

export const EQUIP_SLOTS = ['arma', 'secundaria', 'armadura', 'acessorio'] as const;

export type EquipSlot = (typeof EQUIP_SLOTS)[number];

export const ITEM_STAT_KEYS = [
  'ataque',
  'defesa',
  'vida',
  'mana',
  'critico',
  'velocidade',
  'esquiva',
] as const;

export type ItemStatKey = (typeof ITEM_STAT_KEYS)[number];

export type ItemStats = Partial<Record<ItemStatKey, number>>;

/** O mínimo que a engine precisa saber de um item para derivar atributos. */
export interface EquippableItem {
  stats: ItemStats;
}

export type Equipment = Partial<Record<EquipSlot, EquippableItem | null>>;

/** Subconjunto do herói do qual os atributos derivados dependem. */
export interface HeroCore {
  level: number;
  attrs: Attributes;
  equip: Equipment;
}

export interface DerivedStats {
  maxHp: number;
  maxMp: number;
  dmgFisico: number;
  dmgMagico: number;
  esquiva: number;
  critico: number;
  velocidade: number;
  curaBonus: number;
  resistMagica: number;
  descontoLoja: number;
}

export function emptyAttributes(): Attributes {
  return {
    forca: 0,
    destreza: 0,
    constituicao: 0,
    intelecto: 0,
    sabedoria: 0,
    carisma: 0,
  };
}
