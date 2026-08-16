import type { Metadata } from 'next';

import styles from './multiplayer.module.css';
import { PainelMultiplayer } from './painel-multiplayer';

export const metadata: Metadata = {
  title: 'Jogar com alguém — RPG Legend',
};

export default function PaginaMultiplayer() {
  return (
    <main className={styles.tela}>
      <PainelMultiplayer />
    </main>
  );
}
