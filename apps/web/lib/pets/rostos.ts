import type { PetId } from '@rpg-legend/shared';

/**
 * Os pets que têm arte própria, com o estado parado e o de carinho.
 *
 * Quem não está aqui cai no emoji de `petIcon()` — é o padrão, não uma
 * falta: `PET_ICONS` cobre os nove pets, e a arte vai chegando aos poucos.
 *
 * Mora num módulo só porque **duas telas mostram o mesmo pet**: o bichinho
 * no canto da partida (`app/jogo/bicho-de-estimacao.tsx`) e o mascote do
 * menu (`app/menu/atalhos-e-mascote.tsx`). Com uma tabela em cada arquivo,
 * arte nova aparecia num lugar e não no outro, e o defeito só se via
 * trocando de tela.
 *
 * Os caminhos são de `public/`, servidos pelo Next a partir da raiz.
 */

/**
 * Uma tira de sprites: os quadros lado a lado num PNG só, que o CSS
 * percorre com `steps()`. Arte parada é o mesmo formato com um quadro.
 *
 * `quadros` e `duracaoMs` **têm que bater com o arquivo**, e é por isso
 * que quem escreve esses números é o `gera-sprites-de-pet.mjs`, não a mão:
 * errar aqui não quebra nada, só faz a animação cortar quadro ou mostrar
 * vazio no fim — defeito que passa em revisão e só aparece na tela.
 */
export interface Animacao {
  src: string;
  quadros: number;
  /** A volta inteira. Ignorado quando há só um quadro. */
  duracaoMs: number;
}

export interface RostoDePet {
  normal: Animacao;
  coracao: Animacao;
}

const parado = (src: string): Animacao => ({ src, quadros: 1, duracaoMs: 0 });

export const ROSTOS_DE_PET: Partial<Record<PetId, RostoDePet>> = {
  baby_dragon: {
    normal: parado('/img/pets/dragon-normal.png'),
    coracao: parado('/img/pets/dragon-heart.png'),
  },
  /**
   * O slime dorme parado (com o `zZ`) e pula quando recebe carinho.
   *
   * Vem com a base de grama junto, ao contrário do dragão. Não é escolha:
   * o corpo e a grama dividem a mesma rampa de verde, então não há recorte
   * possível sem redesenhar o sprite.
   *
   * Os 24 quadros do carinho vieram de 18 no GIF: lá o atraso variava
   * entre 50 ms e 100 ms, e como `steps()` divide em fatias iguais, o
   * quadro de 100 ms entra duas vezes. O ritmo sai idêntico ao do
   * desenho — ver `gera-sprites-de-pet.mjs`.
   */
  slime: {
    normal: { src: '/img/pets/slime-normal.png', quadros: 12, duracaoMs: 1920 },
    coracao: { src: '/img/pets/slime-heart.png', quadros: 24, duracaoMs: 1200 },
  },
};
