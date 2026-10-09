'use client';

/**
 * O totem dos andares 20, 40, 60 e 80: o toque já marcou o andar no portão
 * (`lib/jogo/totem.ts`), e a tela oferece a volta pra cidade na hora — é o
 * "totem de tp" do pedido do usuário.
 */

import { runName } from '@rpg-legend/shared';

import type { EstadoNaCidade, EstadoNaMasmorra } from '@/lib/jogo/estado';
import { voltarPeloTotem, type Totem } from '@/lib/jogo/totem';
import styles from './jogo.module.css';
import { TextoDoJogo } from './texto-do-jogo';

interface Props {
  totem: Totem;
  onVoltar: (cidade: EstadoNaCidade) => void;
  onFechar: (estado: EstadoNaMasmorra) => void;
}

export function TelaTotem({ totem, onVoltar, onFechar }: Readonly<Props>) {
  return (
    <section className={styles.combate}>
      <div className={styles.cartaInimigo}>
        <span className={styles.iconeInimigo} aria-hidden>
          🗿
        </span>
        <h1 className={styles.nomeInimigo}>Totem Antigo</h1>
        <p className={styles.classeInimigo}>
          {runName(totem.estado.masmorra)} · Andar {totem.estado.floor}
        </p>
      </div>

      <p className={styles.textoCaixa}>
        <TextoDoJogo>{totem.texto}</TextoDoJogo>
      </p>

      <div className={styles.escolhas}>
        <button type="button" className={`${styles.botao} ${styles.botaoPrincipal}`} onClick={() => onVoltar(voltarPeloTotem(totem))}>
          Voltar à cidade
        </button>
        <button type="button" className={styles.botao} onClick={() => onFechar(totem.estado)}>
          Continuar explorando
        </button>
      </div>
    </section>
  );
}
