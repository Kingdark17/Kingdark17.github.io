/**
 * O que o cartão de guilda escreve além do que já está pronto no herói.
 *
 * O cartão é o painel do herói desde 2026-10-09 (a arte é do usuário). Ele
 * existe por causa da fraqueza: a criação deixou de mostrá-la quando a
 * classe foi pra Guilda, e nenhuma outra tela a mostrava. Ver
 * `app/jogo/painel-heroi.tsx`.
 */

import { DEBUFFS, debuffById, heroPowers, powerManaCost, type Hero } from '@rpg-legend/shared';

export interface FraquezaNoCartao {
  icone: string;
  nome: string;
  efeito: string;
}

/**
 * A fraqueza pelo catálogo, e não pelo que o save gravou: o save guarda a
 * cópia do dia em que o herói nasceu, e o texto do efeito pode ter mudado
 * desde então. Save do cliente antigo gravou só o nome, sem `id` — por isso
 * a busca pelo nome antes de desistir e mostrar a cópia gravada.
 */
export function fraquezaNoCartao(hero: Pick<Hero, 'debuff'>): FraquezaNoCartao | null {
  const gravada = hero.debuff as Partial<Hero['debuff']> | undefined;
  if (!gravada?.id && !gravada?.name) return null;

  const fonte = (gravada.id ? debuffById(gravada.id) : null) ?? DEBUFFS.find((d) => d.name === gravada.name) ?? gravada;
  return { icone: fonte.icon ?? '', nome: fonte.name ?? '', efeito: fonte.desc ?? '' };
}

export interface PoderNoCartao {
  id: string;
  icone: string;
  nome: string;
  /** O mesmo custo que o botão do combate mostra, já com a Mana Instável. */
  custo: number;
}

export function poderesNoCartao(hero: Hero): PoderNoCartao[] {
  return heroPowers(hero).map((poder) => ({ id: poder.id, icone: poder.icon, nome: poder.name, custo: powerManaCost(hero, poder) }));
}
