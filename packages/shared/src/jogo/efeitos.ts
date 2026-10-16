/**
 * Os efeitos sonoros que o fluxo do jogo pede: a sala, o combate e os
 * extras devolvem qual tocar junto do resultado. Quem toca é cada cliente —
 * o site em `apps/web/lib/som/efeitos.ts`, com as mesmas frequências do
 * `SFX` de `js/effects.js`.
 */

export type Efeito = 'hit' | 'crit' | 'miss' | 'gold' | 'buy' | 'sell' | 'door' | 'levelup' | 'victory' | 'defeat' | 'step' | 'heal';
