/**
 * Ferimentos do herói (doc do Breno de 2026-11-06, decidido com o usuário):
 * o membro quebrado e o que tira vida de sala em sala.
 *
 * - Braço quebrado: o herói bate 30% mais fraco (golpe e poder).
 * - Perna quebrada: anda mais devagar e foge pior.
 * - Veneno e sangramento: tiram um pouco da vida a cada sala em que ele
 *   entra, e passam sozinhos depois de algumas.
 *
 * Vêm das armadilhas (`dungeon/armadilhas.ts`) e do golpe pesado de chefe
 * (`combat/monster-hit.ts`), e saram na taverna (tudo) ou com a tala (os
 * membros). Moram no herói, e por isso no save; ausentes, ele está inteiro.
 */

import { defaultRng, type Rng } from '../rng.js';
import type { Hero } from './hero.js';

export interface Ferimentos {
  braco?: true;
  perna?: true;
  /** Salas que ainda faltam de veneno. */
  veneno?: number;
  /** Salas que ainda faltam de sangramento. */
  sangramento?: number;
}

/** Quanto do dano o herói de braço quebrado ainda dá. */
export const DANO_COM_BRACO_QUEBRADO = 0.7;
/** O ritmo do andar de quem está de perna quebrada. */
export const PASSO_COM_PERNA_QUEBRADA = 0.6;
/** O que a perna quebrada tira da rolagem de fuga (d20). */
export const FUGA_COM_PERNA_QUEBRADA = 4;
/** A fração da vida máxima que o veneno e o sangramento tiram a cada sala. */
export const VENENO_POR_SALA = 0.05;
export const SANGRAMENTO_POR_SALA = 0.04;
/** A chance de o golpe de chefe que acerta o herói quebrar um braço ou uma perna. */
export const CHANCE_DE_QUEBRAR_NO_CHEFE = 0.15;

export type Membro = 'braco' | 'perna';

/** Quebra um braço ou uma perna (um número do rng): o que já está quebrado continua. */
export function quebrarMembro(hero: Hero, rng: Rng = defaultRng): { hero: Hero; membro: Membro } {
  const membro: Membro = rng() < 0.5 ? 'braco' : 'perna';
  return { hero: { ...hero, ferimentos: { ...hero.ferimentos, [membro]: true } }, membro };
}

/** O nome do membro quebrado, pro texto. */
export function nomeDoMembro(membro: Membro): string {
  return membro === 'braco' ? 'um braço' : 'uma perna';
}

/** Junta veneno e sangramento novos aos que o herói já tem: fica o mais longo. */
export function envenenar(hero: Hero, salas: { veneno?: number; sangramento?: number }): Hero {
  if (!salas.veneno && !salas.sangramento) return hero;
  const atual = hero.ferimentos ?? {};
  const ferimentos: Ferimentos = { ...atual };
  if (salas.veneno) ferimentos.veneno = Math.max(atual.veneno ?? 0, salas.veneno);
  if (salas.sangramento) ferimentos.sangramento = Math.max(atual.sangramento ?? 0, salas.sangramento);
  return { ...hero, ferimentos };
}

/**
 * O herói entrou noutra sala: o veneno e o sangramento tiram a parte deles
 * da vida máxima (nunca matam: param em 1) e contam uma sala a menos.
 */
export function passarDeSala(hero: Hero): { hero: Hero; dano: number } {
  const atual = hero.ferimentos;
  if (!atual?.veneno && !atual?.sangramento) return { hero, dano: 0 };
  const parte = (atual.veneno ? VENENO_POR_SALA : 0) + (atual.sangramento ? SANGRAMENTO_POR_SALA : 0);
  const dano = Math.min(Math.max(1, Math.round(hero.maxHp * parte)), Math.max(0, hero.hp - 1));
  const ferimentos: Ferimentos = { ...atual };
  if (atual.veneno) {
    if (atual.veneno > 1) ferimentos.veneno = atual.veneno - 1;
    else delete ferimentos.veneno;
  }
  if (atual.sangramento) {
    if (atual.sangramento > 1) ferimentos.sangramento = atual.sangramento - 1;
    else delete ferimentos.sangramento;
  }
  return { hero: limpo({ ...hero, hp: hero.hp - dano, ferimentos }), dano };
}

/** A tala: conserta o braço e a perna. */
export function curarMembros(hero: Hero): Hero {
  if (!hero.ferimentos?.braco && !hero.ferimentos?.perna) return hero;
  const { braco: _braco, perna: _perna, ...resto } = hero.ferimentos;
  return limpo({ ...hero, ferimentos: resto });
}

/** A taverna: sara tudo. */
export function curarTudo(hero: Hero): Hero {
  if (!hero.ferimentos) return hero;
  const { ferimentos: _ferimentos, ...inteiro } = hero;
  return inteiro;
}

/** Sem ferimento nenhum, o campo sai do herói (o save de quem nunca se feriu fica igual). */
function limpo(hero: Hero): Hero {
  if (hero.ferimentos && Object.keys(hero.ferimentos).length > 0) return hero;
  const { ferimentos: _ferimentos, ...inteiro } = hero;
  return inteiro;
}

/** O multiplicador do dano do herói: o braço quebrado bate mais fraco. */
export function forcaDoBraco(hero: Pick<Hero, 'ferimentos'>): number {
  return hero.ferimentos?.braco ? DANO_COM_BRACO_QUEBRADO : 1;
}

/** O ritmo do andar na sala: a perna quebrada anda mais devagar. Quem desenha multiplica o tempo por ele. */
export function ritmoDoAndar(hero: Pick<Hero, 'ferimentos'>): number {
  return hero.ferimentos?.perna ? PASSO_COM_PERNA_QUEBRADA : 1;
}

/** Os ferimentos em palavras, pro cartão do herói (vazio quando ele está inteiro). */
export function textosDosFerimentos(hero: Pick<Hero, 'ferimentos'>): string[] {
  const f = hero.ferimentos;
  if (!f) return [];
  const textos: string[] = [];
  if (f.braco) textos.push('🦴 Braço quebrado');
  if (f.perna) textos.push('🦵 Perna quebrada');
  if (f.veneno) textos.push(`☠️ Envenenado (${f.veneno} ${f.veneno === 1 ? 'sala' : 'salas'})`);
  if (f.sangramento) textos.push(`🩸 Sangrando (${f.sangramento} ${f.sangramento === 1 ? 'sala' : 'salas'})`);
  return textos;
}
