'use client';

/**
 * O ataque em dois toques do combate em primeira pessoa (doc do Breno,
 * regras do usuário em 2026-10-09): **gira o d20 de dano, e aí aparece a
 * barra de mira**. Parou na zona, acertou; quanto mais perto do centro,
 * mais forte; a faixa fina do centro crita.
 *
 * Só desenha e mede o tempo. Quem lê a barra é a engine (`lerMira`) e quem
 * resolve o golpe é `atacar`, com a jogada que sai daqui.
 *
 * **Depois de girar não há volta.** Voltar só existe antes do giro: com o
 * dado na tela, desistir viraria um jeito de rolar de novo até sair 20.
 *
 * O cursor anda por `requestAnimationFrame` mexendo direto no estilo, sem
 * estado do React a cada quadro. E a posição no toque vem do `timeStamp`
 * do evento, não do último quadro pintado: vale quando o jogador tocou, não
 * quando a tela conseguiu desenhar.
 *
 * Com "menos movimento" pedido no sistema o dado para na hora, sem girar.
 * A barra continua andando, porque ela **é** a jogada.
 */

import { useEffect, useRef, useState } from 'react';

import { LADOS_DO_DANO, lerMira, type AtaqueDisponivel, type JogadaDeAtaque, type LeituraDaMira } from '@rpg-legend/shared';

import { miraNoInstante, rotuloDaLeitura, trechosDaBarra } from '@/lib/jogo/barra-de-mira';
import styles from './combate.module.css';
import jogo from './jogo.module.css';

const GIRO_MS = 480;
const TROCA_DE_FACE_MS = 60;
const PAUSA_ANTES_DA_BARRA_MS = 250;
const LEITURA_NA_TELA_MS = 650;

type Fase =
  | { tipo: 'dado' }
  | { tipo: 'girando'; face: number }
  | { tipo: 'barra'; dado: number }
  | { tipo: 'leitura'; dado: number; mira: number | null; leitura: LeituraDaMira };

function rolar(lados: number): number {
  return Math.floor(Math.random() * lados) + 1;
}

function poucoMovimento(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Props {
  ataque: AtaqueDisponivel;
  /** O nome do ataque, como no botão que o escolheu. */
  rotulo: string;
  onFim: (jogada: JogadaDeAtaque) => void;
  /** Só antes do giro — ver o comentário do arquivo. */
  onVoltar: () => void;
}

export function AtaqueComMira({ ataque, rotulo, onFim, onVoltar }: Props) {
  const [fase, setFase] = useState<Fase>({ tipo: 'dado' });
  const relogios = useRef<number[]>([]);
  const corredor = useRef<HTMLSpanElement>(null);
  const botaoDoDado = useRef<HTMLButtonElement>(null);
  const barra = useRef<HTMLButtonElement>(null);
  /** Posto pelo efeito da barra; o toque e o teclado chamam por aqui. */
  const parar = useRef<((instante: number) => void) | null>(null);
  const aoTerminar = useRef(onFim);

  useEffect(() => {
    aoTerminar.current = onFim;
  }, [onFim]);

  // Relógios pendentes morrem com a tela: sair do combate no meio do giro
  // não pode disparar um ataque depois.
  useEffect(() => {
    const pendentes = relogios.current;
    return () => pendentes.forEach((relogio) => window.clearTimeout(relogio));
  }, []);

  useEffect(() => {
    if (fase.tipo === 'dado') botaoDoDado.current?.focus();
    if (fase.tipo === 'barra') barra.current?.focus();
  }, [fase.tipo]);

  function depois(ms: number, fazer: () => void) {
    relogios.current.push(window.setTimeout(fazer, ms));
  }

  function girar() {
    if (fase.tipo !== 'dado') return;
    const resultado = rolar(LADOS_DO_DANO);
    const mostrarBarra = () => depois(PAUSA_ANTES_DA_BARRA_MS, () => setFase({ tipo: 'barra', dado: resultado }));

    if (poucoMovimento()) {
      setFase({ tipo: 'girando', face: resultado });
      mostrarBarra();
      return;
    }

    setFase({ tipo: 'girando', face: rolar(LADOS_DO_DANO) });
    const troca = window.setInterval(() => setFase({ tipo: 'girando', face: rolar(LADOS_DO_DANO) }), TROCA_DE_FACE_MS);
    depois(GIRO_MS, () => {
      window.clearInterval(troca);
      setFase({ tipo: 'girando', face: resultado });
      mostrarBarra();
    });
    relogios.current.push(troca);
  }

  const dadoDaBarra = fase.tipo === 'barra' ? fase.dado : null;

  useEffect(() => {
    if (dadoDaBarra === null) return;
    const inicio = performance.now();
    let parou = false;
    let quadro = 0;

    const pararEm = (instante: number) => {
      if (parou) return;
      parou = true;
      cancelAnimationFrame(quadro);
      const mira = miraNoInstante(instante - inicio);
      if (corredor.current) corredor.current.style.transform = `translateX(${(mira ?? 1) * 100}%)`;
      setFase({ tipo: 'leitura', dado: dadoDaBarra, mira, leitura: lerMira(ataque.zona, mira) });
      depois(LEITURA_NA_TELA_MS, () => aoTerminar.current({ dado: dadoDaBarra, mira }));
    };
    parar.current = pararEm;

    const passo = (agora: number) => {
      const mira = miraNoInstante(agora - inicio);
      if (mira === null) {
        pararEm(agora);
        return;
      }
      if (corredor.current) corredor.current.style.transform = `translateX(${mira * 100}%)`;
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);

    // Na janela, e não só no botão: o teclado para a barra mesmo que o foco
    // tenha saído dela. O `preventDefault` também impede o Enter de virar
    // clique no botão focado e parar duas vezes.
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key !== ' ' && evento.key !== 'Enter') return;
      evento.preventDefault();
      pararEm(evento.timeStamp);
    };
    window.addEventListener('keydown', tecla);

    return () => {
      parou = true;
      cancelAnimationFrame(quadro);
      window.removeEventListener('keydown', tecla);
      parar.current = null;
    };
  }, [dadoDaBarra, ataque.zona]);

  const trechos = trechosDaBarra(ataque.zona);
  const naBarra = fase.tipo === 'barra' || fase.tipo === 'leitura';

  return (
    <div className={styles.ataque}>
      <p className={styles.tituloDoAtaque}>
        {rotulo}
        {ataque.daClasse && <span className={styles.notaDoAtaque}> · zona maior</span>}
      </p>

      {!naBarra ? (
        <>
          <button
            ref={botaoDoDado}
            type="button"
            className={styles.dadoGrande}
            data-girando={fase.tipo === 'girando' || undefined}
            onClick={girar}
            disabled={fase.tipo !== 'dado'}
            aria-label={fase.tipo === 'dado' ? `Girar o d${LADOS_DO_DANO} de dano` : `d${LADOS_DO_DANO}: ${fase.face}`}
          >
            {fase.tipo === 'dado' ? `d${LADOS_DO_DANO}` : fase.face}
          </button>
          {fase.tipo === 'dado' ? (
            <div className={styles.rodapeDoAtaque}>
              <p className={styles.dica}>Toque no dado para girar o dano.</p>
              <button type="button" className={jogo.botaoDiscreto} onClick={onVoltar}>
                Voltar
              </button>
            </div>
          ) : (
            <p className={styles.dica}>&nbsp;</p>
          )}
        </>
      ) : (
        <>
          <div className={styles.linhaDaBarra}>
            <span className={styles.dadoPequeno} aria-label={`d${LADOS_DO_DANO} de dano: ${fase.dado}`}>
              {fase.dado}
            </span>
            <button
              ref={barra}
              type="button"
              className={styles.barra}
              data-parada={fase.tipo === 'leitura' || undefined}
              onPointerDown={(evento) => parar.current?.(evento.timeStamp)}
              // Ativação sem ponteiro nem tecla (leitor de tela): `detail` 0.
              onClick={(evento) => {
                if (evento.detail === 0) parar.current?.(performance.now());
              }}
              aria-label="Parar a barra de mira"
            >
              <span className={styles.zona} style={{ left: `${trechos.zona.inicio}%`, width: `${trechos.zona.largura}%` }} />
              <span className={styles.faixaCritica} style={{ left: `${trechos.critica.inicio}%`, width: `${trechos.critica.largura}%` }} />
              <span ref={corredor} className={styles.corredor}>
                <span className={styles.cursor} />
              </span>
            </button>
          </div>
          <p
            className={`${styles.dica} ${fase.tipo === 'leitura' ? styles.leitura : ''} ${fase.tipo === 'leitura' && fase.leitura.critico ? styles.leituraCritica : ''}`}
            aria-live="polite"
          >
            {fase.tipo === 'leitura' ? (
              rotuloDaLeitura(fase.leitura)
            ) : (
              <>
                Toque na barra<span className={styles.soComTeclado}> (ou Espaço)</span> para parar no centro.
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}
