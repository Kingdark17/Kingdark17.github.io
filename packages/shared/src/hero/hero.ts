import { instantiate, type Item } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById, type ItemCategory } from '../items/templates.js';
import { defaultRng, pick, randomInt, type Rng } from '../rng.js';
import {
  classById,
  classByName,
  idDaClasse,
  idDaRaca,
  powerById,
  FIRST_NAMES,
  LEGACY_DEBUFF_EFFECTS,
  powerByName,
  RACES,
  CLASSES,
  SURNAMES,
  type ClassDef,
  type Debuff,
  type DebuffEffect,
  type Power,
} from './catalog.js';
import { derivedStats, xpForLevel } from './derived.js';
import { ATTR_KEYS, emptyAttributes, EQUIP_SLOTS, type AttrKey, type Attributes, type DerivedStats, type EquipSlot, type HeroCore } from './stats.js';

/**
 * Equipamento do herói jogável, com o `Item` completo em cada slot.
 *
 * `HeroCore.equip` (stats.ts) usa `EquippableItem` — só `{ stats }`, o mínimo
 * que `derivedStats()` precisa — de propósito, pra essa função pura continuar
 * testável com objetos falsos mínimos. Aqui precisamos do item de verdade
 * (`uid`, `templateId`, `equipped`) pra equipar/desequipar de fato, então
 * `Hero` reescreve `equip` com um tipo mais rico. `Item` já satisfaz
 * estruturalmente `EquippableItem`, então nada quebra do lado de `derivedStats`.
 */
export type HeroEquipment = Partial<Record<EquipSlot, Item | null>>;

/**
 * Buffs temporários de combate. Runtime state pura, nunca persiste no save
 * fora de um combate em andamento — o original zera `hero.buffs = {}` a cada
 * `startCombat()`/`exitCombat()`.
 */
export interface HeroBuffs {
  critNext?: boolean;
  precisaoTurns?: number;
  precisaoAmount?: number;
  forcaTurns?: number;
  forcaAmount?: number;
  esquivaTurns?: number;
  esquivaAmount?: number;
  shield?: number;
  poisonTurns?: number;
  poisonDmg?: number;
}

/**
 * Herói jogável. `powers` guarda só o nome dos poderes escolhidos — o
 * original copiava o objeto de poder inteiro (ícone, descrição, todos os
 * campos) para dentro do herói, duplicando o catálogo a cada save. Resolver
 * via `powerByName()` na hora de exibir segue o mesmo padrão de
 * `templateId`/`speciesId` já usado em itens e monstros.
 */
export interface Hero extends HeroCore {
  equip: HeroEquipment;
  name: string;
  race: string;
  raceIcon: string;
  className: string;
  classIcon: string;
  /**
   * Identidade que as **regras** usam. Opcionais porque os saves que já
   * estão na nuvem não têm — quem chega sem eles é resolvido pelo nome uma
   * vez (`idDaClasse`/`idDaRaca`) e passa a gravar o id no próximo save.
   */
  classId?: string;
  raceId?: string;
  xp: number;
  xpNext: number;
  attrPoints: number;
  gold: number;
  powerNames: string[];
  /** Idem: id é o que vale, `powerNames` fica pro save antigo e pra exibição. */
  powerIds?: string[];
  debuff: Debuff;
  killCount: number;
  hp: number;
  mp: number;
  maxHp: number;
  maxMp: number;
  derived: DerivedStats;
  buffs?: HeroBuffs;
  /** Bênção de um NPC do mapa: bônus de esquiva que dura N combates inteiros (não turnos) — distinto de `HeroBuffs`, que zera a cada combate. Concedida por `npc-services.js`'s `blessing()`, consumida no início de cada combate. */
  npcBlessing?: { combats: number; dodge: number };
}

export function heroPowers(hero: Pick<Hero, 'powerNames' | 'powerIds'>): Power[] {
  // Save novo traz ids; o que veio de antes só tem nome. Sem este `??` a
  // troca de idioma faria `powerByName` devolver null pra tudo e o herói
  // perderia todos os poderes calado.
  const ids = hero.powerIds ?? hero.powerNames.map((name) => powerByName(name)?.id).filter((id): id is string => !!id);
  return ids.map((id) => powerById(id)).filter((p): p is Power => p !== null);
}

/**
 * Rola os 6 atributos-base (6 + d6) e aplica bônus de raça, viés de classe e
 * a penalidade do debuff sorteado, sempre travados em [1, 20].
 */
export function rollAttrs(race: (typeof RACES)[number], cls: ClassDef, debuff: Debuff, rng: Rng = defaultRng): Attributes {
  const attrs = emptyAttributes();
  for (const key of ATTR_KEYS) attrs[key] = 6 + randomInt(6, rng);
  for (const key of Object.keys(race.bonus) as AttrKey[]) attrs[key] += race.bonus[key] ?? 0;
  for (const key of Object.keys(cls.bias) as AttrKey[]) attrs[key] += cls.bias[key] ?? 0;
  if (debuff.attr) attrs[debuff.attr] -= 1;
  for (const key of ATTR_KEYS) attrs[key] = clamp(attrs[key], 1, 20);
  return attrs;
}

export interface HeroCreation {
  name: string;
  race: (typeof RACES)[number];
  cls: ClassDef;
  debuff: Debuff;
  /** Ids dos poderes escolhidos pelo jogador (a assinatura da classe entra automaticamente). */
  chosenPowerIds: string[];
  attrs?: Attributes;
}

export function buildHero(creation: HeroCreation, rng: Rng = defaultRng): Hero {
  const attrs = creation.attrs ?? rollAttrs(creation.race, creation.cls, creation.debuff, rng);
  const weaponTemplate = templateById(creation.cls.weaponTemplate);
  if (!weaponTemplate) throw new Error(`Arma inicial desconhecida: ${creation.cls.weaponTemplate}`);
  const startWeapon: Item = { ...instantiate(weaponTemplate, RARITIES[0] as (typeof RARITIES)[number]), equipped: true };

  // poder de assinatura da classe (automático) + os escolhidos na criação, sem duplicar
  const powerIds = [creation.cls.signatureId];
  for (const id of creation.chosenPowerIds) {
    if (id !== creation.cls.signatureId) powerIds.push(id);
  }
  // `powerNames` continua gravado porque é o que o save antigo tem e o que
  // qualquer leitor de fora (o resumo de `/api/characters`) sabe ler.
  const powerNames = powerIds.map((id) => powerById(id)?.name ?? id);

  // Sem anotar `equip` como HeroCore aqui: isso faria o compilador estreitar
  // o tipo para EquippableItem (o mínimo que derivedStats() exige) e perder
  // uid/templateId/equipped do Item de verdade antes do spread abaixo.
  const equip: HeroEquipment = { arma: startWeapon, secundaria: null, armadura: null, acessorio: null };
  const derived = derivedStats({ level: 1, attrs, equip });

  return {
    level: 1,
    attrs,
    equip,
    name: creation.name,
    race: creation.race.name,
    raceIcon: creation.race.icon,
    className: creation.cls.name,
    classIcon: creation.cls.icon,
    classId: creation.cls.id,
    raceId: creation.race.id,
    xp: 0,
    xpNext: xpForLevel(1),
    attrPoints: 0,
    gold: 30 + randomInt(21, rng),
    powerNames,
    powerIds,
    debuff: creation.debuff,
    killCount: 0,
    derived,
    maxHp: derived.maxHp,
    hp: derived.maxHp,
    maxMp: derived.maxMp,
    mp: derived.maxMp,
  };
}

/**
 * Recalcula `derived`/`maxHp`/`maxMp` a partir de nível, atributos e
 * equipamento — sempre do zero. Diferente do original, NÃO muta o herói:
 * devolve uma cópia. Preserva o mesmo comportamento assimétrico de HP/MP —
 * um AUMENTO de vida máxima cura o herói pela diferença (subir de nível não
 * deveria te deixar mais vulnerável proporcionalmente), mas uma REDUÇÃO
 * (trocar um item, por exemplo) só limita o HP atual ao novo teto, nunca cura.
 */
export function recomputeDerived<T extends HeroCore & { hp: number; mp: number; maxHp: number; maxMp: number; derived?: DerivedStats }>(
  hero: T,
  options: { critPenalty?: boolean } = {},
): T {
  const oldMaxHp = hero.maxHp || 0;
  const oldMaxMp = hero.maxMp || 0;
  const derived = derivedStats(hero, options);
  const deltaHp = derived.maxHp - oldMaxHp;
  const deltaMp = derived.maxMp - oldMaxMp;

  return {
    ...hero,
    derived,
    maxHp: derived.maxHp,
    maxMp: derived.maxMp,
    hp: clamp((hero.hp || derived.maxHp) + Math.max(0, deltaHp), 1, derived.maxHp),
    mp: clamp((hero.mp || derived.maxMp) + Math.max(0, deltaMp), 0, derived.maxMp),
  };
}

/** Gasta 1 ponto de atributo livre. Devolve o herói inalterado se não houver pontos. */
export function spendAttrPoint(hero: Hero, key: AttrKey): Hero {
  if (!hero.attrPoints || hero.attrPoints <= 0) return hero;
  const next: Hero = {
    ...hero,
    attrs: { ...hero.attrs, [key]: clamp(hero.attrs[key] + 1, 1, 99) },
    attrPoints: hero.attrPoints - 1,
  };
  return recomputeDerived(next);
}

/**
 * Aplica XP e sobe de nível quantas vezes o total permitir. Nenhum atributo
 * sobe sozinho — o jogador ganha 2 pontos por nível para distribuir.
 */
export function gainXP(hero: Hero, amount: number): { hero: Hero; leveledUp: boolean; levels: number } {
  let xp = hero.xp + amount;
  let level = hero.level;
  let xpNext = hero.xpNext;
  let attrPoints = hero.attrPoints;
  let levels = 0;

  while (xp >= xpNext) {
    xp -= xpNext;
    level += 1;
    xpNext = xpForLevel(level);
    attrPoints += 2;
    levels++;
  }

  let next: Hero = { ...hero, xp, level, xpNext, attrPoints };
  if (levels > 0) next = recomputeDerived(next);
  return { hero: next, leveledUp: levels > 0, levels };
}

// ---------- equipamento ----------

const OFFHAND_WEAPON_IDS = new Set(['espada', 'adaga', 'maca']);

/**
 * Armas que ocupam as duas mãos, e por isso não convivem com nada na
 * secundária.
 *
 * `violao` entra aqui a pedido do Breno: o bardo toca com as duas mãos e não
 * deveria aparecer de escudo. É regra de arma, não de classe — qualquer um
 * que pegue o violão fica sem a mão secundária, e o bardo com uma espada
 * continua podendo usar escudo. O jogo não bloqueia arma por classe (só varia
 * a eficiência, ver `weaponAffinityPct`), e esta lista não abre exceção nisso.
 *
 * `marreta` **não** está aqui. Parece de duas mãos pelo peso, mas isso é
 * decisão de quem desenha, não dedução minha — some quando alguém decidir.
 */
const TWO_HANDED_WEAPON_IDS = new Set(['arco', 'cajado', 'machado', 'violao']);

export function isOffhandEligible(item: Item | null | undefined): boolean {
  if (!item) return false;
  if (item.templateId === 'escudo') return true;
  const template = templateById(item.templateId);
  return template?.category === 'arma' && OFFHAND_WEAPON_IDS.has(item.templateId);
}

/**
 * Ocupa as duas mãos? Ver {@link TWO_HANDED_WEAPON_IDS}.
 *
 * Esta função existiu por um bom tempo exportada e **nunca chamada** — a
 * lista estava escrita, o teste passava e a regra não valia nada no jogo:
 * dava pra andar de arco e escudo. Quem a usa hoje é `equipItem`.
 */
export function isTwoHanded(item: Item | null | undefined): boolean {
  if (!item) return false;
  const template = templateById(item.templateId);
  return template?.category === 'arma' && TWO_HANDED_WEAPON_IDS.has(item.templateId);
}

/** Acha o slot que carrega este item — por referência ou, se a referência mudou (ex: após um equipItem), por uid. */
export function equippedSlot(hero: Pick<Hero, 'equip'>, item: Item): EquipSlot | null {
  for (const slot of EQUIP_SLOTS) {
    const current = hero.equip[slot];
    if (current === item || current?.uid === item.uid) return slot;
  }
  return null;
}

export interface EquipResult {
  hero: Hero;
  equipped: boolean;
  /**
   * Por que não deu, quando `equipped` é `false`. Só existe pro caso que
   * precisa de explicação na tela: a peça **cabe** naquele slot, e mesmo
   * assim foi recusada. "Não vai nesse espaço" seria mentira ali.
   */
  reason?: 'two_handed_weapon';
}

/** Regra de qual slot aceita qual item — a mesma checagem que `equipItem()` usava inline. */
function slotAccepts(slot: EquipSlot, item: Item, category: ItemCategory): boolean {
  if (slot === 'secundaria') return isOffhandEligible(item);
  if (slot === 'arma') return category === 'arma';
  if (slot === 'armadura') return category === 'armadura' && item.templateId !== 'escudo';
  return category === 'acessorio'; // slot === 'acessorio'
}

/**
 * Equipa um item num slot. Devolve `equipped: false` sem alterar o herói
 * quando a peça não pode ir naquele slot (categoria errada, secundária sem
 * elegibilidade). Não muta `item` nem `hero`.
 *
 * **A arma principal manda nas duas mãos.** Equipar uma arma de duas mãos
 * esvazia a secundária — o que estava lá volta pra mochila; tentar ocupar a
 * secundária com uma arma de duas mãos na principal é recusado. O outro
 * arranjo (o escudo expulsar a arma) seria pior: tirar a arma de alguém pra
 * caber um escudo é surpresa, e a arma é a peça que a pessoa escolheu.
 */
export function equipItem(hero: Hero, item: Item, requestedSlot?: EquipSlot): EquipResult {
  const template = templateById(item.templateId);
  const equippableCategory = template && (template.category === 'arma' || template.category === 'armadura' || template.category === 'acessorio') ? template.category : null;
  if (!equippableCategory) return { hero, equipped: false };

  const slot: EquipSlot = requestedSlot ?? (item.templateId === 'escudo' ? 'secundaria' : equippableCategory);
  if (!slotAccepts(slot, item, equippableCategory)) return { hero, equipped: false };
  if (slot === 'secundaria' && isTwoHanded(hero.equip.arma)) return { hero, equipped: false, reason: 'two_handed_weapon' };

  const equip: HeroEquipment = { ...hero.equip };
  for (const otherSlot of EQUIP_SLOTS) {
    const current = equip[otherSlot];
    if (otherSlot === slot) continue;
    if (current === item) equip[otherSlot] = null;
  }
  equip[slot] = { ...item, equipped: true };
  // Quem recolhe a peça expulsa é a camada de mochila, que já devolve pro
  // inventário tudo que saiu de um slot (`trocaDeEquipamento`).
  if (slot === 'arma' && isTwoHanded(item)) equip.secundaria = null;

  return { hero: recomputeDerived({ ...hero, equip }), equipped: true };
}

export function unequipItem(hero: Hero, slot: EquipSlot): Hero {
  if (!hero.equip[slot]) return hero;
  const equip: HeroEquipment = { ...hero.equip, [slot]: null };
  return recomputeDerived({ ...hero, equip });
}

// ---------- debuff ----------

/**
 * Confere se o herói está sob um efeito de debuff, cobrindo saves antigos que
 * gravaram só `debuff.name` (sem `debuff.effect`) antes da mecânica de efeito
 * existir. Ver {@link LEGACY_DEBUFF_EFFECTS}.
 */
export function hasDebuffEffect(hero: Pick<Hero, 'debuff'> | null | undefined, effect: DebuffEffect): boolean {
  if (!hero?.debuff) return false;
  if (hero.debuff.effect === effect) return true;
  return LEGACY_DEBUFF_EFFECTS[hero.debuff.name] === effect;
}

// ---------- afinidade de arma ----------

/** % de eficiência do herói com a arma equipada, conforme a classe. 100% se não houver afinidade definida. */
export function weaponAffinityPct(hero: Pick<Hero, 'className' | 'classId' | 'equip'>): number {
  const weapon = hero.equip.arma;
  if (!weapon) return 100;
  const cls = classById(idDaClasse(hero) ?? '');
  const pct = cls?.affinity[weapon.templateId];
  return pct ?? 100;
}

// ---------- companheiro ----------

/** Postura escolhida pelo jogador no dropdown de gerenciar equipe (`ui.js`). */
export type CompanionStance = 'equilibrada' | 'agressiva' | 'defensiva' | 'suporte';

export interface Companion {
  name: string;
  raceIcon: string;
  race: string;
  className: string;
  classIcon: string;
  /** Igual ao herói: é o id que as regras de combate olham. */
  classId?: string;
  hp: number;
  maxHp: number;
  attack: number;
  attrs: Attributes;
  stance: CompanionStance;
  ability: string;
  abilityDesc: string;
  /** Companheiro recrutado por tempo limitado (serviço de NPC) em vez de permanente. */
  temporary?: boolean;
  combatsLeft?: number;
}

/** Por id da classe, não pelo nome — ver a nota em `catalog.ts`. */
const COMPANION_ROLES: Record<string, { ability: string; desc: string }> = {
  guerreiro: { ability: 'Proteção', desc: 'Pode interceptar ataques contra o herói.' },
  mago: { ability: 'Rajada Arcana', desc: 'Seus ataques ignoram parte da resistência.' },
  ladino: { ability: 'Ataque Furtivo', desc: 'Pode causar um segundo golpe.' },
  clerigo: { ability: 'Prece Curativa', desc: 'Pode recuperar a Vida do herói.' },
  barbaro: { ability: 'Fúria', desc: 'Causa mais dano quando está ferido.' },
  arqueiro: { ability: 'Tiro Crítico', desc: 'Possui chance elevada de dano crítico.' },
  paladino: { ability: 'Proteção Sagrada', desc: 'Protege a equipe e resiste a golpes.' },
  necromante: { ability: 'Maldição', desc: 'Enfraquece criaturas durante a batalha.' },
  druida: { ability: 'Esporos', desc: 'Pode causar dano contínuo e auxiliar aliados.' },
  monge: { ability: 'Golpe Atordoante', desc: 'Pode impedir a reação do inimigo.' },
  bardo: { ability: 'Canção de Batalha', desc: 'Inspira os aliados durante o combate.' },
  cacador: { ability: 'Flecha Serrilhada', desc: 'Possui chance elevada de causar sangramento.' },
};

export function generateCompanion(rng: Rng = defaultRng): Companion {
  const race = pick(RACES, rng);
  const cls = pick(CLASSES, rng);
  const attrs = emptyAttributes();
  for (const key of ATTR_KEYS) attrs[key] = 6 + randomInt(6, rng);
  for (const key of Object.keys(race.bonus) as AttrKey[]) attrs[key] += race.bonus[key] ?? 0;
  for (const key of Object.keys(cls.bias) as AttrKey[]) attrs[key] += cls.bias[key] ?? 0;

  const maxHp = 18 + attrs.constituicao * 3;
  const role = COMPANION_ROLES[cls.id] ?? { ability: 'Ataque', desc: 'Ajuda durante o combate.' };

  return {
    name: `${pick(FIRST_NAMES, rng)} ${pick(SURNAMES, rng)}`,
    raceIcon: race.icon,
    race: race.name,
    className: cls.name,
    classIcon: cls.icon,
    classId: cls.id,
    hp: maxHp,
    maxHp,
    attack: 4 + Math.floor((attrs.forca + attrs.destreza) / 3),
    attrs,
    stance: 'equilibrada',
    ability: role.ability,
    abilityDesc: role.desc,
  };
}

/**
 * Normaliza um herói vindo de um save que pode não ter todos os campos
 * atuais (save antigo, ou herói solo reaproveitado no multiplayer). Não muta
 * a entrada.
 */
export function hydrateSavedHero(hero: Hero): Hero {
  const equip: HeroEquipment = { arma: hero.equip?.arma ?? null, secundaria: hero.equip?.secundaria ?? null, armadura: hero.equip?.armadura ?? null, acessorio: hero.equip?.acessorio ?? null };

  // Identidade resolvida uma vez, na entrada: o save que veio de antes só
  // tem nome, e a partir daqui o resto do jogo só precisa olhar o id.
  const classId = idDaClasse(hero) ?? undefined;
  const raceId = idDaRaca(hero) ?? undefined;
  const cls = classById(classId ?? '');

  let powerIds = hero.powerIds?.length
    ? hero.powerIds
    : (hero.powerNames ?? []).map((name) => powerByName(name)?.id).filter((id): id is string => !!id);
  if (!powerIds.length && cls) powerIds = [cls.signatureId];

  return recomputeDerived({
    ...hero,
    equip,
    attrPoints: hero.attrPoints || 0,
    buffs: {},
    classId,
    raceId,
    powerIds,
    // Regenerados do catálogo, não copiados do save: assim o nome mostrado
    // acompanha o catálogo em vez de ficar congelado no que foi gravado.
    powerNames: powerIds.map((id) => powerById(id)?.name).filter((name): name is string => !!name),
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
