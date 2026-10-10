/**
 * O relógio da barra de mira e o que a tela escreve sobre ela.
 *
 * A regra de acerto mora na engine (`lerMira`, `zonaDoAtaque`): aqui fica
 * só o tempo — quanto o cursor leva pra cruzar a barra — e o desenho da
 * zona em porcentagem. Separado do componente pra poder ser testado sem
 * navegador.
 */

import { FAIXA_CRITICA, type LeituraDaMira } from '@rpg-legend/shared';

/**
 * Quanto o cursor leva pra cruzar a barra inteira, da esquerda pra direita.
 * Saiu com 1000 ms; o usuário pediu "um pouco" mais devagar.
 */
export const DURACAO_DA_BARRA_MS = 1400;

/**
 * Onde o cursor está `decorrido` ms depois de sair, de 0 a 1. `null` quando
 * ele já passou do fim — o toque que não veio, que a engine lê como erro.
 */
export function miraNoInstante(decorrido: number): number | null {
  if (decorrido >= DURACAO_DA_BARRA_MS) return null;
  return Math.max(0, decorrido / DURACAO_DA_BARRA_MS);
}

/** Um trecho da barra, em porcentagem da largura. */
export interface Trecho {
  inicio: number;
  largura: number;
}

/** A zona de acerto e a faixa do crítico, as duas centradas na barra. */
export function trechosDaBarra(zona: number): { zona: Trecho; critica: Trecho } {
  return {
    zona: { inicio: (0.5 - zona / 2) * 100, largura: zona * 100 },
    critica: { inicio: (0.5 - FAIXA_CRITICA / 2) * 100, largura: FAIXA_CRITICA * 100 },
  };
}

/** "1,35×", "Crítico! 1,5×" ou "Errou" — o que aparece na barra quando ela para. */
export function rotuloDaLeitura(leitura: LeituraDaMira): string {
  if (!leitura.acerto) return 'Errou';
  const forca = `${String(leitura.forca).replace('.', ',')}×`;
  return leitura.critico ? `Crítico! ${forca}` : forca;
}
