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
export function quantosAnimais(estado: { hero: Hero; party: readonly Companion[] }): number {
  return animaisDaEquipe(estado.party).length + (estado.hero.animais?.length ?? 0);
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

/** O animal da equipe vai pra junto dos guardados (deixa de seguir o herói). */
export function guardarAnimal<T extends { hero: Hero; party: Companion[] }>(estado: T, id: string): T {
  const animal = estado.party.find((membro) => membro.animal?.id === id);
  if (!animal) return estado;
  return {
    ...estado,
    party: estado.party.filter((membro) => membro !== animal),
    hero: { ...estado.hero, animais: [...(estado.hero.animais ?? []), animal] },
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
