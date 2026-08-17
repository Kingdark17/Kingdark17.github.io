/**
 * O `AudioContext` do jogo e a voz mais simples que dá pra tocar nele.
 *
 * **Um só, compartilhado.** O cliente antigo criava dois — `effects.js` e
 * `music.js` abriam cada um o seu, cada um com o próprio volume e o
 * próprio estado de suspensão. Navegador limita quantos contextos existem
 * por aba, e o efeito colateral aparecia na prática: destravar o áudio no
 * primeiro clique acordava a música mas não os efeitos, ou o contrário.
 *
 * Tudo passa por um ganho mestre ligado à preferência, então o controle de
 * volume vale pra música **e** pros efeitos. No original o volume só
 * mexia na música; os efeitos eram liga/desliga. Divergir aqui é o que
 * qualquer pessoa espera de um controle de volume.
 *
 * Nada disto pode rodar no servidor: só existe quando o navegador chama.
 */

import { assinarPreferencia, lerPreferencia } from './preferencia';

let contexto: AudioContext | null = null;
let mestre: GainNode | null = null;

/** O ganho do original (`music.js`), mantido pra a música soar igual. */
const TETO = 0.48;

function volumeAtual(): number {
  const preferencia = lerPreferencia();
  return preferencia.ligado ? preferencia.volume : 0;
}

/**
 * `null` quando o navegador não deixa (áudio bloqueado, API ausente). Todo
 * chamador trata isso como "hoje não tem som" e segue — som nunca pode
 * derrubar o jogo.
 */
export function audio(): AudioContext | null {
  if (contexto) return contexto;
  if (typeof window === 'undefined') return null;

  try {
    const Construtor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Construtor) return null;

    contexto = new Construtor();
    mestre = contexto.createGain();
    const compressor = contexto.createDynamicsCompressor();
    const eco = contexto.createDelay(0.8);
    eco.delayTime.value = 0.24;
    const ganhoDoEco = contexto.createGain();
    ganhoDoEco.gain.value = 0.16;

    mestre.connect(compressor);
    compressor.connect(contexto.destination);
    mestre.connect(eco);
    eco.connect(ganhoDoEco);
    ganhoDoEco.connect(compressor);
    mestre.gain.value = volumeAtual() * TETO;

    assinarPreferencia(aplicarVolume);
  } catch {
    contexto = null;
  }
  return contexto;
}

export function saidaMestre(): GainNode | null {
  audio();
  return mestre;
}

export function aplicarVolume(): void {
  if (!contexto || !mestre) return;
  mestre.gain.cancelScheduledValues(contexto.currentTime);
  mestre.gain.linearRampToValueAtTime(volumeAtual() * TETO, contexto.currentTime + 0.2);
}

export function estaMudo(): boolean {
  return volumeAtual() <= 0;
}

/**
 * Retoma o contexto quando o navegador o suspendeu — acontece no primeiro
 * gesto da página e toda vez que a aba volta do segundo plano.
 */
export function acordar(): void {
  const c = audio();
  if (c && c.state === 'suspended') void c.resume();
  aplicarVolume();
}

export interface Voz {
  midi: number;
  duracao: number;
  onda?: OscillatorType;
  ganho?: number;
  ataque?: number;
  /** Corte do passa-baixa, em Hz. */
  corte?: number;
}

export function hz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Uma nota: oscilador → passa-baixa → envelope → mestre. */
export function tocarVoz({ midi, duracao, onda = 'triangle', ganho = 0.1, ataque = 0.015, corte = 5000 }: Voz): void {
  const c = audio();
  const saida = saidaMestre();
  if (!c || !saida || !midi || estaMudo()) return;

  try {
    const agora = c.currentTime;
    const oscilador = c.createOscillator();
    const envelope = c.createGain();
    const filtro = c.createBiquadFilter();

    oscilador.type = onda;
    oscilador.frequency.value = hz(midi);
    filtro.type = 'lowpass';
    filtro.frequency.value = corte;

    // Rampa exponencial não aceita zero — daí o 0.0001 nas duas pontas.
    envelope.gain.setValueAtTime(0.0001, agora);
    envelope.gain.exponentialRampToValueAtTime(ganho, agora + ataque);
    envelope.gain.exponentialRampToValueAtTime(0.0001, agora + duracao);

    oscilador.connect(filtro);
    filtro.connect(envelope);
    envelope.connect(saida);
    oscilador.start(agora);
    oscilador.stop(agora + duracao + 0.04);
  } catch {
    /* silencioso: áudio pode estar bloqueado pelo navegador */
  }
}
