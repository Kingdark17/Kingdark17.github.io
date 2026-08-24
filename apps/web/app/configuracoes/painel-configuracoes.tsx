'use client';

/**
 * Som do jogo: liga/desliga, volume geral e volume dos efeitos.
 *
 * Mesma fonte de verdade do controle que já existe dentro da partida
 * (`app/jogo/controle-de-som.tsx`): `useSyncExternalStore` sobre o
 * `localStorage`, porque é exatamente isso que a preferência é — estado
 * que vive fora do React. Mexer aqui muda o controle de lá na hora, e
 * vice-versa, sem nenhum dos dois saber que o outro existe.
 *
 * O retrato do servidor é o padrão: `localStorage` não existe lá, e ler no
 * primeiro render faria o HTML servido discordar do que o navegador monta.
 *
 * **O volume dos efeitos é relativo ao geral.** Abaixar o geral abaixa
 * tudo; abaixar os efeitos mexe só neles. Ver `lib/som/audio.ts` pro
 * caminho do áudio.
 */

import Link from 'next/link';
import { useSyncExternalStore } from 'react';

import { aplicarVolume } from '@/lib/som/audio';
import { tocar } from '@/lib/som/efeitos';
import {
  assinarPreferencia,
  gravarPreferencia,
  lerPreferencia,
  PREFERENCIA_PADRAO,
  type PreferenciaDeSom,
} from '@/lib/som/preferencia';

import styles from './configuracoes.module.css';

const noServidor = () => PREFERENCIA_PADRAO;

const porcento = (valor: number) => `${Math.round(valor * 100)}%`;

export function PainelConfiguracoes() {
  const preferencia = useSyncExternalStore(assinarPreferencia, lerPreferencia, noServidor);

  function mudar(nova: PreferenciaDeSom) {
    gravarPreferencia(nova);
    aplicarVolume();
  }

  return (
    <section className={styles.painel}>
      <h1 className={styles.titulo}>Configurações</h1>

      <h2 className={styles.secao}>Som</h2>

      <div className={styles.linha}>
        <span className={styles.rotulo}>Som do jogo</span>
        <button
          type="button"
          className={styles.botao}
          onClick={() => mudar({ ...preferencia, ligado: !preferencia.ligado })}
          aria-pressed={preferencia.ligado}
        >
          {preferencia.ligado ? '🔊 Ligado' : '🔇 Desligado'}
        </button>
      </div>

      <label className={styles.campo}>
        <span className={styles.rotulo}>
          Volume geral <span className={styles.valor}>{porcento(preferencia.volume)}</span>
        </span>
        <input
          type="range"
          className={styles.deslizante}
          min={0}
          max={100}
          value={Math.round(preferencia.volume * 100)}
          onChange={(evento) => mudar({ ...preferencia, volume: Number(evento.target.value) / 100 })}
          disabled={!preferencia.ligado}
        />
        <span className={styles.dica}>Vale pra música e pros efeitos.</span>
      </label>

      <label className={styles.campo}>
        <span className={styles.rotulo}>
          Efeitos sonoros <span className={styles.valor}>{porcento(preferencia.efeitos)}</span>
        </span>
        <input
          type="range"
          className={styles.deslizante}
          min={0}
          max={100}
          value={Math.round(preferencia.efeitos * 100)}
          onChange={(evento) => mudar({ ...preferencia, efeitos: Number(evento.target.value) / 100 })}
          disabled={!preferencia.ligado}
        />
        <span className={styles.dica}>Golpe, moeda, porta, nível. Abaixa só eles, sem mexer na música.</span>
      </label>

      {/* Sem isto o controle é cego: ninguém arrasta o volume dos efeitos
          numa tela em silêncio e sabe onde parou. Toca o mesmo `gold` do
          jogo, então o que se ouve aqui é o que se ouve lá. */}
      <div className={styles.acoes}>
        <button type="button" className={styles.botao} onClick={() => tocar('gold')} disabled={!preferencia.ligado}>
          Testar efeito
        </button>
        <Link href="/menu" className={styles.voltar}>
          Voltar ao menu
        </Link>
      </div>

      <p className={styles.nota}>
        A preferência é deste aparelho, não da conta: quem joga no celular e no computador ajusta cada um do seu jeito.
      </p>
    </section>
  );
}
