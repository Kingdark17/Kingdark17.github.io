import type { Metadata } from 'next';

import styles from './loja.module.css';
import { PainelLoja } from './painel-loja';

export const metadata: Metadata = {
  title: 'Loja — RPG Legend',
};

export default function PaginaLoja() {
  return (
    <main className={styles.tela}>
      <PainelLoja />
    </main>
  );
}
