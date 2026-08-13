import type { Metadata } from 'next';

import { ListaPersonagens } from './lista-personagens';
import styles from './personagens.module.css';

export const metadata: Metadata = {
  title: 'Personagens — RPG Legend',
};

export default function PaginaPersonagens() {
  return (
    <main className={styles.tela}>
      <div className={styles.conteudo}>
        <h1 className={styles.titulo}>Seus personagens</h1>
        <p className={styles.subtitulo}>Cada slot guarda um progresso separado na nuvem.</p>
        <ListaPersonagens />
      </div>
    </main>
  );
}
