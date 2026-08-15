'use client';

/**
 * Painel ADM — o `adminPanelModal` do cliente antigo. Só aparece pra
 * conta administradora, e quem diz quem é administrador é o servidor.
 */

import { useState } from 'react';

import { aplicar, fichaDe, modoInfinito, type Adm, type FichaDoAdm } from '@/lib/jogo/adm';
import styles from './jogo.module.css';

const CAMPOS: { chave: keyof FichaDoAdm; rotulo: string }[] = [
  { chave: 'hp', rotulo: 'Vida' },
  { chave: 'maxHp', rotulo: 'Vida máxima' },
  { chave: 'mp', rotulo: 'Mana' },
  { chave: 'maxMp', rotulo: 'Mana máxima' },
  { chave: 'gold', rotulo: 'Ouro' },
  { chave: 'level', rotulo: 'Nível' },
  { chave: 'xp', rotulo: 'XP' },
  { chave: 'attrPoints', rotulo: 'Pontos livres' },
  { chave: 'forca', rotulo: 'Força' },
  { chave: 'destreza', rotulo: 'Destreza' },
  { chave: 'constituicao', rotulo: 'Constituição' },
  { chave: 'intelecto', rotulo: 'Intelecto' },
  { chave: 'sabedoria', rotulo: 'Sabedoria' },
  { chave: 'carisma', rotulo: 'Carisma' },
];

interface Props {
  adm: Adm;
  onAdm: (proximo: Adm) => void;
  onFechar: (final: Adm) => void;
}

export function TelaAdm({ adm, onAdm, onFechar }: Props) {
  const [ficha, setFicha] = useState<FichaDoAdm>(() => fichaDe(adm.estado.hero));

  function aplicarFicha() {
    const proximo = aplicar(adm, ficha);
    setFicha(fichaDe(proximo.estado.hero));
    onAdm(proximo);
  }

  function ligarInfinito() {
    const proximo = modoInfinito(adm);
    setFicha(fichaDe(proximo.estado.hero));
    onAdm(proximo);
  }

  const resposta = adm.log[adm.log.length - 1];

  return (
    <section className={styles.loja}>
      <header className={styles.cabecalhoLoja}>
        <h1 className={styles.local}>🛠️ Painel ADM</h1>
        <button type="button" className={styles.botao} onClick={() => onFechar(adm)}>
          Fechar
        </button>
      </header>

      {resposta && <p className={styles.linhaDoLog}>{resposta}</p>}

      <div className={styles.fichaDoAdm}>
        {CAMPOS.map(({ chave, rotulo }) => (
          <label key={chave} className={styles.campoDoAdm}>
            <span className={styles.metaItem}>{rotulo}</span>
            <input
              className={styles.entradaDoAdm}
              type="number"
              value={ficha[chave]}
              onChange={(evento) => setFicha({ ...ficha, [chave]: Number(evento.target.value) })}
            />
          </label>
        ))}
      </div>

      <div className={styles.escolhas}>
        <button type="button" className={`${styles.botao} ${styles.botaoPrincipal}`} onClick={aplicarFicha}>
          Aplicar
        </button>
        <button type="button" className={styles.botao} onClick={ligarInfinito}>
          Modo infinito
        </button>
      </div>
    </section>
  );
}
