/**
 * Minimapa com a mesma neblina do original: sala visitada aparece inteira,
 * sala vizinha de uma visitada aparece como silhueta, e o resto não
 * aparece. A regra mora em `isKnown()` na engine.
 *
 * O ícone, o rótulo e o "já esvaziei" vêm de fora (`apresentacaoDe`) porque
 * cidade e masmorra desenham a mesma grade com catálogos diferentes.
 *
 * **A cor só entra em sala visitada.** A silhueta de uma sala vizinha diz
 * que ela existe, não o que tem dentro — pintá-la pelo tipo entregaria o
 * baú e o chefe antes de o jogador chegar lá, que é justamente o que a
 * neblina existe pra impedir. O original fazia a mesma separação:
 * `room-dim` era cinza chapado, e só `room-known` ganhava a classe do tipo.
 */

import { isKnown } from '@rpg-legend/shared';

import type { CelulaDoMapa, Posicao } from '@/lib/jogo/estado';
import styles from './jogo.module.css';

interface Props {
  grade: CelulaDoMapa[][];
  posicao: Posicao;
  linhas: number;
  colunas: number;
  icone: (celula: CelulaDoMapa) => string;
  /** Nome curto da sala, pra quem lê a tela por leitor de tela em vez de cor. */
  rotulo: (celula: CelulaDoMapa) => string;
  gasta: (celula: CelulaDoMapa) => boolean;
  descricao: string;
}

export function Mapa({ grade, posicao, linhas, colunas, icone, rotulo, gasta, descricao }: Readonly<Props>) {
  return (
    <div className={styles.grade} style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }} role="grid" aria-label={descricao}>
      {grade.slice(0, linhas).flatMap((linha, y) =>
        linha.slice(0, colunas).map((celula, x) => {
          const aqui = x === posicao.x && y === posicao.y;
          const vazia = celula.type === 'void';
          const conhecida = !vazia && isKnown(grade, celula, colunas, linhas);

          let classe = styles.vazia;
          if (celula.visited) classe = styles.visitada;
          else if (conhecida) classe = styles.conhecida;
          else if (!vazia) classe = styles.desconhecida;

          const esgotada = Boolean(celula.visited) && gasta(celula);

          let dentro = '';
          if (aqui) dentro = '🧍';
          else if (celula.visited) dentro = icone(celula);

          return (
            <div
              key={`${x},${y}`}
              role="gridcell"
              // A cor distingue sala de sala pra quem enxerga; o rótulo faz
              // o mesmo trabalho pra quem não. Sem ele, a informação que a
              // cor passou a carregar simplesmente não existiria no áudio.
              aria-label={legendaDaCelula({ x, y, aqui, vazia, visitada: !!celula.visited, conhecida, esgotada, rotulo: rotulo(celula) })}
              data-tipo={celula.visited ? celula.type : undefined}
              className={`${styles.celula} ${classe} ${aqui ? styles.aqui : ''} ${esgotada ? styles.esgotada : ''}`}
            >
              {dentro}
            </div>
          );
        }),
      )}
    </div>
  );
}

interface DadosDaCelula {
  x: number;
  y: number;
  aqui: boolean;
  vazia: boolean;
  visitada: boolean;
  conhecida: boolean;
  esgotada: boolean;
  rotulo: string;
}

function legendaDaCelula(dados: DadosDaCelula): string {
  const onde = `${dados.x},${dados.y}`;
  if (dados.vazia) return `${onde}: vazio`;
  if (dados.aqui) return `${onde}: você está aqui`;
  if (dados.visitada) return `${onde}: ${dados.rotulo}${dados.esgotada ? ', já resolvida' : ''}`;
  if (dados.conhecida) return `${onde}: sala conhecida, ainda não visitada`;
  return `${onde}: inexplorado`;
}
