'use client';

/**
 * O professor de classe. O molde é o da Guilda: as cartas só selecionam, e
 * quem decide é o botão de baixo, que diz o que vai acontecer — aprender ou
 * trocar poder não tem volta.
 *
 * Herói com vaga escolhe o que aprender. Quem já tem os três poderes da
 * criação antiga escolhe também qual esquecer. Ver `lib/jogo/professor.ts`.
 */

import { useState } from 'react';

import type { Power } from '@rpg-legend/shared';

import { aprender, ofertas, trocar, trocaveis, type Professor } from '@/lib/jogo/professor';
import styles from './jogo.module.css';
import { TextoDoJogo } from './texto-do-jogo';

interface Props {
  professor: Professor;
  onProfessor: (proximo: Professor) => void;
  onFechar: (final: Professor) => void;
}

function CartaDePoder({ poder, escolhida, onEscolher }: Readonly<{ poder: Power; escolhida: boolean; onEscolher: () => void }>) {
  return (
    <button
      type="button"
      className={`${styles.cartaItem} ${styles.cartaClicavel} ${escolhida ? styles.cartaSelecionada : ''}`}
      aria-pressed={escolhida}
      onClick={onEscolher}
    >
      <span className={styles.iconeDaCarta} aria-hidden>
        {poder.icon}
      </span>
      <span className={styles.nomeItem}>
        {poder.name} <span className={styles.custoDeMana}>({poder.cost} MP)</span>
      </span>
      <span className={styles.metaItem}>{poder.desc}</span>
    </button>
  );
}

export function TelaProfessor({ professor, onProfessor, onFechar }: Readonly<Props>) {
  const [aprenderId, setAprenderId] = useState<string | null>(null);
  const [esquecerId, setEsquecerId] = useState<string | null>(null);
  const fala = professor.log[professor.log.length - 1] ?? '';
  const novo = ofertas(professor).find((poder) => poder.id === aprenderId);
  const velho = trocaveis(professor).find((poder) => poder.id === esquecerId);

  return (
    <section className={styles.loja}>
      <header className={styles.cabecalhoLoja}>
        <h1 className={styles.local}>
          🎓 Mestre {professor.classe.icon} {professor.classe.name}
        </h1>
        <button type="button" className={styles.botao} onClick={() => onFechar(professor)}>
          {professor.concluido ? 'Continuar' : 'Agora não'}
        </button>
      </header>

      <p className={styles.textoDaGuilda}>
        <TextoDoJogo>{fala}</TextoDoJogo>
      </p>

      {!professor.concluido && professor.modo && (
        <>
          <div className={styles.grupoDoPortao}>
            <h2 className={styles.tituloDaSecao}>O mestre ensina</h2>
            <div className={styles.gradeDeItens}>
              {ofertas(professor).map((poder) => (
                <CartaDePoder key={poder.id} poder={poder} escolhida={aprenderId === poder.id} onEscolher={() => setAprenderId(poder.id)} />
              ))}
            </div>
          </div>

          {professor.modo === 'swap' && (
            <div className={styles.grupoDoPortao}>
              <h2 className={styles.tituloDaSecao}>Você esquece</h2>
              <div className={styles.gradeDeItens}>
                {trocaveis(professor).map((poder) => (
                  <CartaDePoder key={poder.id} poder={poder} escolhida={esquecerId === poder.id} onEscolher={() => setEsquecerId(poder.id)} />
                ))}
              </div>
            </div>
          )}

          <div className={styles.escolhas}>
            {professor.modo === 'learn' ? (
              <button
                type="button"
                className={`${styles.botao} ${styles.botaoPrincipal}`}
                disabled={!novo}
                onClick={() => novo && onProfessor(aprender(professor, novo.id))}
              >
                {novo ? `Aprender ${novo.name}` : 'Escolha um poder'}
              </button>
            ) : (
              <button
                type="button"
                className={`${styles.botao} ${styles.botaoPrincipal}`}
                disabled={!novo || !velho}
                onClick={() => novo && velho && onProfessor(trocar(professor, velho.id, novo.id))}
              >
                {novo && velho ? `Trocar ${velho.name} por ${novo.name}` : 'Escolha o que aprender e o que esquecer'}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
