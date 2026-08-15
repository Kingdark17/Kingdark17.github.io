'use client';

/**
 * Conversa com NPC: retrato, falas em sequência e o botão do serviço que
 * ele oferece. As regras estão em `lib/jogo/dialogo.ts`.
 */

import {
  falaAtual,
  proximaFala,
  rotuloDoServico,
  servicoDisponivel,
  temMaisFalas,
  usarServico,
  type Dialogo,
} from '@/lib/jogo/dialogo';
import styles from './jogo.module.css';
import { TextoDoJogo } from './texto-do-jogo';

interface Props {
  dialogo: Dialogo;
  onDialogo: (proximo: Dialogo) => void;
  onFechar: (final: Dialogo) => void;
}

export function TelaDialogo({ dialogo, onDialogo, onFechar }: Props) {
  const { npc } = dialogo;
  const servico = rotuloDoServico(npc);
  const resposta = dialogo.log[dialogo.log.length - 1];

  return (
    <section className={styles.combate}>
      <div className={styles.cartaInimigo}>
        <span className={styles.iconeInimigo} aria-hidden>
          {npc.icon}
        </span>
        <h1 className={styles.nomeInimigo}>{npc.name}</h1>
        <p className={styles.classeInimigo}>{npc.role}</p>
      </div>

      <p className={styles.textoCaixa}>
        <TextoDoJogo>{falaAtual(dialogo)}</TextoDoJogo>
      </p>

      {resposta && (
        <p className={styles.linhaDoLog}>
          <TextoDoJogo>{resposta}</TextoDoJogo>
        </p>
      )}

      <div className={styles.escolhas}>
        {temMaisFalas(dialogo) && (
          <button type="button" className={`${styles.botao} ${styles.botaoPrincipal}`} onClick={() => onDialogo(proximaFala(dialogo))}>
            Continuar conversa
          </button>
        )}

        {servico && (
          <button type="button" className={styles.botao} onClick={() => onDialogo(usarServico(dialogo))} disabled={!servicoDisponivel(npc)}>
            {servico}
            {npc.serviceUsed ? ' (já usado)' : ''}
          </button>
        )}

        <button type="button" className={styles.botao} onClick={() => onFechar(dialogo)}>
          Encerrar conversa
        </button>
      </div>
    </section>
  );
}
