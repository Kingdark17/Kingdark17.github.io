'use client';

import { useEffect, useRef } from 'react';

/** A mesma largura do `@media (max-width: 52rem)` de `.navegadorDeItens`, em `jogo.module.css`. */
const FICHA_EMBAIXO_DA_LISTA = '(max-width: 52rem)';

/**
 * Traz a ficha pra dentro da tela quando uma peça é escolhida — **só na tela
 * estreita**, salvo com `sempre` (abaixo).
 *
 * Ali a ficha desce pra baixo da lista inteira. Na loja, tocar numa carta do
 * estoque, no topo, não dava resposta nenhuma além da borda, e o "Comprar"
 * ficava depois de toda a mochila: comprar parecia não funcionar. No
 * computador a ficha está ao lado, sempre à vista, e a página não se mexe.
 *
 * Depois do desenho, e não no clique: a ficha só tem a altura final quando
 * já mostra a peça nova.
 *
 * `sempre` liga também no computador. É o caso da mochila, onde a ficha
 * fica embaixo do boneco numa coluna que rola por dentro: escolher uma carta
 * no guardado, na outra coluna, a deixaria fora da vista. `nearest` mexe só
 * o necessário — com a ficha já inteira na tela, nada se move.
 */
export function useFichaAVista(selecionado: string | null, { sempre = false }: { sempre?: boolean } = {}) {
  const ficha = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!selecionado || !ficha.current) return;
    if (!sempre && !window.matchMedia(FICHA_EMBAIXO_DA_LISTA).matches) return;
    const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ficha.current.scrollIntoView({ block: 'nearest', behavior: semMovimento ? 'auto' : 'smooth' });
  }, [selecionado, sempre]);

  return ficha;
}
