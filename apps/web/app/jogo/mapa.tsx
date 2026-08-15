/**
 * Minimapa com a mesma neblina do original: sala visitada aparece inteira,
 * sala vizinha de uma visitada aparece como silhueta, e o resto não
 * aparece. A regra mora em `isKnown()` na engine.
 *
 * O ícone vem de fora (`apresentacaoDe`) porque cidade e masmorra desenham
 * a mesma grade com catálogos diferentes.
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
  descricao: string;
}

export function Mapa({ grade, posicao, linhas, colunas, icone, descricao }: Props) {
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

          return (
            <div
              key={`${x},${y}`}
              role="gridcell"
              aria-label={celula.visited ? `${x},${y}: visitada` : `${x},${y}`}
              className={`${styles.celula} ${classe} ${aqui ? styles.aqui : ''}`}
            >
              {aqui ? '🧍' : celula.visited ? icone(celula) : ''}
            </div>
          );
        }),
      )}
    </div>
  );
}
