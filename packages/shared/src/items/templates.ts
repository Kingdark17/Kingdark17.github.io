import type { ItemStatKey } from '../hero/stats.js';

export const ITEM_CATEGORIES = [
  'arma',
  'armadura',
  'acessorio',
  'consumivel',
  'material',
  'missao',
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  arma: 'Arma',
  armadura: 'Armadura',
  acessorio: 'Acessório',
  consumivel: 'Consumível',
  material: 'Material',
  missao: 'Missão',
};

/** Categorias que ocupam slot e entram no cálculo de atributos derivados. */
export const EQUIPPABLE_CATEGORIES = ['arma', 'armadura', 'acessorio'] as const;

export function isEquippable(category: string): boolean {
  return (EQUIPPABLE_CATEGORIES as readonly string[]).includes(category);
}

/** Stats que só fazem sentido em consumível. */
export const CONSUMABLE_STAT_KEYS = ['cura', 'curaMana'] as const;

export type ConsumableStatKey = (typeof CONSUMABLE_STAT_KEYS)[number];

export type AnyStatKey = ItemStatKey | ConsumableStatKey;

export type StatBlock = Partial<Record<AnyStatKey, number>>;

export const STAT_LABELS: Record<AnyStatKey, string> = {
  ataque: 'Ataque',
  defesa: 'Defesa',
  vida: 'Vida',
  mana: 'Mana',
  critico: 'Crítico',
  velocidade: 'Velocidade',
  esquiva: 'Esquiva',
  cura: 'Cura',
  curaMana: 'Restaura Mana',
};

export const PROC_EFFECTS = [
  'queimadura',
  'atordoar',
  'sangramento',
  'mana_gratis',
  'cura_no_acerto',
] as const;

export type ProcEffect = (typeof PROC_EFFECTS)[number];

export interface ProcTemplate {
  chance: number;
  effect: ProcEffect;
  label: string;
  icon: string;
}

export interface ItemTemplate {
  id: string;
  name: string;
  category: ItemCategory;
  desc: string;
  /**
   * Caminho do sprite relativo à raiz de imagens, SEM o `?v=`.
   *
   * O jogo original guardava a tag `<img>` inteira aqui e a copiava para
   * dentro de cada item gerado — o que congelava a arte no save e mandava
   * ~93 bytes de HTML por item pela rede a cada sincronização. Agora o item
   * carrega só o `templateId` e a UI resolve o sprite na hora de desenhar.
   */
  sprite: string;
  base: StatBlock;
  value: number;
  proc?: ProcTemplate;
}

const BURN: ProcTemplate = {
  chance: 0.15,
  effect: 'queimadura',
  label: 'Queimadura',
  icon: '🔥',
};
const STUN: ProcTemplate = { chance: 0.12, effect: 'atordoar', label: 'Atordoar', icon: '💫' };

export const TEMPLATES: readonly ItemTemplate[] = [
  // ---------- armas ----------
  {
    id: 'espada',
    name: 'Espada',
    category: 'arma',
    desc: 'Uma lâmina equilibrada para combate corpo a corpo.',
    sprite: 'weapons/espada.png',
    base: { ataque: 4 },
    value: 22,
    proc: BURN,
  },
  {
    id: 'machado',
    name: 'Machado de Guerra',
    category: 'arma',
    desc: 'Pesado e brutal, favorece a força bruta.',
    sprite: 'weapons/machado.png',
    base: { ataque: 6, velocidade: -1 },
    value: 26,
    proc: STUN,
  },
  {
    id: 'adaga',
    name: 'Adaga Sombria',
    category: 'arma',
    desc: 'Rápida e precisa, ideal para golpes furtivos.',
    sprite: 'weapons/adaga.png',
    base: { ataque: 3, critico: 8 },
    value: 20,
    proc: { chance: 0.15, effect: 'sangramento', label: 'Sangramento', icon: '🩸' },
  },
  {
    id: 'arco',
    name: 'Arco Longo',
    category: 'arma',
    desc: 'Ataques precisos a distância.',
    sprite: 'weapons/arco.png',
    base: { ataque: 4, esquiva: 2, critico: 6 },
    value: 24,
  },
  {
    id: 'cajado',
    name: 'Cajado Arcano',
    category: 'arma',
    desc: 'Canaliza energia mágica em combate.',
    sprite: 'weapons/cajado.png',
    base: { ataque: 3, mana: 8 },
    value: 24,
    proc: { chance: 0.1, effect: 'mana_gratis', label: 'Poupança Arcana', icon: '🔷' },
  },
  {
    id: 'maca',
    name: 'Maça Sagrada',
    category: 'arma',
    desc: 'Abençoada, favorece curandeiros.',
    sprite: 'weapons/maca.png',
    base: { ataque: 3, vida: 6 },
    value: 22,
    proc: { chance: 0.1, effect: 'cura_no_acerto', label: 'Toque Curativo', icon: '✨' },
  },
  {
    id: 'marreta',
    name: 'Marreta de Guerra',
    category: 'arma',
    desc: 'Um golpe pesado o suficiente para rachar armaduras.',
    sprite: 'weapons/marreta.png',
    base: { ataque: 7, velocidade: -2 },
    value: 27,
    proc: STUN,
  },
  {
    id: 'violao',
    name: 'Violão Encantado',
    category: 'arma',
    desc: 'Acordes que vibram no ar e atordoam quem ousar se aproximar.',
    sprite: 'weapons/violao.png',
    base: { ataque: 3, critico: 6, esquiva: 2 },
    value: 23,
    proc: { ...STUN, chance: 0.15 },
  },

  // ---------- armaduras ----------
  {
    id: 'escudo',
    name: 'Escudo de Carvalho',
    category: 'armadura',
    desc: 'Pesado, mas confiável contra golpes diretos.',
    sprite: 'armor/escudo.png',
    base: { defesa: 5, velocidade: -1 },
    value: 24,
  },
  {
    id: 'couro',
    name: 'Armadura de Couro Batido',
    category: 'armadura',
    desc: 'Leve o suficiente para não atrapalhar reflexos.',
    sprite: 'armor/couro.png',
    base: { defesa: 3, velocidade: 1 },
    value: 22,
  },
  {
    id: 'placas',
    name: 'Armadura de Placas',
    category: 'armadura',
    desc: 'Proteção pesada, reduz agilidade.',
    sprite: 'armor/placas.png',
    base: { defesa: 7, esquiva: -2 },
    value: 30,
  },
  {
    id: 'robe',
    name: 'Robe Arcano',
    category: 'armadura',
    desc: 'Tecido enfeitiçado que amplia o poder mágico.',
    sprite: 'armor/robe.png',
    base: { defesa: 2, mana: 10 },
    value: 26,
  },

  // ---------- acessórios ----------
  {
    id: 'anel_som',
    name: 'Anel das Sombras',
    category: 'acessorio',
    desc: 'Sussurra segredos no escuro.',
    sprite: 'accessories/anel_som.png',
    base: { critico: 5, esquiva: 2 },
    value: 20,
  },
  {
    id: 'amuleto_sab',
    name: 'Amuleto da Sabedoria',
    category: 'acessorio',
    desc: 'Pertenceu a um oráculo esquecido.',
    sprite: 'accessories/amuleto_sab.png',
    base: { mana: 6, vida: 4 },
    value: 20,
  },
  {
    id: 'bota_vento',
    name: 'Botas do Vento',
    category: 'acessorio',
    desc: 'Passos leves como brisa de outono.',
    sprite: 'accessories/bota_vento.png',
    base: { velocidade: 3, esquiva: 1 },
    value: 18,
  },
  {
    id: 'colar_forca',
    name: 'Colar da Força Ancestral',
    category: 'acessorio',
    desc: 'Pulsa com poder antigo.',
    sprite: 'accessories/colar_forca.png',
    base: { ataque: 2, vida: 8 },
    value: 22,
  },

  // ---------- consumíveis ----------
  {
    id: 'pot_vida',
    name: 'Poção de Vida',
    category: 'consumivel',
    desc: 'Restaura uma quantidade de vida ao ser bebida.',
    sprite: 'potions/cura.png',
    base: { cura: 22 },
    value: 14,
  },
  {
    id: 'pot_mana',
    name: 'Poção de Mana',
    category: 'consumivel',
    desc: 'Restaura uma quantidade de mana.',
    sprite: 'potions/mana.png',
    base: { curaMana: 16 },
    value: 14,
  },
  {
    id: 'pergaminho',
    name: 'Pergaminho Selado',
    category: 'consumivel',
    desc: 'Contém um feitiço de propósito desconhecido.',
    sprite: 'scrolls/pergaminho.png',
    base: { cura: 10, curaMana: 10 },
    value: 16,
  },

  // ---------- materiais ----------
  {
    id: 'minerio',
    name: 'Minério Bruto',
    category: 'material',
    desc: 'Pode ser vendido a um ferreiro.',
    sprite: 'materials/minerio.png',
    base: {},
    value: 10,
  },
  {
    id: 'essencia',
    name: 'Essência Arcana',
    category: 'material',
    desc: 'Resíduo de magia cristalizado.',
    sprite: 'materials/essencia.png',
    base: {},
    value: 14,
  },
  {
    id: 'catalisador_mitico',
    name: 'Catalisador Mítico',
    category: 'material',
    desc: 'Catalisador raro que aumenta muito a chance de elevar o tier na reforja.',
    sprite: 'materials/catalisador_mitico.png',
    base: {},
    value: 80,
  },
  {
    id: 'pedra_protecao',
    name: 'Pedra de Proteção',
    category: 'material',
    desc: 'Protege o equipamento: uma reforja feita com ela nunca reduz o tier.',
    sprite: 'materials/pedra_protecao.png',
    base: {},
    value: 55,
  },
  {
    id: 'couro_bruto',
    name: 'Couro de Fera',
    category: 'material',
    desc: 'Material usado em armaduras leves.',
    sprite: 'materials/couro_bruto.png',
    base: {},
    value: 10,
  },
];

const TEMPLATES_BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

/** Busca O(1) — o original filtrava o array inteiro a cada chamada. */
export function templateById(id: string): ItemTemplate | null {
  return TEMPLATES_BY_ID.get(id) ?? null;
}

export function templatesByCategory(category: ItemCategory): ItemTemplate[] {
  return TEMPLATES.filter((t) => t.category === category);
}
