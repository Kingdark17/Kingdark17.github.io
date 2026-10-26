/**
 * Como cada objeto da sala é desenhado: o conteúdo (o ícone do minimapa) e
 * os extras — baú pequeno, vaso, placa, parede rachada — e o baú da sala
 * secreta. Arte provisória: o baú reaproveita o do mapa; vaso e placa são
 * emoji até o Breno desenhar.
 *
 * A tela passa o que há na sala como **texto** (`assinaturaDosExtras`,
 * `chaveDosObjetos`), e não como a célula: assim a planta e as figuras só
 * mudam quando algo na sala muda, e o React Compiler não precisa supor que
 * a célula muda depois do render.
 */

import { ID_DO_BAU_SECRETO, ID_DO_CONTEUDO, extrasDe, idDoExtra, objetosDaSala, type CelulaDoMapa, type DungeonId, type RoomObject } from '@rpg-legend/shared';

import type { Figura } from './desenho-da-sala';
import { arteDoTipo } from './icones-do-mapa';

/** Os extras da sala como texto: o tipo de cada um e, colado, `*` se já foi usado e `$` se o baú secreto já foi aberto. */
export function assinaturaDosExtras(celula: CelulaDoMapa | null): string {
  return extrasDe(celula)
    .map((e) => `${e.kind}${e.used ? '*' : ''}${e.secretCollected ? '$' : ''}`)
    .join(',');
}

/** Os objetos da planta como texto, pra memorizar pela chave. A masmorra muda onde cai o extra de um canto que a arte dela fecha. */
export function chaveDosObjetos(celula: CelulaDoMapa | null, temConteudo: boolean, masmorra: DungeonId | null): string {
  return objetosDaSala(celula, temConteudo, masmorra)
    .map((o) => `${o.id}:${o.col}:${o.row}`)
    .join('|');
}

/** O caminho de volta de `chaveDosObjetos`. */
export function lerObjetos(chave: string): RoomObject[] {
  if (!chave) return [];
  return chave.split('|').map((pedaco) => {
    const [id = '', col = '0', row = '0'] = pedaco.split(':');
    return { id, col: Number(col), row: Number(row) };
  });
}

const BAU = arteDoTipo('treasure');

/**
 * As figuras pelo id do objeto. Na sala secreta (`indiceDaSecreta`), só o
 * baú dela, apagado quando já foi aberto.
 */
export function figurasDaSala(conteudo: Figura | null, assinatura: string, indiceDaSecreta: number | null): Record<string, Figura> {
  const extras = assinatura ? assinatura.split(',') : [];
  if (indiceDaSecreta !== null) {
    const parede = extras[indiceDaSecreta] ?? '';
    return { [ID_DO_BAU_SECRETO]: { arte: BAU, emoji: '🧰', apagada: parede.includes('$') } };
  }

  const figuras: Record<string, Figura> = {};
  if (conteudo) figuras[ID_DO_CONTEUDO] = conteudo;
  extras.forEach((sinal, indice) => {
    const tipo = sinal.replace(/[*$]/g, '');
    const usado = sinal.includes('*');
    const id = idDoExtra(indice);
    if (tipo === 'chest') figuras[id] = { arte: BAU, emoji: '🧰', escala: 0.75, apagada: usado };
    if (tipo === 'pot') figuras[id] = { arte: null, emoji: '🏺', escala: 0.85 };
    if (tipo === 'sign') figuras[id] = { arte: null, emoji: '🪧', escala: 0.85 };
    if (tipo === 'crack') figuras[id] = { arte: null, emoji: '', forma: 'rachadura' };
  });
  return figuras;
}
