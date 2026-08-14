import type { Metadata } from 'next';

import styles from './jogo.module.css';
import { TelaJogo } from './tela-jogo';

export const metadata: Metadata = {
  title: 'Jogo — RPG Legend',
};

const SLOT_PADRAO = 1;
const MAX_SLOTS = 4;

function slotValido(valor: string | undefined): number {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 1 && numero <= MAX_SLOTS ? numero : SLOT_PADRAO;
}

export default async function PaginaJogo({ searchParams }: { searchParams: Promise<{ slot?: string }> }) {
  const { slot } = await searchParams;

  return (
    <main className={styles.tela}>
      <TelaJogo slot={slotValido(slot)} />
    </main>
  );
}
