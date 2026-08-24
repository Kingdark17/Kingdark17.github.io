import type { Metadata } from 'next';
import Link from 'next/link';

import { ListaPersonagens } from './lista-personagens';
import styles from './personagens.module.css';

export const metadata: Metadata = {
  title: 'Personagens — RPG Legend',
};

/**
 * O menu novo tem três botões, e "Jogar" cai aqui. Por isso **esta** tela
 * passou a ser a porta do co-op: `/multiplayer` só era alcançável pela
 * lista de destinos do menu antigo, e sem o atalho abaixo o modo de jogar
 * junto ficaria sem nenhuma entrada no site inteiro.
 *
 * Faz sentido aqui e não no menu: jogar junto é uma forma de jogar, e a
 * sala pede um personagem de qualquer jeito.
 */
export default function PaginaPersonagens() {
  return (
    <main className={styles.tela}>
      <div className={styles.conteudo}>
        <h1 className={styles.titulo}>Seus personagens</h1>
        <p className={styles.subtitulo}>Cada slot guarda um progresso separado na nuvem.</p>

        <nav className={styles.atalhos} aria-label="Outras formas de jogar">
          <Link className={styles.atalhoCoop} href="/multiplayer">
            👥 Jogar com alguém
          </Link>
          <Link className={styles.botaoDiscreto} href="/menu">
            Voltar ao menu
          </Link>
        </nav>

        <ListaPersonagens />
      </div>
    </main>
  );
}
