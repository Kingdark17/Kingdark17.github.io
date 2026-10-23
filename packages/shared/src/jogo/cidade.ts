/**
 * A cidade desenhada (`city/mapa-da-cidade.ts`) do lado do jogo: o que cada
 * porta faz, onde o herói aparece e quando os troncos saem do caminho.
 *
 * A grade de salas da cidade continua sendo a do save. Encostar numa porta
 * leva o jogador pra sala dela e a aciona com `interagir`, como encostar no
 * conteúdo de uma sala fazia: a loja abre com o estoque guardado, a guilda
 * treina, a taverna cura. Por isso nada do que já existia muda, e o mesmo
 * personagem carrega no site e no app em qualquer sala da cidade.
 */

import type { CityCell, CityRoomType } from '../city/city.js';
import { chegadaNoPonto, plantaDaCidade, pontoDaSala, type PontoDaCidade } from '../city/mapa-da-cidade.js';
import { dungeonById, isCleared, lockReason, type DungeonId } from '../dungeon/dungeons.js';
import type { RoomLayout, Walker } from '../dungeon/room-walk.js';
import { hasClass } from '../hero/hero.js';
import type { PetId } from '../pets/pets.js';
import { defaultRng, type Rng } from '../rng.js';
import { celulaAtual, type EstadoNaCidade, type Posicao } from './estado.js';
import { abrirPortao, motivo } from './portao.js';
import { interagir, type ResultadoDaInteracao } from './sala.js';
import { marcar } from './tutorial.js';

/** A porta de cada sala da cidade no mapa. A vidente é a sala do NPC que abençoa (a Erma). */
const SALA_DO_PONTO: Partial<Record<PontoDaCidade, CityRoomType>> = {
  taverna: 'tavern',
  loja: 'shop',
  ferreiro: 'blacksmith',
  arvore: 'start',
  igreja: 'encantadora',
  guilda: 'guild',
  quadro: 'questboard',
  vidente: 'npc',
};

/** As três entradas de masmorra: o ponto tem o id da masmorra. */
const ENTRADAS: Partial<Record<PontoDaCidade, DungeonId>> = { floresta: 'floresta', caverna: 'caverna', torre: 'torre' };

/**
 * Os troncos ainda fecham o caminho da caverna: a masmorra que a Caverna
 * pede (a Floresta) não foi zerada no Normal (decisão do usuário,
 * 2026-10-23). O nível não entra: quem zerou a Floresta vê o caminho aberto,
 * e a entrada da Caverna é que diz se falta nível.
 */
export function troncosNoCaminho(estado: Pick<EstadoNaCidade, 'progresso'>): boolean {
  const requer = dungeonById('caverna')?.requires;
  return !!requer && !isCleared(estado.progresso, { dungeon: requer, difficulty: 'normal' });
}

/** A narração da cidade desenhada, no lugar da narração da sala: o que há em volta da praça. */
export const TEXTO_DA_CIDADE =
  'A cidade se espalha em volta da árvore da praça: a taverna, a loja de poções e a igreja a oeste; o ferreiro, a guilda e o quadro de avisos a leste; a cabana da vidente ao sul.';

/** Como entrar e por onde vão as masmorras; com os troncos no caminho, avisa que a Caverna está fechada. */
export function pistasDaCidade(estado: Pick<EstadoNaCidade, 'progresso'>): string {
  const pistas = 'Encoste numa porta para entrar. A Floresta fica pelo caminho do sul, a Caverna ao norte e a Torre pela estrada do leste.';
  return troncosNoCaminho(estado) ? `${pistas} Troncos caídos fecham o caminho da Caverna.` : pistas;
}

/** A planta da cidade como ela está pra este jogador: com ou sem os troncos. */
export function plantaDaCidadeAgora(estado: Pick<EstadoNaCidade, 'progresso'>): RoomLayout {
  return plantaDaCidade(troncosNoCaminho(estado));
}

/**
 * Onde o herói aparece na cidade. Quem volta da masmorra, na entrada dela;
 * quem carrega o jogo ou sai de uma tela, diante da porta da sala em que
 * está — e o portão, que tem três entradas, na da última masmorra.
 */
export function chegadaNaCidade(estado: EstadoNaCidade, daMasmorra = false): Walker {
  const celula = celulaAtual(estado) as CityCell | null;
  if (daMasmorra || celula?.type === 'gate') return chegadaNoPonto(estado.masmorra.dungeon);
  return chegadaNoPonto(celula ? pontoDaSala(celula) : 'arvore');
}

/** Onde fica a sala deste ponto na grade, ou `null` (o poço, os troncos). */
function salaDoPonto(estado: EstadoNaCidade, ponto: PontoDaCidade): Posicao | null {
  const tipo = ENTRADAS[ponto] ? 'gate' : SALA_DO_PONTO[ponto];
  if (!tipo) return null;
  for (const linha of estado.map) {
    for (const celula of linha) {
      if (celula.type !== tipo) continue;
      if (tipo === 'npc' && celula.npc?.service !== 'blessing') continue;
      return { x: celula.x, y: celula.y };
    }
  }
  return null;
}

function nada(estado: EstadoNaCidade): ResultadoDaInteracao {
  return { estado, aviso: null, tela: null, recado: null };
}

/**
 * O herói encostou num ponto da cidade. Fecha "Dê o primeiro passo" (na
 * cidade desenhada não há sala vizinha pra onde andar) e faz o que a porta
 * faz: vai pra sala dela e a aciona.
 */
export function entrarNoPonto(
  estado: EstadoNaCidade,
  ponto: PontoDaCidade,
  rng: Rng = defaultRng,
  pet: PetId | null = null,
  now?: () => number,
  app = false,
): ResultadoDaInteracao {
  const passo = marcar(estado, 'move', rng, now);
  const resultado = acionar(passo.estado as EstadoNaCidade, ponto, rng, pet, now, app);
  return { ...resultado, recado: resultado.recado ?? passo.recado };
}

function acionar(estado: EstadoNaCidade, ponto: PontoDaCidade, rng: Rng, pet: PetId | null, now: (() => number) | undefined, app: boolean): ResultadoDaInteracao {
  if (ponto === 'troncos') {
    return {
      estado,
      aviso: { icone: '🪵', titulo: 'Troncos no Caminho', texto: 'Troncos caídos fecham o caminho da Caverna. Zere a Floresta no Normal para abrir a passagem.' },
      tela: null,
      recado: null,
    };
  }

  const sala = salaDoPonto(estado, ponto);
  if (!sala) return nada(estado);
  const naSala: EstadoNaCidade = { ...estado, pos: sala };

  const masmorra = ENTRADAS[ponto];
  // O Aprendiz é barrado pelo guarda do portão, em qualquer entrada.
  if (!masmorra || !hasClass(naSala.hero)) return interagir(naSala, rng, pet, now, app);

  const fechada = lockReason(naSala.progresso, naSala.hero.level, { dungeon: masmorra, difficulty: 'normal' });
  if (fechada) {
    const def = dungeonById(masmorra);
    return {
      estado: naSala,
      aviso: { icone: def?.icon ?? '🌟', titulo: def?.name ?? masmorra, texto: `A entrada da ${def?.name ?? masmorra} ainda não abre. Para entrar: ${motivo(fechada)}.` },
      tela: null,
      recado: null,
    };
  }
  return { estado: naSala, aviso: null, tela: { tipo: 'portao', portao: abrirPortao(naSala, app, masmorra) }, recado: null };
}

/**
 * O Bram, o ferreiro que troca, atende dentro do ferreiro (decisão do
 * usuário, 2026-10-23): a tela da forja oferece a conversa com ele, que é a
 * sala do NPC de troca. Fechar a conversa devolve o herói à porta do
 * ferreiro (`pontoDaSala`).
 */
export function falarComOBram(estado: EstadoNaCidade, rng: Rng = defaultRng, now?: () => number, app = false): ResultadoDaInteracao {
  for (const linha of estado.map) {
    for (const celula of linha) {
      if (celula.type === 'npc' && celula.npc?.service === 'barter') return interagir({ ...estado, pos: { x: celula.x, y: celula.y } }, rng, null, now, app);
    }
  }
  return nada(estado);
}
