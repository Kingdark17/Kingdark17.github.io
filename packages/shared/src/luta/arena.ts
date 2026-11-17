/**
 * A luta em tempo real do app, na própria sala: **a sala é a arena** (doc do
 * Breno de 2026-11-10, decidido com o usuário em 2026-11-11). Até então o
 * herói era um coração numa caixa, como no Undertale (2026-10-17).
 *
 * - Os monstros começam cada um na casa dele (`lugaresNaLuta`), como no
 *   site, e **andam atrás do herói** (doc do Breno de 2026-11-15, que desfaz
 *   o "ficam parados" de 2026-11-11): cada um chega até a distância do golpe
 *   dele (`JeitoDeLutar.distancia`), no passo dele, e é dali que golpeia.
 *   Quem investe **fica onde a investida acabou** (`corpoX`, `corpoY`;
 *   pedido do usuário, 2026-11-12). No PC **o alvo é o cursor**
 *   (doc do Breno de 2026-11-15): o monstro numa área de 3 casas em volta
 *   dele (`AREA_DA_MIRA`), e sem nenhum o golpe vai no chão; no celular, o
 *   monstro que o jogador tocou na placa (`mirar`), ou o de pé mais perto.
 * - **O herói anda pela sala** (`walkTick`, a regra de sempre), com as
 *   portas fechadas e cada monstro de pé tomando a casa em que está. Todo golpe de
 *   monstro no herói é um desenho no chão da sala, com **aviso** antes: o
 *   círculo do golpe de perto, a faixa da investida, a bola do tiro. Só pega
 *   se encostar no herói, e aí é o golpe do site (`landHitOnHero`).
 * - **Cada comportamento é um jeito de lutar** (`JEITOS_DE_LUTAR`): o
 *   agressivo e o ágil saem da casa deles e cruzam a sala em linha reta, o
 *   mágico atira de onde está, o lento, o venenoso e o defensivo batem num
 *   círculo onde o herói estava.
 * - **Vários golpeiam juntos** (doc do Breno de 2026-11-15; até
 *   `ATACANDO_DE_UMA_VEZ`), cada um com o respiro dele entre um golpe e o
 *   outro (`RESPIRO_DO_MONSTRO`), e um golpe não começa no mesmo instante do
 *   outro. O golpe pode ir num companheiro, pela regra do site
 *   (`pickMonsterTarget`): aí não passa pelo chão.
 * - **Um botão de ataque**, que abre o evento da arma (`eventos-de-arma.ts`)
 *   no alvo; enquanto ele dura o mundo anda em **câmera lenta**, e no fim o
 *   golpe cai no alvo. **O ataque tem o alcance da classe** (doc do Breno de
 *   2026-11-15, `alcanceNaArena`: 12 blocos o Arqueiro, 1 o Ladino…): fora
 *   dele o botão não abre o evento, e quem se afasta antes do fim erra. Os
 *   poderes acertam de qualquer lugar. O dano e a velocidade de andar da
 *   classe (`classes-de-luta.ts`) só valem aqui.
 * - Poderes e itens são botões, com tempo de espera; o menu de itens aberto
 *   também deixa o mundo lento. Os companheiros batem no alvo, no tempo deles.
 * - **A recompensa é a do site**: o golpe é o mesmo `resolverGolpe`, o do
 *   monstro é o mesmo `startMonsterAttack` + `landHitOnHero`, e quem cai é
 *   pago por `pagarAbate`/`limparSala`/`perderLuta`.
 *
 * O que no site é "por turno" aqui é "por rodada": a cada `RODADA` passos
 * correm o veneno do herói, o dano contínuo dos monstros e a Canção de
 * Batalha. O resto conta sozinho — o atordoado e o lento gastam turno quando
 * o monstro tenta atacar, os buffs do herói quando ele golpeia.
 *
 * **Tudo em passos e unidades inteiras**, os mesmos do andar: 60 passos por
 * segundo, casa de `TILE_UNITS`. A única conta que não é de
 * inteiros é o comprimento de um rumo (uma raiz e uma divisão), igual nos
 * dois lados. O sorteio vem de fora, um `rng` que atravessa a luta inteira:
 * com a mesma entrada, passo a passo, a luta sai igual.
 */

import { landHitOnHero, hitPartyMember, pickMonsterTarget, startMonsterAttack } from '../combat/monster-hit.js';
import type { CombatMonster, CombatMonsterView } from '../combat/monster-state.js';
import { partyMemberAct, passarRodadaDaCancao } from '../combat/party.js';
import { ataquesDisponiveis, LADOS_DO_DANO, resolverGolpe, type AttackStyle, type LeituraDaMira } from '../combat/resolve-attack.js';
import { tickHeroStatus } from '../combat/hero-status.js';
import { tickMonsterDot } from '../combat/status-effects.js';
import { castPower, powerManaCost } from '../combat/use-power.js';
import { anotarUso, atributoDoGolpe, textoDaHabilidade, treinarPoder } from '../hero/treino.js';
import { geometriaDaSala, paredesDaSala } from '../dungeon/arte-da-sala.js';
import type { DungeonCell } from '../dungeon/generate.js';
import { HERO_HALF, HERO_SPEED, roomLayout, TILE_UNITS, walkTick, type GeometriaDaSala, type RoomObject, type Walker } from '../dungeon/room-walk.js';
import type { Behavior } from '../monsters/species.js';
import { heroPowers, type Hero } from '../hero/hero.js';
import type { Item } from '../items/item.js';
import { monsterView } from '../monsters/generate.js';
import { petBonus, type PetId } from '../pets/pets.js';
import { randomInt, type Rng } from '../rng.js';
import { descontoDeMana, efeitoDoUnico } from '../items/acessorios-unicos.js';
import type { Conquista } from '../jogo/conquista.js';
import type { Efeito } from '../jogo/efeitos.js';
import { celulaAtual, substituirCelulaAtual, type EstadoDoJogo, type EstadoNaMasmorra } from '../jogo/estado.js';
import { enfurecer, FORCA_DO_DEVASTADOR, ferirMonstro, PODERES_DO_CHEFE, poderDaVez, textoDosLacaios, type Ferida, type PoderDoChefe } from '../jogo/chefe-final.js';
import { reviver } from '../jogo/dupla.js';
import { gravarMonstro, indicesDePe, limparSala, pagarAbate, perderLuta, prepararLuta } from '../jogo/fim-da-luta.js';
import { heroiNaLuta, lugaresNaLuta } from '../jogo/luta-no-mapa.js';
import { podeUsar, usar } from '../jogo/mochila.js';
import { aplicarRunas, RUNAS } from '../items/runas.js';
import { defesasDoHeroi, escudoDoVigor } from '../items/encantamentos.js';
import { MAX_ESQUELETOS } from '../combat/invocacao.js';
import { alcanceDoHeroi, classeDeLuta } from '../hero/classes-de-luta.js';
import { CHANCE_DE_QUEBRAR_NO_CHEFE, nomeDoMembro, PASSO_COM_PERNA_QUEBRADA, quebrarMembro, type Membro } from '../hero/ferimentos.js';
import { eventoDaArma, eventoDoAtaque, eventoDoPoder, lerEvento, TAMANHO_DO_DESENHO, type EventoDeArma, type JogadaDoEvento, type TipoDeEvento } from './eventos-de-arma.js';

// ---------- números ----------

/** Na câmera lenta, o mundo anda um passo a cada este tanto. */
export const LENTIDAO = 2;

/** A rodada da luta: veneno do herói, dano contínuo dos monstros e a Canção de Batalha, a cada 1,5 s. */
export const RODADA = 90;

/** Depois de um golpe, quanto até o próximo aperto abrir outro evento. */
export const RECARGA_DO_ATAQUE = 15;

/** Quanto um poder espera depois de usado: 3 s. */
export const RECARGA_DO_PODER = 180;

/**
 * Os poderes mágicos pedem o evento antes de sair (doc do Breno de
 * 2026-11-15): os de dano mágico e os de cura. Os outros (o golpe físico, os
 * reforços, o esqueleto) saem direto no botão.
 */
export const TIPOS_DE_PODER_MAGICO: readonly string[] = ['dano_magico', 'cura'];

/** Quem erra o evento do poder mágico: ele sai nesta força (decisão do usuário: "sai mais fraco"). */
export const FORCA_DO_PODER_ERRADO = 0.5;

/** Quanto o botão de item espera depois de usado. */
export const RECARGA_DO_ITEM = 60;

/** O raio do herói pro golpe do monstro, em volta do pé dele: encostou, pegou. Menor que o corpo, pra dar pra desviar. */
export const RAIO_DO_HEROI = 160;

/**
 * A mira do cursor (doc do Breno de 2026-11-15, "uma área de 3"): o monstro
 * de pé até este tanto do cursor, do meio da casa dele, vira o alvo — um
 * círculo de 3 casas de largura (decisão do usuário).
 */
export const AREA_DA_MIRA = 1440;

/** No fim do evento o alcance tem esta folga: meio passo pra trás durante a mira ainda acerta. */
export const FOLGA_DO_ALCANCE = 480;

/** Passos até o tiro sumir, se não sair do chão nem bater em nada. */
export const VIDA_DO_TIRO = 120;

/** Atordoado, o monstro fica parado este tanto e perde o golpe. */
export const TEMPO_ATORDOADO = 60;

/** Lento demais, o monstro hesita este tanto e perde o golpe. */
export const TEMPO_HESITANDO = 40;

/** Quanto a luta espera antes do primeiro golpe. */
export const ESPERA_INICIAL = 60;

/**
 * Quantos monstros podem estar golpeando (no aviso ou na investida) ao mesmo
 * tempo, e o tanto entre o começo de um golpe e o do próximo.
 *
 * Até 2026-11-15 era um por vez, a regra do site levada pro tempo real; o
 * doc do Breno pediu vários atacando juntos (decisão do usuário). Pra o
 * grupo não bater o triplo do site, cada monstro tem o respiro dele depois
 * de golpear (`RESPIRO_DO_MONSTRO`). Números ainda por afinar.
 */
export const ATACANDO_DE_UMA_VEZ = 3;
export const INTERVALO_ENTRE_GOLPES = 30;

/** Depois de descansar do golpe, o monstro ainda espera este tanto antes do próximo (andando atrás do herói). */
export const RESPIRO_DO_MONSTRO = 70;

/** Andando, um monstro não chega mais perto que isto do corpo de outro de pé. */
export const ESPACO_ENTRE_MONSTROS = 700;

/** Um companheiro golpeia a cada este tanto. */
export const CADENCIA_DO_COMPANHEIRO = 100;

/** O jeito de lutar de um comportamento. */
export interface JeitoDeLutar {
  /** Quanto dura o aviso antes do golpe. */
  aviso: number;
  /**
   * Perto: cai num círculo em volta de onde o herói estava quando o aviso
   * começou. Investida: o monstro sai da casa dele em linha reta, mirando
   * onde o herói estava, até a parede. Tiro: uma bola sai do monstro, mirando
   * onde o herói está quando o aviso acaba.
   */
  golpe: 'perto' | 'investida' | 'tiro';
  /** O raio do que pega: o círculo (perto), o corpo que mergulha (investida), a bola (tiro). */
  tamanho: number;
  /** Por passo, o mergulho ou a bola. O golpe de perto não anda. */
  velocidade: number;
  /** Parado depois do golpe. */
  descanso: number;
  /** Descansando, ele se protege: o golpe do herói chega com metade da força. */
  guarda?: boolean;
  /** Andando atrás do herói, quanto anda por passo (o herói anda 64). */
  passo: number;
  /** Até que distância do herói ele chega, e de onde o golpe pode começar. */
  distancia: number;
}

/**
 * Os seis jeitos (decisão do usuário, 2026-10-17): o ágil é rápido e desvia
 * (a esquiva de 15% dele já está no golpe); o agressivo investe em linha
 * reta; o lento é devagar e bate forte (o ×1,7 no terceiro golpe já está na
 * regra); o mágico atira de longe; o venenoso envenena (já está no golpe); o
 * defensivo se protege depois de bater.
 */
export const JEITOS_DE_LUTAR: Readonly<Record<Behavior, JeitoDeLutar>> = {
  agressivo: { aviso: 30, golpe: 'investida', tamanho: 560, velocidade: 160, descanso: 40, passo: 40, distancia: 3360 },
  agil: { aviso: 18, golpe: 'investida', tamanho: 400, velocidade: 224, descanso: 25, passo: 48, distancia: 3360 },
  defensivo: { aviso: 36, golpe: 'perto', tamanho: 1100, velocidade: 0, descanso: 60, guarda: true, passo: 28, distancia: 1440 },
  venenoso: { aviso: 30, golpe: 'perto', tamanho: 1000, velocidade: 0, descanso: 40, passo: 34, distancia: 1440 },
  lento: { aviso: 54, golpe: 'perto', tamanho: 1300, velocidade: 0, descanso: 50, passo: 20, distancia: 1440 },
  magico: { aviso: 36, golpe: 'tiro', tamanho: 360, velocidade: 96, descanso: 50, passo: 28, distancia: 4800 },
};

// ---------- formas ----------

export type FaseDoMonstro = 'esperando' | 'avisando' | 'investindo' | 'descansando' | 'atordoado' | 'hesitando' | 'caido';

export interface MonstroNaArena {
  /** O índice em `cell.monsters`, que é também o lugar dele no palco. */
  indice: number;
  fase: FaseDoMonstro;
  /** Passos que faltam na fase. */
  tempo: number;
  /** A força do golpe em curso (`attackMult`). */
  forca: number;
  /** Em quem o golpe em curso cai: -1 é o herói (no chão da sala); senão o índice do companheiro na equipe. */
  alvo: number;
  /** O golpe na sala, em unidades dela: o centro do círculo (perto), o corpo que investe (investida) ou de onde a bola sai (tiro). */
  x: number;
  y: number;
  /** O rumo da investida, travado no começo do aviso, já na velocidade dela. */
  rumoX: number;
  rumoY: number;
  /**
   * Onde o monstro está de pé, em unidades da sala: começa no meio da casa
   * dele e, depois de uma investida, fica onde ela acabou (pedido do usuário,
   * 2026-11-12). É dali que o alcance mede e que saem a investida e o tiro.
   */
  corpoX: number;
  corpoY: number;
  /** O chefe final: o poder do golpe em curso (`jogo/chefe-final.ts`). Ausente no golpe comum. */
  poder?: PoderDoChefe;
  /** Na luta em dupla: ele anda atrás do parceiro, e o golpe em curso mira nele (`Dupla`). */
  noParceiro?: boolean;
  /** No espelho de quem acompanha: este golpe já acertou o meu herói (a investida não acerta duas vezes). */
  acertou?: boolean;
}

/**
 * A luta em dupla (o co-op do app, 2026-11-16; decisões do usuário): cada
 * app cuida do próprio herói — anda, desvia e ataca nele, sem esperar a
 * rede —, e o de quem criou a sala cuida dos monstros.
 *
 * - `anfitriao`: a luta de sempre, com mais um corpo na sala: os monstros
 *   escolhem entre o herói daqui e o parceiro (o mais perto de pé), e o dano
 *   que o parceiro causa chega pela entrada (`danoDeFora`).
 * - `convidado`: um **espelho**. Os monstros não pensam aqui: o estado deles
 *   chega pela entrada (`espelho`), o que mira o meu herói é testado contra
 *   ele aqui mesmo, e o dano que eu causo sai em `QuadroDaLuta.danos` em vez
 *   de derrubar alguém (quem derruba é o anfitrião; a queda volta no espelho,
 *   e é ela que paga o abate e vence a sala).
 *
 * Quem cai **vira fantasma** (anda, não age, e os monstros o ignoram) e a
 * luta segue com o outro; com os dois caídos, é derrota pros dois.
 */
export interface Dupla {
  papel: 'anfitriao' | 'convidado';
  /** Onde o parceiro está na sala. Ausente até ele dizer. */
  parceiro?: { x: number; y: number };
  /** O parceiro caiu: os monstros não vão atrás dele. */
  parceiroCaido?: boolean;
  /** O herói daqui caiu. */
  fantasma?: boolean;
}

/** Um monstro como o anfitrião o manda pro espelho. */
export interface MonstroNoEspelho {
  indice: number;
  fase: FaseDoMonstro;
  tempo: number;
  forca: number;
  alvo: number;
  x: number;
  y: number;
  rumoX: number;
  rumoY: number;
  corpoX: number;
  corpoY: number;
  poder?: PoderDoChefe;
  /** Mira o parceiro do anfitrião, que é o herói de quem recebe. */
  noParceiro?: boolean;
  hp: number;
  /** O monstro inteiro: quando o espelho ainda não o tem (os lacaios) ou quando ele mudou além da vida. */
  monstro?: CombatMonster;
}

/** O que o anfitrião manda dos monstros e das bolas, umas dez vezes por segundo. */
export interface Espelho {
  monstros: MonstroNoEspelho[];
  tiros: Tiro[];
}

export interface CompanheiroNaArena {
  /** O índice em `estado.party`. */
  indice: number;
  /** Passos até o próximo golpe. */
  tempo: number;
}

/** A bola do mágico, voando pela sala. */
export interface Tiro {
  x: number;
  y: number;
  vx: number;
  vy: number;
  raio: number;
  vida: number;
  /** Quem atirou (o índice na sala) e a força. */
  indice: number;
  forca: number;
}

export interface EventoAberto {
  evento: EventoDeArma;
  /** Passos desde o aperto que abriu. */
  passo: number;
  jogada: JogadaDoEvento;
  /** O monstro mirado (índice na sala). */
  alvo: number;
  estilo: AttackStyle;
  /** O evento é de um poder mágico (o id dele), e não do ataque: no fim, é o poder que sai, na força do evento. */
  poder?: string;
}

export interface Arena {
  /** Passos do mundo desde que a luta abriu. */
  passo: number;
  /** Conta os passos da câmera lenta. */
  lento: number;
  /** Por onde o herói entrou na sala. */
  chegada: Walker;
  /** Onde o herói está na sala, e pra onde olha: é ali que ele fica quando a luta acaba. */
  heroi: Walker;
  /** O monstro que o jogador escolheu (índice na sala); sempre um de pé enquanto a luta dura. */
  alvo: number;
  /**
   * O jogador tocou na placa desse alvo (`mirar`): no celular, o ataque vai
   * nele enquanto ele estiver ao alcance. Sem escolha (ou depois que ele
   * cai), vai no de pé mais perto.
   */
  escolhido?: boolean;
  monstros: MonstroNaArena[];
  companheiros: CompanheiroNaArena[];
  tiros: Tiro[];
  evento: EventoAberto | null;
  recarga: number;
  /** Por id de poder, quanto falta pra ele voltar. */
  recargaDosPoderes: Record<string, number>;
  recargaDoItem: number;
  /** Passos até a próxima rodada. */
  rodada: number;
  /** Passos até outro golpe poder começar. */
  intervalo: number;
  /** Quem golpeou por último (índice na sala; -1 ninguém): a vez passa pro próximo de pé. */
  vez: number;
  /**
   * O que sobra do escudo do vigor (a Encantadora, `items/encantamentos.ts`): apanha antes da vida e some com a
   * luta. Ausente quando o herói não tem vigor.
   */
  escudo?: number;
  /** A luta em dupla; ausente na luta de um só. */
  dupla?: Dupla;
}

export type FimDaLuta = 'vitoria' | 'derrota';

export interface LutaEmTempoReal {
  /** Na masmorra enquanto dura; no fim, o que `limparSala`/`perderLuta` deixaram (o andar seguinte, a cidade…). */
  estado: EstadoDoJogo;
  arena: Arena;
  pet: PetId | null;
  /** Jogada no teclado (o PC): o cajado pede letras em vez do desenho (`EVENTO_NO_TECLADO`). */
  teclado: boolean;
  fim: FimDaLuta | null;
  /** O item achado ao vencer. */
  loot: Item | null;
  /** O chefe final caiu e a masmorra foi zerada: a tela de vitória (`jogo/conquista.ts`). */
  conquista?: Conquista;
}

/** O que a pessoa fez neste passo. */
export interface EntradaDaLuta {
  /** O joystick (ou as teclas), inteiros de -STICK_MAX a STICK_MAX: o herói anda pela sala. */
  x: number;
  y: number;
  /** Tocou num monstro: ele vira o alvo (índice na sala). */
  mirar?: number;
  /**
   * No PC, onde o cursor está na sala, em unidades dela (doc do Breno de
   * 2026-11-15): o ataque vai no monstro da área em volta dele, ou no chão.
   * Ausente (o celular, ou o cursor fora da sala), vale o alvo da placa ou o mais perto.
   */
  cursor?: { x: number; y: number };
  /** Apertou o botão de ataque neste passo. Com evento aberto, conta como toque. */
  atacar?: boolean;
  /** Soltou o botão de ataque neste passo (a carga). */
  soltar?: boolean;
  /** Tocou no evento neste passo (barra, bolinha, ritmo, toque duplo). */
  tocar?: boolean;
  /** Desenho: onde o dedo está, na caixa do desenho. Ausente, o dedo está fora da tela. */
  dedo?: { x: number; y: number };
  /** Letras: a tecla de letra apertada neste passo. */
  tecla?: string;
  /** O poder apertado neste passo. */
  poder?: string;
  /** O item usado neste passo (uid). */
  item?: string;
  /** O menu de itens está aberto: o mundo anda em câmera lenta. */
  menu?: boolean;
  /** Em dupla: onde o parceiro está agora, e se caiu. */
  parceiro?: { x: number; y: number; caido?: boolean };
  /** Em dupla, o anfitrião: o dano que o parceiro causou desde o último passo. */
  danoDeFora?: readonly { indice: number; dano: number }[];
  /** Em dupla, o convidado: o estado dos monstros que chegou do anfitrião neste passo. */
  espelho?: Espelho;
  /** Em dupla: o parceiro saiu da sala. Quem ficou segue sozinho; se estava caído, perde. */
  semParceiro?: boolean;
  /** Em dupla: o parceiro gastou uma Poção de Reviver em mim — com quantos % da vida máxima eu levanto. */
  reviver?: number;
}

/** Algo que a tela mostra ou toca. */
export interface Acontecimento {
  tipo: 'numero' | 'som' | 'diario' | 'aviso';
  /** Número: o texto ("-12", "Errou"…). Diário e aviso: a frase. */
  texto?: string;
  /** Número: sobre quem. `chao`: o golpe que foi no chão, em (`x`, `y`). */
  onde?: 'monstro' | 'heroi' | 'companheiro' | 'chao';
  /** Número no chão: onde, em unidades da sala. */
  x?: number;
  y?: number;
  /** Número sobre monstro ou companheiro: qual (índice na sala, ou na equipe). */
  indice?: number;
  tom?: 'dano' | 'critico' | 'cura' | 'erro' | 'escudo';
  som?: Efeito;
}

export interface QuadroDaLuta {
  luta: LutaEmTempoReal;
  acontecimentos: Acontecimento[];
  /** Em dupla, no convidado: o dano que o herói daqui (e a equipe dele) causou neste passo, pra mandar ao anfitrião. */
  danos?: { indice: number; dano: number }[];
}

// ---------- abrir ----------

/**
 * Abre a luta na sala atual: prepara os monstros e o herói (`prepararLuta`),
 * põe os monstros nas casas deles (os caídos ficam no lugar, apagados), o
 * herói um passo pra dentro da porta por onde entrou (`heroiNaLuta`) e os
 * companheiros vivos ao lado. O alvo começa no primeiro de pé, como no site.
 * `chegada` é onde o herói estava quando a luta abriu. `teclado`: jogada
 * no PC, onde o cajado pede letras em vez do desenho.
 */
export function abrirLuta(
  estado: EstadoNaMasmorra,
  chegada: Walker,
  pet: PetId | null = null,
  teclado = false,
  dupla: Dupla['papel'] | null = null,
): QuadroDaLuta {
  const preparada = prepararLuta(estado);
  const sala = celulaAtual(preparada.estado) as DungeonCell;
  const dePe = indicesDePe(sala);

  const formato = geometriaDaSala(preparada.estado.masmorra.dungeon);
  const quantos = (sala.monsters ?? []).length;
  const monstros: MonstroNaArena[] = (sala.monsters ?? []).map((_, indice) => {
    const lugar = lugarDoMonstro(quantos, indice, formato);
    return {
      indice,
      fase: dePe.includes(indice) ? 'esperando' : 'caido',
      tempo: 0,
      forca: 1,
      alvo: -1,
      x: 0,
      y: 0,
      rumoX: 0,
      rumoY: 0,
      corpoX: lugar.x,
      corpoY: lugar.y,
    };
  });

  const companheiros: CompanheiroNaArena[] = [];
  preparada.estado.party.forEach((membro, indice) => {
    if (membro.hp > 0) companheiros.push({ indice, tempo: CADENCIA_DO_COMPANHEIRO / 2 + indice * 10 });
  });

  const arena: Arena = {
    passo: 0,
    lento: 0,
    chegada: { ...chegada },
    heroi: { ...heroiNaLuta(chegada, formato) },
    alvo: dePe[0] ?? 0,
    monstros,
    companheiros,
    tiros: [],
    evento: null,
    recarga: 0,
    recargaDosPoderes: {},
    recargaDoItem: 0,
    rodada: RODADA,
    intervalo: ESPERA_INICIAL,
    vez: -1,
  };
  const acontecimentos: Acontecimento[] = preparada.log.map((texto) => ({ tipo: 'diario', texto }));
  // O vigor da armadura encantada ergue o escudo na entrada da luta (só o app tem a arena).
  const escudo = escudoDoVigor(preparada.estado.hero);
  if (escudo > 0) {
    arena.escudo = escudo;
    acontecimentos.push({ tipo: 'aviso', texto: `💪 Vigor: escudo de ${escudo}` });
  }
  if (dupla) {
    arena.dupla = { papel: dupla };
    // Quem já chega caído (o fantasma que ninguém reviveu) só acompanha.
    if (preparada.estado.hero.hp <= 0) arena.dupla.fantasma = true;
  }
  return { luta: { estado: preparada.estado, arena, pet, teclado, fim: null, loot: null }, acontecimentos };
}

// ---------- o passo ----------

/**
 * Um passo da luta. O evento da arma corre em tempo de verdade; o mundo
 * (herói, monstros, companheiros, tiros, rodada) anda um passo — ou, em
 * câmera lenta, um a cada `LENTIDAO`.
 *
 * `now` é o relógio do `uid` do item que cai ao vencer (e do andar novo, se
 * foi chefe); sem ele, `Date.now`.
 */
export function passoDaLuta(luta: LutaEmTempoReal, entrada: EntradaDaLuta, rng: Rng, now?: () => number): QuadroDaLuta {
  if (luta.fim) return { luta, acontecimentos: [] };
  const l: Luta = { ...luta, arena: copiarArena(luta.arena), rng, now, acontecimentos: [], danos: [] };
  if (l.arena.dupla) receberDoParceiro(l, entrada);
  if (l.fim) return fecharPasso(l);

  if (entrada.mirar !== undefined) mirar(l, entrada.mirar);
  // O fantasma anda, mas não age.
  if (l.arena.dupla?.fantasma) l.arena.evento = null;
  else if (l.arena.evento) seguirEvento(l, entrada);
  else if (entrada.atacar && l.arena.recarga <= 0) abrirEvento(l, entrada);
  else if (entrada.poder) pedirPoder(l, entrada.poder);
  else if (entrada.item) usarItem(l, entrada.item);

  if (!l.fim) {
    // Em dupla não há câmera lenta (decisão do usuário, 2026-11-15): ninguém trava o outro.
    const lento = !l.arena.dupla && (!!l.arena.evento || !!entrada.menu);
    if (lento) l.arena.lento += 1;
    if (!lento || l.arena.lento % LENTIDAO === 0) passoDoMundo(l, entrada);
  }

  return fecharPasso(l);
}

function fecharPasso(l: Luta): QuadroDaLuta {
  const fora: LutaEmTempoReal = { estado: l.estado, arena: l.arena, pet: l.pet, teclado: l.teclado, fim: l.fim, loot: l.loot };
  const quadro: QuadroDaLuta = { luta: l.conquista ? { ...fora, conquista: l.conquista } : fora, acontecimentos: l.acontecimentos };
  if (l.danos.length > 0) quadro.danos = l.danos;
  return quadro;
}

/**
 * Vários passos de uma vez, cada um com a sua entrada, juntando o que
 * aconteceu; para no fim da luta. É o que os casos de teste usam pra conferir
 * uma luta inteira — e o que um servidor usaria pra refazer uma luta a partir
 * das entradas.
 */
export function simularLuta(luta: LutaEmTempoReal, entradas: readonly EntradaDaLuta[], rng: Rng, now?: () => number): QuadroDaLuta {
  let atual = luta;
  const acontecimentos: Acontecimento[] = [];
  const danos: { indice: number; dano: number }[] = [];
  for (const entrada of entradas) {
    if (atual.fim) break;
    const quadro = passoDaLuta(atual, entrada, rng, now);
    atual = quadro.luta;
    acontecimentos.push(...quadro.acontecimentos);
    if (quadro.danos) danos.push(...quadro.danos);
  }
  return danos.length > 0 ? { luta: atual, acontecimentos, danos } : { luta: atual, acontecimentos };
}

/** A luta enquanto o passo corre: a mesma, mais o sorteio, o relógio e o que vai pra tela. */
interface Luta extends LutaEmTempoReal {
  rng: Rng;
  now: (() => number) | undefined;
  acontecimentos: Acontecimento[];
  /** O dano causado neste passo no espelho (`QuadroDaLuta.danos`). */
  danos: { indice: number; dano: number }[];
}

function copiarArena(arena: Arena): Arena {
  return {
    ...arena,
    chegada: { ...arena.chegada },
    heroi: { ...arena.heroi },
    monstros: arena.monstros.map((m) => ({ ...m })),
    companheiros: arena.companheiros.map((c) => ({ ...c })),
    tiros: arena.tiros.map((t) => ({ ...t })),
    evento: arena.evento
      ? {
          ...arena.evento,
          jogada: {
            ...arena.evento.jogada,
            ...(arena.evento.jogada.toques ? { toques: [...arena.evento.jogada.toques] } : {}),
            ...(arena.evento.jogada.traco ? { traco: [...arena.evento.jogada.traco] } : {}),
            ...(arena.evento.jogada.teclas ? { teclas: [...arena.evento.jogada.teclas] } : {}),
          },
        }
      : null,
    recargaDosPoderes: { ...arena.recargaDosPoderes },
    ...(arena.dupla ? { dupla: { ...arena.dupla, ...(arena.dupla.parceiro ? { parceiro: { ...arena.dupla.parceiro } } : {}) } } : {}),
  };
}

function masmorra(l: Luta): EstadoNaMasmorra {
  if (l.estado.mapMode !== 'dungeon') throw new Error('a luta só acontece na masmorra');
  return l.estado;
}

function sala(l: Luta): DungeonCell {
  return celulaAtual(masmorra(l)) as DungeonCell;
}

function monstroNo(l: Luta, indice: number): CombatMonsterView {
  return monsterView((sala(l).monsters ?? [])[indice] as CombatMonster);
}

function jeitoDe(monstro: CombatMonsterView): JeitoDeLutar {
  return JEITOS_DE_LUTAR[monstro.behavior] ?? JEITOS_DE_LUTAR.agressivo;
}

/**
 * O jeito do golpe em curso: o do comportamento, e o chefe final mexe nele.
 * Na fúria o aviso e o descanso encurtam; o Golpe Devastador avisa por mais
 * tempo e pega mais longe (a tela desenha o aviso com este tamanho).
 */
export function jeitoDoGolpe(monstro: CombatMonsterView, poder?: PoderDoChefe): JeitoDeLutar {
  let jeito = jeitoDe(monstro);
  if (monstro.chefeFinal && monstro.furia) jeito = { ...jeito, aviso: Math.trunc((jeito.aviso * 2) / 3), descanso: Math.trunc(jeito.descanso / 2) };
  if (poder === 'devastador') jeito = { ...jeito, aviso: Math.trunc((jeito.aviso * 3) / 2), tamanho: Math.trunc((jeito.tamanho * 13) / 10) };
  return jeito;
}

/** O alvo do jogador, se ainda está de pé; senão o primeiro de pé. `null`, ninguém de pé. */
function alvoAtual(l: Luta): number | null {
  const escolhido = l.arena.monstros[l.arena.alvo];
  if (escolhido && escolhido.fase !== 'caido') return escolhido.indice;
  return l.arena.monstros.find((m) => m.fase !== 'caido')?.indice ?? null;
}

function geometria(l: Luta): GeometriaDaSala {
  return geometriaDaSala(masmorra(l).masmorra.dungeon);
}

/** O meio da casa em que o monstro `indice` começa a luta, em unidades da sala. */
export function lugarDoMonstro(quantos: number, indice: number, formato: GeometriaDaSala): { x: number; y: number } {
  const lugares = lugaresNaLuta(quantos, formato);
  const lugar = lugares[Math.min(indice, lugares.length - 1)] as { col: number; row: number };
  return { x: lugar.col * TILE_UNITS + TILE_UNITS / 2, y: lugar.row * TILE_UNITS + TILE_UNITS / 2 };
}

/** Onde o monstro `indice` está de pé agora: de onde sai a investida e o tiro, e o que o alcance mede. */
function lugarDe(l: Luta, indice: number): { x: number; y: number } {
  const m = l.arena.monstros.find((monstro) => monstro.indice === indice);
  if (!m) return lugarDoMonstro(l.arena.monstros.length, indice, geometria(l));
  return { x: m.corpoX, y: m.corpoY };
}

/**
 * Os lacaios entraram: cada novo aparece na casa dele pro novo tamanho do
 * grupo. Quem já estava na sala fica onde está (desde 2026-11-15 os monstros
 * andam; antes a sala toda se arrumava de novo).
 */
function porOsLacaios(l: Luta, novos: readonly number[]): void {
  const formato = geometria(l);
  for (const m of l.arena.monstros) {
    if (!novos.includes(m.indice)) continue;
    const lugar = lugarDoMonstro(l.arena.monstros.length, m.indice, formato);
    m.corpoX = lugar.x;
    m.corpoY = lugar.y;
  }
}

/**
 * A investida acabou em (m.x, m.y): o monstro fica ali, puxado pra dentro do
 * chão se passou da parede. A que pegou no herói (`raio` é o do corpo que
 * investe) para encostada nele, e não em cima: sem isso, quem investe de novo
 * de perto ia chegando mais perto a cada golpe, até ficar no mesmo ponto.
 */
function pousar(l: Luta, m: MonstroNaArena, raio?: number): void {
  let x = m.x;
  let y = m.y;
  if (raio !== undefined) {
    const heroi = l.arena.heroi;
    const limite = raio + RAIO_DO_HEROI;
    let dx = x - heroi.x;
    let dy = y - heroi.y;
    if (dx === 0 && dy === 0) {
      // Bem em cima: volta por onde veio.
      dx = -m.rumoX;
      dy = -m.rumoY;
    }
    const distancia = Math.sqrt(dx * dx + dy * dy);
    if (distancia > 0 && distancia < limite) {
      x = heroi.x + Math.trunc((dx * limite) / distancia);
      y = heroi.y + Math.trunc((dy * limite) / distancia);
    }
  }
  const { cols, rows } = geometria(l);
  const meia = TILE_UNITS / 2;
  m.corpoX = Math.min(Math.max(x, TILE_UNITS + meia), (cols - 1) * TILE_UNITS - meia);
  m.corpoY = Math.min(Math.max(y, TILE_UNITS + meia), (rows - 1) * TILE_UNITS - meia);
}

/**
 * Até onde o ataque comum do herói alcança, em unidades da sala, do pé dele
 * ao meio da casa do monstro: o alcance da classe em blocos
 * (`alcanceDoHeroi`) e mais meia casa — com 1 bloco, a casa do lado.
 */
export function alcanceNaArena(hero: Hero): number {
  return alcanceDoHeroi(hero) * TILE_UNITS + TILE_UNITS / 2;
}

/**
 * A velocidade de andar do herói na luta: a de sempre, na % da classe; com a
 * perna quebrada, o passo do mapa (`PASSO_COM_PERNA_QUEBRADA`) vale aqui
 * também (doc do Breno de 2026-11-15: membro quebrado afeta a batalha).
 */
export function velocidadeNaArena(hero: Hero): number {
  const pct = classeDeLuta(hero).velocidade;
  const daClasse = pct === 100 ? HERO_SPEED : Math.trunc((HERO_SPEED * pct) / 100);
  return hero.ferimentos?.perna ? Math.trunc(daClasse * PASSO_COM_PERNA_QUEBRADA) : daClasse;
}

/** O herói alcança o monstro `indice` com o ataque comum, com esta folga a mais? */
function alcanca(l: Luta, indice: number, folga = 0): boolean {
  const lugar = lugarDe(l, indice);
  const dx = l.arena.heroi.x - lugar.x;
  const dy = l.arena.heroi.y - lugar.y;
  const limite = alcanceNaArena(masmorra(l).hero) + folga;
  return dx * dx + dy * dy <= limite * limite;
}

/** O monstro de pé na área da mira em volta de (x, y): o mais perto do cursor; `null`, nenhum. No empate, o primeiro. */
function monstroNaMira(l: Luta, x: number, y: number): number | null {
  let melhor: number | null = null;
  let menor = 0;
  for (const m of l.arena.monstros) {
    if (m.fase === 'caido') continue;
    const lugar = lugarDe(l, m.indice);
    const dx = x - lugar.x;
    const dy = y - lugar.y;
    const distancia = dx * dx + dy * dy;
    if (distancia > AREA_DA_MIRA * AREA_DA_MIRA) continue;
    if (melhor === null || distancia < menor) {
      melhor = m.indice;
      menor = distancia;
    }
  }
  return melhor;
}

/** O monstro de pé mais perto do herói que o ataque alcança; `null`, nenhum. No empate, o primeiro. */
function maisPertoAoAlcance(l: Luta): number | null {
  let melhor: number | null = null;
  let menor = 0;
  for (const m of l.arena.monstros) {
    if (m.fase === 'caido' || !alcanca(l, m.indice)) continue;
    const lugar = lugarDe(l, m.indice);
    const dx = l.arena.heroi.x - lugar.x;
    const dy = l.arena.heroi.y - lugar.y;
    const distancia = dx * dx + dy * dy;
    if (melhor === null || distancia < menor) {
      melhor = m.indice;
      menor = distancia;
    }
  }
  return melhor;
}

/** Um rumo de comprimento `velocidade` de (0,0) até (dx, dy), em inteiros. */
function rumo(dx: number, dy: number, velocidade: number): { x: number; y: number } {
  const comprimento = Math.sqrt(dx * dx + dy * dy);
  if (comprimento === 0) return { x: 0, y: velocidade };
  return { x: Math.trunc((dx * velocidade) / comprimento), y: Math.trunc((dy * velocidade) / comprimento) };
}

/** O círculo de raio `raio` em (x, y) encosta no herói? */
function encosta(heroi: Walker, x: number, y: number, raio: number): boolean {
  const dx = heroi.x - x;
  const dy = heroi.y - y;
  const limite = raio + RAIO_DO_HEROI;
  return dx * dx + dy * dy <= limite * limite;
}

/** O ponto (x, y) chegou na parede em volta da sala? É onde a investida e o tiro acabam. */
function foraDoChao(l: Luta, x: number, y: number): boolean {
  const { cols, rows } = geometria(l);
  return x < TILE_UNITS || x > (cols - 1) * TILE_UNITS || y < TILE_UNITS || y > (rows - 1) * TILE_UNITS;
}

function contar(l: Luta, acontecimento: Acontecimento): void {
  l.acontecimentos.push(acontecimento);
}

function diario(l: Luta, linhas: readonly string[]): void {
  for (const texto of linhas) contar(l, { tipo: 'diario', texto });
}

// ---------- o ataque do herói ----------

/** Tocar num monstro de pé faz dele o alvo. Caído, ou um índice que não existe, não muda nada. */
function mirar(l: Luta, indice: number): void {
  const m = l.arena.monstros[indice];
  if (m && m.fase !== 'caido') {
    l.arena.alvo = m.indice;
    l.arena.escolhido = true;
  }
}

/** O ataque do botão: o da classe primeiro; o mágico sem mana pro golpe de magia cai pro físico. */
function estiloDoBotao(hero: Hero): AttackStyle {
  const ataques = ataquesDisponiveis(hero);
  const primeiro = ataques.find((a) => hero.mp >= a.custo) ?? ataques[ataques.length - 1];
  return (primeiro as (typeof ataques)[number]).estilo;
}

/**
 * O botão de ataque abre o evento da arma no alvo, que precisa estar ao
 * alcance da classe. No PC o alvo é o monstro na área do cursor; sem
 * nenhum, o golpe vai no chão, ali (doc do Breno de 2026-11-15). Sem cursor
 * (o celular), é o da placa, se o jogador escolheu e ele está ao alcance,
 * ou o de pé mais perto que estiver (e ele vira o alvo). Fora do alcance, o
 * botão só avisa.
 */
function abrirEvento(l: Luta, entrada: EntradaDaLuta): void {
  let alvo: number | null;
  if (entrada.cursor) {
    alvo = monstroNaMira(l, entrada.cursor.x, entrada.cursor.y);
    if (alvo === null) {
      golpeNoChao(l, entrada.cursor.x, entrada.cursor.y);
      return;
    }
    l.arena.alvo = alvo;
    if (!alcanca(l, alvo)) {
      contar(l, { tipo: 'aviso', texto: 'Chegue mais perto' });
      return;
    }
  } else {
    alvo = alvoAtual(l);
    if (alvo === null) return;
    if (!l.arena.escolhido || !alcanca(l, alvo)) {
      const perto = maisPertoAoAlcance(l);
      if (perto === null) {
        contar(l, { tipo: 'aviso', texto: 'Chegue mais perto' });
        return;
      }
      alvo = perto;
      l.arena.alvo = perto;
    }
  }
  const hero = masmorra(l).hero;
  const estilo = estiloDoBotao(hero);
  const evento = eventoDoAtaque(hero, estilo, l.rng, l.teclado);
  l.arena.evento = { evento, passo: 0, jogada: {}, alvo, estilo };
}

/** Sem monstro na área do cursor: o golpe vai no chão, sem evento, e o botão espera a recarga como depois de um golpe. */
function golpeNoChao(l: Luta, x: number, y: number): void {
  l.arena.recarga = RECARGA_DO_ATAQUE;
  contar(l, { tipo: 'numero', onde: 'chao', x: Math.trunc(x), y: Math.trunc(y), texto: 'Errou', tom: 'erro' });
  contar(l, { tipo: 'som', som: 'miss' });
}

/** O evento aberto anda um passo de verdade e lê o que a pessoa fez nele; terminado, o golpe sai. */
function seguirEvento(l: Luta, entrada: EntradaDaLuta): void {
  const aberto = l.arena.evento as EventoAberto;
  aberto.passo += 1;
  const { evento, jogada, passo } = aberto;
  const tocou = !!entrada.tocar || !!entrada.atacar;
  let pronto = passo >= evento.duracao;

  switch (evento.tipo) {
    case 'barra':
    case 'circulo':
      if (tocou && passo < evento.duracao) {
        jogada.toque = passo;
        pronto = true;
      }
      break;
    case 'carga':
      if (entrada.soltar && passo < evento.duracao) {
        jogada.soltou = passo;
        pronto = true;
      }
      break;
    case 'ritmo':
    case 'toque_duplo':
      if (tocou && passo <= evento.duracao) jogada.toques = [...(jogada.toques ?? []), passo];
      break;
    case 'desenho': {
      const traco = jogada.traco ?? [];
      if (entrada.dedo && passo <= evento.duracao) {
        const x = Math.max(0, Math.min(TAMANHO_DO_DESENHO, Math.trunc(entrada.dedo.x)));
        const y = Math.max(0, Math.min(TAMANHO_DO_DESENHO, Math.trunc(entrada.dedo.y)));
        const ultimo = traco[traco.length - 1];
        if (!ultimo || ultimo.x !== x || ultimo.y !== y) jogada.traco = [...traco, { x, y, t: passo }];
      } else if (!entrada.dedo && traco.length > 0) {
        // Levantou o dedo: o desenho acabou.
        pronto = true;
      }
      break;
    }
    case 'letras':
      if (entrada.tecla && passo <= evento.duracao) {
        jogada.teclas = [...(jogada.teclas ?? []), { letra: entrada.tecla, t: passo }];
        // Uma tecla na janela da última letra decide ela: não sobra nada pra apertar.
        const batidas = evento.notas ?? [];
        if (passo >= (batidas[batidas.length - 1] ?? 0) - (evento.janela ?? 0)) pronto = true;
      }
      break;
  }

  if (pronto) golpear(l);
}

/**
 * O evento terminou: lê, rola o d20 e o golpe cai no alvo do evento. Se ele
 * caiu enquanto o evento corria (um companheiro, o veneno), cai no alvo de agora.
 * Quem se afastou do alvo além do alcance durante o evento erra (sem dado).
 */
function golpear(l: Luta): void {
  const aberto = l.arena.evento as EventoAberto;
  l.arena.evento = null;
  l.arena.recarga = RECARGA_DO_ATAQUE;
  const leitura = lerEvento(aberto.evento, aberto.jogada);
  if (aberto.poder) {
    // O poder mágico sai na força do evento; errado, mais fraco.
    usarPoder(l, aberto.poder, leitura.acerto ? leitura.forca : FORCA_DO_PODER_ERRADO);
    return;
  }
  const doEvento = l.arena.monstros[aberto.alvo] as MonstroNaArena;
  const indice = doEvento.fase !== 'caido' ? doEvento.indice : alvoAtual(l);
  if (indice === null) return;
  if (!alcanca(l, indice, FOLGA_DO_ALCANCE)) {
    contar(l, { tipo: 'numero', onde: 'monstro', indice, texto: 'Longe', tom: 'erro' });
    contar(l, { tipo: 'som', som: 'miss' });
    return;
  }
  const dado = 1 + randomInt(LADOS_DO_DANO, l.rng);
  acertarMonstro(l, l.arena.monstros[indice] as MonstroNaArena, dado, leitura, aberto.estilo);
}

/** O golpe do herói chega no monstro: a regra do site, com a guarda do defensivo. */
function acertarMonstro(l: Luta, alvo: MonstroNaArena, dado: number, leitura: LeituraDaMira, estilo: AttackStyle): void {
  const monstro = monstroNo(l, alvo.indice);
  let lida = leitura;
  if (jeitoDe(monstro).guarda && alvo.fase === 'descansando' && leitura.acerto) {
    lida = { acerto: true, forca: Math.round(leitura.forca * 50) / 100, critico: false };
    contar(l, { tipo: 'aviso', texto: `${monstro.name} se protege!` });
  }
  const estado = masmorra(l);
  const golpe = resolverGolpe(estado.hero, monstro, dado, lida, estilo, {
    rng: l.rng,
    petCriticoBonus: petBonus(l.pet).critico ?? 0,
    danoDaClasse: classeDeLuta(estado.hero).dano,
  });
  // O golpe que acerta treina o atributo dele (`treino.ts`).
  const treinado = golpe.outcome === 'hit' ? anotarUso(golpe.hero, atributoDoGolpe(golpe.hero, estilo)) : golpe.hero;
  const ferida = ferirNaArena(l, { ...estado, hero: treinado }, alvo.indice, golpe.monster);

  if (golpe.outcome === 'no_mana') {
    contar(l, { tipo: 'aviso', texto: 'Mana insuficiente' });
    return;
  }
  if (golpe.outcome !== 'hit') {
    contar(l, { tipo: 'numero', onde: 'monstro', indice: alvo.indice, texto: golpe.outcome === 'dodged' ? 'Desviou' : 'Errou', tom: 'erro' });
    contar(l, { tipo: 'som', som: 'miss' });
    return;
  }
  contar(l, numeroNoMonstro(ferida, alvo.indice, `-${golpe.damage}`, golpe.isCrit ? 'critico' : 'dano'));
  contar(l, { tipo: 'som', som: golpe.isCrit ? 'crit' : 'hit' });
  if (!ferida.protegido) roubarVida(l, golpe.damage ?? 0);
  if (ferida.caiu) {
    abater(l, alvo.indice, golpe.monster);
    return;
  }
  if (!ferida.protegido) aplicarRunasDoGolpe(l, alvo.indice, monsterView(ferida.monstro), golpe.damage ?? 0);
}

/**
 * Grava o golpe no monstro com a regra do chefe final (`ferirMonstro`): o
 * protegido não sente nada, e o que chega à metade chama os lacaios — eles
 * entram no palco esperando a vez, e o alvo passa pro primeiro deles.
 */
function ferirNaArena(l: Luta, estado: EstadoNaMasmorra, indice: number, depois: CombatMonster): Ferida {
  if (noEspelho(l)) return ferirNoEspelho(l, estado, indice, depois);
  const ferida = ferirMonstro(estado, indice, depois, l.rng);
  l.estado = ferida.estado;
  if (ferida.lacaios.length > 0) {
    for (const novo of ferida.lacaios) l.arena.monstros.push({ indice: novo, fase: 'esperando', tempo: 0, forca: 1, alvo: -1, x: 0, y: 0, rumoX: 0, rumoY: 0, corpoX: 0, corpoY: 0 });
    porOsLacaios(l, ferida.lacaios);
    l.arena.alvo = ferida.lacaios[0] as number;
  }
  // O chefe final que chamou os lacaios tem o texto dele; o de andar 5 diz o que as mecânicas fizeram.
  const textos = ferida.lacaios.length > 0 && ferida.monstro.chefeFinal ? [textoDosLacaios(monsterView(ferida.monstro).name)] : ferida.textos;
  for (const texto of textos) contar(l, { tipo: 'aviso', texto });
  if (textos.length) diario(l, textos);
  return ferida;
}

/** O número do golpe no monstro: o dano, ou o escudo quando o chefe final está protegido pelos lacaios. */
function numeroNoMonstro(ferida: Ferida, indice: number, texto: string, tom: 'dano' | 'critico'): Acontecimento {
  if (ferida.protegido) return { tipo: 'numero', onde: 'monstro', indice, texto: '🛡️', tom: 'erro' };
  return { tipo: 'numero', onde: 'monstro', indice, texto, tom };
}

/**
 * As runas da arma no golpe que acertou (`items/runas.ts`). Só a arena as
 * aplica: no site a arma vale só pelos atributos. O choque pode derrubar.
 */
function aplicarRunasDoGolpe(l: Luta, indice: number, monstro: CombatMonsterView, dano: number): void {
  const estado = masmorra(l);
  const runas = aplicarRunas(estado.hero, monstro, dano, l.rng);
  if (runas.disparos.length === 0) return;
  const ferida = ferirNaArena(l, { ...estado, hero: runas.hero }, indice, runas.monster);
  for (const disparo of runas.disparos) {
    const icone = RUNAS[disparo.runa].icone;
    if (disparo.runa === 'vampirica') {
      if (disparo.valor > 0) contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `${icone}+${disparo.valor}`, tom: 'cura' });
    } else if (disparo.runa === 'eletrica') {
      contar(l, numeroNoMonstro(ferida, indice, `${icone}-${disparo.valor}`, 'dano'));
    } else {
      // Queimar e gelar só marcam o monstro, como o 💫 e o 🐌: sem dano agora, ele não treme.
      contar(l, { tipo: 'numero', onde: 'monstro', indice, texto: icone, tom: 'erro' });
    }
  }
  if (ferida.caiu) abater(l, indice, runas.monster);
}

// ---------- poderes e itens ----------

/**
 * O botão de um poder: o mágico (`TIPOS_DE_PODER_MAGICO`) abre o evento dele
 * (as letras no PC, o desenho no celular) e só sai quando o evento acaba; os
 * outros saem na hora. Sem mana, o mágico avisa antes de abrir o evento.
 */
function pedirPoder(l: Luta, id: string): void {
  const estado = masmorra(l);
  const poder = heroPowers(estado.hero).find((p) => p.id === id);
  if (!poder || (l.arena.recargaDosPoderes[id] ?? 0) > 0) return;
  if (!TIPOS_DE_PODER_MAGICO.includes(poder.type)) {
    usarPoder(l, id);
    return;
  }
  const alvo = alvoAtual(l);
  if (alvo === null) return;
  if (estado.hero.mp < powerManaCost(estado.hero, poder, descontoDeMana(estado.hero))) {
    contar(l, { tipo: 'aviso', texto: `Mana insuficiente para ${poder.name}` });
    return;
  }
  l.arena.evento = { evento: eventoDoPoder(l.rng, l.teclado), passo: 0, jogada: {}, alvo, estilo: 'magic', poder: id };
}

function usarPoder(l: Luta, id: string, forcaDoEvento = 1): void {
  const estado = masmorra(l);
  const poder = heroPowers(estado.hero).find((p) => p.id === id);
  if (!poder || (l.arena.recargaDosPoderes[id] ?? 0) > 0) return;
  const alvo = alvoAtual(l);
  if (alvo === null) return;

  const bonus = petBonus(l.pet);
  const monstro = monstroNo(l, alvo);
  // A Coroa do Arquimago (`items/acessorios-unicos.ts`) tira parte do custo: só aqui, na arena.
  const desconto = descontoDeMana(estado.hero);
  const uso = castPower(estado.hero, estado.party, monstro, poder, {
    rng: l.rng,
    petCuraBonus: bonus.healing ?? 0,
    petManaSaveChance: bonus.manaSave ?? 0,
    ...(desconto > 0 ? { descontoDeMana: desconto } : {}),
    danoDaClasse: classeDeLuta(estado.hero).dano,
    ...(forcaDoEvento !== 1 ? { forcaDoEvento } : {}),
  });
  if (uso.outcome === 'no_mana') {
    contar(l, { tipo: 'aviso', texto: `Mana insuficiente para ${poder.name}` });
    return;
  }
  if (uso.outcome === 'summon_full') {
    contar(l, { tipo: 'aviso', texto: `Seus ${MAX_ESQUELETOS} esqueletos já estão de pé` });
    return;
  }
  l.arena.recargaDosPoderes[id] = RECARGA_DO_PODER;
  // O poder usado treina o atributo dele e sobe o próprio nível pelo uso.
  const treino = treinarPoder(uso.hero, poder);
  if (treino.subiu) {
    diario(l, [textoDaHabilidade(poder.name, treino.subiu)]);
    contar(l, { tipo: 'aviso', texto: `⭐ ${poder.name} nível ${treino.subiu}` });
  }
  const ferida = ferirNaArena(l, { ...estado, hero: treino.hero, party: uso.party }, alvo, uso.monster);

  if (uso.outcome === 'damage') {
    contar(l, numeroNoMonstro(ferida, alvo, `${poder.icon} -${uso.damage}`, 'critico'));
    contar(l, { tipo: 'som', som: 'crit' });
  } else if (uso.outcome === 'heal') {
    contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `+${uso.healed}`, tom: 'cura' });
    contar(l, { tipo: 'som', som: 'heal' });
  } else if (uso.outcome === 'summon') {
    // O esqueleto entra no fim da equipe e começa a bater no tempo dele, como os companheiros da entrada.
    l.arena.companheiros.push({ indice: uso.party.length - 1, tempo: CADENCIA_DO_COMPANHEIRO / 2 });
    contar(l, { tipo: 'aviso', texto: `${poder.icon} ${uso.summoned?.name ?? 'Esqueleto'} se ergue` });
  } else {
    contar(l, { tipo: 'aviso', texto: `${poder.icon} ${poder.name}` });
  }
  if (uso.healed && uso.outcome === 'damage') contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `+${uso.healed}`, tom: 'cura' });
  if (ferida.caiu) abater(l, alvo, uso.monster);
}

function usarItem(l: Luta, uid: string): void {
  const estado = masmorra(l);
  const item = estado.inventory.find((atual) => atual.uid === uid);
  if (!item || !podeUsar(item) || l.arena.recargaDoItem > 0) return;
  const usado = usar({ estado, log: [] }, item);
  if (usado.estado.mapMode !== 'dungeon') return;
  l.arena.recargaDoItem = RECARGA_DO_ITEM;
  const cura = usado.estado.hero.hp - estado.hero.hp;
  l.estado = usado.estado;
  diario(l, usado.log);
  if (cura > 0) contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `+${cura}`, tom: 'cura' });
  contar(l, { tipo: 'som', som: 'heal' });
}

// ---------- o mundo ----------

/**
 * O herói anda pela sala com a regra de sempre (`walkTick`): as portas
 * fechadas (só se sai vencendo ou caindo), as paredes de dentro da masmorra
 * e cada monstro de pé tomando a casa dele. A casa de monstro em que o herói
 * já está pisando não conta (os lacaios aparecem onde ele pode estar, e quem
 * entra pelo lado numa sala cheia chega em cima de um): ele sai dela andando.
 */
function moverHeroi(l: Luta, entrada: EntradaDaLuta): Walker {
  const heroi = l.arena.heroi;
  if (Math.trunc(entrada.x) === 0 && Math.trunc(entrada.y) === 0) return heroi;
  const formato = geometria(l);
  const monstros: RoomObject[] = [];
  for (const m of l.arena.monstros) {
    // O caído não segura ninguém, nem o que está voando na investida (esse pega pelo golpe).
    if (m.fase === 'caido' || m.fase === 'investindo') continue;
    const lugar = { col: Math.floor(m.corpoX / TILE_UNITS), row: Math.floor(m.corpoY / TILE_UNITS) };
    const pisando =
      heroi.x + HERO_HALF > lugar.col * TILE_UNITS &&
      heroi.x - HERO_HALF < (lugar.col + 1) * TILE_UNITS &&
      heroi.y + HERO_HALF > lugar.row * TILE_UNITS &&
      heroi.y - HERO_HALF < (lugar.row + 1) * TILE_UNITS;
    if (!pisando) monstros.push({ id: `monstro_${m.indice}`, col: lugar.col, row: lugar.row });
  }
  const planta = roomLayout({}, monstros, paredesDaSala(masmorra(l).masmorra.dungeon), formato);
  return walkTick(planta, heroi, { x: entrada.x, y: entrada.y }, velocidadeNaArena(masmorra(l).hero)).walker;
}

function passoDoMundo(l: Luta, entrada: EntradaDaLuta): void {
  const arena = l.arena;
  arena.passo += 1;
  arena.heroi = moverHeroi(l, entrada);
  if (arena.recarga > 0) arena.recarga -= 1;
  if (arena.recargaDoItem > 0) arena.recargaDoItem -= 1;
  if (arena.intervalo > 0) arena.intervalo -= 1;
  for (const id of Object.keys(arena.recargaDosPoderes)) {
    const falta = (arena.recargaDosPoderes[id] as number) - 1;
    if (falta > 0) arena.recargaDosPoderes[id] = falta;
    else delete arena.recargaDosPoderes[id];
  }

  if (noEspelho(l)) {
    passoDoEspelho(l);
  } else {
    for (const m of arena.monstros) {
      if (l.fim) return;
      if (m.fase !== 'caido') agirMonstro(l, m);
    }
    if (l.fim) return;
    if (podeGolpear(l)) {
      const proximo = proximoDaVez(l);
      if (proximo) comecarGolpe(l, proximo);
    }
  }
  if (l.fim) return;
  if (!arena.dupla?.fantasma) {
    for (const c of arena.companheiros) {
      if (l.fim) return;
      agirCompanheiro(l, c);
    }
  }
  if (!noEspelho(l)) moverTiros(l);
  if (l.fim) return;

  arena.rodada -= 1;
  if (arena.rodada <= 0) {
    arena.rodada = RODADA;
    rodada(l);
  }
}

function agirMonstro(l: Luta, m: MonstroNaArena): void {
  const jeito = jeitoDoGolpe(monstroNo(l, m.indice), m.poder);
  switch (m.fase) {
    case 'esperando':
      // O respiro dele corre enquanto anda atrás do herói.
      if (m.tempo > 0) m.tempo -= 1;
      aproximar(l, m, jeito);
      return;
    case 'avisando':
      m.tempo -= 1;
      if (m.tempo <= 0) soltarGolpe(l, m, jeito);
      return;
    case 'investindo':
      investir(l, m, jeito);
      return;
    default:
      // Descansando, atordoado, hesitando: parado até o tempo acabar; aí volta a andar, no respiro dele.
      m.tempo -= 1;
      if (m.tempo <= 0) {
        m.fase = 'esperando';
        m.tempo = RESPIRO_DO_MONSTRO;
      }
  }
}

/** A distância (ao quadrado) do corpo do monstro ao herói. */
function distanciaDoHeroi(l: Luta, m: MonstroNaArena): number {
  const quem = presaDe(l, m);
  const dx = quem.x - m.corpoX;
  const dy = quem.y - m.corpoY;
  return dx * dx + dy * dy;
}

/** O monstro está perto o bastante do herói pro golpe dele começar? */
function aDistanciaDoGolpe(l: Luta, m: MonstroNaArena, jeito: JeitoDeLutar): boolean {
  return distanciaDoHeroi(l, m) <= jeito.distancia * jeito.distancia;
}

/**
 * O monstro esperando anda em linha reta pro herói, no passo dele, até a
 * distância do golpe. Não sai do chão da sala, não entra em casa de parede
 * (os cantos da Caverna) e não encosta em outro monstro de pé: barrado,
 * fica onde está neste passo.
 */
function aproximar(l: Luta, m: MonstroNaArena, jeito: JeitoDeLutar): void {
  escolherPresa(l, m);
  if (aDistanciaDoGolpe(l, m, jeito)) return;
  const heroi = presaDe(l, m);
  const r = rumo(heroi.x - m.corpoX, heroi.y - m.corpoY, jeito.passo);
  const { cols, rows } = geometria(l);
  const meia = TILE_UNITS / 2;
  const x = Math.min(Math.max(m.corpoX + r.x, TILE_UNITS + meia), (cols - 1) * TILE_UNITS - meia);
  const y = Math.min(Math.max(m.corpoY + r.y, TILE_UNITS + meia), (rows - 1) * TILE_UNITS - meia);
  const col = Math.floor(x / TILE_UNITS);
  const row = Math.floor(y / TILE_UNITS);
  if (paredesDaSala(masmorra(l).masmorra.dungeon).some((casa) => casa.col === col && casa.row === row)) return;
  for (const outro of l.arena.monstros) {
    if (outro === m || outro.fase === 'caido') continue;
    const dx = outro.corpoX - x;
    const dy = outro.corpoY - y;
    const antesX = outro.corpoX - m.corpoX;
    const antesY = outro.corpoY - m.corpoY;
    // Só barra quem chegaria mais perto do outro: afastar-se sempre pode.
    if (dx * dx + dy * dy < ESPACO_ENTRE_MONSTROS * ESPACO_ENTRE_MONSTROS && dx * dx + dy * dy < antesX * antesX + antesY * antesY) return;
  }
  m.corpoX = x;
  m.corpoY = y;
}

/** Há vaga pra mais um golpe começar: menos de `ATACANDO_DE_UMA_VEZ` golpeando e o respiro passado. */
function podeGolpear(l: Luta): boolean {
  if (l.arena.intervalo > 0) return false;
  const golpeando = l.arena.monstros.filter((m) => m.fase === 'avisando' || m.fase === 'investindo').length;
  return golpeando < ATACANDO_DE_UMA_VEZ;
}

/**
 * O próximo da vez: depois de quem golpeou por último, dando a volta, o
 * primeiro esperando com o respiro passado e já à distância do golpe dele.
 */
function proximoDaVez(l: Luta): MonstroNaArena | null {
  const monstros = l.arena.monstros;
  for (let k = 1; k <= monstros.length; k++) {
    const m = monstros[(l.arena.vez + k + monstros.length) % monstros.length] as MonstroNaArena;
    if (m.fase !== 'esperando' || m.tempo > 0) continue;
    if (aDistanciaDoGolpe(l, m, jeitoDe(monstroNo(l, m.indice)))) return m;
  }
  return null;
}

/**
 * O monstro tenta golpear: atordoado ou lento demais, perde o golpe; senão
 * sorteia em quem cai, como no site, e o aviso começa. Golpe no herói trava
 * o desenho no chão (o círculo e a investida miram onde o herói está
 * agora). Perder a vez também é a vez: o respiro do próximo começa igual.
 *
 * O chefe final, na vez de um poder (`poderDaVez`), avisa o nome dele e mira
 * sempre o herói: o Golpe Devastador com o dobro da força, o Rugido com a
 * de sempre, mas pegando também os companheiros quando o aviso acaba. O
 * poder conta já no começo, pra o aviso do próximo sair certo.
 */
function comecarGolpe(l: Luta, m: MonstroNaArena): void {
  const estado = masmorra(l);
  const monstro = monstroNo(l, m.indice);
  const poder = poderDaVez(monstro);
  const jeito = jeitoDoGolpe(monstro, poder ?? undefined);
  const inicio = startMonsterAttack(monstro, estado.hero, l.rng);
  const solta = poder !== null && inicio.outcome === 'ready';
  l.estado = gravarMonstro({ ...estado, hero: inicio.hero }, m.indice, solta ? { ...inicio.monster, poderes: (inicio.monster.poderes ?? 0) + 1 } : inicio.monster);
  l.arena.vez = m.indice;
  if (inicio.outcome === 'stunned') {
    m.fase = 'atordoado';
    m.tempo = TEMPO_ATORDOADO;
    l.arena.intervalo = INTERVALO_ENTRE_GOLPES;
    contar(l, { tipo: 'numero', onde: 'monstro', indice: m.indice, texto: '💫', tom: 'erro' });
    return;
  }
  if (inicio.outcome === 'lento_skip') {
    m.fase = 'hesitando';
    m.tempo = TEMPO_HESITANDO;
    l.arena.intervalo = INTERVALO_ENTRE_GOLPES;
    contar(l, { tipo: 'numero', onde: 'monstro', indice: m.indice, texto: '🐌', tom: 'erro' });
    return;
  }
  if (inicio.rageTriggered) contar(l, { tipo: 'aviso', texto: `${monstro.name} fica furioso!` });

  m.fase = 'avisando';
  m.tempo = jeito.aviso;
  m.forca = inicio.attackMult;
  if (solta) {
    m.poder = poder;
    m.alvo = -1;
    if (poder === 'devastador') m.forca = inicio.attackMult * FORCA_DO_DEVASTADOR;
    const { nome, icone } = PODERES_DO_CHEFE[poder];
    contar(l, { tipo: 'aviso', texto: `${icone} ${monstro.name}: ${nome}!` });
  } else {
    m.alvo = pickMonsterTarget(masmorra(l).party, l.rng) ?? -1;
  }
  m.rumoX = 0;
  m.rumoY = 0;
  if (m.alvo >= 0) {
    // No companheiro: fora do chão, cai como no site quando o aviso acaba.
    m.x = 0;
    m.y = 0;
    return;
  }
  const heroi = presaDe(l, m);
  if (jeito.golpe === 'perto') {
    m.x = heroi.x;
    m.y = heroi.y;
    return;
  }
  // A investida e o tiro saem de onde o monstro está.
  const lugar = lugarDe(l, m.indice);
  m.x = lugar.x;
  m.y = lugar.y;
  if (jeito.golpe === 'investida') {
    const r = rumo(heroi.x - m.x, heroi.y - m.y, jeito.velocidade);
    m.rumoX = r.x;
    m.rumoY = r.y;
  }
}

/** O aviso acabou: o golpe sai. O Rugido do chefe final pega antes cada companheiro de pé. */
function soltarGolpe(l: Luta, m: MonstroNaArena, jeito: JeitoDeLutar): void {
  if (m.poder === 'rugido') rugirNaEquipe(l, m);
  if (m.alvo >= 0) {
    golpeNoCompanheiro(l, m, m.alvo);
    descansar(l, m, jeito);
    return;
  }
  if (jeito.golpe === 'investida') {
    m.fase = 'investindo';
    investir(l, m, jeito);
    return;
  }
  if (jeito.golpe === 'tiro') {
    // A bola mira onde o herói está agora, no fim do aviso.
    const heroi = presaDe(l, m);
    const v = rumo(heroi.x - m.x, heroi.y - m.y, jeito.velocidade);
    l.arena.tiros.push({ x: m.x, y: m.y, vx: v.x, vy: v.y, raio: jeito.tamanho, vida: VIDA_DO_TIRO, indice: m.indice, forca: m.forca });
    descansar(l, m, jeito);
    return;
  }
  if (pega(l, m.x, m.y, jeito.tamanho)) golpeNoHeroi(l, m.indice, m.forca);
  // O golpe no parceiro quem julga é o app dele: daqui não dá pra dizer que errou.
  else if (!m.noParceiro) contar(l, { tipo: 'numero', onde: 'monstro', indice: m.indice, texto: 'Errou', tom: 'erro' });
  descansar(l, m, jeito);
}

/** O Rugido do chefe final pega cada companheiro de pé, na força do golpe, como o golpe do site num companheiro. */
function rugirNaEquipe(l: Luta, m: MonstroNaArena): void {
  const estado = masmorra(l);
  const monstro = monstroNo(l, m.indice);
  const party = estado.party.map((membro, indice) => {
    if (membro.hp <= 0) return membro;
    const golpe = hitPartyMember(membro, monstro, m.forca, l.rng);
    contar(l, { tipo: 'numero', onde: 'companheiro', indice, texto: `-${golpe.damage}`, tom: 'dano' });
    if (golpe.defeated) diario(l, [`${membro.name} caiu!`]);
    return golpe.member;
  });
  l.estado = { ...estado, party };
}

/** O golpe acabou: o monstro descansa, e o próximo golpe espera o respiro. */
function descansar(l: Luta, m: MonstroNaArena, jeito: JeitoDeLutar): void {
  delete m.poder;
  if (l.fim) return;
  m.fase = 'descansando';
  m.tempo = jeito.descanso;
  l.arena.intervalo = INTERVALO_ENTRE_GOLPES;
}

/** A investida segue pelo rumo travado: encostou no herói, pega e para; chegou na parede, acabou. O monstro fica onde ela acabou. */
function investir(l: Luta, m: MonstroNaArena, jeito: JeitoDeLutar): void {
  m.x += m.rumoX;
  m.y += m.rumoY;
  if (pega(l, m.x, m.y, jeito.tamanho)) {
    pousar(l, m, jeito.tamanho);
    golpeNoHeroi(l, m.indice, m.forca);
    descansar(l, m, jeito);
    return;
  }
  // Bateu no parceiro: para ali (o golpe quem julga é o app dele).
  if (pegaOParceiro(l, m.x, m.y, jeito.tamanho)) {
    pousar(l, m);
    descansar(l, m, jeito);
    return;
  }
  if (foraDoChao(l, m.x, m.y)) {
    pousar(l, m);
    contar(l, { tipo: 'numero', onde: 'monstro', indice: m.indice, texto: 'Errou', tom: 'erro' });
    descansar(l, m, jeito);
  }
}

/**
 * O golpe do monstro `indice` pegou no herói: a regra do site, com a esquiva de sempre, mais a armadura
 * encantada (que só a arena aplica) e o escudo do vigor, que apanha antes da vida.
 */
function golpeNoHeroi(l: Luta, indice: number, forca: number): void {
  const estado = masmorra(l);
  const monstro = monstroNo(l, indice);
  const golpe = landHitOnHero(estado.hero, monstro, forca, l.rng, petBonus(l.pet).esquiva ?? 0, defesasDoHeroi(estado.hero));
  if (golpe.dodged) {
    // Esquivar treina a Destreza.
    l.estado = gravarMonstro({ ...estado, hero: anotarUso(golpe.hero, 'destreza') }, indice, golpe.monster);
    contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: 'Desviou', tom: 'erro' });
    contar(l, { tipo: 'som', som: 'miss' });
    return;
  }
  let hero = noEscudo(l, estado.hero.hp, golpe.hero, golpe.damage);
  // Os pesados (os Brutamontes) também quebram osso, como o chefe já quebra (doc do Breno de 2026-11-15; só aqui).
  let quebrou: Membro | undefined = golpe.quebrou;
  if (!quebrou && !monstro.isBoss && monstro.enemyClassId === 'brutamontes' && l.rng() < CHANCE_DE_QUEBRAR_NO_CHEFE) {
    const quebra = quebrarMembro(hero, l.rng);
    hero = quebra.hero;
    quebrou = quebra.membro;
  }
  l.estado = gravarMonstro({ ...estado, hero }, indice, golpe.monster);
  contar(l, { tipo: 'som', som: 'hit' });
  if (quebrou) {
    const texto = `🦴 ${monstro.name} quebrou ${nomeDoMembro(quebrou)}!`;
    contar(l, { tipo: 'aviso', texto });
    diario(l, [texto]);
  }
  if (golpe.manaDrained > 0) contar(l, { tipo: 'aviso', texto: `${monstro.name} drena ${golpe.manaDrained} de mana` });
  if (golpe.drainResisted) contar(l, { tipo: 'aviso', texto: 'Sua armadura segura o dreno de mana' });
  if (golpe.poisonApplied) contar(l, { tipo: 'aviso', texto: 'Você foi envenenado' });
  if (golpe.poisonResisted) contar(l, { tipo: 'aviso', texto: 'Sua armadura segura o veneno' });
  if (hero.hp <= 0) cair(l);
}

/**
 * O dano no herói passa primeiro pelo escudo do vigor: ele aguenta o que tiver, e a vida perde só o resto. Conta
 * os números (o do escudo no tom dele) e devolve o herói com a vida certa. Sem escudo, é o dano de sempre.
 */
function noEscudo(l: Luta, vidaAntes: number, hero: Hero, dano: number): Hero {
  const escudo = l.arena.escudo ?? 0;
  const absorvido = Math.min(escudo, dano);
  if (absorvido <= 0) {
    contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `-${dano}`, tom: 'dano' });
    return hero;
  }
  l.arena.escudo = escudo - absorvido;
  contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `💪-${absorvido}`, tom: 'escudo' });
  const resto = dano - absorvido;
  if (resto > 0) contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `-${resto}`, tom: 'dano' });
  return { ...hero, hp: Math.max(0, vidaAntes - resto) };
}

/** O golpe do monstro `m` cai no companheiro `alvo`, como no site. Se ele já caiu, o golpe vai no vazio. */
function golpeNoCompanheiro(l: Luta, m: MonstroNaArena, alvo: number): void {
  const estado = masmorra(l);
  const membro = estado.party[alvo];
  if (!membro || membro.hp <= 0) {
    contar(l, { tipo: 'numero', onde: 'monstro', indice: m.indice, texto: 'Errou', tom: 'erro' });
    return;
  }
  const golpe = hitPartyMember(membro, monstroNo(l, m.indice), m.forca, l.rng);
  l.estado = { ...estado, party: estado.party.map((atual, i) => (i === alvo ? golpe.member : atual)) };
  contar(l, { tipo: 'numero', onde: 'companheiro', indice: alvo, texto: `-${golpe.damage}`, tom: 'dano' });
  contar(l, { tipo: 'som', som: 'hit' });
  if (golpe.defeated) diario(l, [`${membro.name} caiu!`]);
}

/** O companheiro bate no alvo do jogador, no tempo dele. */
function agirCompanheiro(l: Luta, c: CompanheiroNaArena): void {
  const estado = masmorra(l);
  const membro = estado.party[c.indice];
  if (!membro || membro.hp <= 0) return;
  if (c.tempo > 0) c.tempo -= 1;
  if (c.tempo > 0) return;
  const alvo = alvoAtual(l);
  if (alvo === null) return;
  c.tempo = CADENCIA_DO_COMPANHEIRO;
  const monstro = monstroNo(l, alvo);
  const acao = partyMemberAct(estado.hero, membro, monstro, l.rng);
  const ferida = ferirNaArena(l, { ...estado, hero: acao.hero }, alvo, acao.monster);
  const resultado = acao.outcome;
  if (resultado.kind === 'healed_hero') {
    contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `+${resultado.amount}`, tom: 'cura' });
  } else if (resultado.kind === 'miss') {
    contar(l, { tipo: 'numero', onde: 'monstro', indice: alvo, texto: 'Errou', tom: 'erro' });
  } else {
    contar(l, numeroNoMonstro(ferida, alvo, `-${resultado.amount}`, 'dano'));
    if (ferida.caiu) abater(l, alvo, monsterView(acao.monster));
  }
}

/** As bolas voam; a que encosta no herói pega, a que chega na parede (ou acaba) errou. */
function moverTiros(l: Luta): void {
  const ficam: Tiro[] = [];
  for (const t of l.arena.tiros) {
    if (l.fim) break;
    t.x += t.vx;
    t.y += t.vy;
    t.vida -= 1;
    if (t.vida <= 0 || foraDoChao(l, t.x, t.y)) {
      contar(l, { tipo: 'numero', onde: 'monstro', indice: t.indice, texto: 'Errou', tom: 'erro' });
      continue;
    }
    if (pega(l, t.x, t.y, t.raio)) {
      golpeNoHeroi(l, t.indice, t.forca);
      continue;
    }
    // A bola some no parceiro (o golpe quem julga é o app dele).
    if (pegaOParceiro(l, t.x, t.y, t.raio)) continue;
    ficam.push(t);
  }
  l.arena.tiros = ficam;
}

/** A rodada: o veneno do herói, o dano contínuo de cada monstro de pé e a Canção de Batalha. */
function rodada(l: Luta): void {
  const antes = masmorra(l).hero;
  const veneno = tickHeroStatus(antes);
  // O veneno também passa primeiro pelo escudo do vigor.
  const hero = veneno.damage > 0 ? noEscudo(l, antes.hp, veneno.hero, veneno.damage) : veneno.hero;
  l.estado = { ...masmorra(l), hero };
  if (hero.hp <= 0 && !l.arena.dupla?.fantasma) {
    diario(l, ['O veneno foi mais forte.']);
    cair(l);
    if (l.fim) return;
  }
  regenerar(l);

  // No espelho, o veneno e o fogo dos monstros correm no app do anfitrião.
  for (const indice of noEspelho(l) ? [] : indicesDePe(sala(l))) {
    const monstro = monstroNo(l, indice);
    const dot = tickMonsterDot(monstro);
    const ferida = ferirNaArena(l, masmorra(l), indice, dot.monster as CombatMonster);
    if (dot.damage > 0) contar(l, numeroNoMonstro(ferida, indice, `-${dot.damage}`, 'dano'));
    if (ferida.caiu) abater(l, indice, monsterView(dot.monster as CombatMonster));
    if (l.fim) return;
  }

  l.estado = { ...masmorra(l), hero: passarRodadaDaCancao(masmorra(l).hero) };
}

// ---------- os acessórios únicos (`items/acessorios-unicos.ts`; só a arena os aplica) ----------

/** A Presa do Morcego: o golpe que acertou devolve em vida parte do dano, como a runa vampírica. */
function roubarVida(l: Luta, dano: number): void {
  const estado = masmorra(l);
  const efeito = efeitoDoUnico(estado.hero);
  if (efeito?.efeito !== 'roubo_de_vida' || dano <= 0) return;
  const hero = estado.hero;
  const cura = Math.max(0, Math.min(hero.maxHp - hero.hp, Math.max(1, Math.round(dano * efeito.valor))));
  if (cura <= 0) return;
  l.estado = { ...estado, hero: { ...hero, hp: hero.hp + cura } };
  contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `🦇+${cura}`, tom: 'cura' });
}

/** O Amuleto da Floresta Antiga: a cada rodada da luta, uma parte da vida máxima volta. */
function regenerar(l: Luta): void {
  const estado = masmorra(l);
  const efeito = efeitoDoUnico(estado.hero);
  const hero = estado.hero;
  if (efeito?.efeito !== 'regeneracao' || hero.hp <= 0 || hero.hp >= hero.maxHp) return;
  const cura = Math.min(hero.maxHp - hero.hp, Math.max(1, Math.floor(hero.maxHp * efeito.valor)));
  l.estado = { ...estado, hero: { ...hero, hp: hero.hp + cura } };
  contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `🌲+${cura}`, tom: 'cura' });
}

// ---------- quem cai ----------

/**
 * O monstro `indice` caiu: é pago, e o alvo passa pro primeiro de pé; foi o
 * último, a sala está limpa e a luta acaba em vitória.
 */
function abater(l: Luta, indice: number, abatido: CombatMonsterView): void {
  const m = l.arena.monstros[indice];
  if (m) m.fase = 'caido';
  // O escolhido caiu: o ataque volta a ir no mais perto.
  if (indice === l.arena.alvo) delete l.arena.escolhido;
  const pago = pagarAbate(masmorra(l), abatido);
  // Caiu o último lacaio: o chefe final fica furioso.
  const furia = enfurecer(pago.estado);
  l.estado = furia.estado;
  diario(l, [...pago.log, ...furia.log]);
  for (const texto of furia.log) contar(l, { tipo: 'aviso', texto });
  const dePe = indicesDePe(sala(l));
  if (dePe.length > 0) {
    if (!dePe.includes(l.arena.alvo)) l.arena.alvo = dePe[0] as number;
    return;
  }

  // A arena só existe no app: o item achado pode vir com material.
  const limpa = limparSala(masmorra(l), abatido, l.rng, l.now, true);
  l.estado = limpa.estado;
  l.loot = limpa.loot;
  if (limpa.conquista) l.conquista = limpa.conquista;
  l.fim = 'vitoria';
  l.arena.evento = null;
  l.arena.tiros = [];
  diario(l, limpa.log);
  contar(l, { tipo: 'som', som: 'victory' });
}

// ---------- a luta em dupla ----------

function noEspelho(l: Luta): boolean {
  return l.arena.dupla?.papel === 'convidado';
}

/** O parceiro está de pé na sala, e eu sei onde. */
function parceiroDePe(l: Luta): { x: number; y: number } | null {
  const dupla = l.arena.dupla;
  if (!dupla || !dupla.parceiro || dupla.parceiroCaido) return null;
  return dupla.parceiro;
}

/** Atrás de quem o monstro vai: o parceiro, se foi quem ele escolheu e ainda está de pé; senão o herói daqui. */
function presaDe(l: Luta, m: MonstroNaArena): { x: number; y: number } {
  return (m.noParceiro ? parceiroDePe(l) : null) ?? l.arena.heroi;
}

/**
 * Em dupla, o monstro que espera escolhe o herói de pé mais perto do corpo
 * dele (o fantasma não conta). Sem sorteio: na luta de um só, nada muda.
 */
function escolherPresa(l: Luta, m: MonstroNaArena): void {
  const parceiro = parceiroDePe(l);
  if (!parceiro) {
    delete m.noParceiro;
    return;
  }
  if (l.arena.dupla?.fantasma) {
    m.noParceiro = true;
    return;
  }
  const heroi = l.arena.heroi;
  const daqui = (heroi.x - m.corpoX) ** 2 + (heroi.y - m.corpoY) ** 2;
  const dele = (parceiro.x - m.corpoX) ** 2 + (parceiro.y - m.corpoY) ** 2;
  if (dele < daqui) m.noParceiro = true;
  else delete m.noParceiro;
}

/** O golpe pega o herói daqui (o fantasma não apanha). */
function pega(l: Luta, x: number, y: number, raio: number): boolean {
  return !l.arena.dupla?.fantasma && encosta(l.arena.heroi, x, y, raio);
}

function pegaOParceiro(l: Luta, x: number, y: number, raio: number): boolean {
  const parceiro = parceiroDePe(l);
  if (!parceiro) return false;
  const dx = parceiro.x - x;
  const dy = parceiro.y - y;
  const limite = raio + RAIO_DO_HEROI;
  return dx * dx + dy * dy <= limite * limite;
}

/** O que chegou do parceiro neste passo: onde ele está, o dano que causou (no anfitrião) e o espelho (no convidado). */
function receberDoParceiro(l: Luta, entrada: EntradaDaLuta): void {
  const dupla = l.arena.dupla as Dupla;
  if (entrada.semParceiro) {
    // Sozinho de novo: quem estava caído não tem mais quem o levante.
    delete l.arena.dupla;
    for (const m of l.arena.monstros) delete m.noParceiro;
    if (dupla.fantasma) perder(l);
    return;
  }
  if (entrada.parceiro) {
    dupla.parceiro = { x: Math.trunc(entrada.parceiro.x), y: Math.trunc(entrada.parceiro.y) };
    if (entrada.parceiro.caido) dupla.parceiroCaido = true;
    else delete dupla.parceiroCaido;
  }
  if (dupla.fantasma && entrada.reviver) {
    l.estado = { ...masmorra(l), hero: reviver(masmorra(l).hero, entrada.reviver) };
    delete dupla.fantasma;
    const texto = '✨ Seu parceiro reviveu você!';
    contar(l, { tipo: 'aviso', texto });
    diario(l, [texto]);
    contar(l, { tipo: 'som', som: 'heal' });
  }
  if (dupla.fantasma && dupla.parceiroCaido) {
    perder(l);
    return;
  }
  if (dupla.papel === 'anfitriao') {
    for (const golpe of entrada.danoDeFora ?? []) {
      if (l.fim) return;
      danoDoParceiro(l, Math.trunc(golpe.indice), Math.trunc(golpe.dano));
    }
  } else if (entrada.espelho) {
    aplicarEspelho(l, entrada.espelho);
  }
}

/** No anfitrião: o parceiro feriu um monstro. Passa por `ferirMonstro`, como todo dano (a barreira, a metade da vida…). */
function danoDoParceiro(l: Luta, indice: number, dano: number): void {
  const m = l.arena.monstros[indice];
  if (!m || m.fase === 'caido' || !(dano > 0)) return;
  const antes = (sala(l).monsters ?? [])[indice] as CombatMonster;
  const depois: CombatMonster = { ...antes, hp: Math.max(0, antes.hp - dano) };
  const ferida = ferirNaArena(l, masmorra(l), indice, depois);
  contar(l, numeroNoMonstro(ferida, indice, `-${dano}`, 'dano'));
  if (ferida.caiu) abater(l, indice, monsterView(depois));
}

/**
 * No espelho o golpe do herói daqui não derruba ninguém: a vida do monstro
 * desce na tela (até 1), o dano vai pro anfitrião (`danos`) e a queda volta
 * dele. As mecânicas de chefe (`ferirMonstro`) também correm só lá.
 */
function ferirNoEspelho(l: Luta, estado: EstadoNaMasmorra, indice: number, depois: CombatMonster): Ferida {
  const antes = (celulaAtual(estado) as DungeonCell).monsters?.[indice] as CombatMonster;
  const dano = Math.max(0, antes.hp - depois.hp);
  if (dano > 0) l.danos.push({ indice, dano });
  const monstro: CombatMonster = { ...depois, hp: Math.max(1, Math.min(antes.hp, depois.hp)) };
  l.estado = gravarMonstro(estado, indice, monstro);
  return { estado: l.estado as EstadoNaMasmorra, monstro, caiu: false, protegido: false, lacaios: [], textos: [] };
}

/** O estado dos monstros que chegou do anfitrião por cima do daqui; quem caiu lá cai aqui, e paga o abate. */
function aplicarEspelho(l: Luta, espelho: Espelho): void {
  const arena = l.arena;
  for (const de of espelho.monstros) {
    if (l.fim) return;
    const indice = Math.trunc(de.indice);
    const lista = sala(l).monsters ?? [];
    if (indice < 0 || indice > lista.length) continue;
    // Um lacaio que o espelho ainda não tinha: entra com o monstro inteiro.
    if (indice === lista.length) {
      if (!de.monstro) continue;
      const estado = masmorra(l);
      const celula = celulaAtual(estado) as DungeonCell;
      l.estado = substituirCelulaAtual(estado, { ...celula, monsters: [...lista, de.monstro] });
      arena.monstros.push({ indice, fase: 'esperando', tempo: 0, forca: 1, alvo: -1, x: 0, y: 0, rumoX: 0, rumoY: 0, corpoX: de.corpoX, corpoY: de.corpoY });
    }
    const m = arena.monstros[indice] as MonstroNaArena;
    const jaCaido = m.fase === 'caido';
    const antes = (sala(l).monsters ?? [])[indice] as CombatMonster;
    const agora: CombatMonster = { ...(de.monstro ?? antes), hp: Math.max(0, Math.trunc(de.hp)) };
    l.estado = gravarMonstro(masmorra(l), indice, agora);
    if (jaCaido) continue;
    if (agora.hp <= 0 || de.fase === 'caido') {
      abater(l, indice, monsterView(agora));
      continue;
    }
    // O golpe é o mesmo de antes (mesma fase, ainda correndo): o que já me acertou continua contado.
    const mesmoGolpe = m.acertou && (de.fase === 'investindo' || de.fase === 'avisando') && (m.fase === 'investindo' || m.fase === 'avisando');
    const caiuOCirculo = m.fase === 'avisando' && de.fase !== 'avisando' && de.fase !== 'investindo';
    if (caiuOCirculo) golpeQueCaiu(l, m);
    m.fase = de.fase;
    m.tempo = de.tempo;
    m.forca = de.forca;
    m.alvo = de.alvo;
    m.x = de.x;
    m.y = de.y;
    m.rumoX = de.rumoX;
    m.rumoY = de.rumoY;
    m.corpoX = de.corpoX;
    m.corpoY = de.corpoY;
    if (de.poder) m.poder = de.poder;
    else delete m.poder;
    // Lá ele mira o parceiro do anfitrião, que sou eu: aqui é o herói daqui. E o contrário.
    if (de.noParceiro) delete m.noParceiro;
    else m.noParceiro = true;
    if (mesmoGolpe) m.acertou = true;
    else delete m.acertou;
  }
  if (l.fim) return;
  // As bolas: as do anfitrião no lugar das daqui (a que já me acertou não volta).
  arena.tiros = espelho.tiros.map((t) => ({ ...t }));
}

/**
 * No espelho: o aviso de um golpe de perto acabou no anfitrião, e o círculo
 * cai onde estava. Se o herói daqui está dentro, apanha — com a esquiva e as
 * defesas dele, sorteadas aqui.
 */
function golpeQueCaiu(l: Luta, m: MonstroNaArena): void {
  if (m.alvo >= 0 || m.acertou) return;
  const jeito = jeitoDoGolpe(monstroNo(l, m.indice), m.poder);
  if (jeito.golpe !== 'perto') return;
  if (pega(l, m.x, m.y, jeito.tamanho)) golpeNoHeroi(l, m.indice, m.forca);
}

/**
 * O passo dos monstros no espelho: nada de pensar. Entre um estado e outro
 * do anfitrião, a investida e as bolas seguem o rumo que tinham, e o que
 * encostar no herói daqui acerta (uma vez por golpe).
 */
function passoDoEspelho(l: Luta): void {
  for (const m of l.arena.monstros) {
    if (l.fim) return;
    if (m.fase === 'avisando') {
      if (m.tempo > 0) m.tempo -= 1;
      continue;
    }
    if (m.fase !== 'investindo' || m.acertou) continue;
    m.x += m.rumoX;
    m.y += m.rumoY;
    if (pega(l, m.x, m.y, jeitoDoGolpe(monstroNo(l, m.indice), m.poder).tamanho)) {
      m.acertou = true;
      golpeNoHeroi(l, m.indice, m.forca);
    }
  }
  if (l.fim) return;
  const ficam: Tiro[] = [];
  for (const t of l.arena.tiros) {
    if (l.fim) break;
    t.x += t.vx;
    t.y += t.vy;
    if (pega(l, t.x, t.y, t.raio)) {
      golpeNoHeroi(l, t.indice, t.forca);
      continue;
    }
    ficam.push(t);
  }
  l.arena.tiros = ficam;
}

/** O que o anfitrião manda pro espelho: os monstros como estão, com a vida. */
export function espelhoDaLuta(luta: LutaEmTempoReal, inteiros: readonly number[] = []): Espelho {
  if (luta.estado.mapMode !== 'dungeon') return { monstros: [], tiros: [] };
  const lista = (celulaAtual(luta.estado) as DungeonCell).monsters ?? [];
  return {
    monstros: luta.arena.monstros.map((m) => {
      const monstro = lista[m.indice] as CombatMonster;
      const { acertou: _acertou, ...resto } = m;
      return { ...resto, hp: monstro.hp, ...(inteiros.includes(m.indice) ? { monstro } : {}) };
    }),
    tiros: luta.arena.tiros.map((t) => ({ ...t })),
  };
}

/**
 * O herói daqui ficou sem vida. Na luta de um só (ou sem parceiro de pé), é
 * a derrota de sempre. Em dupla ele vira fantasma e a luta segue com o outro.
 */
function cair(l: Luta): void {
  const dupla = l.arena.dupla;
  if (!dupla || !parceiroDePe(l)) {
    perder(l);
    return;
  }
  if (dupla.fantasma) return;
  dupla.fantasma = true;
  l.arena.evento = null;
  const texto = '👻 Você caiu! Seu parceiro pode reviver você.';
  contar(l, { tipo: 'aviso', texto });
  diario(l, [texto]);
  contar(l, { tipo: 'som', som: 'defeat' });
}

function perder(l: Luta): void {
  const perdida = perderLuta(masmorra(l), l.rng);
  l.estado = perdida.estado;
  l.fim = 'derrota';
  l.arena.evento = null;
  l.arena.tiros = [];
  diario(l, perdida.log);
  contar(l, { tipo: 'som', som: 'defeat' });
}

// ---------- pra tela ----------

/** O evento que o botão de ataque abriria agora (pro app desenhar o ícone do botão), sem sortear nada. */
export function eventoDoBotao(hero: Hero, teclado = false): TipoDeEvento {
  return eventoDaArma(hero.equip.arma?.templateId, teclado);
}
