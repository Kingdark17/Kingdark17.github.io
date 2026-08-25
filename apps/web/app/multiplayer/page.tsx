import type { Metadata } from 'next';
import Link from 'next/link';

import styles from './multiplayer.module.css';
import { PainelMultiplayer } from './painel-multiplayer';

export const metadata: Metadata = {
  title: 'Jogar com alguém — RPG Legend',
};

export default function PaginaMultiplayer() {
  return (
    <main className={styles.tela}>
      {/* Na página, e não dentro do `PainelMultiplayer`: é navegação pura,
          e o painel é Client Component — um `<Link>` estático não tem por
          que entrar no pacote de JavaScript dele. Mesmo arranjo de
          `/amigos`. */}
      <Link href="/menu" className={styles.voltar}>
        Voltar ao menu
      </Link>

      <PainelMultiplayer />
    </main>
  );
}
