import { defaultRng, pick, randomInt, type Rng } from '../rng.js';
import { pickRarity, RARITIES, rarityById, type Rarity, type RarityId } from './rarity.js';
import {
  isEquippable,
  STAT_LABELS,
  templateById,
  TEMPLATES,
  templatesByCategory,
  type AnyStatKey,
  type Formas,
  type ItemCategory,
  type ItemTemplate,
  type ProcTemplate,
  type StatBlock,
} from './templates.js';

/**
 * Instância de item no inventário.
 *
 * Guarda só o que NÃO dá para derivar do template: identidade, raridade,
 * stats rolados e as modificações de reforja. Nome, descrição, sprite, cor de
 * raridade e o efeito do proc saem do template na hora de exibir.
 *
 * O item original tinha 13 campos, três deles strings longas (`icon` com uma
 * tag `<img>` completa, `desc` e `rarityColor`). Como o inventário inteiro dos
 * dois jogadores trafega a cada sincronização, esse enxugamento é a maior
 * parte da redução de payload da migração.
 */
export interface Item {
  uid: string;
  templateId: string;
  rarity: RarityId;
  stats: StatBlock;
  value: number;
  equipped: boolean;
  /** Só presente quando o template tem proc; a reforja altera este número. */
  procChance?: number;
  /** Andar em que caiu, quando houve bônus de profundidade. */
  foundFloor?: number;
  tierAdjustment?: number;
  reforgeCount?: number;
  /** Contador de "pity" da reforja na forja (`shop.js`): tentativas seguidas sem melhora de tier. Zera ao melhorar; a partir de 4, o próximo resultado é forçado a não piorar. */
  reforgeFails?: number;
}

/** Visão "gorda" do item, montada na hora de renderizar. */
export interface ItemView extends Item {
  template: ItemTemplate;
  name: string;
  desc: string;
  sprite: string;
  category: ItemCategory;
  /**
   * A raridade no gênero e número do item, como no nome: "Espada Mítica"
   * com "Mítica · Tier SS" embaixo, não "Mítico".
   */
  rarityLabel: string;
  rarityColorVar: string;
  proc: (ProcTemplate & { chance: number }) | null;
}

export function itemTemplate(item: Pick<Item, 'templateId'>): ItemTemplate {
  const template = templateById(item.templateId);
  if (!template) throw new Error(`Template desconhecido: ${item.templateId}`);
  return template;
}

/**
 * Escolhe, das quatro formas de uma palavra, a que concorda com o nome do
 * item: `concordar(item, ['escondido', 'escondida', 'escondidos', 'escondidas'])`.
 */
export function concordar(item: Pick<Item, 'templateId'>, [m, f, mp, fp]: Formas): string {
  const { genero, plural } = itemTemplate(item);
  if (genero === 'f') return plural ? fp : f;
  return plural ? mp : m;
}

/**
 * Nome exibido: o do template, e a raridade depois, concordando com ele —
 * "Poção de Mana Incomum", "Espada Lendária", "Botas Reforçadas Raras".
 * Comum não ganha nada.
 *
 * Até 2026-10 a raridade vinha antes e sempre no masculino ("Lendário
 * Espada"), herança do `items.js` do jogo antigo.
 */
export function displayName(item: Pick<Item, 'templateId' | 'rarity'>): string {
  const template = itemTemplate(item);
  const rarity = rarityById(item.rarity);
  if (!rarity || rarity.id === 'comum') return template.name;
  return `${template.name} ${concordar(item, rarity.adjetivo)}`;
}

export function itemView(item: Item): ItemView {
  const template = itemTemplate(item);
  const rarity = rarityById(item.rarity) ?? (rarityById('comum') as Rarity);

  return {
    ...item,
    template,
    name: displayName(item),
    desc: template.desc,
    sprite: template.sprite,
    category: template.category,
    rarityLabel: concordar(item, rarity.adjetivo),
    rarityColorVar: rarity.colorVar,
    proc:
      template.proc && item.procChance !== undefined
        ? { ...template.proc, chance: item.procChance }
        : null,
  };
}

export function itemCategory(item: Pick<Item, 'templateId'>): ItemCategory {
  return itemTemplate(item).category;
}

export interface InstantiateOptions {
  rng?: Rng;
  /** Injetável para o uid ser reproduzível em teste. */
  now?: () => number;
}

export function instantiate(
  template: ItemTemplate,
  rarity: Rarity,
  { rng = defaultRng, now = Date.now }: InstantiateOptions = {},
): Item {
  const stats: StatBlock = {};
  for (const key of Object.keys(template.base) as AnyStatKey[]) {
    stats[key] = Math.round((template.base[key] ?? 0) * rarity.mult);
  }

  const item: Item = {
    uid: `${template.id}_${now()}_${randomInt(99999, rng)}`,
    templateId: template.id,
    rarity: rarity.id,
    stats,
    value: Math.round(template.value * rarity.mult),
    equipped: false,
  };

  if (template.proc) {
    item.procChance = Math.min(0.5, template.proc.chance + (rarity.mult - 1) * 0.05);
  }

  return item;
}

export interface RandomItemOptions extends InstantiateOptions {
  category?: ItemCategory;
  rarity?: RarityId;
  floor?: number;
}

export function randomItem(options: RandomItemOptions = {}): Item {
  const { category, rarity: forcedRarity, floor = 1, rng = defaultRng, now } = options;

  const pool = category ? templatesByCategory(category) : TEMPLATES;
  const template = pick(pool, rng);
  // Uma raridade forçada e desconhecida cai para comum, igual ao original.
  const rarity =
    (forcedRarity ? rarityById(forcedRarity) : pickRarity(floor, rng)) ?? (RARITIES[0] as Rarity);

  const item = instantiate(template, rarity, now ? { rng, now } : { rng });

  // Bônus de profundidade: itens equipáveis achados fundo na masmorra vêm um
  // pouco mais fortes, teto de +75%.
  const depth = Math.max(1, floor);
  if (isEquippable(template.category) && depth > 1) {
    const mult = 1 + Math.min(0.75, (depth - 1) * 0.015);
    for (const key of Object.keys(item.stats) as AnyStatKey[]) {
      const value = item.stats[key] ?? 0;
      if (value > 0) item.stats[key] = Math.max(1, Math.round(value * mult));
    }
    item.foundFloor = depth;
  }

  return item;
}

export interface StatTag {
  text: string;
  positive: boolean;
}

export function statTags(item: Pick<Item, 'stats'>): StatTag[] {
  const tags: StatTag[] = [];
  for (const key of Object.keys(item.stats) as AnyStatKey[]) {
    const value = item.stats[key];
    if (!value) continue;
    const label = STAT_LABELS[key] ?? key;
    tags.push({ text: `${value > 0 ? '+' : ''}${value} ${label}`, positive: value > 0 });
  }
  return tags;
}
