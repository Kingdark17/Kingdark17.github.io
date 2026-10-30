/**
 * As salas emendadas da masmorra (2026-10-30, pedido do Breno, site e app):
 * a sala vizinha fica colada do outro lado da porta, o herói passa de uma
 * pra outra andando (`continuarNaVizinha`, em `room-walk.ts`) e a câmera vai
 * com ele. Por isso quem desenha precisa das salas em volta da atual, e não
 * só dela.
 *
 * Decisão do usuário: a vizinha em que ele ainda não entrou aparece na
 * sombra, só paredes e chão — o que tem dentro (monstro, baú, loja) só se vê
 * ao entrar, e a neblina do minimapa continua valendo.
 *
 * A sala secreta atrás da parede rachada fica fora da grade, e continua uma
 * cena à parte. A cidade já é um mapa só e não passa por aqui.
 */

import { DIR_ORDER, inBounds, type Direction } from '../dungeon/graph.js';
import { celulaEm, type CelulaDoMapa, type EstadoDoJogo } from './estado.js';
import { passagemSecreta } from './extras.js';
import { estadoDaSala } from './neblina.js';

export interface SalaEmVolta {
  /** A posição dela na grade do andar. */
  x: number;
  y: number;
  /** Quantas salas ela fica da atual em cada eixo: -1, 0 ou 1. */
  dx: number;
  dy: number;
  celula: CelulaDoMapa;
  /** A atual, ou uma em que o herói já entrou: desenhada com o que tem dentro. As outras ficam na sombra. */
  acesa: boolean;
  /** As portas que a planta dela abre (`portasDaPlanta`). */
  portas: Direction[];
}

/**
 * As salas do quadrado de 3 × 3 em volta da atual, ela inclusive, de cima
 * pra baixo e da esquerda pra direita. Casa da grade sem sala fica de fora.
 * Fora da masmorra, nenhuma.
 */
export function salasEmVolta(estado: EstadoDoJogo): SalaEmVolta[] {
  if (estado.mapMode !== 'dungeon') return [];
  const salas: SalaEmVolta[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = estado.pos.x + dx;
      const y = estado.pos.y + dy;
      if (!inBounds(x, y, estado.mapCols, estado.mapRows)) continue;
      const celula = celulaEm(estado, { x, y });
      if (!celula || celula.type === 'void') continue;
      const atual = dx === 0 && dy === 0;
      const visitada = estadoDaSala(estado.map, celula, estado.mapCols, estado.mapRows) === 'visitada';
      salas.push({ x, y, dx, dy, celula, acesa: atual || visitada, portas: portasDaPlanta(celula) });
    }
  }
  return salas;
}

/** As portas da planta de uma sala: as do mapa e o vão da parede rachada já aberta, que leva à sala secreta. */
export function portasDaPlanta(celula: CelulaDoMapa | null): Direction[] {
  if (!celula) return [];
  const passagem = passagemSecreta(celula)?.lado ?? null;
  return DIR_ORDER.filter((lado) => Boolean(celula.doors?.[lado]) || lado === passagem);
}
