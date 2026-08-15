/**
 * Foto do jogador com a moldura cosmética. As cores e o brilho de cada
 * moldura são os mesmos do `<style>` no topo de `rpg-legend/index.html`,
 * agora como `[data-frame]` no CSS Module.
 *
 * `<img>` cru em vez de `next/image` de propósito: o avatar é ou um `data:`
 * URL vindo da compressão local, ou um `https://` que o próprio jogador
 * digitou — não dá pra listar esses domínios em `remotePatterns`, e não há
 * o que otimizar num quadrado de 256 px que já veio comprimido.
 */

/* eslint-disable @next/next/no-img-element */

import styles from './conta.module.css';

interface Props {
  url: string;
  frame: string;
  nome: string;
  /** Lado em pixels. */
  lado?: number;
}

export function Avatar({ url, frame, nome, lado = 72 }: Props) {
  const estilo = { width: lado, height: lado, fontSize: lado * 0.45 };

  if (!url) {
    return (
      <span className={styles.avatar} data-frame={frame} style={estilo} aria-hidden>
        {nome.slice(0, 1).toUpperCase() || '?'}
      </span>
    );
  }

  return <img className={styles.avatar} data-frame={frame} style={estilo} src={url} alt={`Foto de ${nome}`} />;
}

/** Nome com a cor cosmética. `rainbow` é animação, não cor — por isso a classe. */
export function NomeColorido({ nome, cor, className }: { nome: string; cor: string; className?: string }) {
  const classes = [className, cor === 'rainbow' ? styles.nomeRgb : ''].filter(Boolean).join(' ');
  return (
    <span className={classes} style={cor === 'rainbow' ? undefined : { color: cor }}>
      {nome}
    </span>
  );
}
