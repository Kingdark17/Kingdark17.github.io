'use client';

/**
 * Diário de Aventura — o registro do que já aconteceu nesta partida.
 *
 * Abre no lugar da exploração e **mantém a ficha do herói ao lado**, igual
 * ao guia e à mochila. Não é tela cheia de propósito: sair do diário tem
 * que ser um passo, não uma volta.
 *
 * Só mostra. Quem escreve são `avisar` e `recadar`, na tela de jogo — ver
 * `lib/jogo/diario.ts` pro porquê de a fonte ser essa e não um gerador
 * próprio.
 */

import type { Anotacao } from '@/lib/jogo/diario';
import styles from './jogo.module.css';

export function TelaDiario({ anotacoes, onFechar }: { anotacoes: Anotacao[]; onFechar: () => void }) {
  return (
    <section className={styles.loja}>
      <header className={styles.cabecalhoLoja}>
        <h1 className={styles.local}>📜 Diário de Aventura</h1>
        <p className={styles.ouro}>{anotacoes.length}</p>
        <button type="button" className={styles.botao} onClick={onFechar}>
          Fechar
        </button>
      </header>

      {anotacoes.length === 0 ? (
        <p className={styles.vazio}>Nada aconteceu ainda. Ande pela masmorra e o diário se enche sozinho.</p>
      ) : (
        <ol className={styles.diario}>
          {anotacoes.map((anotacao) => (
            <li key={anotacao.id} className={styles.anotacao}>
              <span className={styles.iconeDaAnotacao} aria-hidden>
                {anotacao.icone}
              </span>
              <div>
                <strong className={styles.nomeDoPasso}>{anotacao.titulo}</strong>
                <p className={styles.dicaDoPasso}>{anotacao.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
