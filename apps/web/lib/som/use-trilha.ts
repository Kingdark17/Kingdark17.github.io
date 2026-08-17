'use client';

/**
 * Liga a trilha no primeiro gesto e mantém o tema colado na cena.
 *
 * O gesto não é frescura: navegador nenhum deixa áudio começar sozinho, e
 * o cliente antigo resolvia do mesmo jeito (`pointerdown`/`keydown` uma
 * vez só). A diferença é que lá o tema era descoberto por uma consulta ao
 * estado global a cada 500 ms; aqui a tela diz qual é.
 *
 * **A música entra por `import()`.** Ela é o maior pedaço do som — cinco
 * temas com melodia, baixo e acordes — e não toca nada antes do primeiro
 * clique. Carregar junto de `/jogo` seria peso na abertura por algo que
 * talvez nem comece (quem entra de teclado navegando, quem está com o som
 * desligado). O efeito sonoro segue direto, porque esse pode acontecer no
 * mesmo instante do gesto.
 */

import { useEffect, useRef } from 'react';

import type { Tema } from './musica';

type ModuloDaMusica = typeof import('./musica');

let musica: ModuloDaMusica | null = null;

async function carregarMusica(): Promise<ModuloDaMusica> {
  musica ??= await import('./musica');
  return musica;
}

export function useTrilha(tema: Tema): void {
  const desejado = useRef<Tema>(tema);

  useEffect(() => {
    const comecar = () => {
      soltar();
      void carregarMusica().then((modulo) => modulo.ligarMusica(desejado.current));
    };
    function soltar() {
      window.removeEventListener('pointerdown', comecar);
      window.removeEventListener('keydown', comecar);
    }

    window.addEventListener('pointerdown', comecar);
    window.addEventListener('keydown', comecar);
    // Sair do jogo cala a trilha: ela é da masmorra, não do site.
    return () => {
      soltar();
      musica?.pararMusica();
    };
  }, []);

  useEffect(() => {
    desejado.current = tema;
    // Antes do primeiro gesto não há música pra trocar de tema — e quando
    // ela chegar, vai começar já no tema certo por causa do `desejado`.
    musica?.pedirTema(tema);
  }, [tema]);
}
