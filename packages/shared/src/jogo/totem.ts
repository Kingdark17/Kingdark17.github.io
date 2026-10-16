/**
 * O totem dos andares 20, 40, 60 e 80. Pedido do usuário (2026-10-09): "a
 * cada 20 andares ele tem um totem de tp pra poder voltar naquele andar".
 * Tocar marca o andar no portão da cidade, pra esta masmorra e esta
 * dificuldade, e oferece a volta pra cidade na hora.
 */

import { runName, touchTotem } from '../dungeon/dungeons.js';
import { voltarParaCidade, type EstadoNaCidade, type EstadoNaMasmorra } from './estado.js';

export interface Totem {
  estado: EstadoNaMasmorra;
  texto: string;
}

export function tocarTotem(estado: EstadoNaMasmorra): Totem {
  const progresso = touchTotem(estado.progresso, estado.masmorra, estado.floor);
  const lugar = `o andar ${estado.floor} de ${runName(estado.masmorra)}`;
  const texto =
    progresso === estado.progresso
      ? `O totem já conhece você: ${lugar} segue marcado no portão da cidade.`
      : `O totem acende quando você o toca. Agora ${lugar} pode ser escolhido no portão da cidade.`;
  return { estado: { ...estado, progresso }, texto };
}

export function voltarPeloTotem(totem: Totem): EstadoNaCidade {
  return voltarParaCidade(totem.estado);
}
