/* eslint-disable @next/next/no-img-element */

/**
 * Minimapa com a mesma neblina do original: sala visitada aparece inteira,
 * sala vizinha de uma visitada aparece como silhueta, e o resto não
 * aparece. A regra mora em `isKnown()` na engine.
 *
 * O ícone, o rótulo e o "já esvaziei" vêm de fora (`apresentacaoDe`) porque
 * cidade e masmorra desenham a mesma grade com catálogos diferentes.
 *
 * **A cor e o ícone só entram em sala cujo tipo o jogador já sabe.** A
 * silhueta de uma sala vizinha diz que ela existe, não o que tem dentro —
 * pintá-la pelo tipo entregaria o baú e o chefe antes de o jogador chegar
 * lá, que é justamente o que a neblina existe pra impedir. O original
 * fazia a mesma separação: `room-dim` era cinza chapado, e só `room-known`
 * ganhava a classe do tipo.
 *
 * **Saber não é o mesmo que ter pisado**, e essa diferença estava perdida
 * aqui. São três estados, não dois:
 *
 * | Estado | Como se chega | O que aparece |
 * | `visited` | entrou | cor, arte e ícone, sem apagar |
 * | `revealed` | **lhe contaram** | cor, arte e ícone, apagado |
 * | vizinha de visitada | de graça, pela porta | só a silhueta |
 *
 * O `revealed` só é marcado em dois lugares, e os dois são conhecimento
 * legítimo: o serviço do prisioneiro, que a pessoa **pagou**, e a sala que
 * fez o jogo perguntar "deseja entrar?" — onde a caixa já mostrou o ícone
 * e o nome antes de ela dizer não. Mostrar no mapa não entrega nada: faz o
 * mapa lembrar o que o jogo já disse em voz alta.
 *
 * Enquanto os dois primeiros estados estavam colados, o prisioneiro
 * **não fazia nada visível** — era o bug do doc do Breno. A sala revelada
 * ficava idêntica a uma vizinha qualquer de sala visitada.
 */

import type { CelulaDoMapa, Posicao } from '@/lib/jogo/estado';
import { arteDoTipo, MARCADOR_DO_JOGADOR } from '@/lib/jogo/icones-do-mapa';
import { estadoDaSala, sabeOTipo, type EstadoDaSala } from '@/lib/jogo/neblina';
import styles from './jogo.module.css';

/** `Record` completo: estado novo na névoa sem classe aqui vira erro de compilação. */
const CLASSE_DO_ESTADO: Record<EstadoDaSala, string> = {
  vazia: styles.vazia,
  inexplorada: styles.desconhecida,
  silhueta: styles.conhecida,
  // A cor vem do `data-tipo`; o que esta classe traz é a opacidade que diz
  // "você sabe o que tem aqui, mas não pisou".
  revelada: styles.conhecida,
  visitada: styles.visitada,
};

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
          const estado = estadoDaSala(grade, celula, colunas, linhas);
          const mostraOTipo = sabeOTipo(estado);
          const esgotada = estado === 'visitada' && gasta(celula);

          // Arte quando existe, emoji quando não — o mesmo arranjo do
          // paperdoll e dos pets. `aria-hidden` nos dois: quem lê a tela
          // recebe a sala pelo `aria-label` da célula, e ouvir "baú" duas
          // vezes seguidas é pior que ouvir uma.
          const arte = mostraOTipo ? arteDoTipo(celula.type) : null;

          return (
            <div
              key={`${x},${y}`}
              role="gridcell"
              // A cor distingue sala de sala pra quem enxerga; o rótulo faz
              // o mesmo trabalho pra quem não. Sem ele, a informação que a
              // cor passou a carregar simplesmente não existiria no áudio.
              aria-label={legendaDaCelula({ x, y, aqui, estado, esgotada, rotulo: rotulo(celula) })}
              data-tipo={mostraOTipo ? celula.type : undefined}
              className={`${styles.celula} ${CLASSE_DO_ESTADO[estado]} ${aqui ? styles.aqui : ''} ${esgotada ? styles.esgotada : ''}`}
            >
              {aqui && <img className={styles.marcadorDoJogador} src={MARCADOR_DO_JOGADOR} alt="" aria-hidden />}
              {!aqui && arte && <img className={styles.arteDaSala} src={arte} alt="" aria-hidden />}
              {!aqui && !arte && mostraOTipo && icone(celula)}
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
  estado: EstadoDaSala;
  esgotada: boolean;
  rotulo: string;
}

/**
 * O mesmo que a cor e o ícone dizem, em palavras — e por isso distingue os
 * mesmos estados. Dizer "sala conhecida" de uma sala revelada esconderia
 * de quem ouve a tela exatamente a informação que a pessoa pagou pra ter.
 */
function legendaDaCelula({ x, y, aqui, estado, esgotada, rotulo }: DadosDaCelula): string {
  const onde = `${x},${y}`;
  if (estado === 'vazia') return `${onde}: vazio`;
  if (aqui) return `${onde}: você está aqui`;
  if (estado === 'visitada') return `${onde}: ${rotulo}${esgotada ? ', já resolvida' : ''}`;
  if (estado === 'revelada') return `${onde}: ${rotulo}, ainda não visitada`;
  if (estado === 'silhueta') return `${onde}: sala conhecida, ainda não visitada`;
  return `${onde}: inexplorado`;
}
