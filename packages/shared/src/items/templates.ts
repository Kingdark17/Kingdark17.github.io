import type { EquipSlot, ItemStatKey } from '../hero/stats.js';

export const ITEM_CATEGORIES = [
  'arma',
  'armadura',
  'acessorio',
  'consumivel',
  'material',
  'missao',
  'runa',
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  arma: 'Arma',
  armadura: 'Armadura',
  acessorio: 'Acessório',
  consumivel: 'Consumível',
  material: 'Material',
  missao: 'Missão',
  runa: 'Runa',
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

/** Gênero gramatical do nome de um item. */
export type Genero = 'm' | 'f';

/**
 * A escada de material de uma arma ou armadura: três degraus, e o primeiro
 * é a peça de hoje (ver `items/materiais.ts`).
 */
export type EscadaId = 'metal' | 'madeira' | 'couro' | 'tecido';

/** O tipo de uma runa (ver `items/runas.ts`). */
export type RunaId = 'eletrica' | 'fogo' | 'gelo' | 'vampirica';

/** O tier de uma runa no nome dela: "Runa de Fogo II". */
export const ROMANOS: readonly string[] = ['I', 'II', 'III'];

/**
 * As quatro formas de uma palavra que concorda com o nome de um item:
 * masculino, feminino e os dois plurais. Ver `concordar` em `item.ts`.
 */
export type Formas = readonly [m: string, f: string, mp: string, fp: string];

export interface ItemTemplate {
  id: string;
  name: string;
  /**
   * Gênero e número do nome: é com eles que a raridade e as frases do jogo
   * concordam — "Espada Lendária", "Botas Raras", "Poção de Vida
   * escondida".
   *
   * Obrigatório de propósito: item novo sem gênero não compila, em vez de
   * virar uma "Espada Raro" que ninguém nota.
   */
  genero: Genero;
  /** O nome está no plural: "Botas Reforçadas Raras", não "Botas Reforçadas Rara". */
  plural?: true;
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
  /**
   * Em que slot esta peça veste, quando não é o slot de mesmo nome da
   * categoria.
   *
   * Nasceu porque a armadura deixou de ser uma peça só: elmo, peitoral,
   * calça e botas são todos `category: 'armadura'` — é o que mantém loja e
   * loot escolhendo por categoria sem saber que a divisão existe —, mas
   * cada um veste num lugar diferente.
   *
   * De quebra, ele engole a exceção do escudo, que antes estava escrita à
   * mão em dois lugares (`equipItem` decidindo o slot e `slotAccepts`
   * recusando-o na armadura). Uma regra em dois lugares é uma regra que
   * pode discordar de si mesma.
   */
  slot?: EquipSlot;
  base: StatBlock;
  value: number;
  proc?: ProcTemplate;
  /** A escada de material. Só armas e armaduras têm; acessório, consumível e material, não. */
  escada?: EscadaId;
  /**
   * O nome sem o material de hoje, quando ele está no nome: de ébano, o
   * "Escudo de Carvalho" é o "Escudo de Ébano". Sem isto, o material entra
   * depois do nome inteiro ("Espada de Aço").
   */
  nomeSemMaterial?: string;
  /** Numa runa, o tipo dela. */
  runa?: RunaId;
}

/**
 * Onde a peça veste. É a categoria, salvo quando o template diz outra coisa.
 *
 * Só vale pra equipamento: consumível e material não têm slot, e chamar
 * isto com um deles devolve a categoria, que não é um `EquipSlot` válido.
 * Quem pergunta já filtrou por `isEquippable` antes.
 */
export function slotForTemplate(template: ItemTemplate): EquipSlot {
  return template.slot ?? (template.category as EquipSlot);
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
    genero: 'f',
    category: 'arma',
    desc: 'Uma lâmina equilibrada para combate corpo a corpo.',
    sprite: 'weapons/espada.png',
    base: { ataque: 4 },
    value: 22,
    proc: BURN,
    escada: 'metal',
  },
  {
    id: 'machado',
    name: 'Machado de Guerra',
    genero: 'm',
    category: 'arma',
    desc: 'Pesado e brutal, favorece a força bruta.',
    sprite: 'weapons/machado.png',
    base: { ataque: 6, velocidade: -1 },
    value: 26,
    proc: STUN,
    escada: 'metal',
  },
  {
    id: 'adaga',
    name: 'Adaga Sombria',
    genero: 'f',
    category: 'arma',
    desc: 'Rápida e precisa, ideal para golpes furtivos.',
    sprite: 'weapons/adaga.png',
    base: { ataque: 3, critico: 8 },
    value: 20,
    proc: { chance: 0.15, effect: 'sangramento', label: 'Sangramento', icon: '🩸' },
    escada: 'metal',
  },
  {
    id: 'arco',
    name: 'Arco Longo',
    genero: 'm',
    category: 'arma',
    desc: 'Ataques precisos a distância.',
    sprite: 'weapons/arco.png',
    base: { ataque: 4, esquiva: 2, critico: 6 },
    value: 24,
    escada: 'madeira',
  },
  {
    id: 'cajado',
    name: 'Cajado Arcano',
    genero: 'm',
    category: 'arma',
    desc: 'Canaliza energia mágica em combate.',
    sprite: 'weapons/cajado.png',
    base: { ataque: 3, mana: 8 },
    value: 24,
    proc: { chance: 0.1, effect: 'mana_gratis', label: 'Poupança Arcana', icon: '🔷' },
    escada: 'madeira',
  },
  {
    id: 'maca',
    name: 'Maça Sagrada',
    genero: 'f',
    category: 'arma',
    desc: 'Abençoada, favorece curandeiros.',
    sprite: 'weapons/maca.png',
    base: { ataque: 3, vida: 6 },
    value: 22,
    proc: { chance: 0.1, effect: 'cura_no_acerto', label: 'Toque Curativo', icon: '✨' },
    escada: 'metal',
  },
  {
    id: 'marreta',
    name: 'Marreta de Guerra',
    genero: 'f',
    category: 'arma',
    desc: 'Um golpe pesado o suficiente para rachar armaduras.',
    sprite: 'weapons/marreta.png',
    base: { ataque: 7, velocidade: -2 },
    value: 27,
    proc: STUN,
    escada: 'metal',
  },
  {
    id: 'violao',
    name: 'Violão Encantado',
    genero: 'm',
    category: 'arma',
    desc: 'Acordes que vibram no ar e atordoam quem ousar se aproximar.',
    sprite: 'weapons/violao.png',
    base: { ataque: 3, critico: 6, esquiva: 2 },
    value: 23,
    proc: { ...STUN, chance: 0.15 },
    escada: 'madeira',
  },

  // ---------- armaduras ----------
  {
    id: 'escudo',
    name: 'Escudo de Carvalho',
    genero: 'm',
    category: 'armadura',
    desc: 'Pesado, mas confiável contra golpes diretos.',
    sprite: 'armor/escudo.png',
    // Armadura pela categoria (é assim que a loja e o loot o encontram),
    // mas veste na mão secundária. Antes isto era um `if` pelo id.
    slot: 'secundaria',
    base: { defesa: 5, velocidade: -1 },
    value: 24,
    escada: 'madeira',
    nomeSemMaterial: 'Escudo',
  },
  {
    id: 'grimorio',
    name: 'Grimório',
    genero: 'm',
    category: 'armadura',
    desc: 'Um livro de feitiços para a mão livre: mais Mana para quem conjura. Cabe ao lado do cajado.',
    // O ícone é provisório: o livro recortado do desenho do boneco, até o
    // Breno mandar o grimorio_icon.
    sprite: 'armor/grimorio.png',
    // Como o escudo, armadura pela categoria e vestido na mão secundária. É
    // a única peça que cabe ao lado do cajado (`AO_LADO_DO_CAJADO`, em
    // hero.ts): decisão do usuário de 2026-10-23, com a arte do Breno, que
    // desenha o livro na outra mão de quem conjura.
    slot: 'secundaria',
    base: { mana: 8 },
    value: 22,
    escada: 'couro',
  },
  {
    id: 'couro',
    name: 'Armadura de Couro Batido',
    genero: 'f',
    category: 'armadura',
    desc: 'Leve o suficiente para não atrapalhar reflexos.',
    sprite: 'armor/couro.png',
    base: { defesa: 3, velocidade: 1 },
    value: 22,
    escada: 'couro',
    nomeSemMaterial: 'Armadura',
  },
  {
    id: 'placas',
    name: 'Peitoral de Placas',
    genero: 'm',
    category: 'armadura',
    desc: 'Proteção pesada, reduz agilidade.',
    sprite: 'armor/placas.png',
    base: { defesa: 4, esquiva: -1 },
    value: 17,
    escada: 'metal',
  },
  {
    id: 'placas_elmo',
    name: 'Elmo de Placas',
    genero: 'm',
    category: 'armadura',
    desc: 'Aço fechado, com uma pedra vermelha na testa.',
    sprite: 'armor/placas_elmo.png',
    slot: 'elmo',
    base: { defesa: 1 },
    value: 5,
    escada: 'metal',
  },
  {
    id: 'placas_calca',
    name: 'Perneira de Placas',
    genero: 'f',
    category: 'armadura',
    desc: 'Placas sobrepostas que protegem a perna inteira.',
    sprite: 'armor/placas_calca.png',
    slot: 'calca',
    base: { defesa: 2, esquiva: -1 },
    value: 8,
    escada: 'metal',
  },
  {
    id: 'robe',
    name: 'Robe Arcano',
    genero: 'm',
    category: 'armadura',
    desc: 'Tecido enfeitiçado que amplia o poder mágico.',
    sprite: 'armor/robe.png',
    // Era 7 de mana e 18 de ouro até o chapéu virar item (2026-09-26). O
    // conjunto do mago continua somando o que o robe inteiro somava antes da
    // divisão — 2 de defesa, 10 de mana, 26 de ouro —, a mesma regra das
    // placas. Peito é a peça maior, depois perna, depois cabeça: 5/3/2 aqui,
    // 4/2/1 de defesa lá.
    //
    // **Mexer aqui não mexe em robe que já existe.** `instantiate` copia os
    // atributos pro item quando ele nasce, e o equipamento soma `item.stats`,
    // não o catálogo. Quem já tinha o robe segue com 7; só os novos saem com
    // 5. O commit que trouxe o chapéu diz o contrário — está errado.
    base: { defesa: 1, mana: 5 },
    value: 13,
    escada: 'tecido',
  },
  {
    id: 'robe_calca',
    name: 'Calça de Mago',
    genero: 'f',
    category: 'armadura',
    desc: 'Saiote pesado de veludo, preso por uma fivela dourada.',
    sprite: 'armor/robe_calca.png',
    slot: 'calca',
    base: { defesa: 1, mana: 3 },
    value: 8,
    escada: 'tecido',
  },
  {
    id: 'robe_chapeu',
    name: 'Chapéu de Mago',
    genero: 'm',
    category: 'armadura',
    desc: 'Feltro escuro e aba larga, com uma estrela dourada presa na ponta.',
    sprite: 'armor/robe_chapeu.png',
    slot: 'elmo',
    base: { mana: 2 },
    value: 5,
    escada: 'tecido',
  },
  {
    id: 'botas',
    name: 'Botas Reforçadas',
    genero: 'f',
    plural: true,
    category: 'armadura',
    desc: 'Aço nos dedos e sola macia — protegem sem prender o passo.',
    sprite: 'armor/botas.png',
    slot: 'botas',
    base: { defesa: 1, velocidade: 1 },
    value: 14,
    escada: 'couro',
    nomeSemMaterial: 'Botas',
  },

  // ---------- acessórios ----------
  {
    id: 'anel_som',
    name: 'Anel das Sombras',
    genero: 'm',
    category: 'acessorio',
    desc: 'Sussurra segredos no escuro.',
    sprite: 'accessories/anel_som.png',
    base: { critico: 5, esquiva: 2 },
    value: 20,
  },
  {
    id: 'amuleto_sab',
    name: 'Amuleto da Sabedoria',
    genero: 'm',
    category: 'acessorio',
    desc: 'Pertenceu a um oráculo esquecido.',
    sprite: 'accessories/amuleto_sab.png',
    base: { mana: 6, vida: 4 },
    value: 20,
  },
  {
    id: 'bota_vento',
    name: 'Botas do Vento',
    genero: 'f',
    plural: true,
    category: 'acessorio',
    desc: 'Passos leves como brisa de outono.',
    sprite: 'accessories/bota_vento.png',
    // Sempre foram botas; vestiam no acessório porque slot de pé não
    // existia. Agora existe. Quem já as tem no acessório continua com elas
    // lá e com os atributos contando — nada revalida o save — e elas
    // descem pro pé sozinhas no primeiro guardar-e-equipar.
    slot: 'botas',
    base: { velocidade: 3, esquiva: 1 },
    value: 18,
  },
  {
    id: 'colar_forca',
    name: 'Colar da Força Ancestral',
    genero: 'm',
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
    genero: 'f',
    category: 'consumivel',
    desc: 'Restaura uma quantidade de vida ao ser bebida.',
    sprite: 'potions/cura.png',
    base: { cura: 22 },
    value: 14,
  },
  {
    id: 'pot_mana',
    name: 'Poção de Mana',
    genero: 'f',
    category: 'consumivel',
    desc: 'Restaura uma quantidade de mana.',
    sprite: 'potions/mana.png',
    base: { curaMana: 16 },
    value: 14,
  },
  {
    id: 'pergaminho',
    name: 'Pergaminho Selado',
    genero: 'm',
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
    genero: 'm',
    category: 'material',
    desc: 'Pode ser vendido a um ferreiro.',
    sprite: 'materials/minerio.png',
    base: {},
    value: 10,
  },
  {
    id: 'essencia',
    name: 'Essência Arcana',
    genero: 'f',
    category: 'material',
    desc: 'Resíduo de magia cristalizado.',
    sprite: 'materials/essencia.png',
    base: {},
    value: 14,
  },
  {
    id: 'catalisador_mitico',
    name: 'Catalisador Mítico',
    genero: 'm',
    category: 'material',
    desc: 'Catalisador raro que aumenta muito a chance de elevar o tier na reforja.',
    sprite: 'materials/catalisador_mitico.png',
    base: {},
    value: 80,
  },
  {
    id: 'pedra_protecao',
    name: 'Pedra de Proteção',
    genero: 'f',
    category: 'material',
    desc: 'Protege o equipamento: uma reforja feita com ela nunca reduz o tier.',
    sprite: 'materials/pedra_protecao.png',
    base: {},
    value: 55,
  },
  {
    id: 'couro_bruto',
    name: 'Couro de Fera',
    genero: 'm',
    category: 'material',
    desc: 'Material usado em armaduras leves.',
    sprite: 'materials/couro_bruto.png',
    base: {},
    value: 10,
  },

  // ---------- runas (só do app; ver items/runas.ts) ----------
  // A arte é provisória (a pedra de proteção): o Breno desenha as runas.
  {
    id: 'runa_eletrica',
    name: 'Runa Elétrica',
    genero: 'f',
    category: 'runa',
    desc: 'Pedra rara que eletrifica a arma: o golpe pode dar um choque e atordoar.',
    sprite: 'materials/pedra_protecao.png',
    base: {},
    value: 40,
    runa: 'eletrica',
  },
  {
    id: 'runa_fogo',
    name: 'Runa de Fogo',
    genero: 'f',
    category: 'runa',
    desc: 'Pedra rara que incendeia a arma: o golpe pode queimar o monstro.',
    sprite: 'materials/pedra_protecao.png',
    base: {},
    value: 40,
    runa: 'fogo',
  },
  {
    id: 'runa_gelo',
    name: 'Runa de Gelo',
    genero: 'f',
    category: 'runa',
    desc: 'Pedra rara que gela a arma: o golpe pode deixar o monstro lento.',
    sprite: 'materials/pedra_protecao.png',
    base: {},
    value: 40,
    runa: 'gelo',
  },
  {
    id: 'runa_vampirica',
    name: 'Runa Vampírica',
    genero: 'f',
    category: 'runa',
    desc: 'Pedra rara que dá sede à arma: o golpe pode curar quem bate.',
    sprite: 'materials/pedra_protecao.png',
    base: {},
    value: 40,
    runa: 'vampirica',
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
