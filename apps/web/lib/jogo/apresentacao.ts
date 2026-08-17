/**
 * Ícone, título e texto de cada sala. A cidade e a masmorra têm as mesmas
 * quatro funções na engine, com tipos de célula diferentes — é o
 * `currentModule()` de `ui.js`, agora escolhido uma vez só.
 *
 * Os `as` daqui são o preço de estreitar `EstadoDoJogo` (união por
 * `mapMode`) e depois percorrer a grade célula a célula: o compilador perde
 * a ligação entre `mapMode` e o tipo das células no meio do `map()`. Ficam
 * confinados neste módulo em vez de espalhados pelos componentes, e cada um
 * está do lado do `mapMode` que o garante.
 */

import {
  cityEntryText,
  cityIconFor,
  cityRoomDesc,
  cityShortLabel,
  entryText,
  iconFor,
  isBossFloor,
  roomDesc,
  shortLabel,
  type CityCell,
  type DungeonCell,
} from '@rpg-legend/shared';

import type { CelulaDoMapa, EstadoDoJogo } from './estado';

export interface Apresentacao {
  /** Nome do lugar inteiro: "Cidade Inicial" ou "Masmorra — Andar 3". */
  lugar: string;
  /** Legenda do minimapa, na ordem em que o original mostrava. */
  legenda: Array<[string, string]>;
  icone: (celula: CelulaDoMapa) => string;
  descricao: (celula: CelulaDoMapa) => string;
  textoDeEntrada: (celula: CelulaDoMapa) => string;
  /** Nome curto pra citar a sala de fora dela ("um baú fechado"), usado nas pistas de porta. */
  rotulo: (celula: CelulaDoMapa) => string;
}

const LEGENDA_DA_CIDADE: Array<[string, string]> = [
  ['🚀', 'Início'],
  ['🧙', 'NPC'],
  ['🏵', 'Vendedor'],
  ['🔨', 'Ferreiro'],
  ['🍺', 'Taverna'],
  ['📜', 'Missões'],
  ['🌟', 'Portão da Masmorra'],
];

const LEGENDA_DA_MASMORRA: Array<[string, string]> = [
  ['🚀', 'Início'],
  ['🧙', 'NPC'],
  ['🧰', 'Baú'],
  ['👾', 'Monstro'],
  ['👑', 'Chefe'],
  ['⬇️', 'Escadas'],
  ['🚪', 'Saída'],
  ['❓', 'Evento'],
];

export function apresentacaoDe(estado: EstadoDoJogo): Apresentacao {
  if (estado.mapMode === 'city') {
    return {
      lugar: 'Cidade Inicial',
      legenda: LEGENDA_DA_CIDADE,
      icone: (celula) => cityIconFor(celula as CityCell),
      descricao: (celula) => cityRoomDesc(celula as CityCell),
      textoDeEntrada: (celula) => cityEntryText(celula as CityCell),
      rotulo: (celula) => cityShortLabel(celula as CityCell),
    };
  }

  return {
    lugar: `Masmorra — Andar ${estado.floor}${isBossFloor(estado.floor) ? ' ⚔️ Andar de Chefe' : ''}`,
    legenda: LEGENDA_DA_MASMORRA,
    icone: (celula) => iconFor(celula as DungeonCell),
    descricao: (celula) => roomDesc(celula as DungeonCell),
    textoDeEntrada: (celula) => entryText(celula as DungeonCell),
    rotulo: (celula) => shortLabel(celula as DungeonCell),
  };
}
