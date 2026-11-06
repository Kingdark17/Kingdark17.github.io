/**
 * As mecânicas dos chefes (doc do Breno de 2026-11-06, "batalha e mecânicas
 * diferentes para bosses"; o usuário escolheu as duas coisas):
 *
 * - **uma por masmorra**, que entra na metade da vida (a segunda fase):
 *   a Floresta chama lobos, a Caverna apaga a luz (some a mira) e a Torre
 *   ergue um escudo elemental que muda de cor a cada dois golpes dele;
 * - **uma ou duas sorteadas** de uma lista: invocar ajudantes na metade da
 *   vida, uma barreira que segura o primeiro dano, o golpe carregado (o
 *   Golpe Devastador com aviso, a cada quatro golpes), curar-se uma vez e a
 *   fúria, as duas com 30% da vida.
 *
 * Vale pros chefes de todo andar 5; o chefe final (andar 100) continua com
 * as fases dele (`jogo/chefe-final.ts`), que já são outra luta. O que o
 * chefe precisa lembrar mora nele, na sala (`fase2`, `escuro`,
 * `escudoElemental`, `barreira`, `curou`, `furia`). A regra de quando cada
 * uma entra é de `jogo/chefe-final.ts` (`ferirMonstro`), por onde passa todo
 * golpe no monstro.
 */

import type { DungeonId } from '../dungeon/dungeons.js';
import { defaultRng, pick, type Rng } from '../rng.js';

export type MecanicaDoChefe = 'invocar' | 'barreira' | 'carregado' | 'cura' | 'furia';

/** A lista das sorteadas, na ordem do sorteio. */
export const MECANICAS_DO_CHEFE: readonly MecanicaDoChefe[] = ['invocar', 'barreira', 'carregado', 'cura', 'furia'];

/** A barreira segura esta fração da vida máxima antes de o chefe sentir o golpe. */
export const BARREIRA_DO_CHEFE = 0.2;
/** Quantos ajudantes ele chama na metade da vida (os lobos da Floresta, e o invocar). */
export const AJUDANTES_DO_CHEFE = 2;
/** O golpe carregado vem a cada este tanto de golpes. */
export const CARGA_A_CADA = 4;
/** A cura e a fúria entram com esta fração da vida. */
export const LIMITE_DO_DESESPERO = 0.3;
/** A cura devolve esta fração da vida máxima, uma vez. */
export const CURA_DO_CHEFE = 0.25;
/** Na fúria, o dano e a velocidade crescem isto. */
export const FORCA_NA_FURIA = 1.3;
export const VELOCIDADE_NA_FURIA_DO_CHEFE = 1.5;
/** O escudo elemental segura esta parte do dano do tipo dele (o que passa é o resto). */
export const PASSA_PELO_ESCUDO = 0.3;
/** O escudo muda de cor a cada este tanto de golpes do chefe. */
export const ESCUDO_TROCA_A_CADA = 2;

/**
 * Sorteia as mecânicas de um chefe: uma ou duas (um número), e cada uma da
 * lista (mais um ou dois). Na Floresta o invocar sai da lista: os lobos já
 * são os ajudantes dela.
 */
export function sortearMecanicas(masmorra: DungeonId | undefined, rng: Rng = defaultRng): MecanicaDoChefe[] {
  const quantas = rng() < 0.5 ? 1 : 2;
  const lista = MECANICAS_DO_CHEFE.filter((m) => !(masmorra === 'floresta' && m === 'invocar'));
  const escolhidas: MecanicaDoChefe[] = [];
  for (let i = 0; i < quantas; i++) {
    const m = pick(
      lista.filter((x) => !escolhidas.includes(x)),
      rng,
    );
    escolhidas.push(m);
  }
  return escolhidas;
}

/** O lado do escudo elemental agora (a Torre, na segunda fase): físico e mágico se revezam a cada dois golpes dele. */
export function escudoDoChefe(monstro: { escudoElemental?: boolean; attackCount?: number }): 'fisico' | 'magico' | null {
  if (!monstro.escudoElemental) return null;
  return Math.floor((monstro.attackCount ?? 0) / ESCUDO_TROCA_A_CADA) % 2 === 0 ? 'fisico' : 'magico';
}

/** O que a placa do chefe mostra das mecânicas dele que estão valendo. */
export function marcasDoChefe(monstro: {
  escudoElemental?: boolean;
  attackCount?: number;
  barreira?: number;
  escuro?: boolean;
  furia?: boolean;
  chefeFinal?: boolean;
}): string[] {
  const marcas: string[] = [];
  const escudo = escudoDoChefe(monstro);
  if (escudo) marcas.push(escudo === 'fisico' ? '🟥 escudo contra golpes' : '🟦 escudo contra magia');
  if (monstro.barreira) marcas.push(`🛡️ barreira ${monstro.barreira}`);
  if (monstro.escuro) marcas.push('🌑 escuridão: a mira some');
  if (monstro.furia && !monstro.chefeFinal) marcas.push('😡 fúria');
  return marcas;
}
