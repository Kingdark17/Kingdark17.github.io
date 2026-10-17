/**
 * A luta em tempo real do app, dentro da sala (etapa 5, decisões do usuário
 * de 2026-10-17).
 *
 * - O herói anda como no resto da sala (`walkTick`), com as portas
 *   **trancadas** até a luta acabar, como no Isaac: só se sai vencendo ou
 *   morrendo.
 * - **Um botão de ataque com mira automática**: mira o monstro de pé mais
 *   perto; com arma de perto, só se houver um ao alcance. O aperto abre o
 *   evento da arma (`eventos-de-arma.ts`), e enquanto ele dura o mundo anda
 *   em **câmera lenta**. No fim, o golpe sai: de perto, ainda precisa
 *   alcançar; o tiro (arco, magia) voa e acerta quem encontrar.
 * - **Cada comportamento é um jeito de lutar** (`JEITOS_DE_LUTAR`), e todo
 *   golpe de monstro vem com um **aviso** antes: quem sair do alcance a tempo
 *   não leva.
 * - Poderes e itens são botões, com tempo de espera; o menu de itens aberto
 *   também deixa o mundo lento.
 * - Os companheiros aparecem na sala, seguem pro monstro mais perto e batem
 *   no tempo deles. Os monstros também acertam neles.
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
 * segundo, quadrado de `TILE_UNITS`. A única conta que não é de inteiros é o
 * comprimento de um rumo (uma raiz e uma divisão), igual nos dois lados.
 * O sorteio vem de fora, um `rng` que atravessa a luta inteira: com a mesma
 * entrada, passo a passo, a luta sai igual.
 */

import { landHitOnHero, hitPartyMember, startMonsterAttack } from '../combat/monster-hit.js';
import type { CombatMonster, CombatMonsterView } from '../combat/monster-state.js';
import { partyMemberAct, passarRodadaDaCancao } from '../combat/party.js';
import { ataquesDisponiveis, LADOS_DO_DANO, resolverGolpe, type AttackStyle, type LeituraDaMira } from '../combat/resolve-attack.js';
import { tickHeroStatus } from '../combat/hero-status.js';
import { tickMonsterDot } from '../combat/status-effects.js';
import { castPower } from '../combat/use-power.js';
import type { DungeonCell } from '../dungeon/generate.js';
import { HERO_HALF, HERO_SPEED, roomLayout, ROOM_COLS, ROOM_ROWS, STICK_MAX, TILE_UNITS, walkTick, type RoomLayout, type Walker } from '../dungeon/room-walk.js';
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
import { eventoDaArma, eventoDoAtaque, lerEvento, TAMANHO_DO_DESENHO, type EventoDeArma, type JogadaDoEvento, type TipoDeEvento } from './eventos-de-arma.js';

// ---------- números ----------

/** Na câmera lenta, o mundo anda um passo a cada este tanto. */
export const LENTIDAO = 4;

/** A rodada da luta: veneno do herói, dano contínuo dos monstros e a Canção de Batalha, a cada 1,5 s. */
export const RODADA = 90;

/** Depois de um golpe, quanto até o próximo aperto abrir outro evento. */
export const RECARGA_DO_ATAQUE = 15;

/** Quanto um poder espera depois de usado: 3 s. */
export const RECARGA_DO_PODER = 180;

/** Quanto o botão de item espera depois de usado. */
export const RECARGA_DO_ITEM = 60;

/** Até onde (centro a centro) o botão de ataque mira com arma de perto: um quadrado e meio. */
export const ALCANCE_CORPO_A_CORPO = 1440;

/** No fim do evento, o golpe de perto ainda chega até aqui: o monstro andou um pouco na câmera lenta. */
export const ALCANCE_DO_GOLPE = 1920;

/** O tiro do herói (arco, magia), por passo: 7 quadrados por segundo. */
export const VELOCIDADE_DO_TIRO = 112;

/** O tiro do monstro mágico, por passo: 4 quadrados por segundo, dá pra sair da frente. */
export const VELOCIDADE_DO_TIRO_DO_MONSTRO = 64;

/** O tiro acerta quem estiver a até isto do centro dele. */
export const RAIO_DO_TIRO = 400;

/** Passos até o tiro sumir, se não bater em nada. */
export const VIDA_DO_TIRO = 120;

/** A investida acerta quem estiver a até isto do monstro, no caminho. */
export const CONTATO = 640;

/** A investida anda isto por passo (dois passos de herói). */
export const VELOCIDADE_DA_INVESTIDA = 2 * HERO_SPEED;

/** Atordoado, o monstro fica parado este tanto e perde o golpe. */
export const TEMPO_ATORDOADO = 60;

/** Lento demais, o monstro hesita este tanto e perde o golpe. */
export const TEMPO_HESITANDO = 40;

/** Quanto os monstros esperam antes do primeiro golpe, e quanto cada um a mais espera depois do anterior. */
export const ESPERA_INICIAL = 45;
export const ESPERA_POR_MONSTRO = 20;

/**
 * Quantos monstros podem estar golpeando (no aviso ou na investida) ao mesmo
 * tempo, e quanto tempo depois de um golpe começar o próximo pode começar.
 *
 * Um por vez é a regra do site levada pro tempo real: lá, um monstro do
 * grupo ataca por rodada, revezando (decisão do usuário, 2026-10-16). Sem
 * isso, um grupo de três bateria quase três vezes mais por golpe do herói
 * do que no site — e a recompensa é a mesma.
 */
export const ATACANDO_DE_UMA_VEZ = 1;
export const INTERVALO_ENTRE_GOLPES = 20;

/** Um companheiro golpeia a cada este tanto, se houver monstro ao alcance dele. */
export const CADENCIA_DO_COMPANHEIRO = 100;

/** O companheiro anda isto por passo. */
export const VELOCIDADE_DO_COMPANHEIRO = 48;

/** O jeito de lutar de um comportamento. */
export interface JeitoDeLutar {
  /** Por passo, andando: no máximo a velocidade do herói. */
  velocidade: number;
  /** A distância do herói em que ele para e ataca (o mágico mantém ela). */
  distancia: number;
  /** Quanto dura o aviso antes do golpe. */
  aviso: number;
  /** Perto: o golpe cai em quem estiver ao alcance no fim do aviso. Investida: corre em linha reta. Tiro: atira. */
  golpe: 'perto' | 'investida' | 'tiro';
  /** Perto: até onde o golpe chega. Investida: o quanto ela corre. */
  alcance: number;
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
  agressivo: { velocidade: 40, distancia: 2400, aviso: 30, golpe: 'investida', alcance: 2880, descanso: 50 },
  agil: { velocidade: 56, distancia: 1200, aviso: 18, golpe: 'investida', alcance: 1200, descanso: 30 },
  defensivo: { velocidade: 30, distancia: 1000, aviso: 36, golpe: 'perto', alcance: 1300, descanso: 70, guarda: true },
  venenoso: { velocidade: 36, distancia: 1000, aviso: 30, golpe: 'perto', alcance: 1200, descanso: 45 },
  lento: { velocidade: 22, distancia: 1100, aviso: 54, golpe: 'perto', alcance: 1400, descanso: 60 },
  magico: { velocidade: 30, distancia: 3360, aviso: 36, golpe: 'tiro', alcance: 0, descanso: 75 },
};

/** Onde os companheiros começam, em quadrados a partir do herói. */
export const LUGAR_DO_COMPANHEIRO: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, 1],
];

/** Onde os monstros começam, em quadrados, pelo tamanho do grupo. */
export const POSICOES_INICIAIS: readonly (readonly (readonly [number, number])[])[] = [
  [[4, 3]],
  [
    [3, 3],
    [5, 3],
  ],
  [
    [4, 2],
    [3, 4],
    [5, 4],
  ],
];

// ---------- formas ----------

export type FaseDoMonstro = 'andando' | 'avisando' | 'investindo' | 'descansando' | 'atordoado' | 'hesitando' | 'caido';

export interface MonstroNaArena {
  /** O índice em `cell.monsters`. */
  indice: number;
  x: number;
  y: number;
  fase: FaseDoMonstro;
  /** Passos que faltam na fase. Andando, é a espera até poder golpear de novo. */
  tempo: number;
  /** A força do golpe em curso (`attackMult`). */
  forca: number;
  /** O rumo travado no começo do aviso: da investida, ou do tiro. */
  rumoX: number;
  rumoY: number;
  /** Investindo: quanto falta correr. */
  restante: number;
}

export interface CompanheiroNaArena {
  /** O índice em `estado.party`. */
  indice: number;
  x: number;
  y: number;
  /** Passos até o próximo golpe. */
  tempo: number;
}

export interface Tiro {
  de: 'heroi' | 'monstro';
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  /** Do monstro: quem atirou (o índice na sala) e a força. Do herói: -1. */
  indice: number;
  forca: number;
  /** Do herói: o golpe já lido, que só resolve ao acertar. */
  dado?: number;
  leitura?: LeituraDaMira;
  estilo?: AttackStyle;
}

export interface EventoAberto {
  evento: EventoDeArma;
  /** Passos desde o aperto que abriu. */
  passo: number;
  jogada: JogadaDoEvento;
  /** O monstro mirado (índice na sala). */
  alvo: number;
  estilo: AttackStyle;
  /** O golpe sai em tiro (arco, magia), em vez de golpe de perto. */
  tiro: boolean;
}

export interface Arena {
  /** Passos do mundo desde que a luta abriu. */
  passo: number;
  /** Conta os passos da câmera lenta. */
  lento: number;
  heroi: Walker;
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
  /** Passos até outro monstro poder começar um golpe (`INTERVALO_ENTRE_GOLPES`). */
  intervalo: number;
}

export type FimDaLuta = 'vitoria' | 'derrota';

export interface LutaEmTempoReal {
  /** Na masmorra enquanto dura; no fim, o que `limparSala`/`perderLuta` deixaram (o andar seguinte, a cidade…). */
  estado: EstadoDoJogo;
  arena: Arena;
  pet: PetId | null;
  fim: FimDaLuta | null;
  /** O item achado ao vencer. */
  loot: Item | null;
}

/** O que a pessoa fez neste passo. */
export interface EntradaDaLuta {
  /** O joystick (ou as teclas), inteiros de -STICK_MAX a STICK_MAX. */
  x: number;
  y: number;
  /** Apertou o botão de ataque neste passo. Com evento aberto, conta como toque. */
  atacar?: boolean;
  /** Soltou o botão de ataque neste passo (a carga). */
  soltar?: boolean;
  /** Tocou no evento neste passo (barra, bolinha, ritmo, toque duplo). */
  tocar?: boolean;
  /** Desenho: onde o dedo está, na caixa do desenho. Ausente, o dedo está fora da tela. */
  dedo?: { x: number; y: number };
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
  tom?: 'dano' | 'critico' | 'cura' | 'erro';
  som?: Efeito;
}

export interface QuadroDaLuta {
  luta: LutaEmTempoReal;
  acontecimentos: Acontecimento[];
}

// ---------- abrir ----------

/** A sala trancada: parede em volta, sem porta e sem objeto. */
function plantaFechada(): RoomLayout {
  return roomLayout({}, []);
}

function centro(quadrado: number): number {
  return quadrado * TILE_UNITS + TILE_UNITS / 2;
}

/**
 * Abre a luta na sala atual: prepara os monstros e o herói (`prepararLuta`),
 * põe os monstros de pé nos lugares do grupo e os companheiros vivos em
 * volta do herói, que chega em `chegada`. Os monstros esperam um pouco
 * antes do primeiro golpe, um depois do outro.
 */
export function abrirLuta(estado: EstadoNaMasmorra, chegada: Walker, pet: PetId | null = null): QuadroDaLuta {
  const preparada = prepararLuta(estado);
  const sala = celulaAtual(preparada.estado) as DungeonCell;
  const dePe = indicesDePe(sala);
  const lugares = POSICOES_INICIAIS[Math.min(dePe.length, POSICOES_INICIAIS.length) - 1] ?? [];

  const monstros: MonstroNaArena[] = (sala.monsters ?? []).map((_, indice) => {
    const ordem = dePe.indexOf(indice);
    const [col, row] = lugares[ordem] ?? [2 + (ordem % 5), 2 + Math.floor(ordem / 5)];
    return {
      indice,
      x: centro(col),
      y: centro(row),
      fase: ordem < 0 ? 'caido' : 'andando',
      tempo: ordem < 0 ? 0 : ESPERA_INICIAL + ordem * ESPERA_POR_MONSTRO,
      forca: 1,
      rumoX: 0,
      rumoY: 0,
      restante: 0,
    };
  });

  const companheiros: CompanheiroNaArena[] = [];
  preparada.estado.party.forEach((membro, indice) => {
    if (membro.hp <= 0) return;
    // Em volta do herói, um quadrado ao lado; dentro do chão.
    const [lx, ly] = LUGAR_DO_COMPANHEIRO[companheiros.length % LUGAR_DO_COMPANHEIRO.length] as readonly [number, number];
    companheiros.push({
      indice,
      x: dentroDoChao(chegada.x + lx * TILE_UNITS, ROOM_COLS),
      y: dentroDoChao(chegada.y + ly * TILE_UNITS, ROOM_ROWS),
      tempo: CADENCIA_DO_COMPANHEIRO / 2 + indice * 10,
    });
  });

  const arena: Arena = {
    passo: 0,
    lento: 0,
    heroi: { ...chegada },
    monstros,
    companheiros,
    tiros: [],
    evento: null,
    recarga: 0,
    recargaDosPoderes: {},
    recargaDoItem: 0,
    rodada: RODADA,
    intervalo: 0,
  };
  const acontecimentos: Acontecimento[] = preparada.log.map((texto) => ({ tipo: 'diario', texto }));
  return { luta: { estado: preparada.estado, arena, pet, fim: null, loot: null }, acontecimentos };
}

/** Uma coordenada dentro do chão da sala, com a base inteira longe da parede. */
function dentroDoChao(valor: number, quadrados: number): number {
  return Math.max(TILE_UNITS + HERO_HALF, Math.min((quadrados - 1) * TILE_UNITS - HERO_HALF, valor));
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
  const l: Luta = { ...luta, arena: copiarArena(luta.arena), rng, now, acontecimentos: [] };

  if (l.arena.evento) seguirEvento(l, entrada);
  else if (entrada.atacar && l.arena.recarga <= 0) abrirEvento(l);
  else if (entrada.poder) usarPoder(l, entrada.poder);
  else if (entrada.item) usarItem(l, entrada.item);

  if (!l.fim) {
    const lento = !!l.arena.evento || !!entrada.menu;
    if (lento) l.arena.lento += 1;
    if (!lento || l.arena.lento % LENTIDAO === 0) passoDoMundo(l, entrada);
  }

  return { luta: { estado: l.estado, arena: l.arena, pet: l.pet, fim: l.fim, loot: l.loot }, acontecimentos: l.acontecimentos };
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

function distancia2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** O monstro de pé mais perto do ponto; empate fica com o de índice menor. */
function maisPerto(l: Luta, x: number, y: number): MonstroNaArena | null {
  let melhor: MonstroNaArena | null = null;
  let menor = Infinity;
  for (const m of l.arena.monstros) {
    if (m.fase === 'caido') continue;
    const d = distancia2(m.x, m.y, x, y);
    if (d < menor) {
      menor = d;
      melhor = m;
    }
  }
  return melhor;
}

/** Um rumo de comprimento `velocidade` de (0,0) até (dx, dy), em inteiros. */
function rumo(dx: number, dy: number, velocidade: number): { x: number; y: number } {
  const comprimento = Math.sqrt(dx * dx + dy * dy);
  if (comprimento === 0) return { x: 0, y: 0 };
  return { x: Math.trunc((dx * velocidade) / comprimento), y: Math.trunc((dy * velocidade) / comprimento) };
}

/**
 * Anda na direção (dx, dy) a `velocidade` por passo (no máximo a do herói),
 * com a parede segurando como segura o herói.
 */
function andarRumo(planta: RoomLayout, x: number, y: number, dx: number, dy: number, velocidade: number): { x: number; y: number } {
  const forca = Math.trunc((Math.min(velocidade, HERO_SPEED) * STICK_MAX) / HERO_SPEED);
  const r = rumo(dx, dy, forca);
  const passo = walkTick(planta, { x, y, facing: 'S' }, { x: r.x, y: r.y }).walker;
  return { x: passo.x, y: passo.y };
}

function contar(l: Luta, acontecimento: Acontecimento): void {
  l.acontecimentos.push(acontecimento);
}

function diario(l: Luta, linhas: readonly string[]): void {
  for (const texto of linhas) contar(l, { tipo: 'diario', texto });
}

// ---------- o ataque do herói ----------

/** O ataque do botão: o da classe primeiro; o mágico sem mana pro golpe de magia cai pro físico. */
function estiloDoBotao(hero: Hero): AttackStyle {
  const ataques = ataquesDisponiveis(hero);
  const primeiro = ataques.find((a) => hero.mp >= a.custo) ?? ataques[ataques.length - 1];
  return (primeiro as (typeof ataques)[number]).estilo;
}

function abrirEvento(l: Luta): void {
  const hero = masmorra(l).hero;
  const estilo = estiloDoBotao(hero);
  const tiro = estilo === 'magic' || estilo === 'ranged';
  const alvo = maisPerto(l, l.arena.heroi.x, l.arena.heroi.y);
  if (!alvo) return;
  if (!tiro && distancia2(alvo.x, alvo.y, l.arena.heroi.x, l.arena.heroi.y) > ALCANCE_CORPO_A_CORPO * ALCANCE_CORPO_A_CORPO) {
    contar(l, { tipo: 'aviso', texto: 'Longe demais' });
    return;
  }
  const evento = eventoDoAtaque(hero, estilo, l.rng);
  l.arena.evento = { evento, passo: 0, jogada: {}, alvo: alvo.indice, estilo, tiro };
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
  }

  if (pronto) golpear(l);
}

/** O evento terminou: lê, rola o d20 e o golpe sai — de perto agora, ou num tiro. */
function golpear(l: Luta): void {
  const aberto = l.arena.evento as EventoAberto;
  l.arena.evento = null;
  l.arena.recarga = RECARGA_DO_ATAQUE;
  const leitura = lerEvento(aberto.evento, aberto.jogada);
  const dado = 1 + randomInt(LADOS_DO_DANO, l.rng);
  const alvo = l.arena.monstros[aberto.alvo] as MonstroNaArena;
  const heroi = l.arena.heroi;

  if (aberto.tiro) {
    // O tiro sai na direção de onde o alvo está agora; se ele já caiu, na do mais perto.
    const mira = alvo.fase !== 'caido' ? alvo : (maisPerto(l, heroi.x, heroi.y) ?? alvo);
    const v = rumo(mira.x - heroi.x, mira.y - heroi.y, VELOCIDADE_DO_TIRO);
    l.arena.tiros.push({ de: 'heroi', x: heroi.x, y: heroi.y, vx: v.x, vy: v.y, vida: VIDA_DO_TIRO, indice: -1, forca: 1, dado, leitura, estilo: aberto.estilo });
    return;
  }

  if (alvo.fase === 'caido' || distancia2(alvo.x, alvo.y, heroi.x, heroi.y) > ALCANCE_DO_GOLPE * ALCANCE_DO_GOLPE) {
    contar(l, { tipo: 'numero', onde: 'monstro', indice: alvo.indice, texto: 'Longe', tom: 'erro' });
    contar(l, { tipo: 'som', som: 'miss' });
    return;
  }
  acertarMonstro(l, alvo, dado, leitura, aberto.estilo);
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
  if (golpe.monsterDefeated) abater(l, alvo.indice, golpe.monster);
}

// ---------- poderes e itens ----------

function usarPoder(l: Luta, id: string): void {
  const estado = masmorra(l);
  const poder = heroPowers(estado.hero).find((p) => p.id === id);
  if (!poder || (l.arena.recargaDosPoderes[id] ?? 0) > 0) return;
  const alvo = maisPerto(l, l.arena.heroi.x, l.arena.heroi.y);
  if (!alvo) return;

  const bonus = petBonus(l.pet);
  const monstro = monstroNo(l, alvo.indice);
  const uso = castPower(estado.hero, estado.party, monstro, poder, { rng: l.rng, petCuraBonus: bonus.healing ?? 0, petManaSaveChance: bonus.manaSave ?? 0 });
  if (uso.outcome === 'no_mana') {
    contar(l, { tipo: 'aviso', texto: `Mana insuficiente para ${poder.name}` });
    return;
  }
  l.arena.recargaDosPoderes[id] = RECARGA_DO_PODER;
  l.estado = gravarMonstro({ ...estado, hero: uso.hero, party: uso.party }, alvo.indice, uso.monster);

  if (uso.outcome === 'damage') {
    contar(l, { tipo: 'numero', onde: 'monstro', indice: alvo.indice, texto: `${poder.icon} -${uso.damage}`, tom: 'critico' });
    contar(l, { tipo: 'som', som: 'crit' });
  } else if (uso.outcome === 'heal') {
    contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `+${uso.healed}`, tom: 'cura' });
    contar(l, { tipo: 'som', som: 'heal' });
  } else {
    contar(l, { tipo: 'aviso', texto: `${poder.icon} ${poder.name}` });
  }
  if (uso.healed && uso.outcome === 'damage') contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `+${uso.healed}`, tom: 'cura' });
  if (uso.monsterDefeated) abater(l, alvo.indice, uso.monster);
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

function passoDoMundo(l: Luta, entrada: EntradaDaLuta): void {
  const planta = plantaFechada();
  const arena = l.arena;
  arena.passo += 1;
  arena.heroi = walkTick(planta, arena.heroi, { x: entrada.x, y: entrada.y }).walker;
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
    if (m.fase !== 'caido') moverMonstro(l, planta, m);
  }
  for (const c of arena.companheiros) {
    if (l.fim) return;
    moverCompanheiro(l, planta, c);
  }
  moverTiros(l);
  if (l.fim) return;

  arena.rodada -= 1;
  if (arena.rodada <= 0) {
    arena.rodada = RODADA;
    rodada(l);
  }
}

function moverMonstro(l: Luta, planta: RoomLayout, m: MonstroNaArena): void {
  const monstro = monstroNo(l, m.indice);
  const jeito = jeitoDe(monstro);
  const heroi = l.arena.heroi;
  const dx = heroi.x - m.x;
  const dy = heroi.y - m.y;
  const d2 = dx * dx + dy * dy;

  switch (m.fase) {
    case 'andando': {
      if (m.tempo > 0) m.tempo -= 1;
      const longe = d2 > jeito.distancia * jeito.distancia;
      // O mágico guarda distância: perto demais, recua.
      const pertoDemais = jeito.golpe === 'tiro' && d2 < (jeito.distancia * jeito.distancia * 36) / 100;
      if (longe || pertoDemais) {
        const sentido = pertoDemais ? -1 : 1;
        const passo = andarRumo(planta, m.x, m.y, sentido * dx, sentido * dy, jeito.velocidade);
        m.x = passo.x;
        m.y = passo.y;
      }
      const alcance = jeito.golpe === 'tiro' ? (jeito.distancia * 6) / 5 : jeito.distancia + TILE_UNITS / 4;
      if (m.tempo <= 0 && d2 <= alcance * alcance && podeGolpear(l)) comecarGolpe(l, m, monstro, jeito);
      return;
    }
    case 'avisando':
      m.tempo -= 1;
      if (m.tempo <= 0) soltarGolpe(l, planta, m, jeito);
      return;
    case 'investindo':
      investir(l, planta, m, jeito);
      return;
    default:
      // Descansando, atordoado, hesitando: parado até o tempo acabar.
      m.tempo -= 1;
      if (m.tempo <= 0) {
        m.fase = 'andando';
        m.tempo = 0;
      }
  }
}

/** Há vaga pra mais um golpe começar: menos de `ATACANDO_DE_UMA_VEZ` golpeando e o intervalo passado. */
function podeGolpear(l: Luta): boolean {
  if (l.arena.intervalo > 0) return false;
  const golpeando = l.arena.monstros.filter((m) => m.fase === 'avisando' || m.fase === 'investindo').length;
  return golpeando < ATACANDO_DE_UMA_VEZ;
}

/**
 * O monstro tenta golpear: atordoado ou lento demais, perde o golpe; senão,
 * o aviso começa com o rumo travado. Nos três casos a vaga do próximo golpe
 * espera o intervalo — perder a vez também é a vez.
 */
function comecarGolpe(l: Luta, m: MonstroNaArena, monstro: CombatMonsterView, jeito: JeitoDeLutar): void {
  const estado = masmorra(l);
  const inicio = startMonsterAttack(monstro, estado.hero, l.rng);
  l.estado = gravarMonstro({ ...estado, hero: inicio.hero }, m.indice, inicio.monster);
  l.arena.intervalo = INTERVALO_ENTRE_GOLPES;
  if (inicio.outcome === 'stunned') {
    m.fase = 'atordoado';
    m.tempo = TEMPO_ATORDOADO;
    contar(l, { tipo: 'numero', onde: 'monstro', indice: m.indice, texto: '💫', tom: 'erro' });
    return;
  }
  if (inicio.outcome === 'lento_skip') {
    m.fase = 'hesitando';
    m.tempo = TEMPO_HESITANDO;
    contar(l, { tipo: 'numero', onde: 'monstro', indice: m.indice, texto: '🐌', tom: 'erro' });
    return;
  }
  if (inicio.rageTriggered) contar(l, { tipo: 'aviso', texto: `${monstro.name} fica furioso!` });
  m.fase = 'avisando';
  m.tempo = jeito.aviso;
  m.forca = inicio.attackMult;
  m.rumoX = l.arena.heroi.x - m.x;
  m.rumoY = l.arena.heroi.y - m.y;
}

function soltarGolpe(l: Luta, planta: RoomLayout, m: MonstroNaArena, jeito: JeitoDeLutar): void {
  if (jeito.golpe === 'investida') {
    m.fase = 'investindo';
    m.restante = jeito.alcance;
    investir(l, planta, m, jeito);
    return;
  }
  m.fase = 'descansando';
  m.tempo = jeito.descanso;
  if (jeito.golpe === 'tiro') {
    const v = rumo(m.rumoX, m.rumoY, VELOCIDADE_DO_TIRO_DO_MONSTRO);
    l.arena.tiros.push({ de: 'monstro', x: m.x, y: m.y, vx: v.x, vy: v.y, vida: VIDA_DO_TIRO, indice: m.indice, forca: m.forca });
    return;
  }
  // De perto: cai em quem estiver mais perto dentro do alcance, o herói primeiro no empate.
  const alvo = quemEstaPerto(l, m.x, m.y, jeito.alcance);
  if (alvo === null) contar(l, { tipo: 'numero', onde: 'monstro', indice: m.indice, texto: 'Errou', tom: 'erro' });
  else golpeDoMonstro(l, m, alvo);
}

/** Quem leva o golpe: -1 é o herói; senão o índice do companheiro na equipe. `null`, ninguém ao alcance. */
function quemEstaPerto(l: Luta, x: number, y: number, alcance: number): number | null {
  const limite = alcance * alcance;
  let quem: number | null = null;
  let menor = distancia2(l.arena.heroi.x, l.arena.heroi.y, x, y);
  if (menor <= limite) quem = -1;
  else menor = Infinity;
  const equipe = masmorra(l).party;
  for (const c of l.arena.companheiros) {
    if ((equipe[c.indice]?.hp ?? 0) <= 0) continue;
    const d = distancia2(c.x, c.y, x, y);
    if (d <= limite && d < menor) {
      menor = d;
      quem = c.indice;
    }
  }
  return quem;
}

/** A investida corre em linha reta pelo rumo travado; quem ela alcançar primeiro leva o golpe, e ela para. */
function investir(l: Luta, planta: RoomLayout, m: MonstroNaArena, jeito: JeitoDeLutar): void {
  let falta = Math.min(VELOCIDADE_DA_INVESTIDA, m.restante);
  while (falta > 0) {
    const pedaco = Math.min(HERO_SPEED, falta);
    const antes = { x: m.x, y: m.y };
    const passo = andarRumo(planta, m.x, m.y, m.rumoX, m.rumoY, pedaco);
    m.x = passo.x;
    m.y = passo.y;
    falta -= pedaco;
    m.restante -= pedaco;
    const alvo = quemEstaPerto(l, m.x, m.y, CONTATO);
    if (alvo !== null) {
      golpeDoMonstro(l, m, alvo);
      m.restante = 0;
      break;
    }
    if (m.x === antes.x && m.y === antes.y) {
      // Bateu na parede.
      m.restante = 0;
      break;
    }
  }
  if (m.restante <= 0 && !l.fim) {
    m.fase = 'descansando';
    m.tempo = jeito.descanso;
  }
}

/** O golpe do monstro `m` cai no herói (-1) ou no companheiro `alvo`. */
function golpeDoMonstro(l: Luta, m: MonstroNaArena, alvo: number): void {
  const estado = masmorra(l);
  const monstro = monstroNo(l, m.indice);
  if (alvo < 0) {
    const golpe = landHitOnHero(estado.hero, monstro, m.forca, l.rng, petBonus(l.pet).esquiva ?? 0);
    l.estado = gravarMonstro({ ...estado, hero: golpe.hero }, m.indice, golpe.monster);
    if (golpe.dodged) {
      contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: 'Desviou', tom: 'erro' });
      contar(l, { tipo: 'som', som: 'miss' });
      return;
    }
    contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `-${golpe.damage}`, tom: 'dano' });
    contar(l, { tipo: 'som', som: 'hit' });
    if (golpe.manaDrained > 0) contar(l, { tipo: 'aviso', texto: `${monstro.name} drena ${golpe.manaDrained} de mana` });
    if (golpe.poisonApplied) contar(l, { tipo: 'aviso', texto: 'Você foi envenenado' });
    if (golpe.hero.hp <= 0) perder(l);
    return;
  }
  const membro = estado.party[alvo];
  if (!membro) return;
  const golpe = hitPartyMember(membro, monstro, m.forca, l.rng);
  l.estado = { ...estado, party: estado.party.map((atual, i) => (i === alvo ? golpe.member : atual)) };
  contar(l, { tipo: 'numero', onde: 'companheiro', indice: alvo, texto: `-${golpe.damage}`, tom: 'dano' });
  if (golpe.defeated) diario(l, [`${membro.name} caiu!`]);
}

function moverCompanheiro(l: Luta, planta: RoomLayout, c: CompanheiroNaArena): void {
  const estado = masmorra(l);
  const membro = estado.party[c.indice];
  if (!membro || membro.hp <= 0) return;
  if (c.tempo > 0) c.tempo -= 1;
  const alvo = maisPerto(l, c.x, c.y);
  if (!alvo) return;
  const d2 = distancia2(alvo.x, alvo.y, c.x, c.y);
  if (d2 > ALCANCE_CORPO_A_CORPO * ALCANCE_CORPO_A_CORPO) {
    const passo = andarRumo(planta, c.x, c.y, alvo.x - c.x, alvo.y - c.y, VELOCIDADE_DO_COMPANHEIRO);
    c.x = passo.x;
    c.y = passo.y;
    return;
  }
  if (c.tempo > 0) return;
  c.tempo = CADENCIA_DO_COMPANHEIRO;
  const monstro = monstroNo(l, alvo.indice);
  const acao = partyMemberAct(estado.hero, membro, monstro, l.rng);
  l.estado = gravarMonstro({ ...estado, hero: acao.hero }, alvo.indice, acao.monster);
  const resultado = acao.outcome;
  if (resultado.kind === 'healed_hero') {
    contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `+${resultado.amount}`, tom: 'cura' });
  } else if (resultado.kind === 'miss') {
    contar(l, { tipo: 'numero', onde: 'monstro', indice: alvo.indice, texto: 'Errou', tom: 'erro' });
  } else {
    contar(l, { tipo: 'numero', onde: 'monstro', indice: alvo.indice, texto: `-${resultado.amount}`, tom: 'dano' });
    if (acao.monster.hp <= 0) abater(l, alvo.indice, monsterView(acao.monster));
  }
}

/** Os tiros andam; o que sai do chão ou acaba some, o que encosta em alguém acerta. */
function moverTiros(l: Luta): void {
  const ficam: Tiro[] = [];
  const minimo = TILE_UNITS;
  const maximoX = (ROOM_COLS - 1) * TILE_UNITS;
  const maximoY = (ROOM_ROWS - 1) * TILE_UNITS;
  const raio2 = RAIO_DO_TIRO * RAIO_DO_TIRO;
  for (const t of l.arena.tiros) {
    if (l.fim) break;
    t.x += t.vx;
    t.y += t.vy;
    t.vida -= 1;
    if (t.vida <= 0 || t.x < minimo || t.x > maximoX || t.y < minimo || t.y > maximoY) continue;

    if (t.de === 'heroi') {
      const alvo = l.arena.monstros.find((m) => m.fase !== 'caido' && distancia2(m.x, m.y, t.x, t.y) <= raio2);
      if (!alvo) {
        ficam.push(t);
        continue;
      }
      acertarMonstro(l, alvo, t.dado as number, t.leitura as LeituraDaMira, t.estilo as AttackStyle);
      continue;
    }

    const quem = quemEstaPerto(l, t.x, t.y, RAIO_DO_TIRO);
    if (quem === null) {
      ficam.push(t);
      continue;
    }
    const atirador = l.arena.monstros[t.indice] as MonstroNaArena;
    golpeDoMonstro(l, { ...atirador, forca: t.forca }, quem);
  }
  l.arena.tiros = ficam;
}

/** A rodada: o veneno do herói, o dano contínuo de cada monstro de pé e a Canção de Batalha. */
function rodada(l: Luta): void {
  const veneno = tickHeroStatus(masmorra(l).hero);
  l.estado = { ...masmorra(l), hero: veneno.hero };
  if (veneno.damage > 0) contar(l, { tipo: 'numero', onde: 'heroi', indice: 0, texto: `-${veneno.damage}`, tom: 'dano' });
  if (veneno.defeated) {
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

/** O monstro `indice` caiu: é pago; foi o último, a sala está limpa e a luta acaba em vitória. */
function abater(l: Luta, indice: number, abatido: CombatMonsterView): void {
  const m = l.arena.monstros[indice];
  if (m) m.fase = 'caido';
  const pago = pagarAbate(masmorra(l), abatido);
  l.estado = pago.estado;
  diario(l, pago.log);
  if (indicesDePe(sala(l)).length > 0) return;

  const limpa = limparSala(masmorra(l), abatido, l.rng, l.now);
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
export function eventoDoBotao(hero: Hero): TipoDeEvento {
  return eventoDaArma(hero.equip.arma?.templateId);
}
