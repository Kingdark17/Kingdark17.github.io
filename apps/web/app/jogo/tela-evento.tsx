'use client';

/**
 * Evento de sala: o texto do acontecimento e as três escolhas. O resultado
 * depende de um atributo do herói e sai de `resolveEvent` na engine.
 */

import { escolher, escolhas, type Evento } from '@/lib/jogo/evento';
import styles from './jogo.module.css';
import { TextoDoJogo } from './texto-do-jogo';

interface Props {
  evento: Evento;
  onEvento: (proximo: Evento) => void;
  onFechar: (final: Evento) => void;
}

export function TelaEvento({ evento, onEvento, onFechar }: Props) {
  return (
    <section className={styles.combate}>
      <div className={styles.cartaInimigo}>
        <span className={styles.iconeInimigo} aria-hidden>
          {evento.template.icon}
        </span>
        <h1 className={styles.nomeInimigo}>{evento.template.title}</h1>
        <p className={styles.classeInimigo}>Escolha de Atributo</p>
      </div>

      <p className={styles.textoCaixa}>
        <TextoDoJogo>{evento.log[evento.log.length - 1] ?? evento.template.text}</TextoDoJogo>
      </p>

      <div className={styles.escolhas}>
        {evento.resolvido ? (
          <button type="button" className={`${styles.botao} ${styles.botaoPrincipal}`} onClick={() => onFechar(evento)}>
            Continuar
          </button>
        ) : (
          <>
            {escolhas(evento).map((escolha) => (
              <button key={escolha.id} type="button" className={styles.botao} onClick={() => onEvento(escolher(evento, escolha.id))}>
                {escolha.label}
              </button>
            ))}
            <button type="button" className={styles.botao} onClick={() => onFechar(evento)}>
              Sair
            </button>
          </>
        )}
      </div>
    </section>
  );
}
