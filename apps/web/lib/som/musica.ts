/**
 * A trilha do jogo — sintetizada nota a nota, sem nenhum arquivo de áudio.
 * É o `js/music.js` do cliente antigo: as melodias, os baixos, os acordes e
 * os cinco temas são os mesmos números, pra a trilha soar idêntica.
 *
 * **Quem manda no tema agora é a tela.** O original perguntava ao estado
 * global de meio em meio segundo (`setInterval(refresh, 500)`) em que tema
 * deveria estar. Aqui `pedirTema` é chamado quando a cena muda — o
 * relógio que sobrou é o do compasso, que é o que precisa mesmo de um.
 */

import { acordar, audio, estaMudo, saidaMestre, tocarVoz } from './audio';

export type Tema = 'menu' | 'city' | 'dungeon' | 'combat' | 'boss';

type Timbre = 'harp' | 'celtic' | 'dark' | 'battle' | 'boss';

interface Musica {
  /** Duração do passo, em milissegundos. */
  compasso: number;
  melodia: number[];
  baixo: number[];
  acordes: number[][];
  timbre: Timbre;
}

const TEMAS: Record<Tema, Musica> = {
  menu: {
    compasso: 470,
    melodia: [62, 65, 69, 67, 65, 62, 60, 57, 62, 65, 69, 72, 69, 67, 65, 0],
    baixo: [38, 38, 41, 41],
    acordes: [
      [50, 53, 57],
      [48, 53, 57],
    ],
    timbre: 'harp',
  },
  city: {
    compasso: 330,
    melodia: [69, 72, 74, 76, 74, 72, 69, 67, 69, 72, 76, 79, 76, 74, 72, 0, 67, 69, 72, 74, 72, 69, 67, 64, 67, 72, 74, 76, 74, 72, 69, 0],
    baixo: [45, 45, 43, 43, 41, 41, 43, 43],
    acordes: [
      [57, 60, 64],
      [55, 59, 62],
      [53, 57, 60],
      [55, 59, 62],
    ],
    timbre: 'celtic',
  },
  dungeon: {
    compasso: 520,
    melodia: [45, 0, 48, 0, 46, 0, 41, 0, 43, 0, 46, 0, 41, 0, 40, 0],
    baixo: [33, 33, 31, 31],
    acordes: [
      [45, 48, 52],
      [43, 46, 50],
    ],
    timbre: 'dark',
  },
  combat: {
    compasso: 185,
    melodia: [57, 57, 60, 62, 57, 64, 62, 60, 55, 55, 59, 60, 55, 62, 60, 59],
    baixo: [33, 33, 36, 36, 31, 31, 36, 36],
    acordes: [
      [45, 48, 52],
      [43, 47, 50],
    ],
    timbre: 'battle',
  },
  boss: {
    compasso: 225,
    melodia: [45, 45, 46, 48, 45, 52, 50, 48, 43, 43, 45, 46, 43, 50, 48, 46],
    baixo: [28, 28, 31, 31, 26, 26, 31, 31],
    acordes: [
      [40, 45, 48],
      [38, 43, 46],
    ],
    timbre: 'boss',
  },
};

let atual: Tema | null = null;
let relogio: ReturnType<typeof setInterval> | null = null;
let passo = 0;
let ligada = false;

function harpa(midi: number, segundos: number): void {
  tocarVoz({ midi, duracao: segundos * 0.72, onda: 'triangle', ganho: 0.13, ataque: 0.008, corte: 4200 });
  tocarVoz({ midi: midi + 12, duracao: segundos * 0.38, onda: 'sine', ganho: 0.045, ataque: 0.006, corte: 5200 });
}

function flauta(midi: number, segundos: number): void {
  tocarVoz({ midi, duracao: segundos * 1.65, onda: 'sine', ganho: 0.075, ataque: 0.12, corte: 3600 });
  tocarVoz({ midi: midi + 12, duracao: segundos * 1.2, onda: 'triangle', ganho: 0.018, ataque: 0.14, corte: 3000 });
}

function almofada(notas: number[], segundos: number, sombrio: boolean): void {
  notas.forEach((nota, indice) => {
    tocarVoz({
      midi: nota,
      duracao: segundos * 4.1,
      onda: sombrio ? 'sawtooth' : 'sine',
      ganho: sombrio ? 0.025 : 0.035,
      ataque: 0.35,
      corte: sombrio ? 700 : 1700,
    });
    if (indice === 0) tocarVoz({ midi: nota - 12, duracao: segundos * 4, onda: 'sine', ganho: 0.025, ataque: 0.3, corte: 900 });
  });
}

/** Tambor: seno caindo de frequência, que é o que dá o "bum" sem sample. */
function tambor(forte: boolean, sombrio: boolean): void {
  const c = audio();
  const saida = saidaMestre();
  if (!c || !saida || estaMudo()) return;

  try {
    const agora = c.currentTime;
    const oscilador = c.createOscillator();
    const envelope = c.createGain();
    oscilador.type = 'sine';
    oscilador.frequency.setValueAtTime(forte ? (sombrio ? 78 : 105) : 145, agora);
    oscilador.frequency.exponentialRampToValueAtTime(45, agora + 0.13);
    envelope.gain.setValueAtTime(forte ? 0.16 : 0.07, agora);
    envelope.gain.exponentialRampToValueAtTime(0.0001, agora + 0.15);
    oscilador.connect(envelope);
    envelope.connect(saida);
    oscilador.start(agora);
    oscilador.stop(agora + 0.17);
  } catch {
    /* silencioso */
  }
}

function compassoDoTema(musica: Musica): void {
  const segundos = musica.compasso / 1000;
  const nota = musica.melodia[passo % musica.melodia.length] ?? 0;
  const sombrio = musica.timbre === 'dark' || musica.timbre === 'boss';

  if (passo % 4 === 0) {
    almofada(musica.acordes[Math.floor(passo / 4) % musica.acordes.length] ?? [], segundos, sombrio);
    tocarVoz({
      midi: musica.baixo[Math.floor(passo / 4) % musica.baixo.length] ?? 0,
      duracao: segundos * 3.5,
      onda: 'sine',
      ganho: musica.timbre === 'boss' ? 0.11 : 0.065,
      ataque: 0.03,
      corte: 600,
    });
  }

  if (musica.timbre === 'celtic') {
    if (nota) harpa(nota, segundos);
    if (passo % 8 === 4) flauta(nota + 12, segundos);
  } else if (musica.timbre === 'harp') {
    if (nota) harpa(nota, segundos);
    if (passo % 8 === 0) flauta(nota + 12, segundos);
  } else if (musica.timbre === 'dark') {
    if (nota) flauta(nota + 12, segundos);
    if (passo % 8 === 0) {
      const grave = (musica.baixo[Math.floor(passo / 4) % musica.baixo.length] ?? 0) - 12;
      tocarVoz({ midi: grave, duracao: segundos * 7, onda: 'sine', ganho: 0.07, ataque: 0.45, corte: 450 });
    }
  } else if (musica.timbre === 'battle') {
    if (nota) harpa(nota, segundos);
    tambor(passo % 4 === 0, false);
  } else {
    if (nota) tocarVoz({ midi: nota, duracao: segundos * 0.82, onda: 'sawtooth', ganho: 0.085, ataque: 0.025, corte: 1100 });
    tambor(passo % 4 === 0, true);
    if (passo % 8 === 0) tocarVoz({ midi: nota - 12, duracao: segundos * 6, onda: 'sawtooth', ganho: 0.06, ataque: 0.25, corte: 650 });
  }

  passo += 1;
}

function trocarPara(tema: Tema): void {
  atual = tema;
  passo = 0;
  if (relogio) clearInterval(relogio);
  const musica = TEMAS[tema];
  relogio = setInterval(() => compassoDoTema(musica), musica.compasso);
  compassoDoTema(musica);
}

/**
 * Só toca depois de um gesto — política de autoplay de todo navegador. A
 * tela chama isto no primeiro clique ou tecla.
 */
export function ligarMusica(tema: Tema): void {
  if (ligada) return;
  if (!audio()) return;
  ligada = true;
  acordar();
  trocarPara(tema);
}

export function pedirTema(tema: Tema): void {
  if (!ligada || tema === atual) return;
  trocarPara(tema);
}

export function pararMusica(): void {
  if (relogio) clearInterval(relogio);
  relogio = null;
  ligada = false;
  atual = null;
}

export function temaAtual(): Tema | null {
  return atual;
}
