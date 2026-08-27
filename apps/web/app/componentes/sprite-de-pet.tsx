/**
 * Uma tira de sprites tocada pelo CSS — o pet do menu e o da partida
 * passam por aqui.
 *
 * Sem JS nenhum no laço: `steps()` anda de quadro em quadro sozinho, e
 * loop decorativo em CSS é o acordo do projeto. Um `requestAnimationFrame`
 * aqui gastaria quadro do navegador pra mover um `background-position`.
 *
 * **O tamanho vem de fora.** Cada tela mostra o pet num tamanho diferente
 * (rem fixo na partida, `clamp()` com `vmin` no menu), e a mecânica abaixo
 * é toda proporcional de propósito — nenhuma medida em pixel mora neste
 * componente.
 */

import type { CSSProperties } from 'react';

import type { Animacao } from '@/lib/pets/rostos';
import styles from './sprite-de-pet.module.css';

export function SpriteDePet({
  animacao,
  className = '',
  umaVez = false,
}: {
  animacao: Animacao;
  className?: string;
  /** Toca uma vez e **congela no último quadro**, em vez de repetir. */
  umaVez?: boolean;
}) {
  // Um quadro só é arte parada: `steps(1, jump-none)` não existe, então
  // nem entra animação. É o caso do dragão, que ainda não tem tira.
  const anda = animacao.quadros > 1;
  const modo = anda ? (umaVez ? styles.umaVez : styles.emLaco) : '';

  return (
    <span
      aria-hidden
      className={`${styles.sprite} ${modo} ${className}`}
      style={
        {
          '--tira': `url(${animacao.src})`,
          '--quadros': animacao.quadros,
          '--duracao': `${animacao.duracaoMs}ms`,
        } as CSSProperties
      }
    />
  );
}
