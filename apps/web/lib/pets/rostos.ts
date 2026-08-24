import type { PetId } from '@rpg-legend/shared';

/**
 * Os pets que têm arte própria, com o rosto normal e o de carinho.
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
export interface RostoDePet {
  normal: string;
  coracao: string;
}

export const ROSTOS_DE_PET: Partial<Record<PetId, RostoDePet>> = {
  baby_dragon: { normal: '/img/pets/dragon-normal.png', coracao: '/img/pets/dragon-heart.png' },
  /**
   * O "coração" do slime é o quadro de sorriso mais aberto da animação
   * original, não um rosto de coração desenhado — o GIF que veio é um pulo,
   * e não tinha essa pose. Enche o mesmo papel: muda de cara no carinho.
   *
   * Vem com a base de grama junto, ao contrário do dragão. Não é escolha:
   * o corpo e a grama dividem a mesma rampa de verde, então não há recorte
   * possível sem redesenhar o sprite.
   */
  slime: { normal: '/img/pets/slime-normal.png', coracao: '/img/pets/slime-heart.png' },
};
