'use client';

/**
 * O joystick da tela de toque (decisão do usuário, 2026-10-11): o dedo
 * encosta em qualquer ponto da sala, o círculo aparece ali, e arrastar dá a
 * direção e a força do andar. Soltar para.
 *
 * Fica por cima da cena e entrega o vetor a `onVetor`, que o guarda onde o
 * andar lê a cada quadro — nada passa por estado do React além da posição
 * do desenho do círculo.
 * Funciona com mouse também: arrastar com o botão apertado anda, o que serve
 * a quem joga sem teclado.
 */

import { useEffect, useRef, useState, type PointerEvent } from 'react';

import { PARADO, type Vetor } from '@/lib/jogo/andar-na-sala';
import styles from './jogo.module.css';

/** Quantos pixels de arraste são o joystick no fim. */
const RAIO = 44;

/** Arraste menor que isto (fração do raio) é tremor do dedo, não andar. */
const ZONA_MORTA = 0.15;

interface Toque {
  id: number;
  origem: { x: number; y: number };
  alavanca: { x: number; y: number };
}

export function Joystick({ onVetor, ativo }: Readonly<{ onVetor: (vetor: Vetor) => void; ativo: boolean }>) {
  const area = useRef<HTMLDivElement>(null);
  const [toque, setToque] = useState<Toque | null>(null);

  // Abriu uma pergunta por cima: solta o joystick, senão o herói seguiria
  // andando sozinho quando ela fechasse. O círculo some junto (`mostrado`).
  useEffect(() => {
    if (!ativo) onVetor(PARADO);
  }, [ativo, onVetor]);
  const mostrado = ativo ? toque : null;

  function pontoNaArea(evento: PointerEvent<HTMLDivElement>) {
    const caixa = area.current?.getBoundingClientRect();
    return { x: evento.clientX - (caixa?.left ?? 0), y: evento.clientY - (caixa?.top ?? 0) };
  }

  function apertar(evento: PointerEvent<HTMLDivElement>) {
    if (!ativo || mostrado) return;
    evento.preventDefault();
    evento.currentTarget.setPointerCapture(evento.pointerId);
    const ponto = pontoNaArea(evento);
    setToque({ id: evento.pointerId, origem: ponto, alavanca: ponto });
  }

  function arrastar(evento: PointerEvent<HTMLDivElement>) {
    if (!ativo || toque?.id !== evento.pointerId) return;
    const ponto = pontoNaArea(evento);
    let dx = (ponto.x - toque.origem.x) / RAIO;
    let dy = (ponto.y - toque.origem.y) / RAIO;
    const comprimento = Math.hypot(dx, dy);
    if (comprimento > 1) {
      dx /= comprimento;
      dy /= comprimento;
    }
    onVetor(comprimento < ZONA_MORTA ? PARADO : { x: dx, y: dy });
    setToque({ ...toque, alavanca: { x: toque.origem.x + dx * RAIO, y: toque.origem.y + dy * RAIO } });
  }

  function soltar(evento: PointerEvent<HTMLDivElement>) {
    if (toque?.id !== evento.pointerId) return;
    onVetor(PARADO);
    setToque(null);
  }

  return (
    <div
      ref={area}
      className={styles.areaDoJoystick}
      onPointerDown={apertar}
      onPointerMove={arrastar}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      aria-hidden
    >
      {mostrado ? (
        <>
          <span className={styles.baseDoJoystick} style={{ left: mostrado.origem.x, top: mostrado.origem.y }} />
          <span className={styles.alavancaDoJoystick} style={{ left: mostrado.alavanca.x, top: mostrado.alavanca.y }} />
        </>
      ) : (
        ativo && <span className={styles.dicaDoJoystick}>Arraste o dedo na sala para andar</span>
      )}
    </div>
  );
}
