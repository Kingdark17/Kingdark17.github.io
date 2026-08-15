'use client';

import { domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react';
import Link from 'next/link';

import styles from './page.module.css';

/**
 * Os cartões do menu, entrando um atrás do outro.
 *
 * `LazyMotion` com `domAnimation` carrega ~6 KB de features em vez dos ~34 KB
 * do pacote inteiro, e `strict` faz `motion.*` lançar erro — assim ninguém
 * importa o componente pesado por engano e desfaz a economia sem perceber.
 * Este é o único lugar do app com Motion: o resto do movimento (bichinho,
 * moldura RGB) é loop decorativo e continua em CSS, como combinado.
 */

export interface Destino {
  href: string;
  icone: string;
  titulo: string;
  texto: string;
}

export function DestinosDoMenu({ destinos }: { destinos: readonly Destino[] }) {
  const semMovimento = useReducedMotion();

  return (
    <LazyMotion features={domAnimation} strict>
      <nav className={styles.destinos}>
        {destinos.map((destino, indice) => (
          <m.div
            key={destino.href}
            initial={semMovimento ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: semMovimento ? 0 : indice * 0.06 }}
          >
            <Link href={destino.href} className={styles.destino}>
              <span className={styles.iconeDoDestino} aria-hidden>
                {destino.icone}
              </span>
              <span className={styles.tituloDoDestino}>{destino.titulo}</span>
              <span className={styles.textoDoDestino}>{destino.texto}</span>
            </Link>
          </m.div>
        ))}
      </nav>
    </LazyMotion>
  );
}
