/**
 * Quanto o jogador sabe de cada sala do minimapa.
 *
 * Isto morava solto dentro do JSX do `mapa.tsx`, como quatro booleanos
 * encadeados, e **por isso o bug do prisioneiro durou**: não havia onde
 * escrever um teste sem montar ambiente DOM, então nada cobria a regra
 * mais fácil de errar da tela. Aqui é função pura sobre a grade, igual ao
 * resto de `lib/jogo/`.
 *
 * São cinco estados, e o que separa `revelada` de `silhueta` é a diferença
 * que o minimapa estava perdendo:
 *
 * | Estado | Como se chega | O que a tela mostra |
 * | `vazia` | não é sala | nada |
 * | `inexplorada` | nem vizinha de visitada | caixa apagada, sem tipo |
 * | `silhueta` | vizinha de visitada, pela porta | caixa cinza, sem tipo |
 * | `revelada` | **lhe contaram** o que tem | cor, arte e ícone, apagados |
 * | `visitada` | entrou | cor, arte e ícone, cheios |
 *
 * `revealed` só é marcado em dois lugares, e os dois são conhecimento que
 * a pessoa conquistou: o serviço do prisioneiro (`resolveReveal`), que ela
 * pagou, e a sala que fez o jogo perguntar "deseja entrar?" (`revelar`),
 * onde a caixa **já mostrou o ícone e o nome** antes de ela dizer não.
 * Mostrar no mapa não entrega nada que o jogo não tenha dito em voz alta.
 *
 * `silhueta` é o caso que a neblina existe pra proteger, e continua
 * protegido: ela sai de graça, só por a sala fazer porta com uma visitada,
 * e pintá-la entregaria o baú e o chefe antes de o jogador chegar lá.
 */

import { isKnown } from '@rpg-legend/shared';

import type { CelulaDoMapa } from './estado';

export type EstadoDaSala = 'vazia' | 'inexplorada' | 'silhueta' | 'revelada' | 'visitada';

export function estadoDaSala(grade: CelulaDoMapa[][], celula: CelulaDoMapa, colunas: number, linhas: number): EstadoDaSala {
  if (celula.type === 'void') return 'vazia';
  if (celula.visited) return 'visitada';
  if (celula.revealed) return 'revelada';
  return isKnown(grade, celula, colunas, linhas) ? 'silhueta' : 'inexplorada';
}

/**
 * O jogador sabe o que tem nesta sala? É o que libera cor, arte e ícone.
 *
 * Existe separado de `estadoDaSala` porque é a pergunta que a tela faz
 * três vezes seguidas, e repetir a comparação com duas strings em cada uma
 * é como o `revealed` ficou de fora na primeira vez.
 */
export function sabeOTipo(estado: EstadoDaSala): boolean {
  return estado === 'visitada' || estado === 'revelada';
}
