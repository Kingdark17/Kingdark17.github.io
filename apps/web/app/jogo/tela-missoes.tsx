'use client';

/**
 * Quadro de missões: as missões abertas, o progresso de cada uma e o botão
 * de resgatar quando ela fica pronta. O quadro nunca encolhe — resgatar
 * sorteia outra no lugar (`claimQuest` na engine).
 */

import { missoes, resgatar, type Quadro } from '@/lib/jogo/missoes';
import styles from './jogo.module.css';

interface Props {
  quadro: Quadro;
  onQuadro: (proximo: Quadro) => void;
  onFechar: (final: Quadro) => void;
}

export function TelaMissoes({ quadro, onQuadro, onFechar }: Props) {
  const lista = missoes(quadro);

  return (
    <section className={styles.loja}>
      <header className={styles.cabecalhoLoja}>
        <h1 className={styles.local}>📜 Quadro de Missões</h1>
        <p className={styles.ouro}>💰 {quadro.estado.hero.gold} ouro</p>
        <button type="button" className={styles.botao} onClick={() => onFechar(quadro)}>
          Sair
        </button>
      </header>

      <p className={styles.linhaDoLog}>{quadro.log[quadro.log.length - 1]}</p>

      {lista.length === 0 ? (
        <p className={styles.vazio}>Nenhum anúncio no quadro.</p>
      ) : (
        <ul className={styles.listaDeMissoes}>
          {lista.map((missao) => {
            const progresso = Math.min(100, (missao.progress / missao.target) * 100);
            return (
              <li key={missao.id} className={styles.missao}>
                <h2 className={styles.tituloDaMissao}>{missao.title}</h2>
                <p className={styles.descricaoDaMissao}>{missao.desc}</p>

                <div className={styles.trilho}>
                  <div className={`${styles.preenchimento} ${styles.mana}`} style={{ width: `${progresso}%` }} />
                </div>
                <p className={styles.metaItem}>
                  {Math.min(missao.progress, missao.target)}/{missao.target} · recompensa {missao.rewardGold} ouro e {missao.rewardXp} XP
                </p>

                <button
                  type="button"
                  className={`${styles.botao} ${missao.done && !missao.claimed ? styles.botaoPrincipal : ''}`}
                  disabled={!missao.done || missao.claimed}
                  onClick={() => onQuadro(resgatar(quadro, missao.id))}
                >
                  {missao.claimed ? 'Resgatada' : missao.done ? 'Resgatar recompensa' : 'Em andamento'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
