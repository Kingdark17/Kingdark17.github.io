/**
 * Um herói **pronto**, com classe, sorteado do jeito que a criação fazia até
 * 2026-10 — raça, classe, dois poderes extras, fraqueza e atributos.
 *
 * Só os testes usam. A criação de verdade agora nasce Aprendiz e quem dá
 * classe é a Guilda (`criacao.ts`, `guilda.ts`), mas quase todo teste de
 * combate, mochila, loja e sala precisa de um herói que já luta. O código
 * abaixo é o `rolarTudo` + `montarSaveInicial` de antes, na mesma ordem de
 * sorteio: o mesmo `seededRng` continua dando o mesmo herói, e os testes que
 * dependem de um número exato não mudaram de resultado.
 */

import {
  addItem,
  buildHero,
  CLASSES,
  DEBUFFS,
  POWERS,
  RACES,
  randomItem,
  rollAttrs,
  type ClassDef,
  type Rng,
} from '@rpg-legend/shared';

import type { SaveInicial } from './save-inicial';

function sortear<T>(lista: readonly T[], rng: Rng): T {
  return lista[Math.floor(rng() * lista.length)];
}

function sortearPoderes(classe: ClassDef, rng: Rng) {
  const disponiveis = POWERS.filter((poder) => poder.id !== classe.signatureId && !poder.soDaClasse);
  return [...disponiveis].sort(() => rng() - 0.5).slice(0, 2);
}

/**
 * `rngDoSorteio` sorteia o herói; `rngDoSave` o ouro e o consumível inicial.
 * São dois porque a criação antiga usava dois — e o mesmo seed nos dois é o
 * que os testes passavam.
 */
export function saveSorteado(nome: string, rngDoSorteio: Rng, rngDoSave: Rng = rngDoSorteio): SaveInicial {
  const raca = sortear(RACES, rngDoSorteio);
  const classe = sortear(CLASSES, rngDoSorteio);
  const fraqueza = sortear(DEBUFFS, rngDoSorteio);
  const poderes = sortearPoderes(classe, rngDoSorteio);
  const atributos = rollAttrs(raca, classe, fraqueza, rngDoSorteio);

  const hero = buildHero(
    { name: nome.trim(), race: raca, cls: classe, debuff: fraqueza, chosenPowerIds: poderes.map((poder) => poder.id), attrs: atributos },
    rngDoSave,
  );
  const inventory = addItem([], randomItem({ category: 'consumivel', floor: 1, rng: rngDoSave }));
  return { hero, inventory, party: [], floor: 1, quests: [] };
}
