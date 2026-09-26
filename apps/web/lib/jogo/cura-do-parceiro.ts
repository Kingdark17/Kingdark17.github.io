/**
 * A cura que chega do parceiro online.
 *
 * Cura Menor e Renovação Natural sempre prometeram, na descrição, curar o
 * "parceiro online" — e o front novo nunca cumpriu: o servidor repassava o
 * `team-heal` desde o port, e ninguém do lado de cá mandava nem ouvia. O
 * doc do Breno pediu apoio entre aliados no multiplayer; isto é a parte que
 * dá pra fazer sem combate compartilhado (que não existe: só quem conduz
 * luta). Decidido com o Pedro em 2026-09-26.
 *
 * Quem cura é quem lança, na luta dele; quem recebe aplica **no próprio
 * herói** — o servidor só aceita de cada jogador o perfil dele mesmo, então
 * escrever no herói do outro não chegaria a lugar nenhum.
 */

import type { EstadoDoJogo } from './estado';
import type { TelaAberta } from './sala';

/** O teto que o servidor já aplica no repasse (`MAX_HEAL` no gateway). */
export const CURA_MAXIMA_DO_PARCEIRO = 500;

/**
 * Vida de volta, até o máximo. Devolve **quanto curou de fato** — com a
 * vida cheia é zero, e a tela não deve anunciar uma cura que não houve.
 */
export function curarPeloParceiro<T extends EstadoDoJogo>(estado: T, quantia: number): { estado: T; curou: number } {
  const valida = Number.isFinite(quantia) ? Math.max(0, Math.min(CURA_MAXIMA_DO_PARCEIRO, Math.floor(quantia))) : 0;
  const hero = estado.hero;
  const curou = Math.max(0, Math.min(hero.maxHp, hero.hp + valida) - hero.hp);
  if (curou === 0) return { estado, curou: 0 };
  return { estado: { ...estado, hero: { ...hero, hp: hero.hp + curou } }, curou };
}

/**
 * A mesma cura dentro da tela aberta.
 *
 * Cada tela (combate, loja, mochila…) carrega **a própria cópia** do estado
 * e, ao fechar, sobrescreve o do jogo com ela. Curar só o estado do jogo
 * com a mochila aberta faria a cura sumir no "Fechar" — por isso as duas
 * cópias recebem.
 */
export function curarNaTela(aberta: TelaAberta, quantia: number): TelaAberta {
  switch (aberta.tipo) {
    case 'combate':
      return { ...aberta, combate: { ...aberta.combate, estado: curarPeloParceiro(aberta.combate.estado, quantia).estado } };
    case 'loja':
      return { ...aberta, loja: { ...aberta.loja, estado: curarPeloParceiro(aberta.loja.estado, quantia).estado } };
    case 'dialogo':
      return { ...aberta, dialogo: { ...aberta.dialogo, estado: curarPeloParceiro(aberta.dialogo.estado, quantia).estado } };
    case 'missoes':
      return { ...aberta, quadro: { ...aberta.quadro, estado: curarPeloParceiro(aberta.quadro.estado, quantia).estado } };
    case 'evento':
      return { ...aberta, evento: { ...aberta.evento, estado: curarPeloParceiro(aberta.evento.estado, quantia).estado } };
    case 'mochila':
      return { ...aberta, mochila: { ...aberta.mochila, estado: curarPeloParceiro(aberta.mochila.estado, quantia).estado } };
    case 'adm':
      return { ...aberta, adm: { ...aberta.adm, estado: curarPeloParceiro(aberta.adm.estado, quantia).estado } };
  }
}
