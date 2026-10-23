/**
 * A luta em tempo real do app, em primeira pessoa como a do site, com o
 * coração na caixa como no Undertale (pedida pelo usuário como teste em
 * 2026-10-17, e mantida por ele no mesmo dia; a luta dentro da sala ficou
 * no histórico, no commit 82b03da).
 *
 * - Os monstros ficam no palco, de frente, como no site: não andam. O
 *   jogador toca no monstro que quer atacar (`mirar`), e o alvo cai pro
 *   primeiro de pé quando o dele cai.
 * - **O herói é um coração dentro da caixa**, que o joystick move. Todo
 *   golpe de monstro no herói vira um desenho na caixa, com **aviso** antes:
 *   o círculo do golpe de perto, a faixa da investida, a bola do tiro. Só
 *   pega se encostar no coração, e aí é o golpe do site (`landHitOnHero`).
 * - **Cada comportamento é um jeito de lutar** (`JEITOS_DE_LUTAR`): o
 *   agressivo e o ágil mergulham na caixa em linha reta, o mágico atira, o
 *   lento, o venenoso e o defensivo batem num círculo onde o coração estava.
 * - Um monstro golpeia por vez, revezando entre os de pé como no site, com um
 *   respiro entre um golpe e o outro. O golpe pode ir num companheiro, pela
 *   regra do site (`pickMonsterTarget`): aí não passa pela caixa.
 * - **Um botão de ataque**, que abre o evento da arma (`eventos-de-arma.ts`)
 *   no alvo; enquanto ele dura o mundo anda em **câmera lenta**, e no fim o
 *   golpe cai no alvo, de perto ou de longe.
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
 * **Tudo em passos e unidades inteiras**, como o andar: 60 passos por
 * segundo, a caixa medida nas unidades da sala. A única conta que não é de
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
import { castPower } from '../combat/use-power.js';
import type { DungeonCell } from '../dungeon/generate.js';
import { STICK_MAX, type Walker } from '../dungeon/room-walk.js';
import type { Behavior } from '../monsters/species.js';
import { heroPowers, type Hero } from '../hero/hero.js';
import type { Item } from '../items/item.js';
import { monsterView } from '../monsters/generate.js';
import { petBonus, type PetId } from '../pets/pets.js';
import { randomInt, type Rng } from '../rng.js';
import type { Efeito } from '../jogo/efeitos.js';
import { celulaAtual, type EstadoDoJogo, type EstadoNaMasmorra } from '../jogo/estado.js';
import { gravarMonstro, indicesDePe, limparSala, pagarAbate, perderLuta, prepararLuta } from '../jogo/fim-da-luta.js';
import { podeUsar, usar } from '../jogo/mochila.js';
import { aplicarRunas, RUNAS } from '../items/runas.js';
import { defesasDoHeroi, escudoDoVigor } from '../items/encantamentos.js';
import { eventoDaArma, eventoDoAtaque, lerEvento, TAMANHO_DO_DESENHO, type EventoDeArma, type JogadaDoEvento, type TipoDeEvento } from './eventos-de-arma.js';

// ---------- números ----------

/** Na câmera lenta, o mundo anda um passo a cada este tanto. */
export const LENTIDAO = 2;

/** A rodada da luta: veneno do herói, dano contínuo dos monstros e a Canção de Batalha, a cada 1,5 s. */
export const RODADA = 90;

/** Depois de um golpe, quanto até o próximo aperto abrir outro evento. */
export const RECARGA_DO_ATAQUE = 15;

/** Quanto um poder espera depois de usado: 3 s. */
export const RECARGA_DO_PODER = 180;

/** Quanto o botão de item espera depois de usado. */
export const RECARGA_DO_ITEM = 60;

/** A caixa, nas unidades da sala: 8 quadrados de largura por 3 de altura. */
export const LARGURA_DA_CAIXA = 7680;
export const ALTURA_DA_CAIXA = 2880;

/** O raio do coração: encostou nele, pegou. */
export const RAIO_DO_CORACAO = 160;

/** O coração anda isto por passo, com o joystick todo: atravessa a caixa em pouco mais de 1,5 s. */
export const VELOCIDADE_DO_CORACAO = 80;

/** Passos até o tiro sumir, se não sair da caixa nem bater em nada. */
export const VIDA_DO_TIRO = 120;

/** Atordoado, o monstro fica parado este tanto e perde o golpe. */
export const TEMPO_ATORDOADO = 60;

/** Lento demais, o monstro hesita este tanto e perde o golpe. */
export const TEMPO_HESITANDO = 40;

/** Quanto a luta espera antes do primeiro golpe. */
export const ESPERA_INICIAL = 60;

/**
 * Quantos monstros podem estar golpeando (no aviso ou na investida) ao mesmo
 * tempo, e o respiro depois que um golpe acaba antes do próximo começar.
 *
 * Um por vez é a regra do site levada pro tempo real: lá, um monstro do
 * grupo ataca por rodada, revezando (decisão do usuário, 2026-10-16). Sem
 * isso, um grupo de três bateria quase três vezes mais por golpe do herói
 * do que no site — e a recompensa é a mesma.
 */
export const ATACANDO_DE_UMA_VEZ = 1;
export const INTERVALO_ENTRE_GOLPES = 30;

/** Um companheiro golpeia a cada este tanto. */
export const CADENCIA_DO_COMPANHEIRO = 100;

/** O jeito de lutar de um comportamento. */
export interface JeitoDeLutar {
  /** Quanto dura o aviso antes do golpe. */
  aviso: number;
  /**
   * Perto: cai num círculo em volta de onde o coração estava quando o aviso
   * começou. Investida: o monstro mergulha na caixa em linha reta, mirando
   * onde o coração estava. Tiro: uma bola sai de cima, mirando onde o coração
   * está quando o aviso acaba.
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
}

/**
 * Os seis jeitos (decisão do usuário, 2026-10-17): o ágil é rápido e desvia
 * (a esquiva de 15% dele já está no golpe); o agressivo investe em linha
 * reta; o lento é devagar e bate forte (o ×1,7 no terceiro golpe já está na
 * regra); o mágico atira de longe; o venenoso envenena (já está no golpe); o
 * defensivo se protege depois de bater.
 */
export const JEITOS_DE_LUTAR: Readonly<Record<Behavior, JeitoDeLutar>> = {
  agressivo: { aviso: 30, golpe: 'investida', tamanho: 560, velocidade: 160, descanso: 40 },
  agil: { aviso: 18, golpe: 'investida', tamanho: 400, velocidade: 224, descanso: 25 },
  defensivo: { aviso: 36, golpe: 'perto', tamanho: 1100, velocidade: 0, descanso: 60, guarda: true },
  venenoso: { aviso: 30, golpe: 'perto', tamanho: 1000, velocidade: 0, descanso: 40 },
  lento: { aviso: 54, golpe: 'perto', tamanho: 1300, velocidade: 0, descanso: 50 },
  magico: { aviso: 36, golpe: 'tiro', tamanho: 360, velocidade: 96, descanso: 50 },
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
  /** Em quem o golpe em curso cai: -1 é o herói (na caixa); senão o índice do companheiro na equipe. */
  alvo: number;
  /** O golpe na caixa: o centro do círculo (perto), o corpo que mergulha (investida) ou de onde a bola sai (tiro). */
  x: number;
  y: number;
  /** O rumo da investida, travado no começo do aviso, já na velocidade dela. */
  rumoX: number;
  rumoY: number;
}

export interface CompanheiroNaArena {
  /** O índice em `estado.party`. */
  indice: number;
  /** Passos até o próximo golpe. */
  tempo: number;
}

/** A bola do mágico, voando pela caixa. */
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

/** Onde o coração está, na caixa. */
export interface Coracao {
  x: number;
  y: number;
}

export interface EventoAberto {
  evento: EventoDeArma;
  /** Passos desde o aperto que abriu. */
  passo: number;
  jogada: JogadaDoEvento;
  /** O monstro mirado (índice na sala). */
  alvo: number;
  estilo: AttackStyle;
}

export interface Arena {
  /** Passos do mundo desde que a luta abriu. */
  passo: number;
  /** Conta os passos da câmera lenta. */
  lento: number;
  /** Por onde o herói entrou na sala: é onde ele fica quando a luta acaba. */
  chegada: Walker;
  coracao: Coracao;
  /** O monstro que o jogador escolheu (índice na sala); sempre um de pé enquanto a luta dura. */
  alvo: number;
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
}

/** O que a pessoa fez neste passo. */
export interface EntradaDaLuta {
  /** O joystick (ou as teclas), inteiros de -STICK_MAX a STICK_MAX: move o coração. */
  x: number;
  y: number;
  /** Tocou num monstro: ele vira o alvo (índice na sala). */
  mirar?: number;
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
}

/** Algo que a tela mostra ou toca. */
export interface Acontecimento {
  tipo: 'numero' | 'som' | 'diario' | 'aviso';
  /** Número: o texto ("-12", "Errou"…). Diário e aviso: a frase. */
  texto?: string;
  /** Número: sobre quem. */
  onde?: 'monstro' | 'heroi' | 'companheiro';
  /** Número sobre monstro ou companheiro: qual (índice na sala, ou na equipe). */
  indice?: number;
  tom?: 'dano' | 'critico' | 'cura' | 'erro' | 'escudo';
  som?: Efeito;
}

export interface QuadroDaLuta {
  luta: LutaEmTempoReal;
  acontecimentos: Acontecimento[];
}

// ---------- abrir ----------

/**
 * Abre a luta na sala atual: prepara os monstros e o herói (`prepararLuta`),
 * põe os monstros no palco (os caídos ficam no lugar, apagados), o coração
 * no meio da caixa e os companheiros vivos ao lado. O alvo começa no
 * primeiro de pé, como no site. `chegada` é por onde o herói entrou: a luta
 * guarda pra ele voltar ali quando acabar. `teclado`: jogada no PC, onde o
 * cajado pede letras em vez do desenho.
 */
export function abrirLuta(estado: EstadoNaMasmorra, chegada: Walker, pet: PetId | null = null, teclado = false): QuadroDaLuta {
  const preparada = prepararLuta(estado);
  const sala = celulaAtual(preparada.estado) as DungeonCell;
  const dePe = indicesDePe(sala);

  const monstros: MonstroNaArena[] = (sala.monsters ?? []).map((_, indice) => ({
    indice,
    fase: dePe.includes(indice) ? 'esperando' : 'caido',
    tempo: 0,
    forca: 1,
    alvo: -1,
    x: 0,
    y: 0,
    rumoX: 0,
    rumoY: 0,
  }));

  const companheiros: CompanheiroNaArena[] = [];
  preparada.estado.party.forEach((membro, indice) => {
    if (membro.hp > 0) companheiros.push({ indice, tempo: CADENCIA_DO_COMPANHEIRO / 2 + indice * 10 });
  });

  const arena: Arena = {
    passo: 0,
    lento: 0,
    chegada: { ...chegada },
    coracao: { x: LARGURA_DA_CAIXA / 2, y: ALTURA_DA_CAIXA / 2 },
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
  return { luta: { estado: preparada.estado, arena, pet, teclado, fim: null, loot: null }, acontecimentos };
}

// ---------- o passo ----------

/**
 * Um passo da luta. O evento da arma corre em tempo de verdade; o mundo
 * (coração, monstros, companheiros, tiros, rodada) anda um passo — ou, em
 * câmera lenta, um a cada `LENTIDAO`.
 *
 * `now` é o relógio do `uid` do item que cai ao vencer (e do andar novo, se
 * foi chefe); sem ele, `Date.now`.
 */
export function passoDaLuta(luta: LutaEmTempoReal, entrada: EntradaDaLuta, rng: Rng, now?: () => number): QuadroDaLuta {
  if (luta.fim) return { luta, acontecimentos: [] };
  const l: Luta = { ...luta, arena: copiarArena(luta.arena), rng, now, acontecimentos: [] };

  if (entrada.mirar !== undefined) mirar(l, entrada.mirar);
  if (l.arena.evento) seguirEvento(l, entrada);
  else if (entrada.atacar && l.arena.recarga <= 0) abrirEvento(l);
  else if (entrada.poder) usarPoder(l, entrada.poder);
  else if (entrada.item) usarItem(l, entrada.item);

  if (!l.fim) {
    const lento = !!l.arena.evento || !!entrada.menu;
    if (lento) l.arena.lento += 1;
    if (!lento || l.arena.lento % LENTIDAO === 0) passoDoMundo(l, entrada);
  }

  return { luta: { estado: l.estado, arena: l.arena, pet: l.pet, teclado: l.teclado, fim: l.fim, loot: l.loot }, acontecimentos: l.acontecimentos };
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
  for (const entrada of entradas) {
    if (atual.fim) break;
    const quadro = passoDaLuta(atual, entrada, rng, now);
    atual = quadro.luta;
    acontecimentos.push(...quadro.acontecimentos);
  }
  return { luta: atual, acontecimentos };
}

/** A luta enquanto o passo corre: a mesma, mais o sorteio, o relógio e o que vai pra tela. */
interface Luta extends LutaEmTempoReal {
  rng: Rng;
  now: (() => number) | undefined;
  acontecimentos: Acontecimento[];
}

function copiarArena(arena: Arena): Arena {
  return {
    ...arena,
    chegada: { ...arena.chegada },
    coracao: { ...arena.coracao },
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

/** O alvo do jogador, se ainda está de pé; senão o primeiro de pé. `null`, ninguém de pé. */
function alvoAtual(l: Luta): number | null {
  const escolhido = l.arena.monstros[l.arena.alvo];
  if (escolhido && escolhido.fase !== 'caido') return escolhido.indice;
  return l.arena.monstros.find((m) => m.fase !== 'caido')?.indice ?? null;
}

/** De onde, na largura da caixa, sai o golpe do monstro: embaixo do lugar dele no palco. */
function colunaDe(l: Luta, indice: number): number {
  const total = Math.max(1, l.arena.monstros.length);
  return Math.trunc((LARGURA_DA_CAIXA * (2 * indice + 1)) / (2 * total));
}

/** Um rumo de comprimento `velocidade` de (0,0) até (dx, dy), em inteiros. */
function rumo(dx: number, dy: number, velocidade: number): { x: number; y: number } {
  const comprimento = Math.sqrt(dx * dx + dy * dy);
  if (comprimento === 0) return { x: 0, y: velocidade };
  return { x: Math.trunc((dx * velocidade) / comprimento), y: Math.trunc((dy * velocidade) / comprimento) };
}

/** O círculo de raio `raio` em (x, y) encosta no coração? */
function encosta(coracao: Coracao, x: number, y: number, raio: number): boolean {
  const dx = coracao.x - x;
  const dy = coracao.y - y;
  const limite = raio + RAIO_DO_CORACAO;
  return dx * dx + dy * dy <= limite * limite;
}

/** O círculo de raio `raio` em (x, y) já saiu inteiro da caixa? */
function foraDaCaixa(x: number, y: number, raio: number): boolean {
  return x < -raio || x > LARGURA_DA_CAIXA + raio || y < -raio || y > ALTURA_DA_CAIXA + raio;
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
  if (m && m.fase !== 'caido') l.arena.alvo = m.indice;
}

/** O ataque do botão: o da classe primeiro; o mágico sem mana pro golpe de magia cai pro físico. */
function estiloDoBotao(hero: Hero): AttackStyle {
  const ataques = ataquesDisponiveis(hero);
  const primeiro = ataques.find((a) => hero.mp >= a.custo) ?? ataques[ataques.length - 1];
  return (primeiro as (typeof ataques)[number]).estilo;
}

function abrirEvento(l: Luta): void {
  const alvo = alvoAtual(l);
  if (alvo === null) return;
  const hero = masmorra(l).hero;
  const estilo = estiloDoBotao(hero);
  const evento = eventoDoAtaque(hero, estilo, l.rng, l.teclado);
  l.arena.evento = { evento, passo: 0, jogada: {}, alvo, estilo };
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
 */
function golpear(l: Luta): void {
  const aberto = l.arena.evento as EventoAberto;
  l.arena.evento = null;
  l.arena.recarga = RECARGA_DO_ATAQUE;
  const leitura = lerEvento(aberto.evento, aberto.jogada);
  const dado = 1 + randomInt(LADOS_DO_DANO, l.rng);
  const doEvento = l.arena.monstros[aberto.alvo] as MonstroNaArena;
  const indice = doEvento.fase !== 'caido' ? doEvento.indice : alvoAtual(l);
  if (indice === null) return;
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
  const golpe = resolverGolpe(estado.hero, monstro, dado, lida, estilo, { rng: l.rng, petCriticoBonus: petBonus(l.pet).critico ?? 0 });
  l.estado = gravarMonstro({ ...estado, hero: golpe.hero }, alvo.indice, golpe.monster);

  if (golpe.outcome === 'no_mana') {
    contar(l, { tipo: 'aviso', texto: 'Mana insuficiente' });
    return;
  }
  if (golpe.outcome !== 'hit') {
    contar(l, { tipo: 'numero', onde: 'monstro', indice: alvo.indice, texto: golpe.outcome === 'dodged' ? 'Desviou' : 'Errou', tom: 'erro' });
    contar(l, { tipo: 'som', som: 'miss' });
    return;
  }
  contar(l, { tipo: 'numero', onde: 'monstro', indice: alvo.indice, texto: `-${golpe.damage}`, tom: golpe.isCrit ? 'critico' : 'dano' });
  contar(l, { tipo: 'som', som: golpe.isCrit ? 'crit' : 'hit' });
  if (golpe.monsterDefeated) {
    abater(l, alvo.indice, golpe.monster);
    return;
  }
  aplicarRunasDoGolpe(l, alvo.indice, golpe.monster, golpe.damage ?? 0);
}

/**
 * As runas da arma no golpe que acertou (`items/runas.ts`). Só a arena as
 * aplica: no site a arma vale só pelos atributos. O choque pode derrubar.
 */
function aplicarRunasDoGolpe(l: Luta, indice: number, monstro: CombatMonsterView, dano: number): void {
  const estado = masmorra(l);
  const runas = aplicarRunas(estado.hero, monstro, dano, l.rng);
  if (runas.disparos.length === 0) return;
  l.estado = gravarMonstro({ ...estado, hero: runas.hero }, indice, runas.monster);
  for (const disparo of runas.disparos) {
    const icone = RUNAS[disparo.runa].icone;
    if (disparo.runa === 'vampirica') {
      if (disparo.valor > 0) contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `${icone}+${disparo.valor}`, tom: 'cura' });
    } else if (disparo.runa === 'eletrica') {
      contar(l, { tipo: 'numero', onde: 'monstro', indice, texto: `${icone}-${disparo.valor}`, tom: 'dano' });
    } else {
      // Queimar e gelar só marcam o monstro, como o 💫 e o 🐌: sem dano agora, ele não treme.
      contar(l, { tipo: 'numero', onde: 'monstro', indice, texto: icone, tom: 'erro' });
    }
  }
  if (runas.monster.hp <= 0) abater(l, indice, runas.monster);
}

// ---------- poderes e itens ----------

function usarPoder(l: Luta, id: string): void {
  const estado = masmorra(l);
  const poder = heroPowers(estado.hero).find((p) => p.id === id);
  if (!poder || (l.arena.recargaDosPoderes[id] ?? 0) > 0) return;
  const alvo = alvoAtual(l);
  if (alvo === null) return;

  const bonus = petBonus(l.pet);
  const monstro = monstroNo(l, alvo);
  const uso = castPower(estado.hero, estado.party, monstro, poder, { rng: l.rng, petCuraBonus: bonus.healing ?? 0, petManaSaveChance: bonus.manaSave ?? 0 });
  if (uso.outcome === 'no_mana') {
    contar(l, { tipo: 'aviso', texto: `Mana insuficiente para ${poder.name}` });
    return;
  }
  l.arena.recargaDosPoderes[id] = RECARGA_DO_PODER;
  l.estado = gravarMonstro({ ...estado, hero: uso.hero, party: uso.party }, alvo, uso.monster);

  if (uso.outcome === 'damage') {
    contar(l, { tipo: 'numero', onde: 'monstro', indice: alvo, texto: `${poder.icon} -${uso.damage}`, tom: 'critico' });
    contar(l, { tipo: 'som', som: 'crit' });
  } else if (uso.outcome === 'heal') {
    contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `+${uso.healed}`, tom: 'cura' });
    contar(l, { tipo: 'som', som: 'heal' });
  } else {
    contar(l, { tipo: 'aviso', texto: `${poder.icon} ${poder.name}` });
  }
  if (uso.healed && uso.outcome === 'damage') contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `+${uso.healed}`, tom: 'cura' });
  if (uso.monsterDefeated) abater(l, alvo, uso.monster);
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
 * O coração anda como o herói na sala: a diagonal não é mais rápida que o
 * reto. A parede da caixa segura.
 */
function moverCoracao(coracao: Coracao, entrada: EntradaDaLuta): Coracao {
  let ix = Math.trunc(entrada.x);
  let iy = Math.trunc(entrada.y);
  const quadrado = ix * ix + iy * iy;
  if (quadrado > STICK_MAX * STICK_MAX) {
    const comprimento = Math.sqrt(quadrado);
    ix = Math.trunc((ix * STICK_MAX) / comprimento);
    iy = Math.trunc((iy * STICK_MAX) / comprimento);
  }
  const x = coracao.x + Math.trunc((ix * VELOCIDADE_DO_CORACAO) / STICK_MAX);
  const y = coracao.y + Math.trunc((iy * VELOCIDADE_DO_CORACAO) / STICK_MAX);
  return {
    x: Math.max(RAIO_DO_CORACAO, Math.min(LARGURA_DA_CAIXA - RAIO_DO_CORACAO, x)),
    y: Math.max(RAIO_DO_CORACAO, Math.min(ALTURA_DA_CAIXA - RAIO_DO_CORACAO, y)),
  };
}

function passoDoMundo(l: Luta, entrada: EntradaDaLuta): void {
  const arena = l.arena;
  arena.passo += 1;
  arena.coracao = moverCoracao(arena.coracao, entrada);
  if (arena.recarga > 0) arena.recarga -= 1;
  if (arena.recargaDoItem > 0) arena.recargaDoItem -= 1;
  if (arena.intervalo > 0) arena.intervalo -= 1;
  for (const id of Object.keys(arena.recargaDosPoderes)) {
    const falta = (arena.recargaDosPoderes[id] as number) - 1;
    if (falta > 0) arena.recargaDosPoderes[id] = falta;
    else delete arena.recargaDosPoderes[id];
  }

  for (const m of arena.monstros) {
    if (l.fim) return;
    if (m.fase !== 'caido') agirMonstro(l, m);
  }
  if (l.fim) return;
  if (podeGolpear(l)) {
    const proximo = proximoDaVez(l);
    if (proximo) comecarGolpe(l, proximo);
  }
  for (const c of arena.companheiros) {
    if (l.fim) return;
    agirCompanheiro(l, c);
  }
  moverTiros(l);
  if (l.fim) return;

  arena.rodada -= 1;
  if (arena.rodada <= 0) {
    arena.rodada = RODADA;
    rodada(l);
  }
}

function agirMonstro(l: Luta, m: MonstroNaArena): void {
  const jeito = jeitoDe(monstroNo(l, m.indice));
  switch (m.fase) {
    case 'esperando':
      return;
    case 'avisando':
      m.tempo -= 1;
      if (m.tempo <= 0) soltarGolpe(l, m, jeito);
      return;
    case 'investindo':
      investir(l, m, jeito);
      return;
    default:
      // Descansando, atordoado, hesitando: parado até o tempo acabar.
      m.tempo -= 1;
      if (m.tempo <= 0) {
        m.fase = 'esperando';
        m.tempo = 0;
      }
  }
}

/** Há vaga pra mais um golpe começar: menos de `ATACANDO_DE_UMA_VEZ` golpeando e o respiro passado. */
function podeGolpear(l: Luta): boolean {
  if (l.arena.intervalo > 0) return false;
  const golpeando = l.arena.monstros.filter((m) => m.fase === 'avisando' || m.fase === 'investindo').length;
  return golpeando < ATACANDO_DE_UMA_VEZ;
}

/** O próximo da vez: depois de quem golpeou por último, o primeiro esperando, dando a volta. */
function proximoDaVez(l: Luta): MonstroNaArena | null {
  const monstros = l.arena.monstros;
  for (let k = 1; k <= monstros.length; k++) {
    const m = monstros[(l.arena.vez + k + monstros.length) % monstros.length] as MonstroNaArena;
    if (m.fase === 'esperando') return m;
  }
  return null;
}

/**
 * O monstro tenta golpear: atordoado ou lento demais, perde o golpe; senão
 * sorteia em quem cai, como no site, e o aviso começa. Golpe no herói trava
 * o desenho na caixa (o círculo e a investida miram onde o coração está
 * agora). Perder a vez também é a vez: o respiro do próximo começa igual.
 */
function comecarGolpe(l: Luta, m: MonstroNaArena): void {
  const estado = masmorra(l);
  const monstro = monstroNo(l, m.indice);
  const jeito = jeitoDe(monstro);
  const inicio = startMonsterAttack(monstro, estado.hero, l.rng);
  l.estado = gravarMonstro({ ...estado, hero: inicio.hero }, m.indice, inicio.monster);
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
  m.alvo = pickMonsterTarget(masmorra(l).party, l.rng) ?? -1;
  m.rumoX = 0;
  m.rumoY = 0;
  if (m.alvo >= 0) {
    // No companheiro: fora da caixa, cai como no site quando o aviso acaba.
    m.x = 0;
    m.y = 0;
    return;
  }
  const coracao = l.arena.coracao;
  if (jeito.golpe === 'perto') {
    m.x = coracao.x;
    m.y = coracao.y;
    return;
  }
  // A investida e o tiro saem de cima da caixa, embaixo do monstro, inteiros pra fora.
  m.x = colunaDe(l, m.indice);
  m.y = -jeito.tamanho;
  if (jeito.golpe === 'investida') {
    const r = rumo(coracao.x - m.x, coracao.y - m.y, jeito.velocidade);
    m.rumoX = r.x;
    m.rumoY = r.y;
  }
}

/** O aviso acabou: o golpe sai. */
function soltarGolpe(l: Luta, m: MonstroNaArena, jeito: JeitoDeLutar): void {
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
    // A bola mira onde o coração está agora, no fim do aviso.
    const coracao = l.arena.coracao;
    const v = rumo(coracao.x - m.x, coracao.y - m.y, jeito.velocidade);
    l.arena.tiros.push({ x: m.x, y: m.y, vx: v.x, vy: v.y, raio: jeito.tamanho, vida: VIDA_DO_TIRO, indice: m.indice, forca: m.forca });
    descansar(l, m, jeito);
    return;
  }
  if (encosta(l.arena.coracao, m.x, m.y, jeito.tamanho)) golpeNoHeroi(l, m.indice, m.forca);
  else contar(l, { tipo: 'numero', onde: 'monstro', indice: m.indice, texto: 'Errou', tom: 'erro' });
  descansar(l, m, jeito);
}

/** O golpe acabou: o monstro descansa, e o próximo golpe espera o respiro. */
function descansar(l: Luta, m: MonstroNaArena, jeito: JeitoDeLutar): void {
  if (l.fim) return;
  m.fase = 'descansando';
  m.tempo = jeito.descanso;
  l.arena.intervalo = INTERVALO_ENTRE_GOLPES;
}

/** A investida mergulha pelo rumo travado: encostou no coração, pega e para; saiu da caixa, acabou. */
function investir(l: Luta, m: MonstroNaArena, jeito: JeitoDeLutar): void {
  m.x += m.rumoX;
  m.y += m.rumoY;
  if (encosta(l.arena.coracao, m.x, m.y, jeito.tamanho)) {
    golpeNoHeroi(l, m.indice, m.forca);
    descansar(l, m, jeito);
    return;
  }
  if (foraDaCaixa(m.x, m.y, jeito.tamanho)) {
    contar(l, { tipo: 'numero', onde: 'monstro', indice: m.indice, texto: 'Errou', tom: 'erro' });
    descansar(l, m, jeito);
  }
}

/**
 * O golpe do monstro `indice` pegou no coração: a regra do site, com a esquiva de sempre, mais a armadura
 * encantada (que só a arena aplica) e o escudo do vigor, que apanha antes da vida.
 */
function golpeNoHeroi(l: Luta, indice: number, forca: number): void {
  const estado = masmorra(l);
  const monstro = monstroNo(l, indice);
  const golpe = landHitOnHero(estado.hero, monstro, forca, l.rng, petBonus(l.pet).esquiva ?? 0, defesasDoHeroi(estado.hero));
  if (golpe.dodged) {
    l.estado = gravarMonstro({ ...estado, hero: golpe.hero }, indice, golpe.monster);
    contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: 'Desviou', tom: 'erro' });
    contar(l, { tipo: 'som', som: 'miss' });
    return;
  }
  const hero = noEscudo(l, estado.hero.hp, golpe.hero, golpe.damage);
  l.estado = gravarMonstro({ ...estado, hero }, indice, golpe.monster);
  contar(l, { tipo: 'som', som: 'hit' });
  if (golpe.manaDrained > 0) contar(l, { tipo: 'aviso', texto: `${monstro.name} drena ${golpe.manaDrained} de mana` });
  if (golpe.drainResisted) contar(l, { tipo: 'aviso', texto: 'Sua armadura segura o dreno de mana' });
  if (golpe.poisonApplied) contar(l, { tipo: 'aviso', texto: 'Você foi envenenado' });
  if (golpe.poisonResisted) contar(l, { tipo: 'aviso', texto: 'Sua armadura segura o veneno' });
  if (hero.hp <= 0) perder(l);
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
  l.estado = gravarMonstro({ ...estado, hero: acao.hero }, alvo, acao.monster);
  const resultado = acao.outcome;
  if (resultado.kind === 'healed_hero') {
    contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `+${resultado.amount}`, tom: 'cura' });
  } else if (resultado.kind === 'miss') {
    contar(l, { tipo: 'numero', onde: 'monstro', indice: alvo, texto: 'Errou', tom: 'erro' });
  } else {
    contar(l, { tipo: 'numero', onde: 'monstro', indice: alvo, texto: `-${resultado.amount}`, tom: 'dano' });
    if (acao.monster.hp <= 0) abater(l, alvo, monsterView(acao.monster));
  }
}

/** As bolas voam; a que encosta no coração pega, a que sai da caixa (ou acaba) errou. */
function moverTiros(l: Luta): void {
  const ficam: Tiro[] = [];
  for (const t of l.arena.tiros) {
    if (l.fim) break;
    t.x += t.vx;
    t.y += t.vy;
    t.vida -= 1;
    if (t.vida <= 0 || foraDaCaixa(t.x, t.y, t.raio)) {
      contar(l, { tipo: 'numero', onde: 'monstro', indice: t.indice, texto: 'Errou', tom: 'erro' });
      continue;
    }
    if (encosta(l.arena.coracao, t.x, t.y, t.raio)) {
      golpeNoHeroi(l, t.indice, t.forca);
      continue;
    }
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
  if (hero.hp <= 0) {
    diario(l, ['O veneno foi mais forte.']);
    perder(l);
    return;
  }

  for (const indice of indicesDePe(sala(l))) {
    const monstro = monstroNo(l, indice);
    const dot = tickMonsterDot(monstro);
    l.estado = gravarMonstro(masmorra(l), indice, dot.monster);
    if (dot.damage > 0) contar(l, { tipo: 'numero', onde: 'monstro', indice, texto: `-${dot.damage}`, tom: 'dano' });
    if (dot.defeated) abater(l, indice, monsterView(dot.monster as CombatMonster));
    if (l.fim) return;
  }

  l.estado = { ...masmorra(l), hero: passarRodadaDaCancao(masmorra(l).hero) };
}

// ---------- quem cai ----------

/**
 * O monstro `indice` caiu: é pago, e o alvo passa pro primeiro de pé; foi o
 * último, a sala está limpa e a luta acaba em vitória.
 */
function abater(l: Luta, indice: number, abatido: CombatMonsterView): void {
  const m = l.arena.monstros[indice];
  if (m) m.fase = 'caido';
  const pago = pagarAbate(masmorra(l), abatido);
  l.estado = pago.estado;
  diario(l, pago.log);
  const dePe = indicesDePe(sala(l));
  if (dePe.length > 0) {
    if (!dePe.includes(l.arena.alvo)) l.arena.alvo = dePe[0] as number;
    return;
  }

  // A arena só existe no app: o item achado pode vir com material.
  const limpa = limparSala(masmorra(l), abatido, l.rng, l.now, true);
  l.estado = limpa.estado;
  l.loot = limpa.loot;
  l.fim = 'vitoria';
  l.arena.evento = null;
  l.arena.tiros = [];
  diario(l, limpa.log);
  contar(l, { tipo: 'som', som: 'victory' });
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
