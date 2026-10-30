/**
 * Os acessórios únicos das masmorras: o terceiro prêmio de quem zera
 * (`jogo/conquista.ts`). Decisões do usuário (2026-10-26):
 *
 * - um por masmorra, e cai na **primeira vez** que se zera cada
 *   dificuldade: a versão Normal, a Difícil e a Pesadelo, nove ao todo.
 *   Zerar de novo a mesma dificuldade dá só o baú e o ouro;
 * - os efeitos, além dos atributos de um acessório lendário:
 *   o Amuleto da Floresta Antiga recupera 2/3/4% da vida máxima a cada
 *   rodada de luta; a Presa do Morcego devolve em vida 6/9/12% do dano de
 *   cada golpe; a Coroa do Arquimago faz os poderes custarem 10/15/20% menos
 *   mana;
 * - **o efeito vale só no app** (a arena, `luta/arena.ts`), como as runas e
 *   os encantamentos: no site a peça vale pelos atributos.
 *
 * O efeito e os valores moram no modelo da peça (`ItemTemplate.unico`), e a
 * versão no item (`Item.nivelDoUnico`).
 */

import { DIFFICULTIES, type DungeonId, type DungeonRun } from '../dungeon/dungeons.js';
import type { Hero } from '../hero/hero.js';
import { defaultRng, type Rng } from '../rng.js';
import { instantiate, nivelDoUnico, type Item } from './item.js';
import { rarityById, type Rarity } from './rarity.js';
import { templateById, type EfeitoUnicoId } from './templates.js';

/** O acessório único de cada masmorra (o id do modelo). */
export const ACESSORIOS_UNICOS: Readonly<Record<DungeonId, string>> = {
  floresta: 'amuleto_floresta',
  caverna: 'presa_morcego',
  torre: 'coroa_arquimago',
};

/** A raridade com que ele nasce. */
export const RARIDADE_DO_UNICO = 'lendario';

/**
 * O acessório único desta masmorra, na versão desta dificuldade (o nível é a
 * posição dela: Normal 1, Difícil 2, Pesadelo 3).
 */
export function acessorioUnico(run: DungeonRun, rng: Rng = defaultRng, now?: () => number): Item {
  const template = templateById(ACESSORIOS_UNICOS[run.dungeon] ?? ACESSORIOS_UNICOS.floresta);
  if (!template) throw new Error(`Acessório único desconhecido: ${run.dungeon}`);
  const nivel = Math.max(1, DIFFICULTIES.findIndex((d) => d.id === run.difficulty) + 1);
  const item = instantiate(template, rarityById(RARIDADE_DO_UNICO) as Rarity, now ? { rng, now } : { rng });
  return nivel > 1 ? { ...item, nivelDoUnico: nivel } : item;
}

/** O efeito do acessório único que o herói está usando, com o valor da versão dele; `null` sem um. */
export function efeitoDoUnico(hero: Pick<Hero, 'equip'>): { efeito: EfeitoUnicoId; valor: number } | null {
  const peca = hero.equip.acessorio;
  const unico = peca ? templateById(peca.templateId)?.unico : undefined;
  if (!peca || !unico) return null;
  return { efeito: unico.efeito, valor: unico.valores[nivelDoUnico(peca) - 1] ?? 0 };
}

/** Quanto o herói paga a menos de mana nos poderes (a Coroa do Arquimago): uma fração, 0 sem ela. */
export function descontoDeMana(hero: Pick<Hero, 'equip'>): number {
  const efeito = efeitoDoUnico(hero);
  return efeito?.efeito === 'desconto_de_mana' ? efeito.valor : 0;
}
