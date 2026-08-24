import type { Metadata } from 'next';

import styles from './configuracoes.module.css';
import { PainelConfiguracoes } from './painel-configuracoes';

export const metadata: Metadata = {
  title: 'Configurações — RPG Legend',
};

export default function PaginaConfiguracoes() {
  return (
    <main className={styles.tela}>
      <PainelConfiguracoes />
    </main>
  );
}
