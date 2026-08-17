'use client';

/**
 * Liga/desliga o som e ajusta o volume. Substitui o `soundToggle` e o
 * `musicVolume` do `index.html` antigo — com a diferença de que a
 * preferência agora é do aparelho (`localStorage`), não do save.
 *
 * A preferência entra por `useSyncExternalStore` porque é exatamente isso
 * que ela é: um estado que vive fora do React (`localStorage`, e o volume
 * que a música lê). O retrato do servidor é o padrão — `localStorage` não
 * existe lá, e ler direto no primeiro render faria o HTML servido
 * discordar do que o navegador monta.
 */

import { useSyncExternalStore } from 'react';

import { aplicarVolume } from '@/lib/som/audio';
import { assinarPreferencia, gravarPreferencia, lerPreferencia, PREFERENCIA_PADRAO, type PreferenciaDeSom } from '@/lib/som/preferencia';

import styles from './jogo.module.css';

const noServidor = () => PREFERENCIA_PADRAO;

export function ControleDeSom() {
  const preferencia = useSyncExternalStore(assinarPreferencia, lerPreferencia, noServidor);

  function mudar(nova: PreferenciaDeSom) {
    gravarPreferencia(nova);
    aplicarVolume();
  }

  return (
    <div className={styles.controleDeSom}>
      <button
        type="button"
        className={styles.botao}
        onClick={() => mudar({ ...preferencia, ligado: !preferencia.ligado })}
        aria-pressed={preferencia.ligado}
        title={preferencia.ligado ? 'Desligar o som' : 'Ligar o som'}
      >
        {preferencia.ligado ? '🔊' : '🔇'} Som
      </button>

      <input
        type="range"
        className={styles.volume}
        min={0}
        max={100}
        value={Math.round(preferencia.volume * 100)}
        onChange={(evento) => mudar({ ...preferencia, volume: Number(evento.target.value) / 100 })}
        disabled={!preferencia.ligado}
        aria-label="Volume"
        title="Volume"
      />
    </div>
  );
}
