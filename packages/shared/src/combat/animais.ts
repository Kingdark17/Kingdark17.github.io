/**
 * Os animais do Caçador (rodada 7b do doc do Breno de 2026-11-15, decidido
 * com o usuário). Só a luta do app doma; o site conhece os animais (o mesmo
 * personagem roda nos dois) e o ativo luta lá como um recruta.
 *
 * - **Quem se doma**: só os bichos — o lobo das sombras, a aranha e o
 *   morcego —, nunca o chefe. Cada um tem a comida preferida, que o vendedor
 *   do app vende ao Caçador.
 * - **Domar** (`alimentar` na arena): a até 3 blocos, com o bicho abaixo de
 *   25% da vida e a comida dele na mochila, o Caçador oferece (cada oferta
 *   gasta uma). Metade das vezes ele aceita; aceitar 2 vezes doma (ele sai da
 *   luta, e se era o último a sala está vencida, sem o XP e o ouro dele).
 *   Recusou, ataca na hora; recusou 6 vezes, não aceita mais.
 * - **O domado** é um companheiro (`Companion.animal`) com 70% da vida e do
 *   dano que o bicho tinha, e o nome dele (o jogador troca na janela que abre).
 *   Até 4 domados: os 2 primeiros seguem o herói na equipe, os outros ficam
 *   guardados em `Hero.animais` (a troca é na janela do K, rodada 7c). Não
 *   ocupam a vaga dos recrutas.
 */

import type { Companion, Hero } from '../hero/hero.js';
import { speciesById } from '../monsters/species.js';
import { addItem } from '../inventory/inventory.js';
import { instantiate, type Item } from '../items/item.js';
import { RARITIES, type Rarity } from '../items/rarity.js';
import { templateById, type ItemTemplate } from '../items/templates.js';
import type { Rng } from '../rng.js';

/** A comida preferida de cada bicho que se doma (a espécie → o modelo da comida). */
export const COMIDA_DO_ANIMAL: Readonly<Record<string, string>> = {
  lobo_sombras: 'carne_crua',
  aranha: 'grilo',
  morcego: 'fruta_madura',
};

/** As comidas, na ordem em que o vendedor do app as põe à venda. */
export const COMIDAS_DOS_ANIMAIS: readonly string[] = ['carne_crua', 'grilo', 'fruta_madura'];

export const REGRAS_DE_DOMAR = {
  /** Até quantos blocos do bicho o Caçador oferece a comida. */
  distancia: 3,
  /** O bicho precisa estar abaixo deste tanto (%) da vida máxima. */
  vida: 25,
  /** A chance (%) de ele aceitar cada oferta, e quantas vezes aceitar doma. */
  chance: 50,
  aceites: 2,
  /** Recusou este tanto de vezes: não aceita mais. */
  recusas: 6,
  /** O domado começa com este tanto (%) da vida e do dano do bicho. */
  status: 70,
  /** Quantos domados o Caçador tem, e quantos seguem ele na equipe. */
  maximo: 4,
  ativos: 2,
  /** O tamanho máximo do nome. */
  nome: 20,
} as const;

/** A comida preferida do bicho, ou `null` se ele não se doma. */
export function comidaPreferida(speciesId: string): string | null {
  return Object.prototype.hasOwnProperty.call(COMIDA_DO_ANIMAL, speciesId) ? (COMIDA_DO_ANIMAL[speciesId] as string) : null;
}

/** O bicho se doma: uma das espécies com comida preferida, e não é chefe. */
export function domavel(monstro: { speciesId: string; isBoss?: boolean }): boolean {
  return !monstro.isBoss && comidaPreferida(monstro.speciesId) !== null;
}

/** Os animais que seguem o herói (os da equipe). */
export function animaisDaEquipe(party: readonly Companion[]): Companion[] {
  return party.filter((membro) => !!membro.animal);
}

/** Quantos animais o herói tem: os da equipe e os guardados. */
export function quantosAnimais(estado: { hero: Hero; party: readonly Companion[]; inventory?: readonly Item[] }): number {
  // O caído em cristal na mochila (rodada 7d) continua sendo dele.
  const cristais = (estado.inventory ?? []).filter((item) => !!item.animal).length;
  return animaisDaEquipe(estado.party).length + (estado.hero.animais?.length ?? 0) + cristais;
}

/** A equipe sem os esqueletos e sem os animais: o que conta na vaga dos recrutas. */
export function recrutas(party: readonly Companion[]): Companion[] {
  return party.filter((membro) => !membro.invocado && !membro.animal);
}

/** O animal domado, a partir do bicho como ele estava: 70% da vida máxima (inteira) e do dano, com o nome da espécie. */
export function animalDomado(monstro: { speciesId: string; maxHp: number; dmg: number }, id: string): Companion {
  const r = REGRAS_DE_DOMAR;
  const especie = speciesById(monstro.speciesId);
  const nome = especie?.name ?? monstro.speciesId;
  const maxHp = Math.max(1, Math.round((monstro.maxHp * r.status) / 100));
  const attack = Math.max(1, Math.round((monstro.dmg * r.status) / 100));
  return {
    name: nome,
    raceIcon: especie?.icon ?? '🐾',
    race: nome,
    className: 'Animal',
    classIcon: '🐾',
    hp: maxHp,
    maxHp,
    attack,
    attrs: { forca: 0, destreza: 0, constituicao: 0, intelecto: 0, sabedoria: 0, carisma: 0 },
    stance: 'agressiva',
    ability: 'Instinto',
    abilityDesc: 'Um animal domado pelo Caçador.',
    especie: monstro.speciesId,
    animal: { id, nivel: 1, batalhas: 0, vidaBase: maxHp, ataqueBase: attack },
  };
}

/** O domado entra na equipe se ainda cabe (2 seguem o herói); senão fica guardado com o herói. */
export function juntarAnimal<T extends { hero: Hero; party: Companion[] }>(estado: T, animal: Companion): T {
  if (animaisDaEquipe(estado.party).length < REGRAS_DE_DOMAR.ativos) return { ...estado, party: [...estado.party, animal] };
  return { ...estado, hero: { ...estado.hero, animais: [...(estado.hero.animais ?? []), animal] } };
}

/** O nome que o jogador deu, limpo: sem caracteres de controle nem < >, sem espaço nas pontas, até 20 letras; vazio, o padrão. */
export function nomeDoAnimal(nome: string, padrao: string): string {
  let limpo = '';
  for (const letra of nome) {
    const codigo = letra.codePointAt(0) as number;
    if (codigo < 32 || codigo === 127 || letra === '<' || letra === '>') continue;
    limpo += letra;
  }
  limpo = limpo.trim();
  // Corta em letras inteiras (um emoji não se parte ao meio).
  const letras = Array.from(limpo);
  if (letras.length > REGRAS_DE_DOMAR.nome) limpo = letras.slice(0, REGRAS_DE_DOMAR.nome).join('').trim();
  return limpo || padrao;
}

/** Dá nome ao animal `id`, esteja ele na equipe ou guardado. */
export function nomearAnimal<T extends { hero: Hero; party: Companion[] }>(estado: T, id: string, nome: string): T {
  const trocar = (membro: Companion): Companion => (membro.animal?.id === id ? { ...membro, name: nomeDoAnimal(nome, membro.race) } : membro);
  const party = estado.party.map(trocar);
  const guardados = estado.hero.animais;
  return { ...estado, party, ...(guardados ? { hero: { ...estado.hero, animais: guardados.map(trocar) } } : {}) };
}

// ---------- o animal na luta e os níveis (rodada 7c) ----------

export const REGRAS_DOS_ANIMAIS = {
  /** O nível: 1 a cada `batalhasPorNivel` lutas vencidas com ele na equipe, até `nivelMaximo`; cada nível soma `porNivel`% da vida e do dano de quando foi domado. */
  batalhasPorNivel: 30,
  nivelMaximo: 10,
  porNivel: 20,
  /** A retaguarda guarda o dono a até `retaguarda` blocos e bate `danoNaRetaguarda`% mais forte; o ofensivo leva `resistenciaNoOfensivo`% menos. */
  retaguarda: 3,
  danoNaRetaguarda: 20,
  resistenciaNoOfensivo: 20,
  /** O estratégico guarda a área de `ladoDaGuarda` × `ladoDaGuarda` casas marcada no chão, e o golpe dele pega todos dentro dela. */
  ladoDaGuarda: 4,
} as const;

export type EstadoDoAnimal = 'retaguarda' | 'ofensivo' | 'estrategico';

/** O estado do animal na arena (a retaguarda, se ainda não mudou). */
export function estadoDoAnimal(membro: Pick<Companion, 'estadoDoLacaio'>): EstadoDoAnimal {
  return membro.estadoDoLacaio ?? 'retaguarda';
}

/** A vida ou o dano no nível: o de quando foi domado, mais 20% dele por nível acima do 1. */
export function statusNoNivel(base: number, nivel: number): number {
  return Math.max(1, Math.round((base * (100 + REGRAS_DOS_ANIMAIS.porNivel * (nivel - 1))) / 100));
}

/**
 * A luta vencida conta uma batalha pra cada animal da equipe (de pé ou caído):
 * a cada 30, ele sobe um nível (até o 10), e a vida máxima e o dano sobem com
 * ele (a vida que falta continua faltando; o caído continua caído).
 */
export function contarBatalha(party: readonly Companion[]): { party: Companion[]; subiram: Companion[] } {
  const r = REGRAS_DOS_ANIMAIS;
  const subiram: Companion[] = [];
  const nova = party.map((membro) => {
    if (!membro.animal) return membro;
    const batalhas = membro.animal.batalhas + 1;
    const vidaBase = membro.animal.vidaBase ?? membro.maxHp;
    const ataqueBase = membro.animal.ataqueBase ?? membro.attack;
    const animal = { ...membro.animal, batalhas, vidaBase, ataqueBase };
    if (batalhas % r.batalhasPorNivel !== 0 || membro.animal.nivel >= r.nivelMaximo) return { ...membro, animal };
    const nivel = membro.animal.nivel + 1;
    const maxHp = statusNoNivel(vidaBase, nivel);
    const attack = statusNoNivel(ataqueBase, nivel);
    const hp = membro.hp > 0 ? Math.min(maxHp, membro.hp + (maxHp - membro.maxHp)) : membro.hp;
    const subiu: Companion = { ...membro, hp, maxHp, attack, animal: { ...animal, nivel } };
    subiram.push(subiu);
    return subiu;
  });
  return { party: nova, subiram };
}

/** Troca o estado do animal `id` na arena, esteja ele na equipe ou guardado. */
export function mudarEstadoDoAnimal<T extends { hero: Hero; party: Companion[] }>(estado: T, id: string, novo: EstadoDoAnimal): T {
  const trocar = (membro: Companion): Companion => (membro.animal?.id === id ? { ...membro, estadoDoLacaio: novo } : membro);
  const guardados = estado.hero.animais;
  return { ...estado, party: estado.party.map(trocar), ...(guardados ? { hero: { ...estado.hero, animais: guardados.map(trocar) } } : {}) };
}

/** O animal da equipe vai pra junto dos guardados (deixa de seguir o herói; se era a montaria, o herói desmonta). */
export function guardarAnimal<T extends { hero: Hero; party: Companion[] }>(estado: T, id: string): T {
  const animal = estado.party.find((membro) => membro.animal?.id === id);
  if (!animal) return estado;
  const hero = estado.hero.montaria === id ? semMontaria(estado.hero) : estado.hero;
  return {
    ...estado,
    party: estado.party.filter((membro) => membro !== animal),
    hero: { ...hero, animais: [...(hero.animais ?? []), animal] },
  };
}

/** O animal guardado volta a seguir o herói, se ainda cabe na equipe (2 seguem). */
export function levarAnimal<T extends { hero: Hero; party: Companion[] }>(estado: T, id: string): T {
  const guardados = estado.hero.animais ?? [];
  const animal = guardados.find((membro) => membro.animal?.id === id);
  if (!animal || animaisDaEquipe(estado.party).length >= REGRAS_DE_DOMAR.ativos) return estado;
  const resto = guardados.filter((membro) => membro !== animal);
  const { animais: _antes, ...semGuardados } = estado.hero;
  return { ...estado, party: [...estado.party, animal], hero: resto.length > 0 ? { ...estado.hero, animais: resto } : semGuardados };
}

// ---------- a montaria, o cristal, reviver e soltar (rodada 7d) ----------

export const REGRAS_DA_MONTARIA = {
  /** A partir deste nível o animal vira montaria. */
  nivel: 5,
  /** Montado: a velocidade a mais (%) e o alcance do golpe (em blocos; a aljava ainda soma). */
  velocidade: 20,
  alcance: 6,
  /** A partir do nível `nivelDaResistencia`, a montaria segura este tanto (%) do dano que o herói levaria, na vida dela. */
  nivelDaResistencia: 8,
  segura: 15,
  /** A partir do nível `nivelDoDano`, o herói montado bate este tanto (%) mais forte. */
  nivelDoDano: 10,
  dano: 20,
} as const;

export const REGRAS_DO_CRISTAL = {
  /** O modelo do cristal, e a poção que o desfaz. */
  cristal: 'cristal_animal',
  pocao: 'pot_reviver',
  /** A Poção de Reviver traz o animal com este tanto (%) da vida máxima; a taverna, com ela cheia. */
  vidaComPocao: 50,
} as const;

/** O herói a pé (sem o campo da montaria). */
function semMontaria(hero: Hero): Hero {
  const { montaria: _montaria, ...resto } = hero;
  return resto;
}

/** O animal pode ser montado: de pé e do nível 5 em diante. */
export function podeMontar(animal: Companion): boolean {
  return !!animal.animal && animal.hp > 0 && animal.animal.nivel >= REGRAS_DA_MONTARIA.nivel;
}

/** A montaria do herói agora: o animal da equipe em que ele está, se ainda pode ser montado; senão `null`. */
export function montariaDe(estado: { hero: Hero; party: readonly Companion[] }): Companion | null {
  const id = estado.hero.montaria;
  if (!id) return null;
  const animal = estado.party.find((membro) => membro.animal?.id === id);
  return animal && podeMontar(animal) ? animal : null;
}

/** Monta no animal `id` da equipe (nível 5+, de pé). */
export function montarAnimal<T extends { hero: Hero; party: Companion[] }>(estado: T, id: string): T {
  const animal = estado.party.find((membro) => membro.animal?.id === id);
  if (!animal || !podeMontar(animal)) return estado;
  return { ...estado, hero: { ...estado.hero, montaria: id } };
}

/** Desce da montaria. */
export function desmontar<T extends { hero: Hero; party: Companion[] }>(estado: T): T {
  return estado.hero.montaria ? { ...estado, hero: semMontaria(estado.hero) } : estado;
}

/** O cristal do animal que caiu: o modelo do cristal, com o animal dentro (a vida em 0). */
export function cristalDoAnimal(animal: Companion, rng: Rng, now?: () => number): Item {
  const item = instantiate(templateById(REGRAS_DO_CRISTAL.cristal) as ItemTemplate, RARITIES[0] as Rarity, now ? { rng, now } : { rng });
  return { ...item, animal: { ...animal, hp: 0 } };
}

/**
 * No fim da luta, cada animal caído sai da equipe e vira o cristal dele na
 * mochila (se era a montaria, o herói desmonta).
 */
export function cristalizarCaidos<T extends { hero: Hero; party: Companion[]; inventory: Item[] }>(estado: T, rng: Rng, now?: () => number): { estado: T; log: string[] } {
  const caidos = estado.party.filter((membro) => !!membro.animal && membro.hp <= 0);
  if (caidos.length === 0) return { estado, log: [] };
  let inventory = estado.inventory;
  const log: string[] = [];
  for (const animal of caidos) {
    inventory = addItem(inventory, cristalDoAnimal(animal, rng, now));
    log.push(`💠 ${animal.name} caiu e virou um cristal.`);
  }
  const montadoCaiu = caidos.some((membro) => membro.animal?.id === estado.hero.montaria);
  return {
    estado: { ...estado, party: estado.party.filter((membro) => !caidos.includes(membro)), inventory, ...(montadoCaiu ? { hero: semMontaria(estado.hero) } : {}) },
    log,
  };
}

/** A Poção de Reviver no cristal: o animal volta com metade da vida (pra equipe, se cabe; senão guardado), e os dois somem da mochila. */
export function reviverComPocao<T extends { hero: Hero; party: Companion[]; inventory: Item[] }>(estado: T, uid: string): { estado: T; log: string[] } {
  const cristal = estado.inventory.find((item) => item.uid === uid && !!item.animal);
  if (!cristal) return { estado, log: [] };
  const pocao = estado.inventory.find((item) => item.templateId === REGRAS_DO_CRISTAL.pocao);
  if (!pocao) return { estado, log: ['Falta uma Poção de Reviver pra trazer o animal de volta.'] };
  const animal = cristal.animal as Companion;
  const vivo: Companion = { ...animal, hp: Math.max(1, Math.round((animal.maxHp * REGRAS_DO_CRISTAL.vidaComPocao) / 100)) };
  const inventory = estado.inventory.filter((item) => item.uid !== cristal.uid && item.uid !== pocao.uid);
  return { estado: juntarAnimal({ ...estado, inventory }, vivo), log: [`Você usa a Poção de Reviver: ${animal.name} volta com metade da vida.`] };
}

/** Uma noite na taverna traz todos os animais em cristal de volta, com a vida cheia. */
export function reviverNaTaverna<T extends { hero: Hero; party: Companion[]; inventory: Item[] }>(estado: T): { estado: T; voltaram: number } {
  const cristais = estado.inventory.filter((item) => !!item.animal);
  if (cristais.length === 0) return { estado, voltaram: 0 };
  let novo: T = { ...estado, inventory: estado.inventory.filter((item) => !item.animal) };
  for (const cristal of cristais) {
    const animal = cristal.animal as Companion;
    novo = juntarAnimal(novo, { ...animal, hp: animal.maxHp });
  }
  return { estado: novo, voltaram: cristais.length };
}

/** Solta o animal `id` pra sempre: da equipe, dos guardados ou o cristal dele (se era a montaria, o herói desmonta). */
export function soltarAnimal<T extends { hero: Hero; party: Companion[]; inventory: Item[] }>(estado: T, id: string): T {
  const dele = (membro: Companion) => membro.animal?.id === id;
  const naMochila = estado.inventory.some((item) => !!item.animal && dele(item.animal));
  const naEquipe = estado.party.some(dele);
  const guardado = (estado.hero.animais ?? []).some(dele);
  if (!naMochila && !naEquipe && !guardado) return estado;
  let hero = estado.hero.montaria === id ? semMontaria(estado.hero) : estado.hero;
  if (guardado) {
    const resto = (hero.animais ?? []).filter((membro) => !dele(membro));
    const { animais: _antes, ...semGuardados } = hero;
    hero = resto.length > 0 ? { ...hero, animais: resto } : semGuardados;
  }
  return {
    ...estado,
    hero,
    party: naEquipe ? estado.party.filter((membro) => !dele(membro)) : estado.party,
    inventory: naMochila ? estado.inventory.filter((item) => !(item.animal && dele(item.animal))) : estado.inventory,
  };
}
