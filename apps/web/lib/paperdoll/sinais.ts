/**
 * O que o boneco **sente** — o que a tela precisa saber pra ele parar de
 * ser um retrato parado.
 *
 * Nenhuma animação mora aqui, e nenhuma mora em JavaScript: este módulo só
 * lê o herói e devolve um punhado de sinais. Quem os transforma em
 * movimento é o CSS de `paperdoll.module.css`, através de atributos de
 * dado na marcação.
 *
 * **Por que não PixiJS.** A tabela de decisões da migração reserva o Pixi
 * pro personagem 2D, e continua valendo pro boneco que troca de quadro —
 * golpe, andar. Mas os quatro sinais daqui são "mover o boneco inteiro" e
 * "filtrar a imagem", e disso o CSS dá conta sem baixar biblioteca
 * nenhuma: o `Paperdoll` segue sem mandar uma linha de JS. O Pixi entra
 * quando existir arte de quadros, que é o que o CSS não faz.
 */

import { RARITIES, type Hero, type Item, type RarityId } from '@rpg-legend/shared';

export interface SinaisVitais {
  /** Respira parado. Ligado onde o boneco representa alguém vivo. */
  vivo?: boolean;
  /** Piscada de dano — transitória, ligada e desligada por quem exibe. */
  ferido?: boolean;
  /** Tinta esverdeada enquanto o veneno durar. */
  envenenado?: boolean;
  /** Raridade da melhor peça equipada; vira o brilho ao redor do boneco. */
  aura?: RarityId | null;
  /**
   * Atraso da respiração, em milissegundos.
   *
   * Existe pra grade de personagens: três bonecos subindo e descendo no
   * mesmo instante parecem uma engrenagem, não três pessoas. Um atraso
   * diferente por slot desfaz o compasso.
   */
  atraso?: number;
}

/**
 * A partir de qual raridade o boneco brilha.
 *
 * `comum` e `incomum` ficam de fora de propósito: quase todo mundo carrega
 * uma peça dessas o tempo inteiro, e brilho que está sempre aceso não
 * informa nada — vira ruído de fundo e ainda mata o efeito de quando a
 * peça boa aparece de verdade.
 */
const BRILHO_A_PARTIR_DE = 2; // índice de `raro` em RARITIES

const ORDEM: ReadonlyMap<RarityId, number> = new Map(RARITIES.map((r, i) => [r.id, i]));

/** A variável de cor da raridade (`--r-raro`), ou `null` se ela não brilha. */
export function corDaAura(raridade: RarityId | null | undefined): string | null {
  if (!raridade) return null;
  const posicao = ORDEM.get(raridade);
  if (posicao === undefined || posicao < BRILHO_A_PARTIR_DE) return null;
  return RARITIES[posicao]!.colorVar;
}

/** A raridade mais alta entre as peças equipadas, ou `null` se nenhuma brilha. */
export function auraDoEquipamento(equip: Partial<Record<string, Item | null>>): RarityId | null {
  let melhor: RarityId | null = null;
  let melhorPosicao = -1;

  for (const peca of Object.values(equip)) {
    const posicao = peca ? (ORDEM.get(peca.rarity) ?? -1) : -1;
    if (posicao > melhorPosicao) {
      melhorPosicao = posicao;
      melhor = peca?.rarity ?? null;
    }
  }

  return melhorPosicao >= BRILHO_A_PARTIR_DE ? melhor : null;
}

/**
 * Os sinais que dão pra ler do herói sozinho.
 *
 * `ferido` **não** sai daqui: ele é um acontecimento, não um estado — a
 * vida cair de 40 pra 32 não deixa rastro no herói depois. Quem o percebe
 * é a tela, comparando com o que exibiu antes.
 */
export function sinaisDoHeroi(hero: Pick<Hero, 'equip' | 'buffs'>): SinaisVitais {
  return {
    vivo: true,
    envenenado: (hero.buffs?.poisonTurns ?? 0) > 0,
    aura: auraDoEquipamento(hero.equip ?? {}),
  };
}
