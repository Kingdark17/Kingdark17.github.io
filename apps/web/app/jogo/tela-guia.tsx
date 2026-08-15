'use client';

/**
 * Guia do Aventureiro — o `tutorialModal` do cliente antigo: o progresso
 * dos Primeiros Passos em cima, os textos do guia embaixo.
 *
 * Só mostra; quem marca etapa é `interagir` (salas) e a tela de jogo
 * (andar, abrir mochila).
 */

import { concluidos, GUIAS, PASSOS, tutorialDe } from '@/lib/jogo/tutorial';
import type { EstadoDoJogo } from '@/lib/jogo/estado';
import styles from './jogo.module.css';

export function TelaGuia({ estado, onFechar }: { estado: EstadoDoJogo; onFechar: () => void }) {
  const tutorial = tutorialDe(estado);
  const feitos = concluidos(tutorial);

  return (
    <section className={styles.loja}>
      <header className={styles.cabecalhoLoja}>
        <h1 className={styles.local}>📖 Guia do Aventureiro</h1>
        <p className={styles.ouro}>
          {feitos}/{PASSOS.length}
        </p>
        <button type="button" className={styles.botao} onClick={onFechar}>
          Fechar
        </button>
      </header>

      <h2 className={styles.tituloDaSecao}>Primeiros Passos</h2>
      <ul className={styles.listaDePassos}>
        {PASSOS.map((passo) => {
          const feito = !!tutorial.completed[passo.id];
          return (
            <li key={passo.id} className={`${styles.passo} ${feito ? styles.passoFeito : ''}`}>
              <span className={styles.iconeDoPasso} aria-hidden>
                {passo.icone}
              </span>
              <div>
                <strong className={styles.nomeDoPasso}>{passo.nome}</strong>
                <p className={styles.dicaDoPasso}>{passo.dica}</p>
              </div>
              <span aria-label={feito ? 'concluída' : 'pendente'}>{feito ? '✓' : '○'}</span>
            </li>
          );
        })}
      </ul>

      <p className={styles.vazio}>
        {tutorial.rewarded ? '✓ Recompensa recebida: 40 de ouro e uma poção.' : 'Conclua tudo: 40 de ouro e uma poção.'}
      </p>

      <h2 className={styles.tituloDaSecao}>Guia</h2>
      <div className={styles.gradeDoGuia}>
        {GUIAS.map((guia) => (
          <section key={guia.titulo} className={styles.cartaDoGuia}>
            <strong className={styles.nomeDoPasso}>{guia.titulo}</strong>
            <p className={styles.dicaDoPasso}>{guia.texto}</p>
          </section>
        ))}
      </div>
    </section>
  );
}
