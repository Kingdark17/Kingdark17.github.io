/**
 * Os extras das salas, do lado do jogo (decisão do usuário, 2026-10-11):
 * baú pequeno, vaso, placa e parede rachada. Onde ficam e o que guardam
 * sai da engine (`dungeon/extras.ts`), na geração do andar; aqui fica o que
 * aparece na sala e o que acontece quando o herói encosta em cada um.
 *
 * Regras do usuário que moram aqui:
 * - na sala de monstro, nada se pega antes de vencer — quem foge não leva;
 * - a parede rachada, aberta, vira passagem pra uma sala secreta fora do
 *   mapa, com um baú de equipamento acima do normal do andar.
 *
 * Só na masmorra: a cidade não tem extras.
 */

import { extraChestGold, potCoins, signHint, type DungeonExtra } from '../dungeon/extras.js';
import type { DungeonCell } from '../dungeon/generate.js';
import { DIR_OPP, type Direction } from '../dungeon/graph.js';
import { CONTENT_TILE, roomLayout, type RoomLayout, type RoomObject } from '../dungeon/room-walk.js';
import { addItem } from '../inventory/inventory.js';
import { concordar, displayName, type Item } from '../items/item.js';
import { onItemCollected } from '../quests/quests.js';
import type { Rng } from '../rng.js';
import { ID_DO_CONTEUDO } from './andar-na-sala.js';
import type { Efeito } from './efeitos.js';
import { andarDeForca, celulaAtual, substituirCelulaAtual, type CelulaDoMapa, type EstadoNaMasmorra } from './estado.js';
import type { Aviso } from './sala.js';

const PREFIXO = 'extra-';

/** O id do baú da sala secreta na planta dela. */
export const ID_DO_BAU_SECRETO = 'bau-secreto';

export function idDoExtra(indice: number): string {
  return `${PREFIXO}${indice}`;
}

/** O índice do extra pelo id do objeto na planta; `null` se o objeto não é extra. */
export function indiceDoExtra(id: string): number | null {
  if (!id.startsWith(PREFIXO)) return null;
  const indice = Number(id.slice(PREFIXO.length));
  return Number.isInteger(indice) ? indice : null;
}

/** Os extras da sala (a cidade e os andares de antes deles não têm). */
export function extrasDe(celula: CelulaDoMapa | null): DungeonExtra[] {
  return (celula as DungeonCell | null)?.extras ?? [];
}

/** O lado da parede rachada já aberta, que agora é passagem pra sala secreta. */
export function passagemSecreta(celula: CelulaDoMapa | null): { lado: Direction; indice: number } | null {
  const extras = extrasDe(celula);
  const indice = extras.findIndex((e) => e.kind === 'crack' && e.used && e.side);
  return indice < 0 ? null : { lado: extras[indice]!.side!, indice };
}

/**
 * Os objetos da sala na planta do andar: o conteúdo no centro (quando há) e
 * os extras que ainda ocupam lugar. Vaso quebrado some; parede aberta deixa
 * de ser objeto e vira vão (ver `passagemSecreta`).
 */
export function objetosDaSala(celula: CelulaDoMapa | null, temConteudo: boolean): RoomObject[] {
  const objetos: RoomObject[] = temConteudo ? [{ id: ID_DO_CONTEUDO, ...CONTENT_TILE }] : [];
  extrasDe(celula).forEach((extra, indice) => {
    if (extra.kind === 'pot' && extra.used) return;
    if (extra.kind === 'crack' && extra.used) return;
    objetos.push({ id: idDoExtra(indice), col: extra.col, row: extra.row });
  });
  return objetos;
}

/** A planta da sala secreta: uma porta só, de volta pra sala da parede, e o baú no centro. */
export function plantaDaSalaSecreta(ladoDaParede: Direction): RoomLayout {
  return roomLayout({ [DIR_OPP[ladoDaParede]]: true }, [{ id: ID_DO_BAU_SECRETO, ...CONTENT_TILE }]);
}

export interface ResultadoDoExtra {
  estado: EstadoNaMasmorra;
  aviso: Aviso;
  som?: Efeito;
}

function aviso(icone: string, titulo: string, texto: string): Aviso {
  return { icone, titulo, texto };
}

function trocarExtra(estado: EstadoNaMasmorra, celula: DungeonCell, indice: number, mudanca: Partial<DungeonExtra>): EstadoNaMasmorra {
  const extras = (celula.extras ?? []).map((e, i) => (i === indice ? { ...e, ...mudanca } : e));
  return substituirCelulaAtual(estado, { ...celula, extras });
}

function adicionado(item: Item): string {
  return `<b>${displayName(item)}</b> ${concordar(item, ['foi adicionado', 'foi adicionada', 'foram adicionados', 'foram adicionadas'])} à sua mochila.`;
}

/** O herói encostou no extra `indice` da sala em que está. */
export function tocarExtra(estado: EstadoNaMasmorra, indice: number, rng: Rng): ResultadoDoExtra {
  const celula = celulaAtual(estado) as DungeonCell | null;
  const extra = celula?.extras?.[indice];
  if (!celula || !extra) return { estado, aviso: aviso('❔', 'Nada aqui', 'Não há nada aqui.') };

  // Decisão do usuário: na sala de monstro, nada se pega antes de vencer.
  if ((celula.type === 'monster' || celula.type === 'boss') && !celula.beaten && extra.kind !== 'sign') {
    return { estado, aviso: aviso('⚔️', 'Ainda não', 'As criaturas não deixam você mexer em nada enquanto estiverem de pé.') };
  }

  switch (extra.kind) {
    case 'chest': {
      if (extra.used) return { estado, aviso: aviso('🧰', 'Baú Vazio', 'Este baú pequeno já foi aberto.') };
      if (extra.item) {
        const comItem = { ...estado, inventory: addItem(estado.inventory, extra.item), quests: onItemCollected(estado.quests) };
        return { estado: trocarExtra(comItem, celula, indice, { used: true }), aviso: aviso('🧰', 'Baú Pequeno', adicionado(extra.item)), som: 'buy' };
      }
      const ouro = extraChestGold(andarDeForca(estado), rng);
      const comOuro = { ...estado, hero: { ...estado.hero, gold: estado.hero.gold + ouro } };
      return {
        estado: trocarExtra(comOuro, celula, indice, { used: true }),
        aviso: aviso('🧰', 'Baú Pequeno', `Você encontra ${ouro} moedas de ouro no baú pequeno.`),
        som: 'gold',
      };
    }
    case 'pot': {
      if (extra.used) return { estado, aviso: aviso('🏺', 'Cacos', 'Só sobraram cacos.') };
      const moedas = potCoins(rng);
      const comOuro = { ...estado, hero: { ...estado.hero, gold: estado.hero.gold + moedas } };
      return {
        estado: trocarExtra(comOuro, celula, indice, { used: true }),
        aviso: aviso('🏺', 'Vaso', `O vaso se quebra e ${moedas} ${moedas === 1 ? 'moeda rola' : 'moedas rolam'} pelo chão.`),
        som: 'gold',
      };
    }
    case 'sign':
      return { estado, aviso: aviso('🪧', 'Placa', signHint(estado.map as DungeonCell[][], celula)) };
    case 'crack': {
      if (extra.used) return { estado, aviso: aviso('🧱', 'Passagem', 'A passagem continua aberta.') };
      return {
        estado: trocarExtra(estado, celula, indice, { used: true }),
        aviso: aviso('🧱', 'Parede Rachada', 'A parede rachada cede com um empurrão e revela uma passagem estreita.'),
        som: 'door',
      };
    }
  }
}

/** O herói encostou no baú da sala secreta, atrás da parede `indice`. */
export function abrirBauSecreto(estado: EstadoNaMasmorra, indice: number): ResultadoDoExtra {
  const celula = celulaAtual(estado) as DungeonCell | null;
  const extra = celula?.extras?.[indice];
  if (!celula || extra?.kind !== 'crack' || !extra.secretItem) return { estado, aviso: aviso('❔', 'Nada aqui', 'Não há nada aqui.') };
  if (extra.secretCollected) return { estado, aviso: aviso('🧰', 'Baú Vazio', 'O baú escondido já está vazio.') };

  const comItem = { ...estado, inventory: addItem(estado.inventory, extra.secretItem), quests: onItemCollected(estado.quests) };
  return {
    estado: trocarExtra(comItem, celula, indice, { secretCollected: true }),
    aviso: aviso('💎', 'Baú Escondido', adicionado(extra.secretItem)),
    som: 'buy',
  };
}

/** A narração da sala secreta atrás da parede `indice`. */
export function textoDaSecreta(celula: CelulaDoMapa | null, indice: number): string {
  return extrasDe(celula)[indice]?.secretCollected
    ? 'Uma câmara escondida atrás da parede. O baú já está vazio.'
    : 'Uma câmara escondida atrás da parede, coberta de poeira. Um baú esquecido espera no centro.';
}

/** Uma linha pra narração: o que de extra há na sala, na ordem em que aparecem. */
export function descricaoDosExtras(celula: CelulaDoMapa | null): string {
  const frases: string[] = [];
  for (const extra of extrasDe(celula)) {
    if (extra.kind === 'chest') frases.push(extra.used ? 'Num canto, um baú pequeno aberto.' : 'Num canto, um baú pequeno.');
    if (extra.kind === 'pot' && !extra.used) frases.push('Um vaso de barro encostado na parede.');
    if (extra.kind === 'pot' && extra.used) frases.push('Cacos de um vaso pelo chão.');
    if (extra.kind === 'sign') frases.push('Uma placa de madeira presa à parede.');
    if (extra.kind === 'crack') frases.push(extra.used ? 'Uma passagem estreita se abre numa das paredes.' : 'Uma das paredes tem uma rachadura funda.');
  }
  return frases.join(' ');
}
