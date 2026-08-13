import type { Metadata } from 'next';

import styles from './conta.module.css';
import { PainelConta } from './painel-conta';

export const metadata: Metadata = {
  title: 'Conta — RPG Legend',
};

export default function PaginaConta() {
  return (
    <main className={styles.tela}>
      <PainelConta />
    </main>
  );
}
