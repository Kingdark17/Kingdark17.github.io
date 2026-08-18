import type { Attributes, AttrKey } from './stats.js';

export interface Race {
  id: string;
  name: string;
  icon: string;
  desc: string;
  bonus: Partial<Record<AttrKey, number>>;
}

export const RACES: readonly Race[] = [
  { id: 'humano', name: 'Humano', icon: '🧑', desc: 'Versátil e equilibrado em todos os atributos.', bonus: { forca: 1, destreza: 1, constituicao: 1, intelecto: 1, sabedoria: 1, carisma: 1 } },
  { id: 'elfo', name: 'Elfo', icon: '🧝', desc: 'Ágil e perceptivo, porém de constituição frágil.', bonus: { destreza: 2, intelecto: 1, constituicao: -1 } },
  { id: 'anao', name: 'Anão', icon: '⛏️', desc: 'Resistente e forte, mas pouco ágil.', bonus: { constituicao: 2, forca: 1, destreza: -1 } },
  { id: 'orc', name: 'Orc', icon: '👹', desc: 'Força bruta acima da média, raciocínio mais lento.', bonus: { forca: 3, intelecto: -1 } },
  { id: 'elfo_negro', name: 'Elfo Negro', icon: '🦇', desc: 'Mente afiada e reflexos rápidos, porém frio com estranhos.', bonus: { intelecto: 2, destreza: 1, carisma: -1 } },
  { id: 'meio_elfo', name: 'Meio-Elfo', icon: '🍃', desc: 'Carismático e sábio, herda o melhor de dois mundos.', bonus: { carisma: 1, sabedoria: 1 } },
  { id: 'draconato', name: 'Draconato', icon: '🐲', desc: 'Muito forte e resistente, mas pouco carismático.', bonus: { forca: 2, constituicao: 2, carisma: -1 } },
  { id: 'goblin', name: 'Goblin', icon: '👺', desc: 'Ágil e esperto, porém fisicamente frágil.', bonus: { destreza: 2, intelecto: 1, constituicao: -1 } },
  { id: 'fada', name: 'Fada', icon: '🧚', desc: 'Possui grande magia e carisma, mas pouca força.', bonus: { intelecto: 2, carisma: 2, forca: -2 } },
  { id: 'morto_vivo', name: 'Morto-vivo', icon: '💀', desc: 'Muito resistente, mas pouco sábio e carismático.', bonus: { constituicao: 3, carisma: -2, sabedoria: -1 } },
  { id: 'felino', name: 'Felino', icon: '🐱', desc: 'Reflexos excelentes, embora suporte menos golpes pesados.', bonus: { destreza: 3, constituicao: -1 } },
  { id: 'celestial', name: 'Celestial', icon: '😇', desc: 'Sábio e carismático, mas menos adaptado à força bruta.', bonus: { sabedoria: 2, carisma: 2, forca: -1 } },
];

/**
 * Afinidade = % de eficiência da classe com cada tipo de arma. Nenhuma arma é
 * bloqueada — toda classe pode equipar qualquer uma, só causa menos
 * dano/efeito nas que tem pouca afinidade.
 */
export interface ClassDef {
  id: string;
  name: string;
  icon: string;
  weaponTemplate: string;
  bias: Partial<Record<AttrKey, number>>;
  desc: string;
  /** Id do poder de assinatura — resolvido via {@link powerById}. */
  signatureId: string;
  affinity: Record<string, number>;
}

export const CLASSES: readonly ClassDef[] = [
  { id: 'guerreiro', name: 'Guerreiro', icon: '⚔️', weaponTemplate: 'espada', bias: { forca: 3, constituicao: 2 }, desc: 'Combate corpo a corpo, resistente na linha de frente.', signatureId: 'golpe_poderoso', affinity: { espada: 100, machado: 90, maca: 70, adaga: 55, arco: 50, cajado: 25, marreta: 90, violao: 20 } },
  { id: 'mago', name: 'Mago', icon: '🧙', weaponTemplate: 'cajado', bias: { intelecto: 3, sabedoria: 1 }, desc: 'Magias ofensivas e controle de mana.', signatureId: 'bola_de_fogo', affinity: { cajado: 100, maca: 55, adaga: 45, arco: 40, espada: 30, machado: 20, marreta: 20, violao: 30 } },
  { id: 'ladino', name: 'Ladino', icon: '🗡', weaponTemplate: 'adaga', bias: { destreza: 3, carisma: 1 }, desc: 'Furtividade, críticos e agilidade.', signatureId: 'furtividade_sombria', affinity: { adaga: 100, arco: 80, espada: 55, maca: 40, machado: 40, cajado: 30, marreta: 40, violao: 45 } },
  { id: 'clerigo', name: 'Clérigo', icon: '✝️', weaponTemplate: 'maca', bias: { sabedoria: 3, constituicao: 1 }, desc: 'Cura aliados e resiste a corrupção.', signatureId: 'cura_menor', affinity: { maca: 100, cajado: 70, espada: 50, adaga: 40, arco: 35, machado: 30, marreta: 30, violao: 35 } },
  { id: 'barbaro', name: 'Bárbaro', icon: '🪓', weaponTemplate: 'machado', bias: { forca: 4 }, desc: 'Fúria bruta, dano massivo corpo a corpo.', signatureId: 'grito_de_guerra', affinity: { machado: 100, espada: 85, maca: 55, adaga: 45, arco: 35, cajado: 15, marreta: 100, violao: 15 } },
  { id: 'arqueiro', name: 'Arqueiro', icon: '🏹', weaponTemplate: 'arco', bias: { destreza: 3, sabedoria: 1 }, desc: 'Precisão a distância e mobilidade.', signatureId: 'tiro_certeiro', affinity: { arco: 100, adaga: 70, espada: 50, maca: 40, machado: 35, cajado: 25, marreta: 35, violao: 35 } },
  { id: 'paladino', name: 'Paladino', icon: '🛡️', weaponTemplate: 'espada', bias: { forca: 2, sabedoria: 2, constituicao: 1 }, desc: 'Defensor sagrado que combina resistência e cura.', signatureId: 'julgamento_sagrado', affinity: { espada: 100, maca: 90, machado: 65, cajado: 60, adaga: 40, arco: 35, marreta: 65, violao: 35 } },
  { id: 'necromante', name: 'Necromante', icon: '☠️', weaponTemplate: 'cajado', bias: { intelecto: 3, constituicao: 1 }, desc: 'Conjura maldições e drena a força dos inimigos.', signatureId: 'maldicao_sombria', affinity: { cajado: 100, adaga: 75, maca: 55, espada: 40, arco: 35, machado: 25, marreta: 25, violao: 40 } },
  { id: 'druida', name: 'Druida', icon: '🌿', weaponTemplate: 'cajado', bias: { sabedoria: 3, constituicao: 1 }, desc: 'Controla a natureza, venenos e magia de cura.', signatureId: 'esporos_venenosos', affinity: { cajado: 100, maca: 75, arco: 65, adaga: 50, espada: 35, machado: 35, marreta: 35, violao: 55 } },
  { id: 'monge', name: 'Monge', icon: '🥋', weaponTemplate: 'maca', bias: { destreza: 2, sabedoria: 2 }, desc: 'Lutador disciplinado que domina corpo e espírito.', signatureId: 'golpe_atordoante', affinity: { maca: 100, adaga: 85, cajado: 70, espada: 55, machado: 40, arco: 40, marreta: 40, violao: 45 } },
  { id: 'bardo', name: 'Bardo', icon: '🎵', weaponTemplate: 'violao', bias: { carisma: 3, destreza: 1 }, desc: 'Usa música para fortalecer aliados e enfraquecer inimigos.', signatureId: 'cancao_debilitante', affinity: { adaga: 100, arco: 80, espada: 65, cajado: 65, maca: 50, machado: 30, marreta: 30, violao: 100 } },
  { id: 'cacador', name: 'Caçador', icon: '🐺', weaponTemplate: 'arco', bias: { destreza: 2, sabedoria: 2 }, desc: 'Especialista em rastrear e sangrar criaturas.', signatureId: 'flecha_serrilhada', affinity: { arco: 100, adaga: 85, espada: 60, machado: 50, maca: 35, cajado: 25, marreta: 50, violao: 40 } },
];

export type PowerType =
  | 'dano_fisico'
  | 'dano_magico'
  | 'cura'
  | 'buff_crit'
  | 'buff_precisao'
  | 'buff_forca'
  | 'buff_esquiva'
  | 'escudo';

export type PowerStatus = 'queimadura' | 'enfraquecido' | 'veneno' | 'atordoado' | 'vulneravel' | 'sangramento' | 'lento';

export interface Power {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cost: number;
  type: PowerType;
  power?: number;
  status?: PowerStatus;
  turns?: number;
  dotRatio?: number;
  amount?: number;
  healRatio?: number;
}

export const POWERS: readonly Power[] = [
  { id: 'golpe_poderoso', name: 'Golpe Poderoso', icon: '💥', desc: 'Concentra força extra no próximo ataque corpo a corpo.', cost: 8, type: 'dano_fisico', power: 1.8 },
  { id: 'bola_de_fogo', name: 'Bola de Fogo', icon: '🔥', desc: 'Conjura uma explosão e causa queimadura por 3 turnos.', cost: 14, type: 'dano_magico', power: 1.5, status: 'queimadura', turns: 3, dotRatio: 0.18 },
  { id: 'cura_menor', name: 'Cura Menor', icon: '✨', desc: 'Restaura Vida do herói, companheiros e parceiro online.', cost: 10, type: 'cura', power: 1.0 },
  { id: 'furtividade_sombria', name: 'Furtividade Sombria', icon: '🌑', desc: 'O próximo ataque é um acerto crítico garantido.', cost: 8, type: 'buff_crit' },
  { id: 'tiro_certeiro', name: 'Tiro Certeiro', icon: '🎯', desc: 'Aumenta muito a precisão dos próximos ataques.', cost: 6, type: 'buff_precisao', turns: 2, amount: 25 },
  { id: 'grito_de_guerra', name: 'Grito de Guerra', icon: '📯', desc: 'Aumenta o dano físico causado por um tempo.', cost: 10, type: 'buff_forca', turns: 3, amount: 0.3 },
  { id: 'escudo_arcano', name: 'Escudo Arcano', icon: '🔷', desc: 'Cria uma barreira que absorve o próximo golpe recebido.', cost: 10, type: 'escudo', amount: 0.5 },
  { id: 'passo_veloz', name: 'Passo Veloz', icon: '💨', desc: 'Aumenta a chance de esquiva por um tempo.', cost: 6, type: 'buff_esquiva', turns: 3, amount: 20 },
  { id: 'julgamento_sagrado', name: 'Julgamento Sagrado', icon: '🌟', desc: 'Golpe mágico que também recupera um pouco de Vida.', cost: 12, type: 'dano_magico', power: 1.35, healRatio: 0.3 },
  { id: 'maldicao_sombria', name: 'Maldição Sombria', icon: '☠️', desc: 'Causa dano e reduz o dano do inimigo por 3 turnos.', cost: 12, type: 'dano_magico', power: 1.25, status: 'enfraquecido', turns: 3, amount: 0.25 },
  { id: 'esporos_venenosos', name: 'Esporos Venenosos', icon: '☣️', desc: 'Envenena o inimigo por 4 turnos.', cost: 11, type: 'dano_magico', power: 0.9, status: 'veneno', turns: 4, dotRatio: 0.22 },
  { id: 'golpe_atordoante', name: 'Golpe Atordoante', icon: '💫', desc: 'Ataque físico que atordoa o inimigo.', cost: 10, type: 'dano_fisico', power: 1.15, status: 'atordoado', turns: 1 },
  { id: 'cancao_debilitante', name: 'Canção Debilitante', icon: '🎶', desc: 'Torna o inimigo vulnerável a ataques por 3 turnos.', cost: 10, type: 'dano_magico', power: 0.7, status: 'vulneravel', turns: 3, amount: 0.2 },
  { id: 'flecha_serrilhada', name: 'Flecha Serrilhada', icon: '🩸', desc: 'Causa dano físico e sangramento por 3 turnos.', cost: 9, type: 'dano_fisico', power: 1.25, status: 'sangramento', turns: 3, dotRatio: 0.2 },
  { id: 'rajada_glacial', name: 'Rajada Glacial', icon: '❄️', desc: 'Causa dano mágico e deixa o inimigo lento.', cost: 12, type: 'dano_magico', power: 1.3, status: 'lento', turns: 3, amount: 0.2 },
  { id: 'renovacao_natural', name: 'Renovação Natural', icon: '🌱', desc: 'Cura poderosa para o herói, companheiros e parceiro online.', cost: 15, type: 'cura', power: 1.8 },
];

export type DebuffEffect =
  | 'fireVulnerability'
  | 'rangedPenalty'
  | 'fleePenalty'
  | 'physicalVulnerability'
  | 'manaCostPenalty'
  | 'critPenalty'
  | 'poisonVulnerability'
  | 'healingPenalty';

export interface Debuff {
  id: string;
  name: string;
  icon: string;
  desc: string;
  attr: AttrKey | null;
  effect?: DebuffEffect;
}

export const DEBUFFS: readonly Debuff[] = [
  { id: 'medo_do_fogo', name: 'Medo do Fogo', icon: '🔥', desc: 'Recebe 25% mais dano de criaturas mágicas ou de fogo.', attr: null, effect: 'fireVulnerability' },
  { id: 'orgulhoso', name: 'Orgulhoso', icon: '👑', desc: '-1 Carisma em negociações com autoridades.', attr: 'carisma' },
  { id: 'visao_fraca', name: 'Visão Fraca', icon: '👁️', desc: '-2 nas rolagens de ataque quando usa arco ou cajado.', attr: null, effect: 'rangedPenalty' },
  { id: 'sono_leve', name: 'Sono Leve', icon: '😴', desc: 'Descansa mal e recupera menos energia; -1 Constituição.', attr: 'constituicao' },
  { id: 'desajeitado', name: 'Desajeitado', icon: '🤕', desc: '-1 Destreza em testes de agilidade.', attr: 'destreza' },
  { id: 'teimoso', name: 'Teimoso', icon: '🗿', desc: '-1 Sabedoria e -2 nas tentativas de fuga.', attr: 'sabedoria', effect: 'fleePenalty' },
  { id: 'corpo_fragil', name: 'Corpo Frágil', icon: '🦴', desc: '-1 Constituição e recebe 20% mais dano físico.', attr: 'constituicao', effect: 'physicalVulnerability' },
  { id: 'mana_instavel', name: 'Mana Instável', icon: '💢', desc: '-1 Intelecto e poderes custam 20% mais Mana.', attr: 'intelecto', effect: 'manaCostPenalty' },
  { id: 'azarado', name: 'Azarado', icon: '🍂', desc: 'Sua chance de acerto crítico é reduzida em 8%.', attr: null, effect: 'critPenalty' },
  { id: 'sangue_toxico', name: 'Sangue Tóxico', icon: '☣️', desc: 'Efeitos de veneno causam 50% mais dano.', attr: null, effect: 'poisonVulnerability' },
  { id: 'cicatrizacao_lenta', name: 'Cicatrização Lenta', icon: '🩹', desc: 'Curas recebidas são 25% menos eficientes.', attr: null, effect: 'healingPenalty' },
];

/**
 * Nomes legados de debuff que precisam mapear pro mesmo efeito por causa de
 * saves antigos: alguns saves gravaram só o `name` do debuff, sem `effect`,
 * antes de a mecânica de efeito existir. Ver {@link hasDebuffEffect}.
 */
export const LEGACY_DEBUFF_EFFECTS: Record<string, DebuffEffect> = {
  'Medo do Fogo': 'fireVulnerability',
  'Visão Fraca': 'rangedPenalty',
  'Visao Fraca': 'rangedPenalty',
  Teimoso: 'fleePenalty',
};

/** Passiva única de cada classe, sempre ativa em combate — puramente descritivo aqui. */
export interface ClassPassive {
  name: string;
  desc: string;
}

/** Chaveado pelo **id** da classe, não pelo nome: nome é texto de tela e um dia muda de idioma. */
export const CLASS_PASSIVES: Record<string, ClassPassive> = {
  guerreiro: { name: 'Postura Defensiva', desc: '20% de chance de reduzir o golpe recebido em 40%.' },
  mago: { name: 'Fluxo Arcano', desc: 'Ataques mágicos sofrem metade da penalidade de resistência do inimigo.' },
  ladino: { name: 'Ataque Furtivo', desc: '25% de chance de acertar um segundo golpe ao atacar.' },
  clerigo: { name: 'Prece Silenciosa', desc: '20% de chance de recuperar Vida ao acertar um golpe.' },
  barbaro: { name: 'Fúria', desc: '+35% de dano físico quando está com menos de 50% de Vida.' },
  arqueiro: { name: 'Precisão Nata', desc: '+8% de chance de acerto crítico.' },
  paladino: { name: 'Graça Divina', desc: '25% de chance de recuperar Vida ao acertar um golpe.' },
  necromante: { name: 'Toque Sombrio', desc: '30% de chance de enfraquecer o inimigo ao acertar.' },
  druida: { name: 'Picada Natural', desc: '30% de chance de envenenar o inimigo ao acertar.' },
  monge: { name: 'Disciplina', desc: '22% de chance de atordoar o inimigo ao acertar.' },
  bardo: { name: 'Dissonância', desc: '30% de chance de deixar o inimigo vulnerável ao acertar.' },
  cacador: { name: 'Instinto de Caça', desc: '30% de chance de causar sangramento ao acertar. Enxerga criaturas em salas vizinhas ainda não exploradas.' },
};

export function classPassive(classId: string): ClassPassive | null {
  return CLASS_PASSIVES[classId] ?? null;
}

export const FIRST_NAMES = ['Aldric', 'Bryn', 'Cael', 'Dara', 'Eron', 'Fiora', 'Garrick', 'Helka', 'Ivo', 'Junne', 'Korrin', 'Lyra', 'Maren', 'Norrik', 'Orla', 'Petra', 'Quill', 'Rhoda', 'Sten', 'Thalia'] as const;
export const SURNAMES = ['Pedraverde', 'Fenris', 'Duasluas', 'Corvonegro', 'Vale-Ferro', 'Lobodourado', 'Ventoforte', 'Silêncio', 'Brasa', 'Marfim'] as const;

export const ATTR_LABELS: Record<AttrKey, string> = {
  forca: 'FOR',
  destreza: 'DES',
  constituicao: 'CON',
  intelecto: 'INT',
  sabedoria: 'SAB',
  carisma: 'CAR',
};

// ---------- buscas ----------
// O original comparava por `.name` inteiro (com acento) usando um comparador
// que remove acentuação — normalizamos o mesmo jeito para aceitar entrada de
// save antigo ou de formulário HTML sem depender de acento exato.

// Faixa Unicode das marcas de acento combinaveis (U+0300 a U+036F), construida
// via String.fromCharCode em vez de literal no regex para nao depender de
// como o editor/terminal grava caracteres combinaveis no arquivo fonte.
const DIACRITICS = new RegExp(
  '[' + String.fromCodePoint(0x0300) + '-' + String.fromCodePoint(0x036f) + ']',
  'g',
);

function normalizedName(name: string): string {
  return String(name || '')
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase();
}

const RACES_BY_ID = new Map(RACES.map((r) => [r.id, r]));
const CLASSES_BY_ID = new Map(CLASSES.map((c) => [c.id, c]));
const POWERS_BY_ID = new Map(POWERS.map((p) => [p.id, p]));
const DEBUFFS_BY_ID = new Map(DEBUFFS.map((d) => [d.id, d]));

export function raceById(id: string): Race | null {
  return RACES_BY_ID.get(id) ?? null;
}

export function classById(id: string): ClassDef | null {
  return CLASSES_BY_ID.get(id) ?? null;
}

export function powerById(id: string): Power | null {
  return POWERS_BY_ID.get(id) ?? null;
}

export function debuffById(id: string): Debuff | null {
  return DEBUFFS_BY_ID.get(id) ?? null;
}

/**
 * ## Identidade é id; nome é texto de tela
 *
 * Classe, raça e poder têm `id` estável e `name` de exibição. **As regras
 * do jogo só podem olhar o `id`** — afinidade de arma, passiva de classe,
 * bônus de companheiro. O `name` existe pra mostrar, e texto de tela um
 * dia muda de idioma.
 *
 * Isso não era assim: o combate comparava `hero.className === 'Mago'` em
 * uma dúzia de lugares, e `CLASS_PASSIVES` era chaveado pelo nome. Traduzir
 * uma palavra teria mudado dano, desligado a cura do clérigo e sumido com
 * a passiva do guerreiro — sem erro nenhum, porque toda busca termina em
 * `?? null`. O rastro disso ficou visível nos `'Clérigo' || 'Clerigo'` que
 * alguém já teve que escrever quando o acento sumiu de um save.
 *
 * Os saves que já estão na nuvem guardam só o nome. Por isso as buscas por
 * nome continuam existindo — e é por elas que `idDaClasse`/`idDaRaca`
 * resolvem quem chegou sem id.
 */

/** Busca por nome de exibição, insensível a acento — para entrada de save antigo. */
export function classByName(name: string): ClassDef | null {
  const target = normalizedName(name);
  return CLASSES.find((c) => normalizedName(c.name) === target) ?? null;
}

export function powerByName(name: string): Power | null {
  return POWERS.find((p) => p.name === name) ?? null;
}

export function raceByName(name: string): Race | null {
  const target = normalizedName(name);
  return RACES.find((r) => normalizedName(r.name) === target) ?? null;
}

/** O que o save tem de identidade — `classId` novo, ou só o nome antigo. */
export interface IdentidadeDeClasse {
  classId?: string;
  className?: string;
}

export interface IdentidadeDeRaca {
  raceId?: string;
  race?: string;
}

/**
 * Id da classe a partir de qualquer save: o campo novo quando existe, o
 * nome traduzido de volta quando não. Toda regra passa por aqui, então a
 * compatibilidade com save antigo vive **num lugar só**.
 */
export function idDaClasse(quem: IdentidadeDeClasse): string | null {
  if (quem.classId) return quem.classId;
  return quem.className ? (classByName(quem.className)?.id ?? null) : null;
}

export function idDaRaca(quem: IdentidadeDeRaca): string | null {
  if (quem.raceId) return quem.raceId;
  return quem.race ? (raceByName(quem.race)?.id ?? null) : null;
}
