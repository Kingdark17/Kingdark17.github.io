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
 * Cada função devolve `{ estado, aviso }`: estado novo (imutável) e, quando
 * há, a caixinha de diálogo que a tela mostra. Combate, lojas, NPCs, eventos
 * e quadro de missões ainda não foram migrados — aqui eles avisam isso na
 * cara em vez de não fazer nada em silêncio.
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
  type Rng,
} from '@rpg-legend/shared';

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

export interface ResultadoDaInteracao {
  estado: EstadoDoJogo;
  aviso: Aviso | null;
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

/** Fase 3 ainda não tem combate, loja, diálogo nem evento. Melhor falar do que fingir que a sala é vazia. */
function aindaNaoMigrado(icone: string, titulo: string, oQue: string): Aviso {
  return aviso(icone, titulo, `${oQue} ainda não foi migrado para esta versão do jogo. A sala continua aqui, esperando.`);
}

/** Resolve a sala em que o jogador acabou de entrar. */
export function interagir(estado: EstadoDoJogo, rng: Rng = defaultRng): ResultadoDaInteracao {
  return estado.mapMode === 'city' ? naCidade(estado, rng) : naMasmorra(estado, rng);
}

function naCidade(estado: EstadoNaCidade, rng: Rng): ResultadoDaInteracao {
  const celula = celulaAtual(estado);
  if (!celula) return { estado, aviso: null };

  switch (celula.type) {
    case 'gate': {
      const dentro = entrarNaMasmorra(estado, rng);
      return { estado: dentro, aviso: aviso('🌟', 'Portão da Masmorra', `Você atravessa o portão e entra na masmorra. Andar ${dentro.floor}.`) };
    }
    case 'tavern': {
      const descanso = restAtTavern(estado.hero, estado.party);
      return {
        estado: { ...estado, hero: descanso.hero, party: descanso.party },
        aviso: aviso('🍺', 'Taverna', 'Você descansa por uma noite. Vida e mana totalmente restauradas.'),
      };
    }
    case 'shop':
      return { estado, aviso: aindaNaoMigrado('🏵', 'Loja', 'A loja') };
    case 'blacksmith':
      return { estado, aviso: aindaNaoMigrado('🔨', 'Ferreiro', 'A forja do ferreiro') };
    case 'questboard':
      return { estado, aviso: aindaNaoMigrado('📜', 'Quadro de Missões', 'O quadro de missões') };
    case 'npc':
      return { estado, aviso: aindaNaoMigrado('🧙', celula.npc?.name ?? 'Morador', 'A conversa com os moradores') };
    case 'start':
      return { estado, aviso: aviso('🚀', 'Ponto de Partida', 'Foi aqui que sua jornada começou.') };
    default:
      return { estado, aviso: null };
  }
}

function naMasmorra(estado: EstadoNaMasmorra, rng: Rng): ResultadoDaInteracao {
  const celula = celulaAtual(estado);
  if (!celula || estado.mapMode !== 'dungeon') return { estado, aviso: null };

  switch (celula.type) {
    case 'treasure':
      return abrirBau(estado, celula, rng);
    case 'monster':
    case 'boss':
      if (celula.beaten) return { estado, aviso: aviso('👾', 'Sala Vazia', 'Não há mais nada aqui.') };
      return { estado, aviso: aindaNaoMigrado(celula.type === 'boss' ? '👑' : '👾', 'Combate', 'O combate') };
    case 'stairs':
      return descer(estado, rng);
    case 'exit':
      return { estado: voltarParaCidade(estado), aviso: aviso('🚪', 'De Volta à Cidade', 'Você sobe o caminho iluminado e retorna à cidade.') };
    case 'npc':
      return { estado, aviso: aindaNaoMigrado('🧙', celula.npc?.name ?? 'Alguém', 'A conversa com os NPCs') };
    case 'event':
      return { estado, aviso: aindaNaoMigrado('❓', 'Acontecimento', 'Os eventos de masmorra') };
    case 'start':
      return { estado, aviso: aviso('🚀', 'Ponto de Partida', 'Foi aqui que você chegou neste andar.') };
    default:
      return { estado, aviso: null };
  }
}

function descer(estado: EstadoNaMasmorra, rng: Rng): ResultadoDaInteracao {
  const resultado = descerEscada(estado, rng);
  if (resultado.kind === 'selado') {
    return { estado, aviso: aviso('👑', 'Caminho Selado', 'O poder do chefe bloqueia as escadas. Derrote-o para avançar.') };
  }
  return {
    estado: resultado.estado,
    aviso: aviso('⬇️', 'Escadas', `Você desce mais fundo na masmorra. Andar ${resultado.estado.floor}. O ar fica mais pesado…`),
  };
}

/**
 * Baú. Pode ser mímico: nesse caso a sala vira sala de monstro com o mímico
 * dentro e o prêmio vira o bônus dele — exatamente a troca que o original
 * faz antes de chamar o combate. O combate em si é o que falta; o mímico
 * já fica salvo na sala, esperando.
 */
function abrirBau(estado: EstadoNaMasmorra, celula: DungeonCell, rng: Rng): ResultadoDaInteracao {
  if (celula.collected) return { estado, aviso: aviso('🧰', 'Baú Vazio', 'Este baú já foi revistado.') };

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
    return {
      estado: substituirCelulaAtual(estado, revelado),
      aviso: aviso('🧰', 'Mímico!', 'O baú cria dentes e revela ser um <b>Mímico</b>! O combate ainda não foi migrado — ele fica na sala, esperando.'),
    };
  }

  const aberto: DungeonCell = { ...celula, collected: true };

  if (celula.giveGold || !celula.item) {
    const ouro = 8 + randomInt(18, rng) + estado.floor * 2;
    return {
      estado: substituirCelulaAtual({ ...estado, hero: { ...estado.hero, gold: estado.hero.gold + ouro } }, aberto),
      aviso: aviso('🧰', 'Baú Encontrado', `Você encontra ${ouro} moedas de ouro dentro do baú.`),
    };
  }

  const item: Item = celula.item;
  return {
    estado: substituirCelulaAtual(
      { ...estado, inventory: addItem(estado.inventory, item), quests: onItemCollected(estado.quests) },
      aberto,
    ),
    aviso: aviso('🧰', 'Baú Encontrado', `<b>${displayName(item)}</b> foi adicionado à sua mochila.`),
  };
}

function premioDoBau(celula: DungeonCell, floor: number, rng: Rng): DungeonTreasureBonus {
  return celula.giveGold || !celula.item ? { gold: 10 + floor * 3 + randomInt(15, rng) } : { item: celula.item };
}
