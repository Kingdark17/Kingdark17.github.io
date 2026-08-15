/**
 * O que acontece ao entrar numa sala — o `handleEnter()` de `js/city.js` e
 * `js/dungeon.js`, sem DOM.
 *
 * O original pergunta antes de entrar em sala "interessante" (`needsConfirm`
 * em `ui.js`) e, no "não", atravessa a sala mesmo assim quando ela é só de
 * passagem. Sem isso a saída da masmorra sequestra o jogador de volta pra
 * cidade só por ele passar por cima dela — e ela pode estar no caminho da
 * escada. As duas regras estão aqui, iguais.
 *
 * Cada função devolve `{ estado, aviso, tela }`: estado novo (imutável), a
 * caixinha de diálogo que a tela mostra e, quando a sala tem conteúdo
 * próprio (combate, loja, conversa, quadro de missões, evento), qual tela
 * abrir no lugar da exploração.
 */

import {
  addItem,
  defaultRng,
  displayName,
  generateMimic,
  onItemCollected,
  randomInt,
  restAtTavern,
  type DungeonCell,
  type DungeonTreasureBonus,
  type Item,
  type PetId,
  type Rng,
} from '@rpg-legend/shared';

import { iniciarEncontro, type Combate } from './combate';
import { abrirDialogo, type Dialogo } from './dialogo';
import { abrirEvento, type Evento } from './evento';
import { abrirLoja, type Loja } from './loja';
import type { Mochila } from './mochila';
import { abrirQuadro, type Quadro } from './missoes';
import {
  celulaAtual,
  descerEscada,
  entrarNaMasmorra,
  substituirCelulaAtual,
  voltarParaCidade,
  type CelulaDoMapa,
  type EstadoDoJogo,
  type EstadoNaCidade,
  type EstadoNaMasmorra,
} from './estado';

export interface Aviso {
  icone: string;
  titulo: string;
  texto: string;
}

/**
 * O que troca a tela de exploração por outra. União em vez de um campo
 * opcional por tipo: a tela só precisa olhar `tipo` pra saber o que abrir,
 * e acrescentar um lugar novo não vira mais um `?: X | null` na interface.
 *
 * `mochila` é a única que `interagir` nunca devolve — ela não é sala, abre
 * por botão. Mora aqui mesmo assim porque o que a união descreve é qual
 * tela está aberta, não de onde ela veio.
 */
export type TelaAberta =
  | { tipo: 'combate'; combate: Combate }
  | { tipo: 'loja'; loja: Loja }
  | { tipo: 'dialogo'; dialogo: Dialogo }
  | { tipo: 'missoes'; quadro: Quadro }
  | { tipo: 'evento'; evento: Evento }
  | { tipo: 'mochila'; mochila: Mochila };

export interface ResultadoDaInteracao {
  estado: EstadoDoJogo;
  aviso: Aviso | null;
  tela: TelaAberta | null;
}

/** Salas que abrem a pergunta "deseja entrar?" antes do passo (`needsConfirm`). */
const PEDEM_CONFIRMACAO = new Set([
  'npc',
  'event',
  'treasure',
  'monster',
  'boss',
  'shop',
  'blacksmith',
  'tavern',
  'questboard',
  'gate',
  'exit',
  'stairs',
]);

/** Dizer "não" nestas salas atravessa em vez de recuar — senão a saída da masmorra viraria um muro no caminho da escada. */
const ATRAVESSAM_SEM_INTERAGIR = new Set(['npc', 'shop', 'blacksmith', 'tavern', 'questboard', 'treasure', 'event', 'exit']);

export function precisaConfirmar(celula: CelulaDoMapa): boolean {
  if (celula.type === 'treasure' && celula.collected) return false;
  if ((celula.type === 'monster' || celula.type === 'boss') && celula.beaten) return false;
  return PEDEM_CONFIRMACAO.has(celula.type);
}

export function atravessaSemInteragir(celula: CelulaDoMapa): boolean {
  return ATRAVESSAM_SEM_INTERAGIR.has(celula.type);
}

function aviso(icone: string, titulo: string, texto: string): Aviso {
  return { icone, titulo, texto };
}

/**
 * Resolve a sala em que o jogador acabou de entrar. `pet` é o cosmético da
 * conta, não do save — só a sala de monstro o usa, pra passar os bônus ao
 * combate.
 */
export function interagir(estado: EstadoDoJogo, rng: Rng = defaultRng, pet: PetId | null = null): ResultadoDaInteracao {
  return estado.mapMode === 'city' ? naCidade(estado, rng) : naMasmorra(estado, rng, pet);
}

function naCidade(estado: EstadoNaCidade, rng: Rng): ResultadoDaInteracao {
  const celula = celulaAtual(estado);
  if (!celula) return { estado, aviso: null, tela: null };

  switch (celula.type) {
    case 'gate': {
      const dentro = entrarNaMasmorra(estado, rng);
      return {
        estado: dentro,
        aviso: aviso('🌟', 'Portão da Masmorra', `Você atravessa o portão e entra na masmorra. Andar ${dentro.floor}.`),
        tela: null,
      };
    }
    case 'tavern': {
      const descanso = restAtTavern(estado.hero, estado.party);
      return {
        estado: { ...estado, hero: descanso.hero, party: descanso.party },
        aviso: aviso('🍺', 'Taverna', 'Você descansa por uma noite. Vida e mana totalmente restauradas.'),
        tela: null,
      };
    }
    case 'shop':
      return { estado, aviso: null, tela: { tipo: 'loja', loja: abrirLoja(estado, 'shop', rng) } };
    case 'blacksmith':
      return { estado, aviso: null, tela: { tipo: 'loja', loja: abrirLoja(estado, 'blacksmith', rng) } };
    case 'questboard':
      return { estado, aviso: null, tela: { tipo: 'missoes', quadro: abrirQuadro(estado, rng) } };
    case 'npc':
      return abrirConversa(estado);
    case 'start':
      return { estado, aviso: aviso('🚀', 'Ponto de Partida', 'Foi aqui que sua jornada começou.'), tela: null };
    default:
      return { estado, aviso: null, tela: null };
  }
}

function naMasmorra(estado: EstadoNaMasmorra, rng: Rng, pet: PetId | null): ResultadoDaInteracao {
  const celula = celulaAtual(estado);
  if (!celula || estado.mapMode !== 'dungeon') return { estado, aviso: null, tela: null };

  switch (celula.type) {
    case 'treasure':
      return abrirBau(estado, celula, rng, pet);
    case 'monster':
    case 'boss':
      if (celula.beaten) return { estado, aviso: aviso('👾', 'Sala Vazia', 'Não há mais nada aqui.'), tela: null };
      return { estado, aviso: null, tela: { tipo: 'combate', combate: iniciarEncontro(estado, pet) } };
    case 'stairs':
      return descer(estado, rng);
    case 'exit':
      return {
        estado: voltarParaCidade(estado),
        aviso: aviso('🚪', 'De Volta à Cidade', 'Você sobe o caminho iluminado e retorna à cidade.'),
        tela: null,
      };
    case 'npc':
      return abrirConversa(estado);
    case 'event': {
      const evento = abrirEvento(estado);
      return evento ? { estado, aviso: null, tela: { tipo: 'evento', evento } } : { estado, aviso: null, tela: null };
    }
    case 'start':
      return { estado, aviso: aviso('🚀', 'Ponto de Partida', 'Foi aqui que você chegou neste andar.'), tela: null };
    default:
      return { estado, aviso: null, tela: null };
  }
}

function descer(estado: EstadoNaMasmorra, rng: Rng): ResultadoDaInteracao {
  const resultado = descerEscada(estado, rng);
  if (resultado.kind === 'selado') {
    return { estado, aviso: aviso('👑', 'Caminho Selado', 'O poder do chefe bloqueia as escadas. Derrote-o para avançar.'), tela: null };
  }
  return {
    estado: resultado.estado,
    aviso: aviso('⬇️', 'Escadas', `Você desce mais fundo na masmorra. Andar ${resultado.estado.floor}. O ar fica mais pesado…`),
    tela: null,
  };
}

/**
 * Baú. Pode ser mímico: nesse caso a sala vira sala de monstro com o mímico
 * dentro e o prêmio vira o bônus dele — exatamente a troca que o original
 * faz antes de chamar o combate. O combate em si é o que falta; o mímico
 * já fica salvo na sala, esperando.
 */
function abrirBau(estado: EstadoNaMasmorra, celula: DungeonCell, rng: Rng, pet: PetId | null): ResultadoDaInteracao {
  if (celula.collected) return { estado, aviso: aviso('🧰', 'Baú Vazio', 'Este baú já foi revistado.'), tela: null };

  if (celula.isMimic) {
    const bonus: DungeonTreasureBonus = premioDoBau(celula, estado.floor, rng);
    const revelado: DungeonCell = {
      ...celula,
      type: 'monster',
      monsters: [generateMimic(estado.floor, { rng })],
      monsterIndex: 0,
      beaten: false,
      bonusTreasure: bonus,
      isMimic: false,
    };
    const emboscada = substituirCelulaAtual(estado, revelado);
    return {
      estado: emboscada,
      aviso: aviso('🧰', 'Mímico!', 'O baú cria dentes e revela ser um <b>Mímico</b>!'),
      tela: { tipo: 'combate', combate: iniciarEncontro(emboscada, pet) },
    };
  }

  const aberto: DungeonCell = { ...celula, collected: true };

  if (celula.giveGold || !celula.item) {
    const ouro = 8 + randomInt(18, rng) + estado.floor * 2;
    return {
      estado: substituirCelulaAtual({ ...estado, hero: { ...estado.hero, gold: estado.hero.gold + ouro } }, aberto),
      aviso: aviso('🧰', 'Baú Encontrado', `Você encontra ${ouro} moedas de ouro dentro do baú.`),
      tela: null,
    };
  }

  const item: Item = celula.item;
  return {
    estado: substituirCelulaAtual(
      { ...estado, inventory: addItem(estado.inventory, item), quests: onItemCollected(estado.quests) },
      aberto,
    ),
    aviso: aviso('🧰', 'Baú Encontrado', `<b>${displayName(item)}</b> foi adicionado à sua mochila.`),
    tela: null,
  };
}

function premioDoBau(celula: DungeonCell, floor: number, rng: Rng): DungeonTreasureBonus {
  return celula.giveGold || !celula.item ? { gold: 10 + floor * 3 + randomInt(15, rng) } : { item: celula.item };
}

/** NPC existe nos dois mapas, com o mesmo formato. */
function abrirConversa(estado: EstadoDoJogo): ResultadoDaInteracao {
  const dialogo = abrirDialogo(estado);
  if (!dialogo) return { estado, aviso: null, tela: null };
  return { estado, aviso: null, tela: { tipo: 'dialogo', dialogo } };
}
