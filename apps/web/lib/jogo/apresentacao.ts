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
  /** Legenda do minimapa: `[tipo de sala, nome]`, na ordem que o original mostrava. */
  legenda: Array<[string, string]>;
  icone: (celula: CelulaDoMapa) => string;
  descricao: (celula: CelulaDoMapa) => string;
  textoDeEntrada: (celula: CelulaDoMapa) => string;
  /** Nome curto pra citar a sala de fora dela ("um baú fechado"), usado nas pistas de porta. */
  rotulo: (celula: CelulaDoMapa) => string;
  /**
   * Sala que já entregou o que tinha: baú aberto, monstro derrotado. O
   * minimapa a apaga, como o `.tile.collected` do original fazia — é o que
   * separa "ainda tem coisa lá" de "já limpei" sem precisar entrar de novo.
   *
   * Mora aqui, e não no componente, pelo mesmo motivo que `icone`: só a
   * masmorra tem esse estado, e o `as` que descobre isso fica confinado
   * neste módulo.
   */
  gasta: (celula: CelulaDoMapa) => boolean;
}

/**
 * A legenda é `[tipo de sala, nome]`, e não `[emoji, nome]` como era.
 *
 * O emoji aqui era uma segunda lista, escrita à mão em paralelo à da engine
 * (`iconFor`/`cityIconFor`). As duas concordavam, mas concordavam por
 * disciplina, não por construção — e uma delas já dizia o que a grade nunca
 * desenhou: **👾 pra "Monstro"**. `iconFor` devolve o ícone da espécie do
 * monstro daquela sala, então 👾 não aparecia em lugar nenhum do mapa.
 *
 * Com o tipo como chave, legenda e grade passam a resolver o desenho pelo
 * mesmo `arteDoTipo`, e é a primeira vez que as duas batem de verdade.
 */
const LEGENDA_DA_CIDADE: Array<[string, string]> = [
  ['start', 'Início'],
  ['npc', 'NPC'],
  ['shop', 'Vendedor'],
  ['blacksmith', 'Ferreiro'],
  ['tavern', 'Taverna'],
  ['questboard', 'Missões'],
  ['gate', 'Portão da Masmorra'],
];

const LEGENDA_DA_MASMORRA: Array<[string, string]> = [
  ['start', 'Início'],
  ['npc', 'NPC'],
  ['treasure', 'Baú'],
  ['monster', 'Monstro'],
  ['boss', 'Chefe'],
  ['stairs', 'Escadas'],
  ['exit', 'Saída'],
  ['event', 'Evento'],
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
      // Nada na cidade se esgota: a loja repõe estoque, a taverna sempre
      // atende. `CityCell` não tem `collected` nem `beaten`.
      gasta: () => false,
    };
  }

  return {
    lugar: `Masmorra — Andar ${estado.floor}${isBossFloor(estado.floor) ? ' ⚔️ Andar de Chefe' : ''}`,
    legenda: LEGENDA_DA_MASMORRA,
    icone: (celula) => iconFor(celula as DungeonCell),
    descricao: (celula) => roomDesc(celula as DungeonCell),
    textoDeEntrada: (celula) => entryText(celula as DungeonCell),
    rotulo: (celula) => shortLabel(celula as DungeonCell),
    gasta: (celula) => {
      const sala = celula as DungeonCell;
      return Boolean(sala.collected || sala.beaten || sala.resolved);
    },
  };
}
