/**
 * Os efeitos sonoros do jogo — o `SFX` de `js/effects.js`, com as mesmas
 * frequências, durações e ondas, pra soar igual ao que já está no ar.
 *
 * O original tocava direto no `destination` do próprio contexto; aqui vão
 * pelo ganho mestre (ver `audio.ts`), então o controle de volume vale
 * pra eles também.
 */

import { audio, estaMudo, saidaMestre } from './audio';

export type Efeito = 'hit' | 'crit' | 'miss' | 'gold' | 'buy' | 'sell' | 'door' | 'levelup' | 'victory' | 'defeat' | 'step';

interface Beep {
  hz: number;
  duracao: number;
  onda: OscillatorType;
  ganho: number;
}

const beep = (hz: number, duracao: number, onda: OscillatorType, ganho: number): Beep => ({ hz, duracao, onda, ganho });

const EFEITOS: Record<Efeito, Beep[]> = {
  hit: [beep(180, 0.12, 'square', 0.07)],
  crit: [beep(260, 0.18, 'square', 0.09), beep(180, 0.12, 'square', 0.06)],
  miss: [beep(110, 0.1, 'sine', 0.05)],
  gold: [beep(880, 0.08, 'triangle', 0.06), beep(1100, 0.08, 'triangle', 0.05)],
  buy: [beep(520, 0.09, 'triangle', 0.06)],
  sell: [beep(400, 0.09, 'triangle', 0.06)],
  door: [beep(220, 0.15, 'sine', 0.06)],
  levelup: [beep(523, 0.12, 'triangle', 0.08), beep(659, 0.12, 'triangle', 0.08), beep(784, 0.18, 'triangle', 0.09)],
  victory: [beep(660, 0.12, 'triangle', 0.08), beep(880, 0.16, 'triangle', 0.08)],
  defeat: [beep(200, 0.3, 'sawtooth', 0.07)],
  step: [beep(140, 0.05, 'sine', 0.03)],
};

function soar({ hz, duracao, onda, ganho }: Beep): void {
  const c = audio();
  const saida = saidaMestre();
  if (!c || !saida) return;

  try {
    const oscilador = c.createOscillator();
    const envelope = c.createGain();
    oscilador.type = onda;
    oscilador.frequency.value = hz;
    envelope.gain.value = ganho;
    oscilador.connect(envelope);
    envelope.connect(saida);
    oscilador.start();
    envelope.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duracao);
    oscilador.stop(c.currentTime + duracao + 0.02);
  } catch {
    /* silencioso: áudio pode estar bloqueado pelo navegador */
  }
}

export function tocar(efeito: Efeito): void {
  if (estaMudo()) return;
  for (const nota of EFEITOS[efeito]) soar(nota);
}
