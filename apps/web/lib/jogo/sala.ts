/**
 * O que acontece numa sala — o `handleEnter()` de `js/city.js` e
 * `js/dungeon.js`, sem DOM.
 *
 * Desde o andar solto (decisão do usuário, 2026-10-11) entrar numa sala não
 * aciona mais o que ela tem: o herói anda até o conteúdo e **encosta** nele
 * (baú, NPC, loja, escada…). A exceção é a sala de monstro, que começa a
 * luta assim que se entra (`lutaAoEntrar`) — sem a pergunta "deseja
 * entrar?" que o original fazia na porta, e com ela some a saída grátis de
 * dizer "não". A escada e a saída ainda perguntam ao encostar
 * (`confirmaAoTocar`), porque não têm volta: uma troca de andar, a outra
 * tira da masmorra.
 *
 * Cada função devolve `{ estado, aviso, tela }`: estado novo (imutável), a
 * caixinha de diálogo que a tela mostra e, quando a sala tem conteúdo
 * próprio (combate, loja, conversa, quadro de missões, evento), qual tela
 * abrir no lugar da exploração.
 */

import {
  addItem,
  concordar,
  defaultRng,
  displayName,
  dungeonById,
  generateMimic,
  hasClass,
  onItemCollected,
  randomInt,
  restAtTavern,
  type DungeonCell,
  type DungeonTreasureBonus,
  type Item,
  type PetId,
  type Rng,
} from '@rpg-legend/shared';

import type { Efeito } from '@/lib/som/efeitos';
import type { Adm } from './adm';
import { iniciarEncontro, type Combate } from './combate';
import { abrirDialogo, type Dialogo } from './dialogo';
import { abrirEvento, type Evento } from './evento';
import { abrirGuilda, type Guilda } from './guilda';
import { abrirLoja, type Loja } from './loja';
import type { Mochila } from './mochila';
import { abrirQuadro, type Quadro } from './missoes';
import { abrirPortao, type Portao } from './portao';
import { abrirProfessor, type Professor } from './professor';
import { tocarTotem, type Totem } from './totem';
import { marcar, type PassoDoTutorial, type Recado, type ResultadoDoPasso } from './tutorial';
import {
  andarDeForca,
  celulaAtual,
  descerEscada,
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
 * `mochila` e `adm` são as duas que `interagir` nunca devolve — não são
 * sala, abrem por botão. Moram aqui mesmo assim porque o que a união
 * descreve é qual tela está aberta, não de onde ela veio.
 */
export type TelaAberta =
  | { tipo: 'combate'; combate: Combate }
  | { tipo: 'loja'; loja: Loja }
  | { tipo: 'dialogo'; dialogo: Dialogo }
  | { tipo: 'missoes'; quadro: Quadro }
  | { tipo: 'evento'; evento: Evento }
  | { tipo: 'mochila'; mochila: Mochila }
  | { tipo: 'adm'; adm: Adm }
  | { tipo: 'guilda'; guilda: Guilda }
  | { tipo: 'portao'; portao: Portao }
  | { tipo: 'totem'; totem: Totem }
  | { tipo: 'professor'; professor: Professor };

export interface ResultadoDaInteracao {
  estado: EstadoDoJogo;
  aviso: Aviso | null;
  tela: TelaAberta | null;
  /**
   * Som da entrada nesta sala. Opcional porque a maioria das salas não tem
   * um — quem chama toca o passo comum quando vem vazio. Fica aqui pelo
   * mesmo motivo do `aviso`: é a sala que sabe se abriu um baú de ouro ou
   * uma porta de loja, e a tela não tem por que redescobrir isso.
   */
  som?: Efeito;
  /** Etapa dos Primeiros Passos concluída agora, pra tela mostrar o aviso curto. */
  recado: Recado | null;
}

/** O que cada sala resolve. O `recado` do tutorial é costurado por `interagir`, não por sala. */
type ResolucaoDaSala = Omit<ResultadoDaInteracao, 'recado'>;

/**
 * Qual etapa dos Primeiros Passos esta sala fecha, se alguma. O portão não
 * está aqui: ele abre a escolha de masmorra, e "Entre na masmorra" fecha ao
 * atravessar (`portao.ts`) — escolher e desistir não é entrar.
 */
const PASSO_DA_SALA: Record<string, PassoDoTutorial> = {
  npc: 'npc',
  shop: 'shop',
  blacksmith: 'shop',
  guild: 'guild',
  monster: 'combat',
  boss: 'combat',
};

/**
 * Sala de monstro ainda não batida: entrar já é a luta (decisão do usuário,
 * 2026-10-11). Quem foge continua na sala, com a criatura lá — encostar
 * nela recomeça a luta.
 */
export function lutaAoEntrar(celula: CelulaDoMapa | null): boolean {
  return !!celula && (celula.type === 'monster' || celula.type === 'boss') && !celula.beaten;
}

/**
 * O que pergunta antes, ao encostar: só o que não tem volta. A escada troca
 * de andar e a saída tira da masmorra; o resto abre uma tela com o próprio
 * "voltar" (loja, conversa, portão, totem) ou só dá o que tem (baú).
 */
export function confirmaAoTocar(celula: CelulaDoMapa | null): boolean {
  return !!celula && (celula.type === 'stairs' || celula.type === 'exit');
}

function aviso(icone: string, titulo: string, texto: string): Aviso {
  return { icone, titulo, texto };
}

/**
 * Resolve a sala em que o jogador está: quem chama é o encostão no conteúdo
 * ou, na sala de monstro, a entrada. `pet` é o cosmético da conta, não do
 * save — só a sala de monstro o usa, pra passar os bônus ao combate.
 *
 * A etapa do tutorial é marcada **antes** de montar a tela da sala: a
 * recompensa entra no ouro e na mochila que a loja vai mostrar, e a tela
 * aberta já carrega o estado com a etapa marcada — senão fechá-la
 * desfaria a marca.
 */
export function interagir(estado: EstadoDoJogo, rng: Rng = defaultRng, pet: PetId | null = null): ResultadoDaInteracao {
  const antes = comEtapaDaSala(estado, rng);
  const resultado =
    antes.estado.mapMode === 'city' ? naCidade(antes.estado, rng) : naMasmorra(antes.estado, rng, pet);
  return { ...resultado, recado: antes.recado };
}

function comEtapaDaSala(estado: EstadoDoJogo, rng: Rng): ResultadoDoPasso {
  const celula = celulaAtual(estado);
  const passo = celula ? PASSO_DA_SALA[celula.type] : undefined;
  if (!passo) return { estado, recado: null };

  // Sala de monstro já limpa não conta como "comece um combate".
  const jaBatida = passo === 'combat' && (celula as DungeonCell).beaten;
  // Entrar na guilda não é treinar: pro Aprendiz, "Treine na Guilda" fecha
  // no treino, em `treinar`. Quem já tem classe fecha só de entrar — não há
  // o que treinar.
  const aprendiz = passo === 'guild' && !hasClass(estado.hero);
  return jaBatida || aprendiz ? { estado, recado: null } : marcar(estado, passo, rng);
}

function naCidade(estado: EstadoNaCidade, rng: Rng): ResolucaoDaSala {
  const celula = celulaAtual(estado);
  if (!celula) return { estado, aviso: null, tela: null };

  switch (celula.type) {
    case 'gate': {
      // O Aprendiz não desce: sem classe ele não tem arma nem poder, e a
      // Guilda é o primeiro passo do jogo (decisão do usuário, 2026-10-09).
      if (!hasClass(estado.hero)) {
        return {
          estado,
          aviso: aviso(
            '🌟',
            'Portão da Masmorra',
            'O guarda barra a passagem: a masmorra é só para quem já treinou na Guilda dos Aventureiros, ao lado do caminho até aqui.',
          ),
          tela: null,
        };
      }
      // Floresta, Caverna ou Torre, a dificuldade e o andar de entrada se
      // escolhem na tela do portão (`portao.ts`).
      return { estado, aviso: null, tela: { tipo: 'portao', portao: abrirPortao(estado) } };
    }
    case 'tavern': {
      const descanso = restAtTavern(estado.hero, estado.party);
      return {
        estado: { ...estado, hero: descanso.hero, party: descanso.party },
        aviso: aviso('🍺', 'Taverna', 'Você descansa por uma noite. Vida e mana totalmente restauradas.'),
        tela: null,
        som: 'door',
      };
    }
    case 'shop':
      return { estado, aviso: null, tela: { tipo: 'loja', loja: abrirLoja(estado, 'shop', rng) }, som: 'door' };
    case 'blacksmith':
      return { estado, aviso: null, tela: { tipo: 'loja', loja: abrirLoja(estado, 'blacksmith', rng) }, som: 'door' };
    case 'questboard':
      return { estado, aviso: null, tela: { tipo: 'missoes', quadro: abrirQuadro(estado, rng) } };
    case 'guild':
      return { estado, aviso: null, tela: { tipo: 'guilda', guilda: abrirGuilda(estado) }, som: 'door' };
    case 'npc':
      return abrirConversa(estado);
    case 'start':
      return { estado, aviso: aviso('🚀', 'Ponto de Partida', 'Foi aqui que sua jornada começou.'), tela: null };
    default:
      return { estado, aviso: null, tela: null };
  }
}

function naMasmorra(estado: EstadoNaMasmorra, rng: Rng, pet: PetId | null): ResolucaoDaSala {
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
        som: 'door',
      };
    case 'npc':
      return abrirConversa(estado);
    case 'totem': {
      // O toque vale já, e não ao fechar a tela: quem fecha a aba com o
      // totem aberto não pode perder o andar marcado.
      const totem = tocarTotem(estado);
      return { estado: totem.estado, aviso: null, tela: { tipo: 'totem', totem } };
    }
    case 'teacher': {
      if (celula.teacher?.taught) {
        return { estado, aviso: aviso('🎓', 'Sala do Mestre', 'O mestre já seguiu caminho. Ficaram as marcas do treino no chão.'), tela: null };
      }
      const professor = abrirProfessor(estado);
      return professor ? { estado, aviso: null, tela: { tipo: 'professor', professor } } : { estado, aviso: null, tela: null };
    }
    case 'event': {
      const evento = abrirEvento(estado);
      if (!evento) return { estado, aviso: null, tela: null };

      // Já resolvido vira aviso, e não tela — o mesmo que o baú vazio e a
      // sala de monstro já batida fazem logo acima. A tela só tinha um
      // botão "Continuar" e uma frase dizendo que não havia nada; abrir
      // uma tela cheia pra isso é cobrar dois cliques por nada.
      //
      // O ícone e o título saem do próprio evento em vez de um texto
      // genérico: quem passa de novo pelo Altar Antigo reconhece qual sala
      // era, que é a informação que sobrou pra dar.
      if (evento.resolvido) {
        return {
          estado,
          aviso: aviso(evento.template.icon, evento.template.title, 'Você já resolveu o que havia aqui.'),
          tela: null,
        };
      }

      return { estado, aviso: null, tela: { tipo: 'evento', evento } };
    }
    case 'start':
      return { estado, aviso: aviso('🚀', 'Ponto de Partida', 'Foi aqui que você chegou neste andar.'), tela: null };
    default:
      return { estado, aviso: null, tela: null };
  }
}

function descer(estado: EstadoNaMasmorra, rng: Rng): ResolucaoDaSala {
  const resultado = descerEscada(estado, rng);
  if (resultado.kind === 'selado') {
    return { estado, aviso: aviso('👑', 'Caminho Selado', 'O poder do chefe bloqueia as escadas. Derrote-o para avançar.'), tela: null };
  }
  if (resultado.kind === 'fundo') {
    return { estado, aviso: aviso('🕳️', 'O Fundo', 'Não há mais escadas: este é o último andar da masmorra.'), tela: null };
  }
  return {
    estado: resultado.estado,
    aviso: aviso('⬇️', 'Escadas', `Você desce mais fundo na masmorra. Andar ${resultado.estado.floor}. O ar fica mais pesado…`),
    tela: null,
    som: 'door',
  };
}

/**
 * Baú. Pode ser mímico: nesse caso a sala vira sala de monstro com o mímico
 * dentro e o prêmio vira o bônus dele — exatamente a troca que o original
 * faz antes de chamar o combate. O combate em si é o que falta; o mímico
 * já fica salvo na sala, esperando.
 */
function abrirBau(estado: EstadoNaMasmorra, celula: DungeonCell, rng: Rng, pet: PetId | null): ResolucaoDaSala {
  if (celula.collected) return { estado, aviso: aviso('🧰', 'Baú Vazio', 'Este baú já foi revistado.'), tela: null };

  // Ouro, mímico e prêmio sobem com o andar de força: o mesmo andar 3 paga
  // mais na Torre do que na Floresta.
  const forca = andarDeForca(estado);

  if (celula.isMimic) {
    const bonus: DungeonTreasureBonus = premioDoBau(celula, forca, rng);
    const revelado: DungeonCell = {
      ...celula,
      type: 'monster',
      monsters: [generateMimic(forca, { rng, species: dungeonById(estado.masmorra.dungeon)?.species })],
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
    const ouro = 8 + randomInt(18, rng) + forca * 2;
    return {
      estado: substituirCelulaAtual({ ...estado, hero: { ...estado.hero, gold: estado.hero.gold + ouro } }, aberto),
      aviso: aviso('🧰', 'Baú Encontrado', `Você encontra ${ouro} moedas de ouro dentro do baú.`),
      tela: null,
      som: 'gold',
    };
  }

  const item: Item = celula.item;
  return {
    estado: substituirCelulaAtual(
      { ...estado, inventory: addItem(estado.inventory, item), quests: onItemCollected(estado.quests) },
      aberto,
    ),
    aviso: aviso(
      '🧰',
      'Baú Encontrado',
      `<b>${displayName(item)}</b> ${concordar(item, ['foi adicionado', 'foi adicionada', 'foram adicionados', 'foram adicionadas'])} à sua mochila.`,
    ),
    tela: null,
    som: 'buy',
  };
}

function premioDoBau(celula: DungeonCell, floor: number, rng: Rng): DungeonTreasureBonus {
  return celula.giveGold || !celula.item ? { gold: 10 + floor * 3 + randomInt(15, rng) } : { item: celula.item };
}

/** NPC existe nos dois mapas, com o mesmo formato. */
function abrirConversa(estado: EstadoDoJogo): ResolucaoDaSala {
  const dialogo = abrirDialogo(estado);
  if (!dialogo) return { estado, aviso: null, tela: null };
  return { estado, aviso: null, tela: { tipo: 'dialogo', dialogo } };
}
