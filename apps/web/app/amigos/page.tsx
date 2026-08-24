import type { Metadata } from 'next';
import Link from 'next/link';

import styles from './amigos.module.css';
import { PainelAmigos } from './painel-amigos';

export const metadata: Metadata = {
  title: 'Amigos — RPG Legend',
};

export default function PaginaAmigos() {
  return (
    <main className={styles.tela}>
      {/* Fica aqui, na página, e não dentro do `PainelAmigos`: é navegação
          pura, e o painel é Client Component — um `<Link>` estático não tem
          por que entrar no pacote de JavaScript dele.

          Sem isto a tela é um beco: desde que o menu virou três botões,
          chega-se aqui pelo ícone da cartinha e não havia caminho de volta. */}
      <Link href="/menu" className={styles.voltar}>
        Voltar ao menu
      </Link>

      <PainelAmigos />
    </main>
  );
}
