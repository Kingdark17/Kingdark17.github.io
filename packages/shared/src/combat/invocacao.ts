/**
 * O esqueleto do necromante — o poder Levantar Esqueleto, do site e do app.
 *
 * Decisões do usuário (2026-10-17 e 23):
 * - um poder que só o necromante tem (`soDaClasse`), e que todo necromante
 *   ganha, inclusive quem já tinha o personagem;
 * - o esqueleto luta ao lado do herói como um companheiro (ataca depois dele,
 *   e os monstros podem mirar nele) e some quando a luta acaba — vencendo,
 *   perdendo ou fugindo;
 * - até 3 de pé ao mesmo tempo; com 3, o poder avisa e não gasta mana. Um que
 *   caiu pode ser trocado por outro na mesma luta;
 * - é do necromante, à parte dos recrutas: não ocupa vaga na equipe;
 * - vida 20 + 4 × nível + 2 × Inteligência, ataque 3 + nível + Inteligência ÷ 2,
 *   na postura agressiva.
 *
 * Os esqueletos moram em `party`, marcados com `invocado`. Os caídos ficam na
 * lista até a luta acabar: a arena do app guarda os companheiros pelo índice
 * na equipe, e tirar um do meio trocaria quem é quem.
 */

import { emptyAttributes } from '../hero/stats.js';
import type { Companion, Hero } from '../hero/hero.js';

/** Quantos esqueletos podem estar de pé ao mesmo tempo. */
export const MAX_ESQUELETOS = 3;

/** A linha do registro quando a luta acaba com esqueletos na equipe. */
export const FIM_DOS_ESQUELETOS = 'Os esqueletos voltam ao pó.';

/** Os esqueletos de pé agora. */
export function esqueletosDePe(party: readonly Companion[]): number {
  return party.filter((membro) => membro.invocado && membro.hp > 0).length;
}

/** A equipe sem os esqueletos: o que fica quando a luta acaba. */
export function semInvocados(party: readonly Companion[]): Companion[] {
  return party.filter((membro) => !membro.invocado);
}

/**
 * Um esqueleto novo, na força do necromante. O nome conta os que já se
 * levantaram nesta luta ("Esqueleto", "Esqueleto 2"…), pra o registro dizer
 * qual deles fez o quê.
 */
export function criarEsqueleto(hero: Pick<Hero, 'level' | 'attrs'>, party: readonly Companion[]): Companion {
  const inteligencia = hero.attrs.intelecto ?? 0;
  const maxHp = 20 + 4 * hero.level + 2 * inteligencia;
  const numero = party.filter((membro) => membro.invocado).length + 1;
  return {
    name: numero > 1 ? `Esqueleto ${numero}` : 'Esqueleto',
    raceIcon: '💀',
    race: 'Morto-vivo',
    className: 'Esqueleto',
    classIcon: '💀',
    hp: maxHp,
    maxHp,
    attack: 3 + hero.level + Math.floor(inteligencia / 2),
    attrs: emptyAttributes(),
    stance: 'agressiva',
    ability: 'Ossos Erguidos',
    abilityDesc: 'Luta ao lado do necromante até o fim da batalha.',
    invocado: true,
  };
}
