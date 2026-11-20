/**
 * O tratador de animais (o fim do Caçador, 2026-11-18, decidido com o
 * usuário): um prédio novo na cidade, ao lado do ferreiro, com arte
 * provisória até o Breno desenhar. Só no app e só pro Caçador (no site a
 * porta não abre; os outros heróis ouvem que só o Caçador cuida de animais).
 *
 * Os três filhotes ficam sempre à venda, um de cada bicho que se doma (o lobo
 * das sombras, a aranha e o morcego): nível 1, com a vida e o dano de um bicho
 * daquela espécie, a 70% (como domar), por 50 de ouro por nível do herói. O
 * bicho é o do andar equivalente ao nível do herói, ou o do andar de força de
 * agora, o que for maior (2026-11-19, decisão do usuário: na cidade o andar é
 * o último em que ele esteve, e um herói de nível 9 no andar 1 pagava 450 por
 * um lobo de 8 de vida). Respeita o limite de 4 animais; comprado, entra na
 * equipe (se cabe) ou fica guardado, e o app abre a janela do nome. Os
 * textos evitam "fi" minúsculo, que a fonte do app troca por outra letra.
 */

import { animalDomado, juntarAnimal, quantosAnimais, REGRAS_DE_DOMAR } from '../combat/animais.js';
import type { Companion, Hero } from '../hero/hero.js';
import { statusDaEspecie } from '../monsters/generate.js';
import { defaultRng, randomInt, type Rng } from '../rng.js';
import { andarDeForca, type EstadoNaCidade } from './estado.js';

export const REGRAS_DO_TRATADOR = {
  /** O preço de cada filhote: este tanto de ouro por nível do herói. */
  precoPorNivel: 50,
} as const;

/** Os filhotes à venda, na ordem do cercado. */
export const FILHOTES: readonly string[] = ['lobo_sombras', 'aranha', 'morcego'];

/** Um filhote no cercado: a espécie, o nome, o ícone, e a vida e o dano com que ele vem. */
export interface FilhoteAVenda {
  especie: string;
  nome: string;
  icone: string;
  vida: number;
  dano: number;
}

/** A tela do tratador. */
export interface Tratador {
  estado: EstadoNaCidade;
  preco: number;
  filhotes: FilhoteAVenda[];
  /** O herói já tem os 4 animais: não compra mais. */
  cheio: boolean;
  log: string[];
  /** Acabou de comprar: o id do animal (o app abre a janela do nome). */
  comprou?: string;
}

/** O preço de um filhote pro herói. */
export function precoDoFilhote(hero: Pick<Hero, 'level'>): number {
  return REGRAS_DO_TRATADOR.precoPorNivel * hero.level;
}

/** O menor andar de força em que os monstros têm este nível (o `monsterLevel` ao contrário). */
export function andarDoNivel(nivel: number): number {
  return Math.max(1, Math.floor((10 * nivel + 3) / 9));
}

/** O andar do bicho que vira filhote: o do nível do herói, ou o andar de força de agora, o que for maior. */
export function andarDoFilhote(estado: Pick<EstadoNaCidade, 'hero' | 'masmorra' | 'floor'>): number {
  return Math.max(andarDeForca(estado), andarDoNivel(estado.hero.level));
}

/** O filhote da espécie pro herói de agora: 70% de um bicho dela no andar do filhote. */
function filhote(estado: EstadoNaCidade, especie: string, id: string): Companion {
  const status = statusDaEspecie(especie, andarDoFilhote(estado), estado.dificuldade);
  return animalDomado({ speciesId: especie, maxHp: status.maxHp, dmg: status.dmg }, id);
}

/** Os filhotes do cercado, como ficariam com este herói. */
export function filhotesDoTratador(estado: EstadoNaCidade): FilhoteAVenda[] {
  return FILHOTES.map((especie) => {
    const animal = filhote(estado, especie, '');
    return { especie, nome: animal.name, icone: animal.raceIcon, vida: animal.maxHp, dano: animal.attack };
  });
}

export function abrirTratador(estado: EstadoNaCidade): Tratador {
  return {
    estado,
    preco: precoDoFilhote(estado.hero),
    filhotes: filhotesDoTratador(estado),
    cheio: quantosAnimais(estado) >= REGRAS_DE_DOMAR.maximo,
    log: ['O tratador abre o cercado e mostra os bichinhos.'],
  };
}

/** Compra o filhote da espécie: o ouro sai, e ele entra na equipe (se cabe) ou fica guardado. */
export function comprarFilhote(tratador: Tratador, especie: string, rng: Rng = defaultRng, now?: () => number): Tratador {
  const estado = tratador.estado;
  if (!FILHOTES.includes(especie)) return { ...tratador, log: [] };
  if (quantosAnimais(estado) >= REGRAS_DE_DOMAR.maximo) return { ...tratador, log: [`Você já tem ${REGRAS_DE_DOMAR.maximo} animais.`] };
  const preco = precoDoFilhote(estado.hero);
  if (estado.hero.gold < preco) return { ...tratador, log: [`Faltam ${preco - estado.hero.gold} de ouro.`] };
  const id = `animal_${Math.trunc((now ?? Date.now)())}_${randomInt(100000, rng)}`;
  const animal = filhote(estado, especie, id);
  const comprado = juntarAnimal({ ...estado, hero: { ...estado.hero, gold: estado.hero.gold - preco } }, animal);
  return { ...abrirTratador(comprado), log: [`Você paga ${preco} de ouro e leva o bichinho: ${animal.name}.`], comprou: id };
}
