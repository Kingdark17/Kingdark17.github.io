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
import { ataquesDisponiveis, FAIXA_CRITICA, LADOS_DO_DANO, resolverGolpe, type AttackStyle, type LeituraDaMira } from '../combat/resolve-attack.js';
import { tickHeroStatus } from '../combat/hero-status.js';
import { tickMonsterDot } from '../combat/status-effects.js';
import { castPower, powerManaCost } from '../combat/use-power.js';
import { anotarUso, atributoDoGolpe, textoDaHabilidade, treinarPoder } from '../hero/treino.js';
import { geometriaDaSala, paredesDaSala } from '../dungeon/arte-da-sala.js';
import type { DungeonCell } from '../dungeon/generate.js';
import { HERO_HALF, HERO_SPEED, roomLayout, TILE_UNITS, walkTick, type GeometriaDaSala, type RoomObject, type Walker } from '../dungeon/room-walk.js';
import type { Behavior } from '../monsters/species.js';
import { heroPowers, type Companion, type Hero } from '../hero/hero.js';
import type { Item } from '../items/item.js';
import { monsterLevel, monsterView } from '../monsters/generate.js';
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
import { aljavaNoArco, REGRAS_DAS_ALJAVAS, REGRAS_DAS_ARMAS_NOVAS } from '../items/pecas-secretas.js';
import { defesasDoHeroi, escudoDoVigor } from '../items/encantamentos.js';
import {
  criarLacaio,
  custoDoLacaio,
  esqueletosDePe,
  especieDoLacaio,
  estadoDoLacaio,
  MAX_ESQUELETOS,
  REGRAS_DO_NECROMANTE,
  type CristalDoInimigo,
} from '../combat/invocacao.js';
import { speciesById } from '../monsters/species.js';
import {
  alcanceDoHeroi,
  apoiaAliado,
  bonusDoAtaque,
  classeDeLuta,
  classeRefeita,
  contarAcerto,
  contarCriticoNoAliado,
  contarGolpeLevado,
  contarParado,
  auraDeFera,
  aCadaGolpe,
  atordoaNoChute,
  criticoDaArma,
  empurraoDoEmpurrao,
  escudoDoRevestimento,
  explosaoDaArma,
  kusarigamaNaMao,
  lancaNaMao,
  passosPorCargaDaConcentracao,
  podeLancarChapeu,
  velocidadeDaArma,
  danoDoMago,
  golpeQuePrende,
  raizesFundas,
  golpeForte,
  criticoDaClasse,
  criticoDoEstilo,
  curaDoApoio,
  custoDaMagia,
  devolucaoDaClasse,
  duracaoDaFe,
  efeitosDaMoral,
  esfriar,
  esquivaDaClasse,
  forcaDaExplosao,
  miraDaClasse,
  mortoVivo,
  oQueCanaliza,
  passosDoCanal,
  puxaOsMonstros,
  REGRAS_DO_BARBARO,
  REGRAS_DO_BARDO,
  REGRAS_DO_CLERIGO,
  REGRAS_DO_DRUIDA,
  REGRAS_DO_MONGE,
  REGRAS_DO_PALADINO,
  resistenciaDaClasse,
  type ContadoresDaClasse,
  type EfeitosDaMoral,
  type ExtrasDaClasse,
  type Moral,
} from '../hero/classes-de-luta.js';
import { idDaClasse } from '../hero/catalog.js';
import {
  idDoEstilo,
  REGRAS_DA_AGUA,
  REGRAS_DA_CONCENTRACAO,
  REGRAS_DA_ESCURIDAO,
  REGRAS_DA_METAMORFOSE,
  REGRAS_DA_TERRA,
  REGRAS_DO_ARCANO,
  REGRAS_DO_FOGO,
  REGRAS_DO_VENTO,
  REGRAS_DAS_RAIZES,
  REGRAS_DO_CHUTE,
  REGRAS_DO_EMPURRAO,
  REGRAS_DO_ESPADACHIM,
  REGRAS_DO_FLORESCIMENTO,
} from '../hero/estilos.js';
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
  /** Ele vai atrás de um lacaio do Necromante (o índice na equipe), e o golpe em curso cai nele (rodada 4b). */
  noLacaio?: number;
  /** Preso pelas Raízes Ocultas (rodada 5b): os passos que faltam. Não anda nem investe; o golpe de onde está, sim. */
  preso?: number;
  /** O Vento do Mago (rodada 5c) ou a aljava paralisante (6b) o acertou: ele golpeia de 1 bloco mais perto até o fim da luta. */
  encurtado?: boolean;
  /** O redemoinho da Água (rodada 5c): os passos que ainda anda mais devagar. */
  lerdo?: number;
  /** A aljava flamejante (rodada 6b): os próximos golpes dele que ainda saem mais fracos. */
  fraco?: number;
  /** A aljava flamejante (rodada 6b): incendiado, os passos que faltam e o dano de cada segundo. */
  incendio?: { tempo: number; dano: number };
}

/** A área de escuridão do Mago (rodada 5c): o meio dela, em unidades da sala, e os passos que ainda dura. */
export interface EscuridaoNaSala {
  x: number;
  y: number;
  tempo: number;
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
  /** O parceiro é Paladino: os monstros o escolhem como se ele estivesse mais perto (`REGRAS_DO_PALADINO.foco`). */
  parceiroPuxa?: boolean;
  /** O dano que o parceiro levou nos últimos 30 s (ele diz): a duração da Comunhão sagrada conta com ele. */
  parceiroDano?: number;
  /** As flores do Florescimento que o parceiro plantou (rodada 5b): curam o herói daqui também. */
  floresDoParceiro?: FlorNaSala[];
  /** O herói daqui caiu. */
  fantasma?: boolean;
}

/** Em quem o apoio do Bardo, do Clérigo e do Druida cai: o herói daqui ou o parceiro. */
export type Aliado = 'eu' | 'parceiro';

/**
 * O apoio que um herói solta no parceiro (rodada 3b, 2026-11-17): a cura e o
 * reforço do Bardo, a cura do Clérigo, a Purificação do Druida e a Comunhão
 * sagrada (com a duração, em passos). Sai em `QuadroDaLuta.apoios` de um
 * lado e chega em `EntradaDaLuta.apoios` do outro, que faz a conta com o
 * herói dele.
 */
export interface ApoioDoParceiro {
  tipo: 'bardo' | 'clerigo' | 'purificar' | 'comunhao';
  passos?: number;
  /** Os pontos de % de cura a mais (a Purificação da Metamorfose, rodada 5b). */
  mais?: number;
}

/** Uma flor do Florescimento (rodada 5b): o meio dela, em unidades da sala. */
export interface FlorNaSala {
  x: number;
  y: number;
}

/**
 * O que a luta leva de uma pra outra, guardado na memória do app (decisão do
 * usuário: fora do save): a moral do grupo e a recarga do Poder da fé.
 */
export interface MemoriaDaLuta {
  moral?: Moral;
  recargaDaFe?: number;
  /** A espera da Magia Proibida do Necromante (rodada 4b), em passos. */
  recargaDaMagia?: number;
  /** O ki do Monge que sobrou (rodada 4a: "o ki é preservado após a batalha se não for utilizado"). */
  ki?: number;
  /** A espera do chapéu do espadachim (rodada 6c), em passos. */
  recargaDoChapeu?: number;
}

/**
 * O chapéu do espadachim voando (rodada 6c): onde está e o passo dele, se já
 * bateu na parede e volta, quem ele já pegou nesta ida (ou nesta volta), o
 * dano que o primeiro levou (os outros levam o mesmo) e os passos que ainda
 * pode voar.
 */
export interface ChapeuNaSala {
  x: number;
  y: number;
  vx: number;
  vy: number;
  voltando?: boolean;
  pegos: number[];
  dano?: number;
  vida: number;
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
  /**
   * O lacaio do Necromante tem corpo na arena (rodada 4b, decisão do usuário):
   * onde ele está, em unidades da sala. Ausente, o companheiro fica de fora do
   * chão, como no site (os recrutas).
   */
  x?: number;
  y?: number;
}

/** O cristal que ficou onde o inimigo caiu, na luta do Necromante (rodada 4b): fica na sala até o herói sair dela. */
export interface CristalNaSala extends CristalDoInimigo {
  x: number;
  y: number;
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
  /** O ataque do Bardo, do Clérigo ou do Druida mirado num aliado: no fim, sai o apoio, e não o golpe. */
  aliado?: Aliado;
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
  /** O que a classe do herói junta nesta luta (a fúria, o combo…; `hero/classes-de-luta.ts`). Ausente até juntar algo. */
  classe?: ContadoresDaClasse;
  /** No celular: o jogador tocou na placa de um aliado, e o ataque do Bardo, do Clérigo ou do Druida vai nele. */
  alvoAliado?: Aliado;
  /** A moral do grupo (o Bardo): chega da memória do app na abertura (`MemoriaDaLuta`) e volta no fim. */
  moral?: Moral;
  /** O reforço do Bardo: os passos que ainda faltam do dano a mais (`REGRAS_DO_BARDO.forca`). */
  reforco?: number;
  /** O Poder da fé: os passos até ele voltar (chega da memória do app) e os que ainda faltam do que está de pé. */
  recargaDaFe?: number;
  fe?: number;
  /** O dano que o herói daqui levou, com o passo do mundo: a janela de 30 s do Poder da fé (só o Clérigo e a dupla contam). */
  danosLevados?: { passo: number; dano: number }[];
  /** O ki do Monge (rodada 4a), e se ele está revestido (até o próximo golpe levado). */
  ki?: number;
  revestido?: boolean;
  /** Segurando K: os passos desde o último ponto de mana ou de ki, e se segurou neste passo. */
  canal?: number;
  canalizando?: boolean;
  /** O Necromante (rodada 4b): os cristais dos inimigos que caíram nesta luta, e a espera da Magia Proibida. */
  cristais?: CristalNaSala[];
  recargaDaMagia?: number;
  /** O Florescimento (rodada 5b): as flores que o herói daqui plantou (a mais antiga primeiro), e os passos dentro de uma até a próxima cura. */
  flores?: FlorNaSala[];
  relogioDaFlor?: number;
  /** A área de escuridão do Mago (rodada 5c). */
  escuridao?: EscuridaoNaSala;
  /** O chapéu do espadachim voando, e a espera dele (rodada 6c). */
  chapeu?: ChapeuNaSala;
  recargaDoChapeu?: number;
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
  /** Em dupla: onde o parceiro está agora, se caiu, se é Paladino (`puxa`: os monstros o preferem) e o dano que ele levou nos últimos 30 s. */
  parceiro?: { x: number; y: number; caido?: boolean; puxa?: boolean; dano?: number; flores?: readonly FlorNaSala[] };
  /** Tocou na placa de um aliado (o celular): o ataque do Bardo, do Clérigo ou do Druida vai nele. */
  mirarAliado?: Aliado;
  /** Apertou o botão do Poder da fé (o Clérigo). */
  fe?: boolean;
  /** Em dupla: o apoio que o parceiro soltou em mim desde o último passo. */
  apoios?: readonly ApoioDoParceiro[];
  /** Em dupla: a moral do grupo, que o Bardo do parceiro subiu. */
  moral?: number;
  /** Segurando K neste passo: o Mago e o Necromante puxam mana, o Monge junta ki (parado e sem atacar). */
  canalizar?: boolean;
  /** O Monge: apertou o revestimento de ki, ou a explosão de ki. */
  revestir?: boolean;
  explodir?: boolean;
  /** O Necromante: apertou a Magia Proibida (levanta o parceiro caído). */
  magia?: boolean;
  /** O Espadachim: apertou o Corte Invernal. */
  corte?: boolean;
  /** O Florescimento no celular (rodada 5b): o botão 🌸 planta uma flor no pé do herói. */
  florescer?: boolean;
  /** O Monge e o Espadachim (rodada 6c): apertou o chapéu do espadachim (vai rumo ao cursor, ou ao alvo). */
  chapeu?: boolean;
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
  /** Em dupla: o apoio que o herói daqui soltou no parceiro neste passo, pra mandar a ele. */
  apoios?: ApoioDoParceiro[];
  /** O Bardo daqui subiu a moral do grupo neste passo: o nível novo, pra mandar ao parceiro. */
  moral?: number;
  /** A Magia Proibida levantou o parceiro: com quantos % da vida máxima (vai pela rede como a Poção de Reviver). */
  reviver?: number;
}

// ---------- abrir ----------

/**
 * Abre a luta na sala atual: prepara os monstros e o herói (`prepararLuta`),
 * põe os monstros nas casas deles (os caídos ficam no lugar, apagados), o
 * herói um passo pra dentro da porta por onde entrou (`heroiNaLuta`) e os
 * companheiros vivos ao lado. O alvo começa no primeiro de pé, como no site.
 * `chegada` é onde o herói estava quando a luta abriu. `teclado`: jogada
 * no PC, onde o cajado pede letras em vez do desenho. `memoria`: o que veio
 * da luta anterior (a moral do grupo, a recarga do Poder da fé).
 */
export function abrirLuta(
  estado: EstadoNaMasmorra,
  chegada: Walker,
  pet: PetId | null = null,
  teclado = false,
  dupla: Dupla['papel'] | null = null,
  memoria: MemoriaDaLuta = {},
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
  const heroiNaSala = heroiNaLuta(chegada, formato);
  const paredes = paredesDaSala(preparada.estado.masmorra.dungeon);
  let comCorpo = 0;
  preparada.estado.party.forEach((membro, indice) => {
    if (membro.hp <= 0) return;
    const c: CompanheiroNaArena = { indice, tempo: CADENCIA_DO_COMPANHEIRO / 2 + indice * 10 };
    // O lacaio do Necromante entra ao lado do herói (rodada 4b).
    if (membro.invocado) Object.assign(c, lugarAoLado(heroiNaSala, comCorpo++, formato, paredes));
    companheiros.push(c);
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
  if ((memoria.moral?.nivel ?? 0) > 0 || (memoria.moral?.criticos ?? 0) > 0) arena.moral = { ...memoria.moral };
  if ((memoria.recargaDaFe ?? 0) > 0) arena.recargaDaFe = Math.trunc(memoria.recargaDaFe as number);
  if ((memoria.ki ?? 0) > 0) arena.ki = Math.min(REGRAS_DO_MONGE.tetoDoKi, Math.trunc(memoria.ki as number));
  if ((memoria.recargaDaMagia ?? 0) > 0) arena.recargaDaMagia = Math.trunc(memoria.recargaDaMagia as number);
  if ((memoria.recargaDoChapeu ?? 0) > 0) arena.recargaDoChapeu = Math.trunc(memoria.recargaDoChapeu as number);
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
  const l: Luta = { ...luta, arena: copiarArena(luta.arena), rng, now, acontecimentos: [], danos: [], apoios: [] };
  // A recarga do Poder da fé corre no tempo de verdade, mesmo na câmera lenta.
  if (l.arena.recargaDaFe !== undefined) {
    if (l.arena.recargaDaFe > 1) l.arena.recargaDaFe -= 1;
    else delete l.arena.recargaDaFe;
  }
  if (l.arena.recargaDaMagia !== undefined) {
    if (l.arena.recargaDaMagia > 1) l.arena.recargaDaMagia -= 1;
    else delete l.arena.recargaDaMagia;
  }
  if (l.arena.recargaDoChapeu !== undefined) {
    if (l.arena.recargaDoChapeu > 1) l.arena.recargaDoChapeu -= 1;
    else delete l.arena.recargaDoChapeu;
  }
  if (l.arena.dupla) receberDoParceiro(l, entrada);
  if (l.fim) return fecharPasso(l);

  if (entrada.mirar !== undefined) mirar(l, entrada.mirar);
  if (entrada.mirarAliado) mirarAliado(l, entrada.mirarAliado);
  // O fantasma anda, mas não age.
  if (l.arena.dupla?.fantasma) l.arena.evento = null;
  else if (l.arena.evento) seguirEvento(l, entrada);
  else if (entrada.atacar && l.arena.recarga <= 0) abrirEvento(l, entrada);
  else if (entrada.poder) pedirPoder(l, entrada.poder);
  else if (entrada.fe) usarFe(l);
  else if (entrada.revestir) revestir(l);
  else if (entrada.explodir) explodir(l);
  else if (entrada.magia) usarMagia(l);
  else if (entrada.corte) corteInvernal(l);
  else if (entrada.chapeu) lancarChapeu(l, entrada);
  else if (entrada.florescer && l.arena.recarga <= 0) plantar(l, l.arena.heroi.x, l.arena.heroi.y);
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
  if (l.apoios.length > 0) quadro.apoios = l.apoios;
  if (l.moralSubiu !== undefined) quadro.moral = l.moralSubiu;
  if (l.reviverParceiro !== undefined) quadro.reviver = l.reviverParceiro;
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
  const apoios: ApoioDoParceiro[] = [];
  let moral: number | undefined;
  let reviver: number | undefined;
  for (const entrada of entradas) {
    if (atual.fim) break;
    const quadro = passoDaLuta(atual, entrada, rng, now);
    atual = quadro.luta;
    acontecimentos.push(...quadro.acontecimentos);
    if (quadro.danos) danos.push(...quadro.danos);
    if (quadro.apoios) apoios.push(...quadro.apoios);
    if (quadro.moral !== undefined) moral = quadro.moral;
    if (quadro.reviver !== undefined) reviver = quadro.reviver;
  }
  const quadro: QuadroDaLuta = { luta: atual, acontecimentos };
  if (danos.length > 0) quadro.danos = danos;
  if (apoios.length > 0) quadro.apoios = apoios;
  if (moral !== undefined) quadro.moral = moral;
  if (reviver !== undefined) quadro.reviver = reviver;
  return quadro;
}

/** A luta enquanto o passo corre: a mesma, mais o sorteio, o relógio e o que vai pra tela. */
interface Luta extends LutaEmTempoReal {
  rng: Rng;
  now: (() => number) | undefined;
  acontecimentos: Acontecimento[];
  /** O dano causado neste passo no espelho (`QuadroDaLuta.danos`). */
  danos: { indice: number; dano: number }[];
  /** O apoio solto no parceiro neste passo (`QuadroDaLuta.apoios`). */
  apoios: ApoioDoParceiro[];
  /** A moral que o Bardo daqui subiu neste passo (`QuadroDaLuta.moral`). */
  moralSubiu?: number;
  /** A Magia Proibida levantou o parceiro neste passo (`QuadroDaLuta.reviver`). */
  reviverParceiro?: number;
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
    ...(arena.classe ? { classe: { ...arena.classe } } : {}),
    ...(arena.moral ? { moral: { ...arena.moral } } : {}),
    ...(arena.danosLevados ? { danosLevados: arena.danosLevados.map((d) => ({ ...d })) } : {}),
    ...(arena.cristais ? { cristais: arena.cristais.map((c) => ({ ...c })) } : {}),
    ...(arena.chapeu ? { chapeu: { ...arena.chapeu, pegos: [...arena.chapeu.pegos] } } : {}),
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

/** O herói alcança o monstro `indice` com o ataque comum, com esta folga a mais? As vinhas do Druida têm a regra delas. */
function alcanca(l: Luta, indice: number, folga = 0): boolean {
  const lugar = lugarDe(l, indice);
  if (idDaClasse(masmorra(l).hero) === 'druida') {
    // Os estilos (rodada 5b): as Raízes pegam qualquer um da sala; a garra e a flor shuriken saem do herói, no alcance de todo mundo.
    const estilo = idDoEstilo(masmorra(l).hero);
    if (estilo === 'raizes') return true;
    if (estilo !== 'metamorfose' && estilo !== 'florescimento') return nasVinhas(l, lugar, folga);
  }
  const dx = l.arena.heroi.x - lugar.x;
  const dy = l.arena.heroi.y - lugar.y;
  // O Espadachim com o avanço pronto alcança mais: ele vai até o alvo (rodada 5a).
  const avanco = avancoPronto(l) ? REGRAS_DO_ESPADACHIM.avanco * TILE_UNITS : 0;
  const limite = alcanceNaArena(masmorra(l).hero) + folga + avanco;
  return dx * dx + dy * dy <= limite * limite;
}

/**
 * As vinhas do Druida (doc do Breno de 2026-11-15) vêm dos cantos: pegam o
 * monstro a até `REGRAS_DO_DRUIDA.vinhas` blocos de uma parede (a de volta
 * da sala ou uma de dentro) ou de um herói de pé (ele e o parceiro). O doc
 * também fala de arbusto, mas as salas não têm.
 */
function nasVinhas(l: Luta, lugar: { x: number; y: number }, folga: number): boolean {
  const alcance = REGRAS_DO_DRUIDA.vinhas * TILE_UNITS + folga;
  const { cols, rows } = geometria(l);
  const daParede = Math.min(lugar.x - TILE_UNITS, (cols - 1) * TILE_UNITS - lugar.x, lugar.y - TILE_UNITS, (rows - 1) * TILE_UNITS - lugar.y);
  if (daParede <= alcance) return true;
  for (const casa of paredesDaSala(masmorra(l).masmorra.dungeon)) {
    const dx = Math.max(casa.col * TILE_UNITS - lugar.x, 0, lugar.x - (casa.col + 1) * TILE_UNITS);
    const dy = Math.max(casa.row * TILE_UNITS - lugar.y, 0, lugar.y - (casa.row + 1) * TILE_UNITS);
    if (dx * dx + dy * dy <= alcance * alcance) return true;
  }
  // Do herói, como o alcance de todo mundo: do pé dele ao meio da casa do monstro, com meia casa a mais.
  const doHeroi = alcance + TILE_UNITS / 2;
  const herois = [l.arena.heroi, parceiroDePe(l)];
  return herois.some((h) => !!h && (h.x - lugar.x) * (h.x - lugar.x) + (h.y - lugar.y) * (h.y - lugar.y) <= doHeroi * doHeroi);
}

/** A área da mira do herói daqui, em unidades da sala: a de todo mundo, e a do Arqueiro 2,3× maior. */
function areaDaMira(l: Luta): number {
  const pct = miraDaClasse(masmorra(l).hero);
  return pct === 100 ? AREA_DA_MIRA : Math.trunc((AREA_DA_MIRA * pct) / 100);
}

/** O monstro de pé na área da mira em volta de (x, y): o mais perto do cursor; `null`, nenhum. No empate, o primeiro. */
function monstroNaMira(l: Luta, x: number, y: number): number | null {
  return maisPertoNaMira(l, x, y)?.indice ?? null;
}

/** O monstro de pé na área da mira em volta de (x, y), e a distância dele ao cursor (ao quadrado). */
function maisPertoNaMira(l: Luta, x: number, y: number): { indice: number; distancia: number } | null {
  const area = areaDaMira(l);
  let melhor: { indice: number; distancia: number } | null = null;
  for (const m of l.arena.monstros) {
    if (m.fase === 'caido') continue;
    const lugar = lugarDe(l, m.indice);
    const dx = x - lugar.x;
    const dy = y - lugar.y;
    const distancia = dx * dx + dy * dy;
    if (distancia > area * area) continue;
    if (melhor === null || distancia < melhor.distancia) melhor = { indice: m.indice, distancia };
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
    delete l.arena.alvoAliado;
  }
}

/** Tocar na placa de um aliado (o celular) faz dele o alvo do Bardo, do Clérigo e do Druida. Quem não apoia, ou o parceiro que não está, não muda nada. */
function mirarAliado(l: Luta, aliado: Aliado): void {
  if (!apoiaAliado(masmorra(l).hero)) return;
  if (aliado === 'parceiro' && !parceiroDePe(l)) return;
  l.arena.alvoAliado = aliado;
}

/** Onde o aliado está na sala; `null`, o parceiro que não está de pé. */
function lugarDoAliado(l: Luta, aliado: Aliado): { x: number; y: number } | null {
  return aliado === 'eu' ? l.arena.heroi : parceiroDePe(l);
}

/**
 * O aliado em que o ataque vai (o Bardo, o Clérigo, o Druida): no PC, o
 * herói (ele mesmo ou o parceiro) na área do cursor, se estiver mais perto
 * dele que o monstro mais perto; no celular, o da placa. `null`: o ataque vai
 * num monstro.
 */
function aliadoNaMira(l: Luta, entrada: EntradaDaLuta): Aliado | null {
  if (!apoiaAliado(masmorra(l).hero)) return null;
  if (!entrada.cursor) {
    const escolhido = l.arena.alvoAliado;
    if (escolhido && lugarDoAliado(l, escolhido)) return escolhido;
    delete l.arena.alvoAliado;
    return null;
  }
  const { x, y } = entrada.cursor;
  const area = areaDaMira(l);
  let melhor: Aliado | null = null;
  let menor = 0;
  for (const aliado of ['eu', 'parceiro'] as const) {
    const lugar = lugarDoAliado(l, aliado);
    if (!lugar) continue;
    const distancia = (x - lugar.x) * (x - lugar.x) + (y - lugar.y) * (y - lugar.y);
    if (distancia > area * area) continue;
    if (melhor === null || distancia < menor) {
      melhor = aliado;
      menor = distancia;
    }
  }
  if (melhor === null) return null;
  const monstro = maisPertoNaMira(l, x, y);
  return monstro && monstro.distancia < menor ? null : melhor;
}

/** O aliado está ao alcance do apoio: ele mesmo sempre; o parceiro, no alcance da classe (o Druida, sempre: as vinhas saem de quem está de pé). */
function alcancaOAliado(l: Luta, aliado: Aliado): boolean {
  if (aliado === 'eu') return true;
  const lugar = parceiroDePe(l);
  if (!lugar) return false;
  const hero = masmorra(l).hero;
  if (idDaClasse(hero) === 'druida') return true;
  const dx = l.arena.heroi.x - lugar.x;
  const dy = l.arena.heroi.y - lugar.y;
  const limite = alcanceNaArena(hero);
  return dx * dx + dy * dy <= limite * limite;
}

/** O evento do ataque, com a faixa do crítico da moral (o degrau 12 a alarga) e a da lança (rodada 6c). */
function eventoComAMoral(l: Luta, evento: EventoDeArma): EventoDeArma {
  const faixa = moralAqui(l).faixaCritica + (contadores(l).criticoMaior ? REGRAS_DAS_ARMAS_NOVAS.faixaDaLanca : 0);
  return faixa > 0 ? { ...evento, faixa: (FAIXA_CRITICA * (100 + faixa)) / 100 } : evento;
}

/** O que a moral do grupo dá agora. */
function moralAqui(l: Luta): EfeitosDaMoral {
  return efeitosDaMoral(l.arena.moral?.nivel ?? 0);
}

/** O ataque do botão: o da classe primeiro; o mágico sem mana pro golpe de magia cai pro físico (o disparo do Mago custa o da arena). */
function estiloDoBotao(hero: Hero): AttackStyle {
  const ataques = ataquesDisponiveis(hero);
  const daArena = custoDaMagia(hero);
  const custo = (a: (typeof ataques)[number]): number => (a.estilo === 'magic' && daArena !== undefined ? daArena : a.custo);
  const primeiro = ataques.find((a) => hero.mp >= custo(a)) ?? ataques[ataques.length - 1];
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
  // O Bardo, o Clérigo e o Druida podem mirar num aliado: o evento é o mesmo, e no fim sai o apoio.
  const aliado = aliadoNaMira(l, entrada);
  if (aliado) {
    if (!alcancaOAliado(l, aliado)) {
      contar(l, { tipo: 'aviso', texto: 'Chegue mais perto' });
      return;
    }
    const hero = masmorra(l).hero;
    const estilo = estiloDoBotao(hero);
    l.arena.evento = { evento: eventoComAMoral(l, eventoDoAtaque(hero, estilo, l.rng, l.teclado)), passo: 0, jogada: {}, alvo: l.arena.alvo, estilo, aliado };
    return;
  }
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
  const evento = eventoComAMoral(l, eventoDoAtaque(hero, estilo, l.rng, l.teclado));
  l.arena.evento = { evento, passo: 0, jogada: {}, alvo, estilo };
}

/** Sem monstro na área do cursor: o golpe vai no chão, sem evento, e o botão espera a recarga como depois de um golpe. */
function golpeNoChao(l: Luta, x: number, y: number): void {
  // O Florescimento (rodada 5b): o ataque no chão vazio planta uma flor.
  if (idDoEstilo(masmorra(l).hero) === 'florescimento') {
    plantar(l, x, y);
    return;
  }
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
  if (aberto.aliado) {
    apoiar(l, aberto.aliado, leitura);
    return;
  }
  // A lança do Guerreiro (rodada 6c): a faixa maior já valeu neste evento; sorteia a do próximo.
  sortearLanca(l);
  const doEvento = l.arena.monstros[aberto.alvo] as MonstroNaArena;
  const indice = doEvento.fase !== 'caido' ? doEvento.indice : alvoAtual(l);
  if (indice === null) return;
  if (!alcanca(l, indice, FOLGA_DO_ALCANCE)) {
    contar(l, { tipo: 'numero', onde: 'monstro', indice, texto: 'Longe', tom: 'erro' });
    contar(l, { tipo: 'som', som: 'miss' });
    return;
  }
  const heroDoGolpe = masmorra(l).hero;
  const paladino = idDaClasse(heroDoGolpe) === 'paladino';
  const estilo = idDoEstilo(heroDoGolpe);
  let atordoarDepois = false;
  // O avanço: o do Paladino e o chute do Monge sempre; o do Espadachim, a cada 5 s (colado no alvo, atordoa em vez de avançar).
  if (paladino || estilo === 'chute') avancar(l, indice);
  else if (avancoPronto(l)) {
    if (colado(l, indice)) atordoarDepois = true;
    else {
      avancar(l, indice, REGRAS_DO_ESPADACHIM.avanco);
      l.arena.classe = { ...contadores(l), imune: REGRAS_DO_ESPADACHIM.imunidade };
    }
    l.arena.classe = { ...contadores(l), recargaDoEstilo: REGRAS_DO_ESPADACHIM.recarga };
  }
  // O Druida com estilo conta os ataques da luta (a aura da Metamorfose, as Raízes); o Mago com elemento, os disparos (rodada 5c).
  const classeDoGolpe = idDaClasse(heroDoGolpe);
  const conta = !!estilo && (classeDoGolpe === 'druida' || (classeDoGolpe === 'mago' && aberto.estilo === 'magic'));
  const golpeDoDruida = conta ? contarGolpeDoEstilo(l, estilo as string) : 0;
  const disparo = classeDoGolpe === 'mago' && conta;
  // O chute erra 1 vez em 10.
  if (estilo === 'chute' && l.rng() * 100 < REGRAS_DO_CHUTE.erro) {
    contar(l, { tipo: 'numero', onde: 'monstro', indice, texto: 'Errou', tom: 'erro' });
    contar(l, { tipo: 'som', som: 'miss' });
    return;
  }
  const dado = 1 + randomInt(LADOS_DO_DANO, l.rng);
  const acerto = acertarMonstro(l, l.arena.monstros[indice] as MonstroNaArena, dado, leitura, aberto.estilo);
  // A Concentração gasta as cargas no golpe, acertando ou não.
  if (estilo === 'concentracao' && l.arena.classe) l.arena.classe = { ...l.arena.classe, cargas: 0, semGolpe: 0 };
  // O Arcano desperto dá mana a cada disparo, acertando ou não.
  if (disparo && estilo === 'arcano' && golpeDoDruida >= REGRAS_DO_ARCANO.golpesDoArcano) manaDoArcano(l);
  if (!acerto || l.fim) return;
  // O Bardo e o Clérigo também se curam batendo; as vinhas do Druida deixam o monstro lento e envenenado.
  apoiarAqui(l);
  vinhasNoMonstro(l, indice);
  golpeEmArea(l, indice, acerto.dano);
  // A kusarigama do Monge (rodada 6c): a área 3 × 2 no alvo.
  if (kusarigamaNaMao(heroDoGolpe) && !l.fim) areaDaKusarigama(l, indice, acerto.dano);
  if (estilo === 'empurrao') empurraoEmVolta(l, indice, acerto.dano);
  // O avanço do Paladino empurra o alvo que ficou de pé.
  const alvo = l.arena.monstros[indice] as MonstroNaArena;
  if (atordoarDepois && !l.fim && alvo.fase !== 'caido') atordoar(l, alvo, REGRAS_DO_ESPADACHIM.atordoa);
  // O bastão no chute (rodada 6c): às vezes atordoa quem ficou de pé.
  const chuteAtordoa = atordoaNoChute(heroDoGolpe);
  if (chuteAtordoa > 0 && !l.fim && alvo.fase !== 'caido' && l.rng() * 100 < chuteAtordoa) atordoar(l, alvo);
  // Todo 9º golpe das Raízes prende o alvo (o chefe não).
  if (estilo === 'raizes' && golpeQuePrende(golpeDoDruida) && !l.fim) prender(l, alvo);
  // Os elementos do Mago (rodada 5c), no disparo que acertou.
  if (disparo && !l.fim) elementoNoGolpe(l, indice, acerto.dano, golpeDoDruida, estilo as string);
  // A aljava ao lado do arco (rodada 6b), na flecha que acertou.
  if (!l.fim) flechaComAljava(l, indice, acerto.dano);
  if (paladino && !l.fim && alvo.fase !== 'caido') empurrar(l, alvo, l.arena.heroi, REGRAS_DO_PALADINO.empurrao);
}

/**
 * O golpe do herói chega no monstro: a regra do site, com a guarda do
 * defensivo, e o que a classe põe na arena (o dano a mais, o crítico do
 * Ladino, sem a passiva antiga da classe refeita). Acertou: o dano e se foi
 * crítico; senão `null`.
 */
function acertarMonstro(l: Luta, alvo: MonstroNaArena, dado: number, leitura: LeituraDaMira, estilo: AttackStyle, aMais = 0): { dano: number; critico: boolean } | null {
  const monstro = monstroNo(l, alvo.indice);
  let lida = leitura;
  if (jeitoDe(monstro).guarda && alvo.fase === 'descansando' && leitura.acerto) {
    lida = { acerto: true, forca: Math.round(leitura.forca * 50) / 100, critico: false };
    contar(l, { tipo: 'aviso', texto: `${monstro.name} se protege!` });
  }
  const estado = masmorra(l);
  const moral = moralAqui(l);
  // O dano a mais: o da classe, o da moral do grupo e o reforço do Bardo.
  const bonus =
    bonusDoAtaque(estado.hero, contadores(l), { colado: colado(l, alvo.indice), chefe: !!monstro.isBoss, blocos: blocosAte(l, alvo.indice) }) +
    moral.dano +
    ((l.arena.reforco ?? 0) > 0 ? REGRAS_DO_BARDO.forca : 0) +
    (l.arena.revestido ? REGRAS_DO_MONGE.danoRevestido : 0) +
    // O disparo do Mago com elemento (rodada 5c): a rocha, o Arcano, a orbe.
    (estilo === 'magic' && idDaClasse(estado.hero) === 'mago' ? danoDoMago(estado.hero, contadores(l).golpes ?? 0) : 0) +
    aMais;
  const daClasse = criticoDaClasse(estado.hero);
  // O crítico a mais: o da moral, o do estilo e o do leque (rodada 6c).
  const criticoAMais = moral.critico + criticoDoEstilo(estado.hero) + criticoDaArma(estado.hero);
  const critico = criticoAMais > 0 ? (daClasse ?? 1.6) + criticoAMais / 100 : daClasse;
  // O golpe sagrado do Clérigo num morto-vivo.
  const sagrado = idDaClasse(estado.hero) === 'clerigo' && estilo === 'magic' && mortoVivo(monstro.speciesId);
  const custoMagico = custoDaMagia(estado.hero);
  const golpe = resolverGolpe(estado.hero, monstro, dado, lida, estilo, {
    rng: l.rng,
    petCriticoBonus: petBonus(l.pet).critico ?? 0,
    danoDaClasse: classeDeLuta(estado.hero).dano,
    ...(bonus !== 0 ? { bonusDeDano: bonus } : {}),
    ...(critico !== undefined ? { multiplicadorDoCritico: critico } : {}),
    ...(classeRefeita(estado.hero) ? { semPassivaDaClasse: true } : {}),
    ...(sagrado ? { multiplicadorDoDano: REGRAS_DO_CLERIGO.mortoVivo } : {}),
    ...(custoMagico !== undefined ? { custoDaMagia: custoMagico } : {}),
  });
  // O golpe que acerta treina o atributo dele (`treino.ts`).
  const treinado = golpe.outcome === 'hit' ? anotarUso(golpe.hero, atributoDoGolpe(golpe.hero, estilo)) : golpe.hero;
  const ferida = ferirNaArena(l, { ...estado, hero: treinado }, alvo.indice, golpe.monster);

  if (golpe.outcome === 'no_mana') {
    contar(l, { tipo: 'aviso', texto: 'Mana insuficiente' });
    return null;
  }
  if (golpe.outcome !== 'hit') {
    contar(l, { tipo: 'numero', onde: 'monstro', indice: alvo.indice, texto: golpe.outcome === 'dodged' ? 'Desviou' : 'Errou', tom: 'erro' });
    contar(l, { tipo: 'som', som: 'miss' });
    return null;
  }
  contar(l, numeroNoMonstro(ferida, alvo.indice, `-${golpe.damage}`, golpe.isCrit ? 'critico' : 'dano'));
  contar(l, { tipo: 'som', som: golpe.isCrit ? 'crit' : 'hit' });
  contarAcertoDaClasse(l, !!golpe.isCrit);
  const acerto = { dano: golpe.damage ?? 0, critico: !!golpe.isCrit };
  if (!ferida.protegido) roubarVida(l, golpe.damage ?? 0);
  if (ferida.caiu) {
    abater(l, alvo.indice, golpe.monster);
    return acerto;
  }
  if (!ferida.protegido) aplicarRunasDoGolpe(l, alvo.indice, monsterView(ferida.monstro), golpe.damage ?? 0);
  return acerto;
}

// ---------- a classe na arena (rodada 3a: Guerreiro, Ladino, Bárbaro e Paladino) ----------

function contadores(l: Luta): ContadoresDaClasse {
  return l.arena.classe ?? {};
}

/** Quantos blocos inteiros do pé do herói ao meio da casa do monstro: o dano do Arqueiro conta com eles. */
function blocosAte(l: Luta, indice: number): number {
  const lugar = lugarDe(l, indice);
  const dx = l.arena.heroi.x - lugar.x;
  const dy = l.arena.heroi.y - lugar.y;
  return Math.floor(Math.sqrt(dx * dx + dy * dy) / TILE_UNITS);
}

/** O herói está a 1 bloco do monstro: o Guerreiro colado no alvo bate mais forte. */
function colado(l: Luta, indice: number): boolean {
  const lugar = lugarDe(l, indice);
  const dx = l.arena.heroi.x - lugar.x;
  const dy = l.arena.heroi.y - lugar.y;
  const limite = TILE_UNITS + TILE_UNITS / 2;
  return dx * dx + dy * dy <= limite * limite;
}

/** Um golpe do herói acertou: o combo do Guerreiro e a furtividade do Ladino contam, e avisam quando sobem. */
function contarAcertoDaClasse(l: Luta, critico: boolean): void {
  const acerto = contarAcerto(masmorra(l).hero, contadores(l), critico);
  if (!acerto) return;
  l.arena.classe = acerto.contadores;
  if (acerto.combo !== undefined) contar(l, { tipo: 'aviso', texto: `⚔️ Combo! +${acerto.combo}% de dano` });
  if (acerto.furtividade !== undefined) contar(l, { tipo: 'aviso', texto: `🗡️ Furtividade ${acerto.furtividade}` });
}

/** A casa em (x, y) é parede de dentro da sala (os cantos da Caverna)? */
function naParede(l: Luta, x: number, y: number): boolean {
  const col = Math.floor(x / TILE_UNITS);
  const row = Math.floor(y / TILE_UNITS);
  return paredesDaSala(masmorra(l).masmorra.dungeon).some((casa) => casa.col === col && casa.row === row);
}

/**
 * O golpe que avança (o Paladino, o chute do Monge, o Espadachim): ele vai em
 * linha reta até 1 bloco do alvo, no máximo `maxBlocos` blocos (se não cair
 * numa parede de dentro).
 */
function avancar(l: Luta, indice: number, maxBlocos?: number): void {
  const heroi = l.arena.heroi;
  const lugar = lugarDe(l, indice);
  const dx = lugar.x - heroi.x;
  const dy = lugar.y - heroi.y;
  const distancia = Math.sqrt(dx * dx + dy * dy);
  if (distancia <= TILE_UNITS) return;
  const anda = maxBlocos === undefined ? distancia - TILE_UNITS : Math.min(distancia - TILE_UNITS, maxBlocos * TILE_UNITS);
  const x = heroi.x + Math.trunc((dx * anda) / distancia);
  const y = heroi.y + Math.trunc((dy * anda) / distancia);
  if (naParede(l, x, y)) return;
  const olhando = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : dy > 0 ? 'S' : 'N';
  l.arena.heroi = { x, y, facing: olhando };
}

/**
 * Empurra o monstro `blocos` casas pra longe de `de`, sem sair do chão nem
 * entrar em parede. Quem está no aviso ou investindo segue o golpe dele. No
 * espelho, não: os monstros de lá são do anfitrião.
 */
function empurrar(l: Luta, m: MonstroNaArena, de: { x: number; y: number }, blocos: number): void {
  if (noEspelho(l) || m.fase === 'caido' || m.fase === 'avisando' || m.fase === 'investindo') return;
  const r = rumo(m.corpoX - de.x, m.corpoY - de.y, blocos * TILE_UNITS);
  const { cols, rows } = geometria(l);
  const meia = TILE_UNITS / 2;
  const x = Math.min(Math.max(m.corpoX + r.x, TILE_UNITS + meia), (cols - 1) * TILE_UNITS - meia);
  const y = Math.min(Math.max(m.corpoY + r.y, TILE_UNITS + meia), (rows - 1) * TILE_UNITS - meia);
  if (naParede(l, x, y)) return;
  m.corpoX = x;
  m.corpoY = y;
}

/** O monstro fica atordoado na hora: para onde está e perde o golpe que vinha (o que já está investindo segue). */
function atordoar(l: Luta, m: MonstroNaArena, tempo: number = TEMPO_ATORDOADO): void {
  if (noEspelho(l) || m.fase === 'caido' || m.fase === 'investindo') return;
  delete m.poder;
  m.fase = 'atordoado';
  m.tempo = tempo;
  contar(l, { tipo: 'numero', onde: 'monstro', indice: m.indice, texto: '💫', tom: 'erro' });
}

/** O monstro `indice` leva este dano (vindo de fora do golpe: a área, a devolução, o parceiro), com a regra do chefe. Caiu? */
function ferirComDano(l: Luta, indice: number, dano: number, texto: string): boolean {
  const antes = (sala(l).monsters ?? [])[indice] as CombatMonster;
  const depois: CombatMonster = { ...antes, hp: Math.max(0, antes.hp - dano) };
  const ferida = ferirNaArena(l, masmorra(l), indice, depois);
  contar(l, numeroNoMonstro(ferida, indice, texto, 'dano'));
  if (ferida.caiu) abater(l, indice, monsterView(depois));
  return ferida.caiu;
}

/** O monstro de pé `m` está na área da arma pesada do Bárbaro? */
function naAreaDaArma(l: Luta, arma: string, m: MonstroNaArena, centro: { x: number; y: number }): boolean {
  const r = REGRAS_DO_BARBARO;
  const heroi = l.arena.heroi;
  if (arma === 'marreta') {
    const meia = (r.ladoDoTremor * TILE_UNITS) / 2;
    return Math.abs(m.corpoX - heroi.x) <= meia && Math.abs(m.corpoY - heroi.y) <= meia;
  }
  if (arma === 'maca') {
    const meia = (r.ladoDaBola * TILE_UNITS) / 2;
    return Math.abs(m.corpoX - centro.x) <= meia && Math.abs(m.corpoY - centro.y) <= meia;
  }
  // O machadão: a faixa do herói rumo ao alvo, até o alcance.
  const dx = centro.x - heroi.x;
  const dy = centro.y - heroi.y;
  const comprimento = Math.sqrt(dx * dx + dy * dy);
  if (comprimento === 0) return false;
  const px = m.corpoX - heroi.x;
  const py = m.corpoY - heroi.y;
  const ao = px * dx + py * dy;
  const fora = px * dy - py * dx;
  return ao >= 0 && ao <= alcanceNaArena(masmorra(l).hero) * comprimento && Math.abs(fora) <= ((r.larguraDoCorte * TILE_UNITS) / 2) * comprimento;
}

/** O que a arma pesada faz em quem acertou: o machadão pode atordoar (o chefe não), a maça pode empurrar pra longe do herói. */
function efeitoDaArma(l: Luta, arma: string, m: MonstroNaArena): void {
  if (noEspelho(l) || m.fase === 'caido') return;
  const r = REGRAS_DO_BARBARO;
  if (arma === 'machado' && !monstroNo(l, m.indice).isBoss && l.rng() * 100 < r.atordoaNoMachado) atordoar(l, m);
  else if (arma === 'maca' && l.rng() * 100 < r.empurraNaMaca) empurrar(l, m, l.arena.heroi, 1);
}

/**
 * O Bárbaro de arma pesada bate em área (doc do Breno de 2026-11-15): o
 * machadão corta numa faixa até o alcance, a marreta treme no quadrado em
 * volta dele, a bola da maça destrói o quadrado em volta do alvo. O alvo já
 * levou o golpe inteiro; quem mais estiver na área leva metade do dano
 * (decisão do usuário). Depois do dano, o efeito da arma: primeiro no alvo,
 * depois em cada um, na ordem da sala.
 */
function golpeEmArea(l: Luta, alvo: number, dano: number): void {
  const hero = masmorra(l).hero;
  const arma = hero.equip.arma?.templateId ?? '';
  if (idDaClasse(hero) !== 'barbaro' || !(arma === 'machado' || arma === 'marreta' || arma === 'maca')) return;
  const centro = lugarDe(l, alvo);
  efeitoDaArma(l, arma, l.arena.monstros[alvo] as MonstroNaArena);
  const parte = Math.max(1, Math.trunc((dano * REGRAS_DO_BARBARO.nosOutros) / 100));
  for (const m of l.arena.monstros) {
    if (l.fim) return;
    if (m.indice === alvo || m.fase === 'caido' || !naAreaDaArma(l, arma, m, centro)) continue;
    if (!ferirComDano(l, m.indice, parte, `-${parte}`)) efeitoDaArma(l, arma, m);
  }
}

/**
 * O herói levou um golpe com dano: a fúria do Bárbaro e a absorção do
 * Paladino juntam, e o Paladino de pé devolve parte do dano a quem bateu.
 */
function apanhou(l: Luta, indice: number, dano: number, vivo: boolean): void {
  const hero = masmorra(l).hero;
  const novos = contarGolpeLevado(hero, contadores(l));
  if (novos) l.arena.classe = novos;
  const pct = devolucaoDaClasse(hero, contadores(l));
  const m = l.arena.monstros[indice];
  if (!vivo || pct <= 0 || dano <= 0 || !m || m.fase === 'caido') return;
  const devolvido = Math.max(1, Math.trunc((dano * pct) / 100));
  ferirComDano(l, indice, devolvido, `↩️-${devolvido}`);
}

// ---------- o apoio (rodada 3b: Bardo, Clérigo e Druida) e o Arqueiro ----------

/** O ícone do número da cura de cada apoio. */
const ICONE_DO_APOIO: Readonly<Record<ApoioDoParceiro['tipo'], string>> = { bardo: '🎵', clerigo: '✝️', purificar: '🌿', comunhao: '✝️' };

/**
 * O ataque mirado num aliado terminou. Errou o evento, nada sai. O Druida
 * purifica e fica sem atacar por um tempo; o Bardo e o Clérigo curam o
 * aliado e a si mesmos (no parceiro, o apoio vai pela rede), e o crítico do
 * Bardo num aliado conta pra moral. Apoiar treina a Sabedoria.
 */
function apoiar(l: Luta, aliado: Aliado, leitura: LeituraDaMira): void {
  if (!leitura.acerto) {
    contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: 'Errou', tom: 'erro' });
    contar(l, { tipo: 'som', som: 'miss' });
    return;
  }
  const estado = masmorra(l);
  l.estado = { ...estado, hero: anotarUso(estado.hero, 'sabedoria') };
  const id = idDaClasse(estado.hero);
  if (id === 'druida') {
    // A Purificação da Metamorfose cura mais (rodada 5b).
    const mais = idDoEstilo(estado.hero) === 'metamorfose' ? REGRAS_DA_METAMORFOSE.purificacao : 0;
    if (aliado === 'eu') purificarAqui(l, mais);
    else l.apoios.push(mais > 0 ? { tipo: 'purificar', mais } : { tipo: 'purificar' });
    l.arena.recarga = REGRAS_DO_DRUIDA.semAtacar;
    contar(l, { tipo: 'aviso', texto: aliado === 'eu' ? '🌿 Purificação Ancestral' : '🌿 Purificação Ancestral no parceiro' });
    return;
  }
  const tipo = id === 'bardo' ? 'bardo' : 'clerigo';
  // Ele mesmo recebe sempre; o parceiro, quando é o mirado.
  apoiarAqui(l);
  if (aliado === 'parceiro') l.apoios.push({ tipo });
  if (tipo === 'bardo' && leitura.critico) contarMoral(l);
}

/**
 * O Bardo e o Clérigo recebem o próprio apoio a cada golpe que acerta (e a
 * cada apoio num aliado): o Bardo, a cura da vida que falta e o reforço; o
 * Clérigo, a cura da vida máxima.
 */
function apoiarAqui(l: Luta): void {
  const id = idDaClasse(masmorra(l).hero);
  if (id === 'bardo') receberApoio(l, { tipo: 'bardo' });
  else if (id === 'clerigo') receberApoio(l, { tipo: 'clerigo' });
}

/** O apoio cai no herói daqui (dele mesmo ou do parceiro): a cura, o reforço do Bardo, a Purificação, a Comunhão. */
function receberApoio(l: Luta, apoio: ApoioDoParceiro): void {
  if (apoio.tipo === 'purificar') {
    purificarAqui(l, apoio.mais ?? 0);
    return;
  }
  if (apoio.tipo === 'comunhao') {
    tocarAFe(l, apoio.passos ?? 0, true);
    return;
  }
  curarAqui(l, apoio.tipo);
  // O Poder da fé de pé apaga os efeitos até acabar: o reforço não pega.
  if (apoio.tipo === 'bardo' && !((l.arena.fe ?? 0) > 0)) l.arena.reforco = REGRAS_DO_BARDO.tempoDaForca;
}

/** A cura do apoio no herói daqui, com o número em cima dele. */
function curarAqui(l: Luta, tipo: ApoioDoParceiro['tipo'], mais = 0): void {
  const estado = masmorra(l);
  const cura = curaDoApoio(tipo, estado.hero, mais);
  if (cura <= 0) return;
  l.estado = { ...estado, hero: { ...estado.hero, hp: estado.hero.hp + cura } };
  contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `${ICONE_DO_APOIO[tipo]}+${cura}`, tom: 'cura' });
  contar(l, { tipo: 'som', som: 'heal' });
}

/** A Purificação Ancestral no herói daqui: o veneno e os ferimentos somem, e a cura. */
function purificarAqui(l: Luta, mais = 0): void {
  const estado = masmorra(l);
  const { poisonTurns: _turnos, poisonDmg: _dano, ...buffs } = estado.hero.buffs ?? {};
  const { ferimentos: _ferimentos, ...semFerimentos } = estado.hero;
  l.estado = { ...estado, hero: { ...semFerimentos, buffs } };
  curarAqui(l, 'purificar', mais);
  contar(l, { tipo: 'aviso', texto: '🌿 Purificado' });
}

/** Um crítico do Bardo num aliado: a moral do grupo conta, e avisa quando sobe. */
function contarMoral(l: Luta): void {
  const conta = contarCriticoNoAliado(l.arena.moral ?? {});
  l.arena.moral = conta.moral;
  if (conta.subiu === undefined) return;
  l.moralSubiu = conta.subiu;
  const texto = `🎵 Moral ${conta.subiu}!`;
  contar(l, { tipo: 'aviso', texto });
  diario(l, [texto]);
}

/** As vinhas do Druida no monstro que ficou de pé: lento e envenenado por `REGRAS_DO_DRUIDA.turnos` turnos. No espelho, não (é do anfitrião). */
function vinhasNoMonstro(l: Luta, indice: number): void {
  if (idDaClasse(masmorra(l).hero) !== 'druida' || noEspelho(l)) return;
  const m = l.arena.monstros[indice];
  if (!m || m.fase === 'caido') return;
  const r = REGRAS_DO_DRUIDA;
  const monstro = (sala(l).monsters ?? [])[indice] as CombatMonster;
  // Os estilos (rodada 5b): o golpe forte das Raízes deixa mais lento, e as Raízes fundas envenenam pela vida que resta.
  const estilo = idDoEstilo(masmorra(l).hero);
  const golpes = contadores(l).golpes ?? 0;
  const lento = estilo === 'raizes' && golpeForte(golpes) ? REGRAS_DAS_RAIZES.lento : r.lento;
  const veneno =
    estilo === 'raizes' && raizesFundas(golpes)
      ? Math.max(1, Math.trunc((monstro.hp * REGRAS_DAS_RAIZES.veneno) / 100))
      : Math.max(1, Math.trunc((monstro.maxHp * r.veneno) / 100));
  const status = { ...monstro.status, lento: { turns: r.turnos, amount: lento / 100 }, veneno: { turns: r.turnos, dmg: veneno } };
  l.estado = gravarMonstro(masmorra(l), indice, { ...monstro, status });
  const icone = estilo === 'metamorfose' ? '🐾' : estilo === 'florescimento' ? '🌸' : estilo === 'raizes' ? '🌱' : '🌿';
  contar(l, { tipo: 'numero', onde: 'monstro', indice, texto: icone, tom: 'erro' });
}

/**
 * O botão do Poder da fé (o Clérigo; uma vez a cada 7 min): em dupla, a
 * Comunhão sagrada (ele e o parceiro); sozinho, o Santo Egoísta, que pede a
 * mana cheia. A duração vem do dano levado nos últimos 30 s.
 */
function usarFe(l: Luta): void {
  const hero = masmorra(l).hero;
  if (idDaClasse(hero) !== 'clerigo' || (l.arena.recargaDaFe ?? 0) > 0 || (l.arena.fe ?? 0) > 0) return;
  const comunhao = !!parceiroDePe(l);
  if (!comunhao && hero.mp < hero.maxMp) {
    contar(l, { tipo: 'aviso', texto: 'O Santo Egoísta pede a mana cheia' });
    return;
  }
  const levado = danoLevado(l) + (comunhao ? (l.arena.dupla?.parceiroDano ?? 0) : 0);
  const passos = duracaoDaFe(comunhao, levado, comunhao ? 2 : 1);
  l.arena.recargaDaFe = REGRAS_DO_CLERIGO.recargaDaFe;
  if (comunhao) l.apoios.push({ tipo: 'comunhao', passos });
  const texto = comunhao ? '✝️ Comunhão sagrada!' : '✝️ Santo Egoísta!';
  contar(l, { tipo: 'aviso', texto });
  diario(l, [texto]);
  tocarAFe(l, passos, false);
}

/**
 * O Poder da fé cai no herói daqui: a cura, a mana toda vai embora, os
 * efeitos (bons e ruins) somem até ele acabar, e a vida não desce do piso
 * enquanto dura. Não revive e não tira ferimento.
 */
function tocarAFe(l: Luta, passos: number, doParceiro: boolean): void {
  const estado = masmorra(l);
  l.estado = { ...estado, hero: { ...estado.hero, mp: 0, buffs: {} } };
  delete l.arena.reforco;
  curarAqui(l, 'comunhao');
  if (passos > (l.arena.fe ?? 0)) l.arena.fe = passos;
  if (doParceiro) contar(l, { tipo: 'aviso', texto: '✝️ Comunhão sagrada do parceiro!' });
}

/** A vida que o Poder da fé segura: não desce de `REGRAS_DO_CLERIGO.pisoDaVida` (%) da máxima (e não sobe quem já estava abaixo). */
function pisoDaFe(l: Luta, antes: number, hero: Hero): Hero {
  if (!((l.arena.fe ?? 0) > 0)) return hero;
  const piso = Math.min(antes, Math.ceil((hero.maxHp * REGRAS_DO_CLERIGO.pisoDaVida) / 100));
  return hero.hp < piso ? { ...hero, hp: piso } : hero;
}

/** Anota o dano que o herói daqui levou (só o Clérigo e a dupla precisam: a janela do Poder da fé). */
function anotarDanoLevado(l: Luta, dano: number): void {
  if (dano <= 0 || (idDaClasse(masmorra(l).hero) !== 'clerigo' && !l.arena.dupla)) return;
  const janela = l.arena.passo - REGRAS_DO_CLERIGO.janela;
  l.arena.danosLevados = [...(l.arena.danosLevados ?? []).filter((d) => d.passo > janela), { passo: l.arena.passo, dano }];
}

/** Um passo do mundo com o Poder da fé de pé: ele vai acabando, e nenhum efeito pega no herói enquanto dura. */
function passarAFe(l: Luta): void {
  if (l.arena.fe === undefined) return;
  if (l.arena.fe > 1) l.arena.fe -= 1;
  else {
    delete l.arena.fe;
    return;
  }
  delete l.arena.reforco;
  const estado = masmorra(l);
  // Conta só o campo com valor (o `undefined` que o golpe deixa não é efeito).
  if (Object.values(estado.hero.buffs ?? {}).some((v) => v !== undefined)) l.estado = { ...estado, hero: { ...estado.hero, buffs: {} } };
}

/** O dano que o herói daqui levou nos últimos 30 s. */
function danoLevado(l: LutaEmTempoReal): number {
  const janela = l.arena.passo - REGRAS_DO_CLERIGO.janela;
  return (l.arena.danosLevados ?? []).reduce((soma, d) => (d.passo > janela ? soma + d.dano : soma), 0);
}

/** O dano que o herói levou nos últimos 30 s da luta: o app manda pro parceiro (a Comunhão sagrada conta com ele). */
export function danoLevadoNaJanela(luta: LutaEmTempoReal): number {
  return danoLevado(luta);
}

/** O que a linha da classe mostra além dos contadores: a moral, o Poder da fé e a espera do Druida depois da Purificação. */
export function extrasDaLuta(luta: LutaEmTempoReal): ExtrasDaClasse {
  const a = luta.arena;
  const extras: ExtrasDaClasse = {};
  if ((a.moral?.nivel ?? 0) > 0) extras.moral = a.moral?.nivel as number;
  if ((a.recargaDaFe ?? 0) > 0) extras.recargaDaFe = a.recargaDaFe as number;
  if ((a.fe ?? 0) > 0) extras.fe = a.fe as number;
  if (a.recarga > RECARGA_DO_ATAQUE) extras.semAtacar = a.recarga;
  if ((a.ki ?? 0) > 0) extras.ki = a.ki as number;
  if (a.revestido) extras.revestido = true;
  if (a.canalizando) extras.canalizando = true;
  if ((a.recargaDaMagia ?? 0) > 0) extras.recargaDaMagia = a.recargaDaMagia as number;
  if (luta.estado.hero.bloqueioDaMagia) extras.magiaSelada = true;
  if ((a.flores?.length ?? 0) > 0) extras.flores = a.flores?.length as number;
  if (podeLancarChapeu(luta.estado.hero)) extras.chapeu = a.recargaDoChapeu ?? 0;
  return extras;
}

/** O que a luta deixa pra próxima, na memória do app: a moral do grupo, a recarga do Poder da fé e o ki. */
export function memoriaDaLuta(luta: LutaEmTempoReal): MemoriaDaLuta {
  const memoria: MemoriaDaLuta = {};
  if (luta.arena.moral) memoria.moral = { ...luta.arena.moral };
  if ((luta.arena.recargaDaFe ?? 0) > 0) memoria.recargaDaFe = luta.arena.recargaDaFe as number;
  if ((luta.arena.ki ?? 0) > 0) memoria.ki = luta.arena.ki as number;
  if ((luta.arena.recargaDaMagia ?? 0) > 0) memoria.recargaDaMagia = luta.arena.recargaDaMagia as number;
  if ((luta.arena.recargaDoChapeu ?? 0) > 0) memoria.recargaDoChapeu = luta.arena.recargaDoChapeu as number;
  return memoria;
}

// ---------- o Necromante: os lacaios com corpo e a Magia Proibida (rodada 4b) ----------

/**
 * Um lugar ao lado de (x, y) pro lacaio número `k` (à esquerda, à direita,
 * atrás e na diagonal, de volta ao começo), dentro do chão e fora das paredes
 * de dentro; sem lugar livre, o próprio ponto.
 */
export function lugarAoLado(
  centro: { x: number; y: number },
  k: number,
  formato: GeometriaDaSala,
  paredes: readonly { col: number; row: number }[],
): { x: number; y: number } {
  const meia = TILE_UNITS / 2;
  const passos: readonly (readonly [number, number])[] = [[-1, 0], [1, 0], [0, 1], [-1, 1], [1, 1], [0, -1]];
  for (let tentativa = 0; tentativa < passos.length; tentativa++) {
    const [dx, dy] = passos[(k + tentativa) % passos.length] as readonly [number, number];
    const x = Math.min(Math.max(centro.x + dx * TILE_UNITS, TILE_UNITS + meia), (formato.cols - 1) * TILE_UNITS - meia);
    const y = Math.min(Math.max(centro.y + dy * TILE_UNITS, TILE_UNITS + meia), (formato.rows - 1) * TILE_UNITS - meia);
    const col = Math.floor(x / TILE_UNITS);
    const row = Math.floor(y / TILE_UNITS);
    if (!paredes.some((casa) => casa.col === col && casa.row === row)) return { x, y };
  }
  return { x: centro.x, y: centro.y };
}

/** O companheiro tem corpo na arena (o lacaio do Necromante). */
function temCorpo(l: Luta, indice: number): boolean {
  const c = l.arena.companheiros.find((comp) => comp.indice === indice);
  return !!c && c.x !== undefined;
}

/** O lacaio com corpo de pé, pelo índice na equipe; `null`, caído ou sem corpo. */
function lacaioDePe(l: Luta, indice: number): CompanheiroNaArena | null {
  const c = l.arena.companheiros.find((comp) => comp.indice === indice);
  if (!c || c.x === undefined) return null;
  const membro = masmorra(l).party[indice];
  return membro && membro.hp > 0 ? c : null;
}

/** Os lacaios com corpo de pé, na ordem da equipe. */
function lacaiosComCorpo(l: Luta): CompanheiroNaArena[] {
  const party = masmorra(l).party;
  return l.arena.companheiros.filter((c) => c.x !== undefined && (party[c.indice]?.hp ?? 0) > 0);
}

/**
 * Com lacaios na sala, o monstro vai atrás de quem estiver mais perto: o
 * herói (o fantasma não conta), o parceiro de pé ou um lacaio. O Paladino
 * conta mais perto (`REGRAS_DO_PALADINO.foco`). No empate, o herói, o
 * parceiro e os lacaios, nessa ordem.
 */
function escolherComLacaios(l: Luta, m: MonstroNaArena, parceiro: { x: number; y: number } | null, lacaios: readonly CompanheiroNaArena[]): void {
  const perto = (100 - REGRAS_DO_PALADINO.foco) * (100 - REGRAS_DO_PALADINO.foco);
  const distancia = (x: number, y: number): number => (x - m.corpoX) * (x - m.corpoX) + (y - m.corpoY) * (y - m.corpoY);
  let melhor: 'heroi' | 'parceiro' | number | null = null;
  let menor = 0;
  const pesar = (quem: 'heroi' | 'parceiro' | number, valor: number): void => {
    if (melhor === null || valor < menor) {
      melhor = quem;
      menor = valor;
    }
  };
  if (!l.arena.dupla?.fantasma) pesar('heroi', distancia(l.arena.heroi.x, l.arena.heroi.y) * (puxaOsMonstros(masmorra(l).hero) ? perto : 10000));
  if (parceiro) pesar('parceiro', distancia(parceiro.x, parceiro.y) * (l.arena.dupla?.parceiroPuxa ? perto : 10000));
  for (const c of lacaios) pesar(c.indice, distancia(c.x as number, c.y as number) * 10000);
  delete m.noParceiro;
  delete m.noLacaio;
  if (melhor === 'parceiro') m.noParceiro = true;
  else if (typeof melhor === 'number') m.noLacaio = melhor;
}

/** O golpe do monstro num membro da equipe, como no site; o lacaio no ofensivo leva 10% a menos. */
function golpeNoMembro(membro: Companion, monstro: CombatMonsterView, forca: number, rng: Rng): { member: Companion; damage: number; defeated: boolean } {
  const golpe = hitPartyMember(membro, monstro, forca, rng);
  if (!membro.invocado || estadoDoLacaio(membro) !== 'ofensivo') return golpe;
  const dano = Math.max(1, golpe.damage - Math.floor((golpe.damage * REGRAS_DO_NECROMANTE.resistenciaNoOfensivo) / 100));
  const member: Companion = { ...membro, hp: Math.max(0, membro.hp - dano) };
  return { member, damage: dano, defeated: member.hp <= 0 };
}

/** O jeito de lutar do lacaio: o da espécie dele. */
function jeitoDoLacaio(membro: Companion): JeitoDeLutar {
  const especie = speciesById(especieDoLacaio(membro));
  return (especie && JEITOS_DE_LUTAR[especie.behavior]) || JEITOS_DE_LUTAR.defensivo;
}

/** Até onde o lacaio alcança o monstro: quem atira, de longe (a distância do tiro); os outros, colados (uma casa e meia). */
function alcanceDoLacaio(membro: Companion): number {
  const jeito = jeitoDoLacaio(membro);
  return jeito.golpe === 'tiro' ? jeito.distancia : TILE_UNITS + TILE_UNITS / 2;
}

/**
 * Em quem o lacaio vai: na retaguarda, o monstro de pé mais perto dele entre
 * os que estão a até `retaguarda` blocos do dono; no ofensivo, o de pé mais
 * perto dele em toda a sala. `null`, nenhum.
 */
function alvoDoLacaio(l: Luta, c: CompanheiroNaArena, membro: Companion): number | null {
  const retaguarda = estadoDoLacaio(membro) === 'retaguarda';
  const doDono = REGRAS_DO_NECROMANTE.retaguarda * TILE_UNITS + TILE_UNITS / 2;
  const heroi = l.arena.heroi;
  let melhor: number | null = null;
  let menor = 0;
  for (const m of l.arena.monstros) {
    if (m.fase === 'caido') continue;
    const lugar = lugarDe(l, m.indice);
    if (retaguarda && (lugar.x - heroi.x) * (lugar.x - heroi.x) + (lugar.y - heroi.y) * (lugar.y - heroi.y) > doDono * doDono) continue;
    const distancia = (lugar.x - (c.x as number)) * (lugar.x - (c.x as number)) + (lugar.y - (c.y as number)) * (lugar.y - (c.y as number));
    if (melhor === null || distancia < menor) {
      melhor = m.indice;
      menor = distancia;
    }
  }
  return melhor;
}

/** O lacaio anda rumo a (x, y), no passo dele, sem sair do chão nem entrar em parede de dentro. */
function andarLacaio(l: Luta, c: CompanheiroNaArena, x: number, y: number): void {
  const r = rumo(x - (c.x as number), y - (c.y as number), REGRAS_DO_NECROMANTE.passo);
  const { cols, rows } = geometria(l);
  const meia = TILE_UNITS / 2;
  const nx = Math.min(Math.max((c.x as number) + r.x, TILE_UNITS + meia), (cols - 1) * TILE_UNITS - meia);
  const ny = Math.min(Math.max((c.y as number) + r.y, TILE_UNITS + meia), (rows - 1) * TILE_UNITS - meia);
  if (naParede(l, nx, ny)) return;
  c.x = nx;
  c.y = ny;
}

/**
 * O lacaio com corpo: vai atrás do alvo dele (`alvoDoLacaio`) até o alcance e
 * bate no tempo dele, como o companheiro do site (na retaguarda, +10%); sem
 * alvo, volta pra perto do dono.
 */
function agirLacaio(l: Luta, c: CompanheiroNaArena, membro: Companion): void {
  if (c.tempo > 0) c.tempo -= 1;
  const alvo = alvoDoLacaio(l, c, membro);
  if (alvo === null) {
    const heroi = l.arena.heroi;
    const perto = TILE_UNITS + TILE_UNITS / 2;
    const dx = heroi.x - (c.x as number);
    const dy = heroi.y - (c.y as number);
    if (dx * dx + dy * dy > perto * perto) andarLacaio(l, c, heroi.x, heroi.y);
    return;
  }
  const lugar = lugarDe(l, alvo);
  const alcance = alcanceDoLacaio(membro);
  const dx = lugar.x - (c.x as number);
  const dy = lugar.y - (c.y as number);
  if (dx * dx + dy * dy > alcance * alcance) {
    andarLacaio(l, c, lugar.x, lugar.y);
    return;
  }
  if (c.tempo > 0) return;
  c.tempo = CADENCIA_DO_COMPANHEIRO;
  const estado = masmorra(l);
  const acao = partyMemberAct(estado.hero, membro, monstroNo(l, alvo), l.rng);
  const resultado = acao.outcome;
  let depois = acao.monster;
  let dano = resultado.kind === 'miss' ? 0 : resultado.amount;
  if (resultado.kind !== 'miss' && resultado.kind !== 'healed_hero' && estadoDoLacaio(membro) === 'retaguarda') {
    const extra = Math.trunc((dano * REGRAS_DO_NECROMANTE.danoNaRetaguarda) / 100);
    dano += extra;
    depois = { ...depois, hp: depois.hp - extra };
  }
  const ferida = ferirNaArena(l, { ...estado, hero: acao.hero }, alvo, depois as CombatMonster);
  if (resultado.kind === 'miss') {
    contar(l, { tipo: 'numero', onde: 'monstro', indice: alvo, texto: 'Errou', tom: 'erro' });
    return;
  }
  if (resultado.kind === 'healed_hero') return;
  contar(l, numeroNoMonstro(ferida, alvo, `-${dano}`, 'dano'));
  if (ferida.caiu) abater(l, alvo, monsterView(depois as CombatMonster));
}

/**
 * O Necromante invoca um lacaio (o poder Levantar Esqueleto, na luta do
 * app): 65% da mana máxima, até 3 de pé, com os números do Breno, ao lado
 * dele. Usar treina o poder, como os outros.
 */
function invocarLacaio(l: Luta, poder: { id: string; name: string; icon: string }): void {
  const estado = masmorra(l);
  if (esqueletosDePe(estado.party) >= MAX_ESQUELETOS) {
    contar(l, { tipo: 'aviso', texto: `Seus ${MAX_ESQUELETOS} lacaios já estão de pé` });
    return;
  }
  const custo = custoDoLacaio(estado.hero);
  if (estado.hero.mp < custo) {
    contar(l, { tipo: 'aviso', texto: `Mana insuficiente para ${poder.name}` });
    return;
  }
  const lacaio = criarLacaio(estado.hero, estado.party);
  const heroiPago = { ...estado.hero, mp: estado.hero.mp - custo };
  const treino = treinarPoder(heroiPago, heroPowers(heroiPago).find((p) => p.id === poder.id) as Parameters<typeof treinarPoder>[1]);
  if (treino.subiu) {
    diario(l, [textoDaHabilidade(poder.name, treino.subiu)]);
    contar(l, { tipo: 'aviso', texto: `⭐ ${poder.name} nível ${treino.subiu}` });
  }
  const party = [...estado.party, lacaio];
  l.estado = { ...estado, hero: treino.hero, party };
  l.arena.recargaDosPoderes[poder.id] = RECARGA_DO_PODER;
  const comCorpo = l.arena.companheiros.filter((c) => c.x !== undefined).length;
  const lugar = lugarAoLado(l.arena.heroi, comCorpo, geometria(l), paredesDaSala(estado.masmorra.dungeon));
  l.arena.companheiros.push({ indice: party.length - 1, tempo: CADENCIA_DO_COMPANHEIRO / 2, x: lugar.x, y: lugar.y });
  contar(l, { tipo: 'aviso', texto: `${poder.icon} ${lacaio.name} se ergue` });
}

/**
 * A Magia Proibida (o Necromante, uma vez a cada 14 min): com 90% de vida e
 * de mana, levanta o parceiro caído com 50% (decisões do usuário: só o
 * parceiro; os 90% são só o requisito). Selada (o Necromante já se levantou
 * com ela nesta masmorra), não sai.
 */
function usarMagia(l: Luta): void {
  const r = REGRAS_DO_NECROMANTE;
  const hero = masmorra(l).hero;
  if (idDaClasse(hero) !== 'necromante' || (l.arena.recargaDaMagia ?? 0) > 0) return;
  if (hero.bloqueioDaMagia) {
    contar(l, { tipo: 'aviso', texto: 'A Magia Proibida está selada até zerar a masmorra' });
    return;
  }
  if (!l.arena.dupla?.parceiroCaido) {
    contar(l, { tipo: 'aviso', texto: 'Ninguém caído pra levantar' });
    return;
  }
  if (hero.hp * 100 < hero.maxHp * r.requisitoDaMagia || hero.mp * 100 < hero.maxMp * r.requisitoDaMagia) {
    contar(l, { tipo: 'aviso', texto: 'A Magia Proibida pede 90% de vida e de mana' });
    return;
  }
  l.arena.recargaDaMagia = r.recargaDaMagia;
  l.reviverParceiro = r.levantaCom;
  const texto = '☠️ Magia Proibida: seu parceiro se levanta!';
  contar(l, { tipo: 'aviso', texto });
  diario(l, [texto]);
}

// ---------- segurar K, o revestimento e a explosão de ki (rodada 4a) ----------

/**
 * Segurando K, parado e sem atacar (decisão do usuário: andar ou atacar
 * solta), o Mago e o Necromante puxam mana e o Monge junta ki, um ponto a
 * cada `passosPorPonto`. Soltou, o que estava contando zera.
 */
function canalizar(l: Luta, entrada: EntradaDaLuta): void {
  const arena = l.arena;
  const hero = masmorra(l).hero;
  const tipo = oQueCanaliza(hero);
  const parado = Math.trunc(entrada.x) === 0 && Math.trunc(entrada.y) === 0;
  const agiu = !!(entrada.atacar || entrada.poder || entrada.item || entrada.fe || entrada.revestir || entrada.explodir || entrada.chapeu);
  if (!tipo || !entrada.canalizar || !parado || agiu || arena.evento || arena.dupla?.fantasma) {
    delete arena.canal;
    delete arena.canalizando;
    return;
  }
  arena.canalizando = true;
  const canal = (arena.canal ?? 0) + 1;
  if (canal < passosDoCanal(hero)) {
    arena.canal = canal;
    return;
  }
  delete arena.canal;
  if (tipo === 'ki') arena.ki = Math.min(REGRAS_DO_MONGE.tetoDoKi, (arena.ki ?? 0) + 1);
  else if (hero.mp < hero.maxMp) l.estado = { ...masmorra(l), hero: { ...hero, mp: hero.mp + 1 } };
}

// ---------- os estilos de luta (rodada 5a: Espadachim, Cavaleiro, Empurrão, Dash/chute, Concentração) ----------

/** O Espadachim tem o avanço pronto (a recarga passou). */
function avancoPronto(l: Luta): boolean {
  return idDoEstilo(masmorra(l).hero) === 'espadachim' && !((contadores(l).recargaDoEstilo ?? 0) > 0);
}

/** Um passo do mundo: a espera do avanço e a imunidade do Espadachim correm; a Concentração junta cargas sem golpear. */
function passarOsEstilos(l: Luta): void {
  // A escuridão do Mago dura o tempo dela (rodada 5c).
  if (l.arena.escuridao) {
    if (l.arena.escuridao.tempo > 1) l.arena.escuridao = { ...l.arena.escuridao, tempo: l.arena.escuridao.tempo - 1 };
    else delete l.arena.escuridao;
  }
  if ((contadores(l).ventania ?? 0) > 0) {
    const { ventania, ...resto } = contadores(l);
    l.arena.classe = (ventania as number) > 1 ? { ...resto, ventania: (ventania as number) - 1 } : resto;
  }
  const estilo = idDoEstilo(masmorra(l).hero);
  if (estilo !== 'espadachim' && estilo !== 'concentracao') return;
  const c = { ...contadores(l) };
  if (estilo === 'espadachim') {
    if (c.recargaDoEstilo === undefined && c.imune === undefined) return;
    if (c.recargaDoEstilo !== undefined) {
      if (c.recargaDoEstilo > 1) c.recargaDoEstilo -= 1;
      else delete c.recargaDoEstilo;
    }
    if (c.imune !== undefined) {
      if (c.imune > 1) c.imune -= 1;
      else delete c.imune;
    }
  } else {
    const r = REGRAS_DA_CONCENTRACAO;
    const semGolpe = (c.semGolpe ?? 0) + 1;
    if (semGolpe >= passosPorCargaDaConcentracao(masmorra(l).hero)) {
      c.semGolpe = 0;
      c.cargas = Math.min(r.tetoDeCargas, (c.cargas ?? 0) + 1);
    } else c.semGolpe = semGolpe;
  }
  l.arena.classe = c;
}

/** O Empurrão: quem está a 1 bloco do alvo leva o mesmo dano; e cada um (o alvo também) pode ser empurrado e atordoado. */
function empurraoEmVolta(l: Luta, alvo: number, dano: number): void {
  const r = REGRAS_DO_EMPURRAO;
  const centro = lugarDe(l, alvo);
  const raio = r.raio * TILE_UNITS + TILE_UNITS / 2;
  const pegos = [l.arena.monstros[alvo] as MonstroNaArena];
  for (const m of l.arena.monstros) {
    if (l.fim) return;
    if (m.indice === alvo || m.fase === 'caido') continue;
    const dx = m.corpoX - centro.x;
    const dy = m.corpoY - centro.y;
    if (dx * dx + dy * dy > raio * raio) continue;
    pegos.push(m);
    ferirComDano(l, m.indice, dano, `-${dano}`);
  }
  const heroi = { x: l.arena.heroi.x, y: l.arena.heroi.y };
  for (const m of pegos) {
    if (l.fim) return;
    if (m.fase === 'caido' || l.rng() * 100 >= r.chance) continue;
    empurrar(l, m, heroi, empurraoDoEmpurrao(masmorra(l).hero));
    atordoar(l, m);
  }
}

/**
 * O Corte Invernal do Espadachim: com 300 de ki, uma faixa de 3 casas de
 * largura que anda 6 blocos rumo ao alvo (ou pra onde ele olha) e acerta todo
 * mundo nela — o mais perto leva o golpe a 80%, os outros o mesmo dano.
 */
function corteInvernal(l: Luta): void {
  const r = REGRAS_DO_ESPADACHIM;
  const hero = masmorra(l).hero;
  if (idDoEstilo(hero) !== 'espadachim' || (l.arena.ki ?? 0) < r.corte) return;
  const sobra = (l.arena.ki ?? 0) - r.corte;
  if (sobra > 0) l.arena.ki = sobra;
  else delete l.arena.ki;
  l.arena.recarga = RECARGA_DO_ATAQUE;
  contar(l, { tipo: 'aviso', texto: '❄️ Corte Invernal' });
  const heroi = { x: l.arena.heroi.x, y: l.arena.heroi.y };
  const alvo = alvoAtual(l);
  const olhar: Record<string, { x: number; y: number }> = { N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 } };
  const rumoDoCorte = alvo !== null ? { x: lugarDe(l, alvo).x - heroi.x, y: lugarDe(l, alvo).y - heroi.y } : (olhar[l.arena.heroi.facing ?? 'S'] ?? { x: 0, y: 1 });
  const comprimento = Math.sqrt(rumoDoCorte.x * rumoDoCorte.x + rumoDoCorte.y * rumoDoCorte.y);
  if (comprimento === 0) return;
  const alcance = r.alcanceDoCorte * TILE_UNITS + TILE_UNITS / 2;
  const meiaLargura = (r.larguraDoCorte * TILE_UNITS) / 2;
  const pegos: { m: MonstroNaArena; ao: number }[] = [];
  for (const m of l.arena.monstros) {
    if (m.fase === 'caido') continue;
    const lugar = lugarDe(l, m.indice);
    const px = lugar.x - heroi.x;
    const py = lugar.y - heroi.y;
    const ao = (px * rumoDoCorte.x + py * rumoDoCorte.y) / comprimento;
    const fora = Math.abs(px * rumoDoCorte.y - py * rumoDoCorte.x) / comprimento;
    if (ao >= 0 && ao <= alcance && fora <= meiaLargura) pegos.push({ m, ao });
  }
  if (pegos.length === 0) return;
  pegos.sort((a, b) => a.ao - b.ao || a.m.indice - b.m.indice);
  const dado = 1 + randomInt(LADOS_DO_DANO, l.rng);
  const leitura = { acerto: true, forca: r.forcaDoCorte / 100, critico: false };
  const acerto = acertarMonstro(l, (pegos[0] as { m: MonstroNaArena }).m, dado, leitura, estiloDoBotao(hero));
  if (!acerto || l.fim) return;
  for (let k = 1; k < pegos.length; k++) {
    if (l.fim) return;
    const m = (pegos[k] as { m: MonstroNaArena }).m;
    if (m.fase !== 'caido') ferirComDano(l, m.indice, acerto.dano, `❄️-${acerto.dano}`);
  }
}

// ---------- os estilos do Druida (rodada 5b: Metamorfose, Florescimento, Raízes Ocultas) ----------

/** O Druida com estilo deu mais um ataque nesta luta: conta, e avisa a aura de fera e as Raízes fundas quando chegam. O número deste. */
function contarGolpeDoEstilo(l: Luta, estilo: string): number {
  const golpes = (contadores(l).golpes ?? 0) + 1;
  l.arena.classe = { ...contadores(l), golpes };
  const aviso = (texto: string) => contar(l, { tipo: 'aviso', texto });
  if (estilo === 'metamorfose' && golpes === REGRAS_DA_METAMORFOSE.golpesDaAura) aviso('🐾 Aura de fera!');
  if (estilo === 'raizes' && golpes === REGRAS_DAS_RAIZES.golpesDoVeneno) aviso('🌱 Raízes fundas!');
  if (estilo === 'terra' && golpes === REGRAS_DA_TERRA.golpesDaPedra) aviso('🪨 Revestimento de pedra!');
  if (estilo === 'arcano' && golpes === REGRAS_DO_ARCANO.golpesDoArcano) aviso('✨ O arcano desperta!');
  if (estilo === 'escuridao' && golpes === REGRAS_DA_ESCURIDAO.golpesDaFome) aviso('🌑 A escuridão tem fome!');
  return golpes;
}

/** As Raízes (e os Grilhões, o redemoinho) prendem o monstro de pé (o chefe não). No espelho, não (é do anfitrião). */
function prender(l: Luta, m: MonstroNaArena, passos: number = REGRAS_DAS_RAIZES.preso, texto = '🌱 Preso'): void {
  if (noEspelho(l) || m.fase === 'caido' || monstroNo(l, m.indice).isBoss) return;
  m.preso = passos;
  contar(l, { tipo: 'numero', onde: 'monstro', indice: m.indice, texto, tom: 'erro' });
}

// ---------- os elementos do Mago (rodada 5c: Fogo, Terra, Vento, Água, Arcano, Escuridão) ----------

/**
 * O disparo do Mago com elemento acertou o monstro `indice` (o de número
 * `golpe` da luta): o que o elemento faz depois do dano. O que mexe no
 * monstro (a queimadura, o empurrão, o preso) é do anfitrião, como sempre; o
 * dano em quem está em volta, não.
 */
function elementoNoGolpe(l: Luta, indice: number, dano: number, golpe: number, estilo: string): void {
  const alvo = l.arena.monstros[indice] as MonstroNaArena;
  switch (estilo) {
    case 'fogo': {
      const r = REGRAS_DO_FOGO;
      if (aCadaGolpe(golpe, r.bolaACada)) bolaDeFogo(l, indice);
      else queimar(l, alvo, r.turnos);
      return;
    }
    case 'vento': {
      const r = REGRAS_DO_VENTO;
      l.arena.classe = { ...contadores(l), ventania: r.ventania };
      if (alvo.fase === 'caido') return;
      if (!noEspelho(l)) alvo.encurtado = true;
      contar(l, { tipo: 'numero', onde: 'monstro', indice, texto: '🌀', tom: 'erro' });
      if (aCadaGolpe(golpe, r.empurraACada) && empurrarComBatida(l, alvo, l.arena.heroi, r.empurrao) && !monstroNo(l, indice).isBoss) atordoar(l, alvo, r.atordoa);
      return;
    }
    case 'agua': {
      jatoDagua(l, indice, dano);
      if (!l.fim && aCadaGolpe(golpe, REGRAS_DA_AGUA.redemoinhoACada)) redemoinho(l, indice);
      return;
    }
    case 'arcano': {
      const r = REGRAS_DO_ARCANO;
      if (alvo.fase === 'caido') return;
      lentoNoMonstro(l, indice, r.lento);
      if (aCadaGolpe(golpe, r.grilhoesACada)) prender(l, alvo, r.preso, '⛓️ Preso');
      return;
    }
    case 'escuridao': {
      const r = REGRAS_DA_ESCURIDAO;
      if (aCadaGolpe(golpe, r.areaACada)) {
        const lugar = lugarDe(l, indice);
        l.arena.escuridao = { x: Math.trunc(lugar.x), y: Math.trunc(lugar.y), tempo: r.duracao };
        contar(l, { tipo: 'aviso', texto: '🌑 Escuridão' });
      }
      if (golpe >= r.golpesDaFome && alvo.fase !== 'caido') engolir(l, indice);
      return;
    }
    default:
  }
}

/** O monstro de pé fica queimando `turnos` turnos (5% da vida máxima dele por turno), sem encurtar a queimadura que já tinha. No espelho, não. */
function queimar(l: Luta, m: MonstroNaArena, turnos: number): void {
  if (noEspelho(l) || m.fase === 'caido') return;
  const monstro = (sala(l).monsters ?? [])[m.indice] as CombatMonster;
  const dmg = Math.max(1, Math.trunc((monstro.maxHp * REGRAS_DO_FOGO.queimadura) / 100));
  const antes = monstro.status?.queimadura;
  const queimadura = { turns: Math.max(turnos, antes?.turns ?? 0), dmg: Math.max(dmg, antes?.dmg ?? 0) };
  l.estado = gravarMonstro(masmorra(l), m.indice, { ...monstro, status: { ...monstro.status, queimadura } });
  contar(l, { tipo: 'numero', onde: 'monstro', indice: m.indice, texto: '🔥', tom: 'erro' });
}

/** A bola de fogo: queima todos de pé no 3 × 3 em volta do alvo (ele também) por 2 turnos. */
function bolaDeFogo(l: Luta, alvo: number): void {
  const r = REGRAS_DO_FOGO;
  const centro = lugarDe(l, alvo);
  const meio = (r.ladoDaBola * TILE_UNITS) / 2;
  contar(l, { tipo: 'aviso', texto: '🔥 Bola de fogo' });
  for (let i = 0; i < l.arena.monstros.length; i++) {
    const m = l.arena.monstros[i] as MonstroNaArena;
    if (m.fase === 'caido') continue;
    const lugar = lugarDe(l, m.indice);
    if (Math.abs(lugar.x - centro.x) <= meio && Math.abs(lugar.y - centro.y) <= meio) queimar(l, m, r.turnosDaBola);
  }
}

/** O monstro de pé fica `pct` (%) mais lento por 2 turnos (o Arcano). No espelho, não. */
function lentoNoMonstro(l: Luta, indice: number, pct: number): void {
  if (noEspelho(l)) return;
  const monstro = (sala(l).monsters ?? [])[indice] as CombatMonster;
  const lento = { turns: REGRAS_DO_DRUIDA.turnos, amount: pct / 100 };
  l.estado = gravarMonstro(masmorra(l), indice, { ...monstro, status: { ...monstro.status, lento } });
}

/**
 * O empurrão do Vento: como o da maça, `blocos` blocos pra longe de `de`, mas
 * diz se bateu em algo — a parede de volta da sala, uma parede de dentro ou
 * outro monstro de pé. Batendo numa de dentro ou num monstro, fica onde está.
 */
function empurrarComBatida(l: Luta, m: MonstroNaArena, de: { x: number; y: number }, blocos: number): boolean {
  if (noEspelho(l) || m.fase === 'caido' || m.fase === 'avisando' || m.fase === 'investindo') return false;
  const r = rumo(m.corpoX - de.x, m.corpoY - de.y, blocos * TILE_UNITS);
  const { cols, rows } = geometria(l);
  const meia = TILE_UNITS / 2;
  const alvoX = m.corpoX + r.x;
  const alvoY = m.corpoY + r.y;
  const x = Math.min(Math.max(alvoX, TILE_UNITS + meia), (cols - 1) * TILE_UNITS - meia);
  const y = Math.min(Math.max(alvoY, TILE_UNITS + meia), (rows - 1) * TILE_UNITS - meia);
  const noOutro = l.arena.monstros.some(
    (o) => o.indice !== m.indice && o.fase !== 'caido' && (o.corpoX - x) * (o.corpoX - x) + (o.corpoY - y) * (o.corpoY - y) < ESPACO_ENTRE_MONSTROS * ESPACO_ENTRE_MONSTROS,
  );
  if (naParede(l, x, y) || noOutro) return true;
  m.corpoX = x;
  m.corpoY = y;
  return x !== alvoX || y !== alvoY;
}

/** O jato da Água: quem está na linha do Mago ao alvo (1 casa de largura, até o alvo) leva o mesmo dano. */
function jatoDagua(l: Luta, alvo: number, dano: number): void {
  const heroi = { x: l.arena.heroi.x, y: l.arena.heroi.y };
  const fim = lugarDe(l, alvo);
  const dx = fim.x - heroi.x;
  const dy = fim.y - heroi.y;
  const comprimento = Math.sqrt(dx * dx + dy * dy);
  if (comprimento === 0) return;
  const meiaLargura = (REGRAS_DA_AGUA.largura * TILE_UNITS) / 2;
  const pegos: MonstroNaArena[] = [];
  for (const m of l.arena.monstros) {
    if (m.indice === alvo || m.fase === 'caido') continue;
    const lugar = lugarDe(l, m.indice);
    const px = lugar.x - heroi.x;
    const py = lugar.y - heroi.y;
    const ao = (px * dx + py * dy) / comprimento;
    const fora = Math.abs(px * dy - py * dx) / comprimento;
    if (ao >= 0 && ao <= comprimento && fora <= meiaLargura) pegos.push(m);
  }
  for (const m of pegos) {
    if (l.fim) return;
    if (m.fase !== 'caido') ferirComDano(l, m.indice, dano, `💧-${dano}`);
  }
}

/**
 * O redemoinho da Água: puxa quem está de pé a até `raio` blocos do alvo,
 * até `puxa` blocos rumo a ele, prende e deixa mais lento (o chefe não). No
 * espelho, não.
 */
function redemoinho(l: Luta, alvo: number): void {
  const r = REGRAS_DA_AGUA;
  if (noEspelho(l)) return;
  const centro = lugarDe(l, alvo);
  const raio = r.raio * TILE_UNITS + TILE_UNITS / 2;
  contar(l, { tipo: 'aviso', texto: '💧 Redemoinho' });
  for (const m of l.arena.monstros) {
    if (m.fase === 'caido' || monstroNo(l, m.indice).isBoss) continue;
    const dx = centro.x - m.corpoX;
    const dy = centro.y - m.corpoY;
    const distancia = Math.sqrt(dx * dx + dy * dy);
    if (distancia > raio) continue;
    if (m.indice !== alvo && m.fase !== 'avisando' && m.fase !== 'investindo') {
      // Puxa até `puxa` blocos, sem passar do espaço entre os monstros perto do meio.
      const anda = Math.min(r.puxa * TILE_UNITS, Math.max(0, distancia - ESPACO_ENTRE_MONSTROS));
      if (anda > 0 && distancia > 0) {
        const x = m.corpoX + Math.trunc((dx * anda) / distancia);
        const y = m.corpoY + Math.trunc((dy * anda) / distancia);
        if (!naParede(l, x, y)) {
          m.corpoX = x;
          m.corpoY = y;
        }
      }
    }
    prender(l, m, r.preso, '💧 Preso');
    m.lerdo = r.preso + r.lerdo;
  }
}

/** O Arcano desperto: cada disparo dá mana (até o máximo). */
function manaDoArcano(l: Luta): void {
  const estado = masmorra(l);
  const mp = Math.min(estado.hero.maxMp, estado.hero.mp + REGRAS_DO_ARCANO.mana);
  if (mp !== estado.hero.mp) l.estado = { ...estado, hero: { ...estado.hero, mp } };
}

/** A fome da escuridão: o disparo engole 15% da vida que resta do alvo (no chefe, no máximo 300). */
function engolir(l: Luta, indice: number): void {
  const r = REGRAS_DA_ESCURIDAO;
  const monstro = (sala(l).monsters ?? [])[indice] as CombatMonster;
  let engole = Math.trunc((monstro.hp * r.engole) / 100);
  if (monstro.isBoss) engole = Math.min(r.tetoNoChefe, engole);
  if (engole >= 1) ferirComDano(l, indice, engole, `🌑-${engole}`);
}

/** O monstro está dentro da área de escuridão do Mago? */
function naEscuridao(l: Luta, m: MonstroNaArena | undefined): boolean {
  const e = l.arena.escuridao;
  if (!e || !m) return false;
  const meio = (REGRAS_DA_ESCURIDAO.lado * TILE_UNITS) / 2;
  return Math.abs(m.corpoX - e.x) <= meio && Math.abs(m.corpoY - e.y) <= meio;
}

// ---------- as armas novas (rodada 6c: a kusarigama, a lança e o chapéu) ----------

/** A kusarigama: quem está na área de 3 casas de largura e 2 de fundo no alvo (ele e a fileira atrás dele) leva o mesmo dano. */
function areaDaKusarigama(l: Luta, alvo: number, dano: number): void {
  const r = REGRAS_DAS_ARMAS_NOVAS;
  const heroi = { x: l.arena.heroi.x, y: l.arena.heroi.y };
  const centro = lugarDe(l, alvo);
  const dx = centro.x - heroi.x;
  const dy = centro.y - heroi.y;
  const comprimento = Math.sqrt(dx * dx + dy * dy);
  if (comprimento === 0) return;
  const meiaLargura = (r.larguraDaKusarigama * TILE_UNITS) / 2;
  const fundo = r.fundoDaKusarigama * TILE_UNITS - TILE_UNITS / 2;
  const pegos: MonstroNaArena[] = [];
  for (const m of l.arena.monstros) {
    if (m.indice === alvo || m.fase === 'caido') continue;
    const lugar = lugarDe(l, m.indice);
    const px = lugar.x - centro.x;
    const py = lugar.y - centro.y;
    const ao = (px * dx + py * dy) / comprimento;
    const fora = Math.abs(px * dy - py * dx) / comprimento;
    if (ao >= -TILE_UNITS / 2 && ao <= fundo && fora <= meiaLargura) pegos.push(m);
  }
  for (const m of pegos) {
    if (l.fim) return;
    if (m.fase !== 'caido') ferirComDano(l, m.indice, dano, `⛓️-${dano}`);
  }
}

/** A lança: o próximo golpe tem 10% de sair com a faixa do crítico maior (a deste já valeu). */
function sortearLanca(l: Luta): void {
  if (!lancaNaMao(masmorra(l).hero)) return;
  const { criticoMaior: _antes, ...resto } = contadores(l);
  const proximo = l.rng() * 100 < REGRAS_DAS_ARMAS_NOVAS.chanceDaLanca;
  l.arena.classe = proximo ? { ...resto, criticoMaior: true } : resto;
  if (proximo) contar(l, { tipo: 'aviso', texto: '🔱 Crítico maior no próximo golpe' });
}

/**
 * O chapéu do espadachim sai da mão: gasta o ki, começa a espera e voa rumo
 * ao cursor (no PC); sem cursor, ao alvo de agora; sem alvo, pra onde o herói
 * olha.
 */
function lancarChapeu(l: Luta, entrada: EntradaDaLuta): void {
  const r = REGRAS_DAS_ARMAS_NOVAS;
  const hero = masmorra(l).hero;
  if (!podeLancarChapeu(hero) || l.arena.chapeu || (l.arena.recargaDoChapeu ?? 0) > 0 || (l.arena.ki ?? 0) < r.kiDoChapeu) return;
  const heroi = l.arena.heroi;
  const alvo = alvoAtual(l);
  const olhar: Record<string, { x: number; y: number }> = { N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 } };
  const para = entrada.cursor
    ? { x: entrada.cursor.x - heroi.x, y: entrada.cursor.y - heroi.y }
    : alvo !== null
      ? { x: lugarDe(l, alvo).x - heroi.x, y: lugarDe(l, alvo).y - heroi.y }
      : (olhar[heroi.facing ?? 'S'] ?? { x: 0, y: 1 });
  const v = rumo(para.x, para.y, r.velocidadeDoChapeu);
  const sobra = (l.arena.ki ?? 0) - r.kiDoChapeu;
  if (sobra > 0) l.arena.ki = sobra;
  else delete l.arena.ki;
  l.arena.recargaDoChapeu = r.recargaDoChapeu;
  l.arena.chapeu = { x: heroi.x, y: heroi.y, vx: v.x, vy: v.y, pegos: [], vida: r.vidaDoChapeu };
  contar(l, { tipo: 'aviso', texto: '🎩 Chapéu!' });
}

/**
 * Um passo do chapéu: na ida, em linha reta até bater na parede (ou no fim
 * do voo), e aí volta rumo ao herói até a mão dele. Quem ele encosta (uma vez
 * na ida e outra na volta) leva o golpe a 40% — o primeiro rola o golpe, os
 * outros levam o mesmo dano.
 */
function moverChapeu(l: Luta): void {
  const c = l.arena.chapeu;
  if (!c) return;
  const r = REGRAS_DAS_ARMAS_NOVAS;
  const heroi = l.arena.heroi;
  let vx = c.vx;
  let vy = c.vy;
  if (c.voltando) {
    const dx = heroi.x - c.x;
    const dy = heroi.y - c.y;
    if (dx * dx + dy * dy <= r.velocidadeDoChapeu * r.velocidadeDoChapeu || c.vida <= 1) {
      delete l.arena.chapeu;
      return;
    }
    const v = rumo(dx, dy, r.velocidadeDoChapeu);
    vx = v.x;
    vy = v.y;
  }
  const x = c.x + vx;
  const y = c.y + vy;
  if (!c.voltando && (c.vida <= 1 || foraDoChao(l, x, y) || naParede(l, x, y))) {
    l.arena.chapeu = { ...c, voltando: true, pegos: [], vida: c.vida - 1 };
    return;
  }
  const chapeu: ChapeuNaSala = { ...c, x, y, vx, vy, pegos: [...c.pegos], vida: c.vida - 1 };
  l.arena.chapeu = chapeu;
  const hero = masmorra(l).hero;
  for (let i = 0; i < l.arena.monstros.length; i++) {
    if (l.fim) return;
    const m = l.arena.monstros[i] as MonstroNaArena;
    if (m.fase === 'caido' || chapeu.pegos.includes(m.indice)) continue;
    const mx = m.corpoX - x;
    const my = m.corpoY - y;
    if (mx * mx + my * my > r.raioDoChapeu * r.raioDoChapeu) continue;
    chapeu.pegos.push(m.indice);
    if (chapeu.dano !== undefined) {
      ferirComDano(l, m.indice, chapeu.dano, `🎩-${chapeu.dano}`);
      continue;
    }
    const dado = 1 + randomInt(LADOS_DO_DANO, l.rng);
    const acerto = acertarMonstro(l, m, dado, { acerto: true, forca: r.forcaDoChapeu / 100, critico: false }, estiloDoBotao(hero));
    if (acerto) chapeu.dano = acerto.dano;
  }
}

// ---------- as aljavas do Arqueiro (rodada 6b: paralisante, flamejante, explosiva) ----------

/**
 * A flecha com a aljava ao lado do arco acertou o monstro `indice` (com este
 * `dano`): conta a flechada e faz o efeito da aljava. O que mexe no monstro
 * (o encurtar, a paralisia, a fraqueza, o incêndio, o empurrão) é do
 * anfitrião, como sempre; o dano da explosão, não.
 */
function flechaComAljava(l: Luta, indice: number, dano: number): void {
  const aljava = aljavaNoArco(masmorra(l).hero);
  if (!aljava) return;
  const r = REGRAS_DAS_ALJAVAS;
  const flechada = (contadores(l).flechadas ?? 0) + 1;
  l.arena.classe = { ...contadores(l), flechadas: flechada };
  const alvo = l.arena.monstros[indice] as MonstroNaArena;
  switch (aljava) {
    case 'aljava_paralisante':
      if (alvo.fase === 'caido' || noEspelho(l)) return;
      if (!alvo.encurtado) {
        alvo.encurtado = true;
        contar(l, { tipo: 'numero', onde: 'monstro', indice, texto: '🕸️', tom: 'erro' });
      }
      if (aCadaGolpe(flechada, r.paralisiaACada) && !monstroNo(l, indice).isBoss) {
        contar(l, { tipo: 'aviso', texto: '🕸️ Paralisia' });
        atordoar(l, alvo, r.paralisia);
      }
      return;
    case 'aljava_flamejante':
      if (alvo.fase === 'caido' || noEspelho(l)) return;
      if (!alvo.fraco) contar(l, { tipo: 'numero', onde: 'monstro', indice, texto: 'Fraco', tom: 'erro' });
      alvo.fraco = r.golpesFracos;
      if (aCadaGolpe(flechada, r.incendioACada)) incendiar(l, alvo, dano);
      return;
    case 'aljava_explosiva':
      explodirFlecha(l, indice, dano, aCadaGolpe(flechada, r.cadeiaACada));
      return;
    default:
  }
}

/** A aljava flamejante: o monstro fica incendiado 10 s, levando metade do dano da flechada a cada segundo (o incêndio novo fica com o dano maior). */
function incendiar(l: Luta, m: MonstroNaArena, dano: number): void {
  const r = REGRAS_DAS_ALJAVAS;
  const porSegundo = Math.max(1, Math.trunc((dano * r.incendioPorSegundo) / 100));
  m.incendio = { tempo: r.incendio, dano: Math.max(porSegundo, m.incendio?.dano ?? 0) };
  contar(l, { tipo: 'aviso', texto: '🔥 Incêndio' });
}

/**
 * A aljava explosiva: o monstro `origem` explode, e quem está de pé a até 2
 * blocos dele leva o mesmo dano (direto na vida: sem resistência nem escudo)
 * e é empurrado 1 bloco pra longe. Em cadeia, quem a explosão pega também
 * explode, mesmo caindo: cada um explode uma vez só e leva no máximo 2
 * estouros (o alvo da flecha já conta um).
 */
function explodirFlecha(l: Luta, origem: number, dano: number, emCadeia: boolean): void {
  const r = REGRAS_DAS_ALJAVAS;
  const raio = r.raioDaExplosao * TILE_UNITS + TILE_UNITS / 2;
  const estouros: Record<number, number> = { [origem]: 1 };
  const naFila: Record<number, boolean> = { [origem]: true };
  const fila = [origem];
  if (emCadeia) contar(l, { tipo: 'aviso', texto: '💥 Explosão em cadeia' });
  for (let k = 0; k < fila.length; k++) {
    if (l.fim) return;
    const quem = fila[k] as number;
    const centro = lugarDe(l, quem);
    contar(l, { tipo: 'numero', onde: 'monstro', indice: quem, texto: '💥', tom: 'erro' });
    const pegos: MonstroNaArena[] = [];
    for (const m of l.arena.monstros) {
      if (m.indice === quem || m.fase === 'caido' || (estouros[m.indice] ?? 0) >= r.estourosPorInimigo) continue;
      const dx = m.corpoX - centro.x;
      const dy = m.corpoY - centro.y;
      if (dx * dx + dy * dy <= raio * raio) pegos.push(m);
    }
    for (const m of pegos) {
      if (l.fim) return;
      if (m.fase === 'caido') continue;
      estouros[m.indice] = (estouros[m.indice] ?? 0) + 1;
      if (!ferirComDano(l, m.indice, dano, `💥-${dano}`)) empurrar(l, m, centro, r.empurraoDaExplosao);
      if (emCadeia && !naFila[m.indice]) {
        naFila[m.indice] = true;
        fila.push(m.indice);
      }
    }
  }
}

/**
 * O Florescimento planta uma flor em (x, y), a até `plantio` blocos do herói:
 * no máximo `maximo` no chão, e a nova tira a mais antiga. O botão espera a
 * recarga, como depois de um golpe.
 */
function plantar(l: Luta, x: number, y: number): void {
  const r = REGRAS_DO_FLORESCIMENTO;
  if (idDoEstilo(masmorra(l).hero) !== 'florescimento') return;
  const dx = x - l.arena.heroi.x;
  const dy = y - l.arena.heroi.y;
  const alcance = r.plantio * TILE_UNITS + TILE_UNITS / 2;
  if (dx * dx + dy * dy > alcance * alcance) {
    contar(l, { tipo: 'aviso', texto: 'Chegue mais perto' });
    return;
  }
  const flor = { x: Math.trunc(x), y: Math.trunc(y) };
  l.arena.flores = [...(l.arena.flores ?? []), flor].slice(-r.maximo);
  l.arena.recarga = RECARGA_DO_ATAQUE;
  contar(l, { tipo: 'numero', onde: 'chao', x: flor.x, y: flor.y, texto: '🌸', tom: 'cura' });
}

/** O herói daqui está dentro de uma flor (a dele ou a do parceiro)? */
function naFlor(l: Luta): boolean {
  const meio = (REGRAS_DO_FLORESCIMENTO.lado * TILE_UNITS) / 2;
  const { x, y } = l.arena.heroi;
  const flores = [...(l.arena.flores ?? []), ...(l.arena.dupla?.floresDoParceiro ?? [])];
  return flores.some((f) => Math.abs(x - f.x) <= meio && Math.abs(y - f.y) <= meio);
}

/**
 * Um passo do mundo nas flores: quem está dentro fica sem o veneno e o
 * sangramento (a imunidade tira e segura; o osso quebrado não), e a cada
 * segundo dentro cura `cura` (%) da vida máxima. O fantasma não.
 */
function passarAsFlores(l: Luta): void {
  if (l.arena.dupla?.fantasma || !naFlor(l)) {
    delete l.arena.relogioDaFlor;
    return;
  }
  const estado = masmorra(l);
  const hero = estado.hero;
  const envenenado = (hero.buffs?.poisonTurns ?? 0) > 0;
  const ferido = !!hero.ferimentos?.veneno || !!hero.ferimentos?.sangramento;
  if (envenenado || ferido) {
    const { poisonTurns: _turnos, poisonDmg: _dano, ...buffs } = hero.buffs ?? {};
    const { veneno: _veneno, sangramento: _sangramento, ...ferimentos } = hero.ferimentos ?? {};
    const { ferimentos: _antes, ...semFerimentos } = hero;
    const limpo = Object.keys(ferimentos).length > 0 ? { ...semFerimentos, ferimentos } : semFerimentos;
    l.estado = { ...estado, hero: envenenado ? { ...limpo, buffs } : limpo };
    contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: '🌸 Imune', tom: 'cura' });
  }
  const relogio = (l.arena.relogioDaFlor ?? 0) + 1;
  if (relogio < 60) {
    l.arena.relogioDaFlor = relogio;
    return;
  }
  l.arena.relogioDaFlor = 0;
  const agora = masmorra(l);
  const falta = agora.hero.maxHp - agora.hero.hp;
  if (falta <= 0) return;
  const cura = Math.min(falta, Math.max(1, Math.trunc((agora.hero.maxHp * REGRAS_DO_FLORESCIMENTO.cura) / 100)));
  l.estado = { ...agora, hero: { ...agora.hero, hp: agora.hero.hp + cura } };
  contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `🌸+${cura}`, tom: 'cura' });
}

/** O Monge com o ki cheio se reveste: bate mais forte até o próximo golpe levado. */
function revestir(l: Luta): void {
  const r = REGRAS_DO_MONGE;
  if (idDaClasse(masmorra(l).hero) !== 'monge' || l.arena.revestido || (l.arena.ki ?? 0) < r.revestir) return;
  const sobra = (l.arena.ki ?? 0) - r.revestir;
  if (sobra > 0) l.arena.ki = sobra;
  else delete l.arena.ki;
  l.arena.revestido = true;
  contar(l, { tipo: 'aviso', texto: '☯️ Revestido de ki' });
}

/**
 * A explosão de ki: gasta todo o ki e bate em quem está a até
 * `raioDaExplosao` blocos — o mais perto leva o golpe (na força do ki gasto),
 * os outros o mesmo dano — e empurra todos pra longe dele.
 */
function explodir(l: Luta): void {
  const r = REGRAS_DO_MONGE;
  const ki = l.arena.ki ?? 0;
  const hero = masmorra(l).hero;
  if (idDaClasse(hero) !== 'monge' || ki <= 0) return;
  delete l.arena.ki;
  l.arena.recarga = RECARGA_DO_ATAQUE;
  contar(l, { tipo: 'aviso', texto: '💥 Explosão de ki' });
  const heroi = { x: l.arena.heroi.x, y: l.arena.heroi.y };
  const raio = r.raioDaExplosao * TILE_UNITS + TILE_UNITS / 2;
  const naArea: { m: MonstroNaArena; distancia: number }[] = [];
  for (const m of l.arena.monstros) {
    if (m.fase === 'caido') continue;
    const lugar = lugarDe(l, m.indice);
    const distancia = (heroi.x - lugar.x) * (heroi.x - lugar.x) + (heroi.y - lugar.y) * (heroi.y - lugar.y);
    if (distancia <= raio * raio) naArea.push({ m, distancia });
  }
  if (naArea.length === 0) return;
  // O mais perto primeiro; no empate, a ordem da sala.
  naArea.sort((a, b) => a.distancia - b.distancia || a.m.indice - b.m.indice);
  // Com dois leques (rodada 6c), a explosão empurra mais longe e bate mais forte.
  const daArma = explosaoDaArma(hero);
  const dado = 1 + randomInt(LADOS_DO_DANO, l.rng);
  const acerto = acertarMonstro(l, (naArea[0] as { m: MonstroNaArena }).m, dado, { acerto: true, forca: forcaDaExplosao(ki), critico: false }, estiloDoBotao(hero), daArma.dano);
  if (!acerto || l.fim) return;
  for (let k = 1; k < naArea.length; k++) {
    if (l.fim) return;
    const m = (naArea[k] as { m: MonstroNaArena }).m;
    if (m.fase !== 'caido') ferirComDano(l, m.indice, acerto.dano, `💥-${acerto.dano}`);
  }
  for (const { m } of naArea) {
    if (l.fim) return;
    if (m.fase !== 'caido') empurrar(l, m, heroi, daArma.empurra);
  }
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
  // O Necromante invoca o lacaio do Breno (rodada 4b; só aqui, o site continua com o esqueleto de antes).
  if (poder.type === 'invocar' && idDaClasse(estado.hero) === 'necromante') {
    invocarLacaio(l, poder);
    return;
  }
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
  // A moral do grupo (o degrau 1) também deixa o passo mais ligeiro.
  const daMoral = moralAqui(l).velocidade;
  const base = velocidadeNaArena(masmorra(l).hero);
  // As Raízes fundas (rodada 5b) também: o Druida anda 10% mais rápido.
  const fundas = idDoEstilo(masmorra(l).hero) === 'raizes' && raizesFundas(contadores(l).golpes ?? 0) ? REGRAS_DAS_RAIZES.velocidade : 0;
  // E a ventania do Vento (rodada 5c).
  const ventania = (contadores(l).ventania ?? 0) > 0 ? REGRAS_DO_VENTO.velocidade : 0;
  // Os dois leques do Monge (rodada 6c).
  const daMais = daMoral + fundas + ventania + velocidadeDaArma(masmorra(l).hero);
  const velocidade = daMais > 0 ? Math.trunc((base * (100 + daMais)) / 100) : base;
  return walkTick(planta, heroi, { x: entrada.x, y: entrada.y }, velocidade).walker;
}

function passoDoMundo(l: Luta, entrada: EntradaDaLuta): void {
  const arena = l.arena;
  arena.passo += 1;
  const antes = arena.heroi;
  arena.heroi = moverHeroi(l, entrada);
  // O Arqueiro conta o tempo parado.
  const parado = contarParado(masmorra(l).hero, contadores(l), arena.heroi.x !== antes.x || arena.heroi.y !== antes.y);
  if (parado) arena.classe = parado;
  if (arena.reforco !== undefined) {
    if (arena.reforco > 1) arena.reforco -= 1;
    else delete arena.reforco;
  }
  passarAFe(l);
  passarOsEstilos(l);
  passarAsFlores(l);
  canalizar(l, entrada);
  moverChapeu(l);
  if (l.fim) return;
  if (arena.recarga > 0) arena.recarga -= 1;
  if (arena.recargaDoItem > 0) arena.recargaDoItem -= 1;
  if (arena.intervalo > 0) arena.intervalo -= 1;
  for (const id of Object.keys(arena.recargaDosPoderes)) {
    const falta = (arena.recargaDosPoderes[id] as number) - 1;
    if (falta > 0) arena.recargaDosPoderes[id] = falta;
    else delete arena.recargaDosPoderes[id];
  }
  // A fúria do Bárbaro esfria sem apanhar.
  const frio = esfriar(masmorra(l).hero, contadores(l));
  if (frio) arena.classe = frio;

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
  // Incendiado pela aljava flamejante (rodada 6b): queima a cada segundo.
  if (m.incendio) {
    const tempo = m.incendio.tempo - 1;
    const dano = m.incendio.dano;
    if (tempo > 0) m.incendio = { tempo, dano };
    else delete m.incendio;
    if (tempo % 60 === 0 && (ferirComDano(l, m.indice, dano, `🔥-${dano}`) || l.fim)) return;
  }
  // Preso pelas Raízes (rodada 5b): o tempo corre aqui.
  if (m.preso !== undefined) {
    if (m.preso > 1) m.preso -= 1;
    else delete m.preso;
  }
  if (m.lerdo !== undefined) {
    if (m.lerdo > 1) m.lerdo -= 1;
    else delete m.lerdo;
  }
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
  // O Vento do Mago (rodada 5c): o monstro que ele acertou golpeia de 1 bloco mais perto (até meio bloco).
  const distancia = m.encurtado ? Math.max(TILE_UNITS / 2, jeito.distancia - REGRAS_DO_VENTO.encurta * TILE_UNITS) : jeito.distancia;
  return distanciaDoHeroi(l, m) <= distancia * distancia;
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
  // Preso pelas Raízes, não sai do lugar.
  if ((m.preso ?? 0) > 0) return;
  const heroi = presaDe(l, m);
  // Lento (as vinhas do Druida, as canções…), anda menos.
  const lento = ((sala(l).monsters ?? [])[m.indice] as CombatMonster | undefined)?.status?.lento;
  // Sem `amount` (save antigo), os 20% do site (`startMonsterAttack`).
  const passoLento = lento && lento.turns > 0 ? Math.trunc(jeito.passo * (1 - (lento.amount || 0.2))) : jeito.passo;
  // O redemoinho da Água (rodada 5c) também.
  const passo = (m.lerdo ?? 0) > 0 ? Math.trunc((passoLento * (100 - REGRAS_DA_AGUA.lento)) / 100) : passoLento;
  const r = rumo(heroi.x - m.corpoX, heroi.y - m.corpoY, passo);
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
    const jeito = jeitoDe(monstroNo(l, m.indice));
    // Preso pelas Raízes, não investe (o golpe de onde está, sim).
    if ((m.preso ?? 0) > 0 && jeito.golpe === 'investida') continue;
    if (aDistanciaDoGolpe(l, m, jeito)) return m;
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
  // Fraco pela aljava flamejante (rodada 6b): este golpe sai mais fraco, e gasta um.
  const fraco = m.fraco ?? 0;
  if (fraco > 0) {
    m.forca = (m.forca * (100 - REGRAS_DAS_ALJAVAS.fraqueza)) / 100;
    if (fraco > 1) m.fraco = fraco - 1;
    else delete m.fraco;
  }
  if (solta) {
    m.poder = poder;
    m.alvo = -1;
    if (poder === 'devastador') m.forca = m.forca * FORCA_DO_DEVASTADOR;
    const { nome, icone } = PODERES_DO_CHEFE[poder];
    contar(l, { tipo: 'aviso', texto: `${icone} ${monstro.name}: ${nome}!` });
  } else {
    if (m.noLacaio !== undefined && lacaioDePe(l, m.noLacaio)) {
      // Foi atrás de um lacaio: o golpe cai nele.
      m.alvo = m.noLacaio;
    } else {
      const escolhido = pickMonsterTarget(masmorra(l).party, l.rng) ?? -1;
      // O lacaio com corpo só leva o golpe de quem foi atrás dele.
      m.alvo = escolhido >= 0 && temCorpo(l, escolhido) ? -1 : escolhido;
    }
    // O Paladino puxa os monstros: parte dos golpes que iam num companheiro vem nele.
    if (m.alvo >= 0 && puxaOsMonstros(masmorra(l).hero) && l.rng() * 100 < REGRAS_DO_PALADINO.foco) m.alvo = -1;
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
    const golpe = golpeNoMembro(membro, monstro, m.forca, l.rng);
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
  // O Espadachim fica imune logo depois do avanço (rodada 5a).
  if ((contadores(l).imune ?? 0) > 0) {
    contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: 'Imune', tom: 'erro' });
    contar(l, { tipo: 'som', som: 'miss' });
    return;
  }
  const estado = masmorra(l);
  const monstro = monstroNo(l, indice);
  const c = contadores(l);
  // Na escuridão do Mago (rodada 5c), o monstro bate mais fraco e acerta menos.
  const escuro = naEscuridao(l, l.arena.monstros[indice]);
  const r = REGRAS_DA_ESCURIDAO;
  // A esquiva da classe (a furtividade do Ladino) soma com a do pet.
  const esquiva = (petBonus(l.pet).esquiva ?? 0) + esquivaDaClasse(estado.hero, c, !!monstro.isBoss) + (escuro ? r.erra : 0);
  const forcaNoEscuro = escuro ? (forca * (100 - r.fraqueza)) / 100 : forca;
  const golpe = landHitOnHero(estado.hero, monstro, forcaNoEscuro, l.rng, esquiva, defesasDoHeroi(estado.hero), classeRefeita(estado.hero));
  if (golpe.dodged) {
    // Esquivar treina a Destreza.
    l.estado = gravarMonstro({ ...estado, hero: anotarUso(golpe.hero, 'destreza') }, indice, golpe.monster);
    contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: 'Desviou', tom: 'erro' });
    contar(l, { tipo: 'som', som: 'miss' });
    return;
  }
  // A resistência da classe (a vida que falta no Guerreiro, a fúria, a absorção) e a da moral tiram parte do dano.
  const moral = moralAqui(l);
  // O revestimento de ki do Monge segura parte deste golpe, e quebra.
  const revestido = !!l.arena.revestido;
  const resistencia = resistenciaDaClasse(estado.hero, c) + moral.resistencia + (revestido ? escudoDoRevestimento(estado.hero) : 0);
  const dano = resistencia > 0 ? Math.max(1, golpe.damage - Math.floor((golpe.damage * resistencia) / 100)) : golpe.damage;
  const ferido = resistencia > 0 ? { ...golpe.hero, hp: Math.max(0, estado.hero.hp - dano) } : golpe.hero;
  let hero = noEscudo(l, estado.hero.hp, ferido, dano);
  // Os pesados (os Brutamontes) também quebram osso, como o chefe já quebra (doc do Breno de 2026-11-15; só aqui).
  let quebrou: Membro | undefined = golpe.quebrou;
  if (!quebrou && !monstro.isBoss && monstro.enemyClassId === 'brutamontes' && l.rng() < CHANCE_DE_QUEBRAR_NO_CHEFE) {
    const quebra = quebrarMembro(hero, l.rng);
    hero = quebra.hero;
    quebrou = quebra.membro;
  }
  // A moral 5 do grupo segura os ossos: o sorteio corre igual, mas nada quebra.
  if (quebrou && moral.semQuebrar) {
    hero = comOsFerimentos(hero, estado.hero.ferimentos);
    quebrou = undefined;
  }
  // O Poder da fé segura a vida no piso; e o dano levado entra na janela dele.
  hero = pisoDaFe(l, estado.hero.hp, hero);
  anotarDanoLevado(l, dano);
  l.estado = gravarMonstro({ ...estado, hero }, indice, golpe.monster);
  contar(l, { tipo: 'som', som: 'hit' });
  if (revestido) {
    delete l.arena.revestido;
    contar(l, { tipo: 'aviso', texto: '☯️ O revestimento se quebra' });
  }
  if (quebrou) {
    const texto = `🦴 ${monstro.name} quebrou ${nomeDoMembro(quebrou)}!`;
    contar(l, { tipo: 'aviso', texto });
    diario(l, [texto]);
  }
  if (golpe.manaDrained > 0) contar(l, { tipo: 'aviso', texto: `${monstro.name} drena ${golpe.manaDrained} de mana` });
  if (golpe.drainResisted) contar(l, { tipo: 'aviso', texto: 'Sua armadura segura o dreno de mana' });
  if (golpe.poisonApplied) contar(l, { tipo: 'aviso', texto: 'Você foi envenenado' });
  if (golpe.poisonResisted) contar(l, { tipo: 'aviso', texto: 'Sua armadura segura o veneno' });
  apanhou(l, indice, dano, hero.hp > 0);
  if (l.fim) return;
  if (hero.hp <= 0) cair(l);
}

/** O herói com estes ferimentos (os de antes do golpe); sem nenhum, sem o campo. */
function comOsFerimentos(hero: Hero, ferimentos: Hero['ferimentos']): Hero {
  const { ferimentos: _agora, ...resto } = hero;
  return ferimentos ? { ...resto, ferimentos } : resto;
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
  const golpe = golpeNoMembro(membro, monstroNo(l, m.indice), m.forca, l.rng);
  l.estado = { ...estado, party: estado.party.map((atual, i) => (i === alvo ? golpe.member : atual)) };
  contar(l, { tipo: 'numero', onde: 'companheiro', indice: alvo, texto: `-${golpe.damage}`, tom: 'dano' });
  contar(l, { tipo: 'som', som: 'hit' });
  if (golpe.defeated) diario(l, [`${membro.name} caiu!`]);
}

/** O companheiro bate no alvo do jogador, no tempo dele. O lacaio com corpo tem o jeito dele (`agirLacaio`). */
function agirCompanheiro(l: Luta, c: CompanheiroNaArena): void {
  const estado = masmorra(l);
  const membro = estado.party[c.indice];
  if (!membro || membro.hp <= 0) return;
  if (c.x !== undefined && c.y !== undefined) {
    agirLacaio(l, c, membro);
    return;
  }
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
  // O veneno também passa primeiro pelo escudo do vigor (e pelo piso do Poder da fé).
  const hero = veneno.damage > 0 ? pisoDaFe(l, antes.hp, noEscudo(l, antes.hp, veneno.hero, veneno.damage)) : veneno.hero;
  anotarDanoLevado(l, veneno.damage);
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
  // Na luta do Necromante, quem cai deixa um cristal no chão (rodada 4b).
  if (m && idDaClasse(masmorra(l).hero) === 'necromante') {
    const cristal: CristalNaSala = { x: m.corpoX, y: m.corpoY, especie: abatido.speciesId, nivel: monsterLevel(abatido.floor), ...(abatido.isBoss ? { chefe: true } : {}) };
    l.arena.cristais = [...(l.arena.cristais ?? []), cristal];
  }
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

/** Atrás de quem o monstro vai: o lacaio ou o parceiro, se foi quem ele escolheu e ainda está de pé; senão o herói daqui. */
function presaDe(l: Luta, m: MonstroNaArena): { x: number; y: number } {
  if (m.noLacaio !== undefined) {
    const lacaio = lacaioDePe(l, m.noLacaio);
    if (lacaio) return { x: lacaio.x as number, y: lacaio.y as number };
  }
  return (m.noParceiro ? parceiroDePe(l) : null) ?? l.arena.heroi;
}

/**
 * Em dupla, o monstro que espera escolhe o herói de pé mais perto do corpo
 * dele (o fantasma não conta); o Paladino conta como se estivesse
 * `REGRAS_DO_PALADINO.foco` % mais perto. Sem sorteio: na luta de um só,
 * nada muda.
 */
function escolherPresa(l: Luta, m: MonstroNaArena): void {
  const parceiro = parceiroDePe(l);
  const lacaios = lacaiosComCorpo(l);
  if (lacaios.length > 0) {
    escolherComLacaios(l, m, parceiro, lacaios);
    return;
  }
  delete m.noLacaio;
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
  // As distâncias vêm ao quadrado, e o peso também: (100 − foco)² contra 100².
  const perto = (100 - REGRAS_DO_PALADINO.foco) * (100 - REGRAS_DO_PALADINO.foco);
  const pesoDaqui = puxaOsMonstros(masmorra(l).hero) ? perto : 10000;
  const pesoDele = l.arena.dupla?.parceiroPuxa ? perto : 10000;
  if (dele * pesoDele < daqui * pesoDaqui) m.noParceiro = true;
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
    if (entrada.parceiro.puxa) dupla.parceiroPuxa = true;
    else delete dupla.parceiroPuxa;
    if ((entrada.parceiro.dano ?? 0) > 0) dupla.parceiroDano = Math.trunc(entrada.parceiro.dano as number);
    else delete dupla.parceiroDano;
    const flores = (entrada.parceiro.flores ?? []).slice(0, REGRAS_DO_FLORESCIMENTO.maximo).map((f) => ({ x: Math.trunc(f.x), y: Math.trunc(f.y) }));
    if (flores.length > 0) dupla.floresDoParceiro = flores;
    else delete dupla.floresDoParceiro;
  }
  // A moral do grupo que o Bardo do parceiro subiu (fica a maior).
  if (entrada.moral !== undefined && Math.trunc(entrada.moral) > (l.arena.moral?.nivel ?? 0)) l.arena.moral = { ...l.arena.moral, nivel: Math.trunc(entrada.moral) };
  // O apoio do parceiro em mim (o fantasma não recebe nada).
  if (!dupla.fantasma) {
    for (const apoio of entrada.apoios ?? []) {
      if (!Object.prototype.hasOwnProperty.call(ICONE_DO_APOIO, apoio.tipo)) continue;
      receberApoio(l, apoio.passos !== undefined ? { tipo: apoio.tipo, passos: Math.max(0, Math.trunc(apoio.passos)) } : { tipo: apoio.tipo });
    }
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
  ferirComDano(l, indice, dano, `-${dano}`);
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
  // O Necromante com a Magia Proibida liberada se levanta, e ela fica selada até zerar a masmorra (rodada 4b).
  const quem = masmorra(l).hero;
  if (idDaClasse(quem) === 'necromante' && !quem.bloqueioDaMagia) {
    const vida = Math.max(1, Math.trunc((quem.maxHp * REGRAS_DO_NECROMANTE.levantaCom) / 100));
    l.estado = { ...masmorra(l), hero: { ...quem, hp: vida, bloqueioDaMagia: masmorra(l).masmorra.dungeon } };
    const texto = '☠️ A Magia Proibida levanta o Necromante! Ela fica selada até zerar a masmorra.';
    contar(l, { tipo: 'aviso', texto });
    diario(l, [texto]);
    contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `☠️+${vida}`, tom: 'cura' });
    return;
  }
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
