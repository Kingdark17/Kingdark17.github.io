import type { Metadata } from 'next';

import styles from './criacao.module.css';
import { FormularioCriacao } from './formulario-criacao';

export const metadata: Metadata = {
  title: 'Novo personagem — RPG Legend',
};

const SLOT_PADRAO = 1;
const MAX_SLOTS = 4;

function slotValido(valor: string | undefined): number {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 1 && numero <= MAX_SLOTS ? numero : SLOT_PADRAO;
}

export default async function PaginaNovoPersonagem({ searchParams }: { searchParams: Promise<{ slot?: string }> }) {
  const { slot } = await searchParams;

  return (
    <main className={styles.tela}>
      <div className={styles.conteudo}>
        <h1 className={styles.titulo}>Novo personagem</h1>
        <p className={styles.subtitulo}>Slot {slotValido(slot)}</p>
        <FormularioCriacao slot={slotValido(slot)} />
      </div>
    </main>
  );
}
