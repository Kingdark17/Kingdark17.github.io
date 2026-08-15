/**
 * Carta de item: sprite, nome com a cor da raridade, tier e atributos.
 *
 * O sprite vem do template (`weapons/espada.png`) e a arte foi copiada de
 * `rpg-legend/img/` pra `public/img/` — o app na Vercel não pode depender
 * do GitHub Pages pra desenhar um item. Enquanto os dois clientes
 * coexistirem há duas cópias; a do jogo antigo some junto com ele.
 */

import Image from 'next/image';
import type { ReactNode } from 'react';

import { itemView, statTags, tierFor, type Item } from '@rpg-legend/shared';

import styles from './jogo.module.css';

const LADO_DO_SPRITE = 40;

export function spriteDoItem(item: Item): string {
  return `/img/${itemView(item).sprite}`;
}

interface Props {
  item: Item;
  /** Linha de baixo: "12 ouro · comprar", "selecionar", etc. */
  rodape?: string;
  selecionado?: boolean;
  onClick?: () => void;
  /** Botões sob a carta, quando o item aceita mais de uma ação (equipar na principal ou na secundária, usar, descartar). */
  acoes?: ReactNode;
}

export function CartaItem({ item, rodape, selecionado, onClick, acoes }: Props) {
  const visao = itemView(item);
  const tier = tierFor(item);
  const tags = statTags(item);

  const conteudo = (
    <>
      <Image
        className={styles.spriteItem}
        src={spriteDoItem(item)}
        alt=""
        width={LADO_DO_SPRITE}
        height={LADO_DO_SPRITE}
        unoptimized
      />
      <span className={styles.nomeItem} style={{ color: `var(${visao.rarityColorVar})` }}>
        {visao.name}
      </span>
      <span className={styles.metaItem}>
        {visao.rarityLabel}
        {tier ? ` · Tier ${tier}` : ''}
      </span>
      {tags.length > 0 && <span className={styles.statsItem}>{tags.map((tag) => tag.text).join(' · ')}</span>}
      {rodape && <span className={styles.rodapeItem}>{rodape}</span>}
    </>
  );

  if (acoes) {
    return (
      <div className={styles.cartaItem}>
        {conteudo}
        <div className={styles.acoesDaCarta}>{acoes}</div>
      </div>
    );
  }

  if (!onClick) return <div className={styles.cartaItem}>{conteudo}</div>;

  return (
    <button type="button" className={`${styles.cartaItem} ${styles.cartaClicavel} ${selecionado ? styles.cartaSelecionada : ''}`} onClick={onClick}>
      {conteudo}
    </button>
  );
}
