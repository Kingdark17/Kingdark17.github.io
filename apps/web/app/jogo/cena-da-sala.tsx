'use client';

/**
 * A sala com o herói andando solto (decisão do usuário, 2026-10-11: andar
 * livre estilo Isaac). O desenho é de `lib/jogo/desenho-da-sala.ts`, com
 * PixiJS; a regra de andar é da engine, com o relógio do site em
 * `jogo/andar-na-sala.ts` (na engine). Este componente roda o andar a cada quadro e
 * avisa a tela quando algo acontece: o herói atravessou uma porta
 * (`onSaida`) ou encostou no conteúdo da sala (`onEncostar`).
 *
 * Onde o herói está fica num `ref` da tela (`posicao`), fora do React: muda
 * 60 vezes por segundo, e um render por passo derrubaria a tela no celular.
 * O React só fica sabendo das portas e dos encostões. E é da tela, não
 * daqui, porque esta cena desmonta quando uma loja ou uma luta abre por
 * cima — e quem fecha a loja continua no balcão.
 *
 * O PixiJS é buscado aqui dentro, com `import()`, e não no topo do
 * arquivo: assim ele vira um pedaço à parte e só baixa quando a exploração
 * aparece (o guia de lazy loading do Next diz o mesmo pra biblioteca de
 * terceiros).
 *
 * O canvas é enfeite pra quem lê a tela com leitor: a narração em texto ao
 * lado continua dizendo o que tem na sala e por onde dá pra ir.
 *
 * Na masmorra as salas são emendadas (2026-10-30): com `salas`, a cena
 * desenha as em volta da atual e a câmera segue o herói; `origem` é a sala
 * em que ele está, e a posição dele é contada do canto dela.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';

import { ROOM_COLS, ROOM_ROWS, andarNoQuadro, passosDoQuadro, type Direction, type DungeonId, type PosicaoNaSala, type RoomLayout, type Vetor, type Walker } from '@rpg-legend/shared';

import { criarCena, type Cena, type Figura, type OrigemDaSala, type SalaDesenhada, type TemaDaSala } from '@/lib/jogo/desenho-da-sala';
import styles from './jogo.module.css';

interface Props {
  /** Muda quando o jogador troca de sala: aí o herói aparece em `chegada`. */
  sala: string;
  planta: RoomLayout;
  /**
   * Na cidade: a cidade desenhada do Breno no lugar da sala, e se os troncos
   * ainda estão no caminho da caverna. `null` na masmorra.
   */
  cidade: { troncos: boolean } | null;
  tema: TemaDaSala;
  /** Na masmorra: qual, pra desenhar a sala dela quando tem arte (a Floresta do Breno). `null` na cidade. */
  masmorra: DungeonId | null;
  /** A figura de cada objeto da planta (conteúdo e extras), pelo id. */
  figuras: Readonly<Record<string, Figura>>;
  /**
   * Na masmorra emendada: as salas em volta da atual (ela inclusive), cada uma no lugar dela. Ausente na cidade e
   * na sala secreta, que é desenhada sozinha.
   */
  salas?: readonly SalaDesenhada[] | null;
  /** A sala em que o herói está, na grade do andar (com `salas`). */
  origem?: OrigemDaSala | null;
  heroi: Figura;
  /** Onde o herói aparece nesta sala. */
  chegada: Walker;
  /** Onde ele está agora — da tela, pra sobreviver à cena desmontar. */
  posicao: RefObject<PosicaoNaSala>;
  /** Só anda quando a exploração está livre — sem tela, pergunta ou conversa na frente. */
  ativo: boolean;
  /** Lida a cada quadro: as teclas e o joystick, de -1 a 1. */
  entrada: () => Vetor;
  /** Atravessou o vão desta porta. Devolve se a sala mudou; se não, o herói volta pra dentro. */
  onSaida: (direcao: Direction) => boolean;
  /** Encostou neste objeto agora. */
  onEncostar: (id: string) => void;
  /** O que vai por cima da sala (o joystick). */
  children?: ReactNode;
}

export function CenaDaSala({
  sala,
  planta,
  cidade,
  tema,
  masmorra,
  figuras,
  salas = null,
  origem = null,
  heroi,
  chegada,
  posicao,
  ativo,
  entrada,
  onSaida,
  onEncostar,
  children,
}: Readonly<Props>) {
  const alvo = useRef<HTMLDivElement>(null);
  const cena = useRef<Cena | null>(null);
  const [pronta, setPronta] = useState(false);

  // O relógio do Pixi lê os valores mais recentes por aqui, sem reassinar a cada render.
  const atual = useRef({ sala, planta, chegada, origem, posicao, ativo, entrada, onSaida, onEncostar });
  useEffect(() => {
    atual.current = { sala, planta, chegada, origem, posicao, ativo, entrada, onSaida, onEncostar };
  });
  /** O tempo que sobrou do quadro anterior, e de que sala o herói já saiu (esperando a vizinha chegar). */
  const relogio = useRef<{ sobra: number; saiuDe: string | null }>({ sobra: 0, saiuDe: null });

  // Uma cena por boneco: trocar de raça (ADM) refaz; andar não.
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const pixi = await import('pixi.js');
      if (cancelado || !alvo.current) return;
      const criada = await criarCena(pixi, alvo.current, heroi);
      // Desmontou enquanto o PixiJS iniciava (o StrictMode faz isso no
      // desenvolvimento): a cena nasceu órfã e sai junto.
      if (cancelado) {
        criada.destruir();
        return;
      }
      cena.current = criada;
      setPronta(true);
    })();
    return () => {
      cancelado = true;
      cena.current?.destruir();
      cena.current = null;
      setPronta(false);
    };
  }, [heroi]);

  const troncos = cidade ? cidade.troncos : null;
  useEffect(() => {
    if (!pronta) return;
    if (troncos !== null) void cena.current?.desenharCidade(troncos);
    else if (salas) void cena.current?.desenharMasmorra(salas, tema, masmorra);
    else void cena.current?.desenharSala(planta, tema, figuras, masmorra);
  }, [pronta, planta, tema, figuras, salas, troncos, masmorra]);

  useEffect(() => {
    const desenho = cena.current;
    if (!pronta || !desenho) return;
    return desenho.aCadaQuadro((decorridoMs) => {
      const agora = atual.current;
      const p = agora.posicao.current;
      const r = relogio.current;
      if (p.sala !== agora.sala) {
        p.sala = agora.sala;
        p.walker = agora.chegada;
        p.tocando = null;
        r.sobra = 0;
        // Já é outra sala: a de que ele saiu pela porta não segura mais o andar (voltar à mesma chave sem passar
        // por outra porta — morrer na vizinha e entrar de novo pelo portão — deixava o herói parado).
        r.saiuDe = null;
      }
      if (!agora.ativo || r.saiuDe === p.sala) {
        r.sobra = 0;
        desenho.colocarHeroi(p.walker, false, agora.origem);
        return;
      }

      const { passos, sobra } = passosDoQuadro(r.sobra, decorridoMs);
      r.sobra = sobra;
      const antes = p.walker;
      const quadro = andarNoQuadro(agora.planta, antes, agora.entrada(), passos, p.tocando);
      p.walker = quadro.walker;
      p.tocando = quadro.tocando;

      if (quadro.saida) {
        // A sala vizinha chega no próximo render; até lá, não anda mais nesta.
        if (agora.onSaida(quadro.saida)) r.saiuDe = p.sala;
        else p.walker = antes;
      } else if (quadro.encostou) {
        agora.onEncostar(quadro.encostou);
      }
      desenho.colocarHeroi(p.walker, quadro.andou, agora.origem);
    });
  }, [pronta]);

  // A caixa tem o formato da sala (a Torre é 11 × 12); a cidade é vista por uma janela de sala de sempre.
  const formato = {
    '--colunas': cidade ? ROOM_COLS : (planta.cols ?? ROOM_COLS),
    '--linhas': cidade ? ROOM_ROWS : (planta.rows ?? ROOM_ROWS),
  } as CSSProperties;

  return (
    <div className={styles.cenaDaSala} style={formato}>
      <div ref={alvo} className={styles.telaDaSala} />
      {children}
    </div>
  );
}
