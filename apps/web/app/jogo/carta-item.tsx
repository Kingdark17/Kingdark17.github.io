/**
 * Carta de item: sprite, nome com a cor da raridade, tier e atributos.
 *
 * O sprite vem do template (`weapons/espada.png`) e a arte foi copiada de
 * `rpg-legend/img/` pra `public/img/` — o app na Vercel não pode depender
 * do GitHub Pages pra desenhar um item. Enquanto os dois clientes
 * coexistirem há duas cópias; a do jogo antigo some junto com ele.
 */

import Image from 'next/image';

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
}

/**
 * Carta de item: sprite, nome com a cor da raridade, tier e atributos.
 *
 * **A carta não age.** Ela mostra e, quando clicável, seleciona — quem
 * equipa, usa e descarta é a ficha ao lado (`ficha-item.tsx`). Antes cada
 * carta carregava os próprios botões, o que enchia a grade de "Equipar /
 * Descartar" repetidos e espalhava a mesma ação por dezenas de lugares.
 */
export function CartaItem({ item, rodape, selecionado, onClick }: Readonly<Props>) {
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

  /* A tarja lateral com a cor da raridade — do jogo antigo
     (`.item-card { border-left: 3px solid }`). Dá a raridade de longe, sem
     precisar ler o nome, que é o que faz uma grade de 76 itens ser
     varrível. O nome continua colorido: a cor nunca é o único sinal. */
  const tarja = { borderLeftColor: `var(${visao.rarityColorVar})` };

  if (!onClick) return <div className={styles.cartaItem} style={tarja}>{conteudo}</div>;

  return (
    <button
      type="button"
      style={tarja}
      className={`${styles.cartaItem} ${styles.cartaClicavel} ${selecionado ? styles.cartaSelecionada : ''}`}
      onClick={onClick}
    >
      {conteudo}
    </button>
  );
}
