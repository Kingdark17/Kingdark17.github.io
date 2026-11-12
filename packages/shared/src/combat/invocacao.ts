/**
 * O esqueleto do necromante — o poder Levantar Esqueleto, do site e do app.
 *
 * Decisões do usuário (2026-10-17 e 23):
 * - um poder que só o necromante tem (`soDaClasse`), e que todo necromante
 *   ganha, inclusive quem já tinha o personagem;
 * - o esqueleto luta ao lado do herói como um companheiro (ataca depois dele,
 *   e os monstros podem mirar nele). Desde 2026-11-10 (doc do Breno, decidido
 *   com o usuário) ele não some mais no fim da luta: segue o herói de sala em
 *   sala, com a vida que tiver, até cair, até a volta à cidade ou até o herói
 *   ser derrotado;
 * - até 3 de pé ao mesmo tempo; com 3, o poder avisa e não gasta mana. Um que
 *   caiu pode ser trocado por outro na mesma luta;
 * - é do necromante, à parte dos recrutas: não ocupa vaga na equipe;
 * - vida 10 + 2 × nível + Inteligência, ataque (3 + nível + Inteligência ÷ 2) ÷ 2,
 *   na postura agressiva. É a metade do que era até 2026-11-12 (pedido do
 *   usuário: o esqueleto estava forte demais); quem já estava de pé fica como
 *   estava até cair.
 *
 * Os esqueletos moram em `party`, marcados com `invocado`. Os caídos ficam na
 * lista até a luta acabar (`semInvocadosCaidos` os tira aí): a arena do app
 * guarda os companheiros pelo índice na equipe, e tirar um do meio trocaria
 * quem é quem.
 */

import { emptyAttributes } from '../hero/stats.js';
import type { Companion, Hero } from '../hero/hero.js';

/** Quantos esqueletos podem estar de pé ao mesmo tempo. */
export const MAX_ESQUELETOS = 3;

/** A linha do registro quando a luta acaba com esqueletos caídos na equipe. */
export const FIM_DOS_ESQUELETOS = 'Os esqueletos caídos voltam ao pó.';

/** Os esqueletos de pé agora. */
export function esqueletosDePe(party: readonly Companion[]): number {
  return party.filter((membro) => membro.invocado && membro.hp > 0).length;
}

/** A equipe sem os esqueletos: o que chega à cidade, e o que conta nas vagas dos recrutas. */
export function semInvocados(party: readonly Companion[]): Companion[] {
  return party.filter((membro) => !membro.invocado);
}

/** Há esqueleto caído na equipe. */
export function temInvocadoCaido(party: readonly Companion[]): boolean {
  return party.some((membro) => membro.invocado && membro.hp <= 0);
}

/** A equipe sem os esqueletos que caíram: o que fica quando a luta acaba. Os de pé seguem o herói. */
export function semInvocadosCaidos(party: readonly Companion[]): Companion[] {
  return party.filter((membro) => !membro.invocado || membro.hp > 0);
}

/**
 * Um esqueleto novo, na força do necromante. O nome leva o primeiro número
 * livre entre os esqueletos da equipe ("Esqueleto", "Esqueleto 2"…), pra o
 * registro dizer qual deles fez o quê.
 */
export function criarEsqueleto(hero: Pick<Hero, 'level' | 'attrs'>, party: readonly Companion[]): Companion {
  const inteligencia = hero.attrs.intelecto ?? 0;
  const maxHp = Math.max(1, Math.floor((20 + 4 * hero.level + 2 * inteligencia) / 2));
  const nomeDoNumero = (n: number): string => (n > 1 ? `Esqueleto ${n}` : 'Esqueleto');
  const usados = new Set(party.filter((membro) => membro.invocado).map((membro) => membro.name));
  let numero = 1;
  while (usados.has(nomeDoNumero(numero))) numero++;
  return {
    name: nomeDoNumero(numero),
    raceIcon: '💀',
    race: 'Morto-vivo',
    className: 'Esqueleto',
    classIcon: '💀',
    hp: maxHp,
    maxHp,
    attack: Math.max(1, Math.floor((3 + hero.level + Math.floor(inteligencia / 2)) / 2)),
    attrs: emptyAttributes(),
    stance: 'agressiva',
    ability: 'Ossos Erguidos',
    abilityDesc: 'Luta ao lado do necromante até cair ou até a volta à cidade.',
    invocado: true,
  };
}
