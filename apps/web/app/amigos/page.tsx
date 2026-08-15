import type { Metadata } from 'next';

import styles from './amigos.module.css';
import { PainelAmigos } from './painel-amigos';

export const metadata: Metadata = {
  title: 'Amigos — RPG Legend',
};

export default function PaginaAmigos() {
  return (
    <main className={styles.tela}>
      <PainelAmigos />
    </main>
  );
}
