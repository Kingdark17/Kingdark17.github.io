/**
 * O portão da cidade: escolher a masmorra, a dificuldade e o andar de
 * entrada — o andar 1 ou um totem já tocado.
 *
 * As regras moram em `dungeon/dungeons.ts`, na engine (decisões do usuário,
 * 2026-10-09). Aqui fica o que a tela do portão precisa: o que está aberto,
 * por que o resto está fechado, e entrar.
 */

import {
  DIFFICULTIES,
  difficultyById,
  DUNGEONS,
  dungeonById,
  entryFloors,
  lockReason,
  runName,
  type DifficultyId,
  type DungeonId,
  type DungeonRun,
  type LockReason,
} from '../dungeon/dungeons.js';
import { defaultRng, type Rng } from '../rng.js';
import { entrarNaMasmorra, type EstadoNaCidade, type EstadoNaMasmorra } from './estado.js';
import { marcar, type Recado } from './tutorial.js';

export interface Portao {
  estado: EstadoNaCidade;
  escolha: DungeonRun;
  andar: number;
  /** O portão é o do app: o andar de entrada pode ter item com material. */
  app?: true;
  /**
   * Aberto por uma das entradas da cidade desenhada (`jogo/cidade.ts`): a
   * masmorra é a dela, e a tela não oferece as outras.
   */
  fixa?: true;
}

export interface OpcaoDoPortao<Id extends string> {
  id: Id;
  nome: string;
  icone: string;
  /** `null` quando abre; senão, o que falta, pra escrever no botão. */
  falta: string | null;
}

export function motivo(bloqueio: LockReason): string {
  switch (bloqueio.kind) {
    case 'level':
      return `Nível ${bloqueio.minLevel}`;
    case 'previous_dungeon':
      return `Zere a ${dungeonById(bloqueio.dungeon)?.name ?? bloqueio.dungeon} no Normal`;
    case 'previous_difficulty':
      return `Zere o ${difficultyById(bloqueio.difficulty)?.name ?? bloqueio.difficulty}`;
  }
}

function bloqueio(portao: Pick<Portao, 'estado'>, escolha: DungeonRun): LockReason | null {
  return lockReason(portao.estado.progresso, portao.estado.hero.level, escolha);
}

/** O totem mais fundo já tocado, que é por onde quem volta quer entrar. */
function andarMaisFundo(estado: EstadoNaCidade, escolha: DungeonRun): number {
  const andares = entryFloors(estado.progresso, escolha);
  return andares[andares.length - 1] ?? 1;
}

/** A dificuldade mais difícil já aberta nesta masmorra. */
function dificuldadeAberta(estado: EstadoNaCidade, dungeon: DungeonId): DifficultyId {
  const abertas = DIFFICULTIES.filter((d) => !lockReason(estado.progresso, estado.hero.level, { dungeon, difficulty: d.id }));
  return abertas[abertas.length - 1]?.id ?? 'normal';
}

/**
 * Abre na última masmorra e dificuldade em que o jogador desceu, se ainda
 * estiverem abertas; senão, na Floresta Normal.
 *
 * `masmorra`: a entrada da cidade desenhada por onde ele chegou. A masmorra
 * fica fixa (`fixa`), na última dificuldade em que ele desceu nela ou, sem
 * essa, na mais difícil aberta. Quem chama já conferiu que ela abre.
 */
export function abrirPortao(estado: EstadoNaCidade, app = false, masmorra?: DungeonId): Portao {
  const ultima = bloqueio({ estado }, estado.masmorra) ? null : estado.masmorra;
  const comApp = app ? { app: true as const } : {};
  if (masmorra) {
    const escolha: DungeonRun = ultima?.dungeon === masmorra ? ultima : { dungeon: masmorra, difficulty: dificuldadeAberta(estado, masmorra) };
    return { estado, escolha, andar: andarMaisFundo(estado, escolha), ...comApp, fixa: true };
  }
  const escolha: DungeonRun = ultima ?? { dungeon: 'floresta', difficulty: 'normal' };
  return { estado, escolha, andar: andarMaisFundo(estado, escolha), ...comApp };
}

export function masmorras(portao: Portao): OpcaoDoPortao<DungeonId>[] {
  return DUNGEONS.map((masmorra) => {
    const fechada = bloqueio(portao, { dungeon: masmorra.id, difficulty: 'normal' });
    return { id: masmorra.id, nome: masmorra.name, icone: masmorra.icon, falta: fechada ? motivo(fechada) : null };
  });
}

export function dificuldades(portao: Portao): OpcaoDoPortao<DifficultyId>[] {
  return DIFFICULTIES.map((dificuldade) => {
    const fechada = bloqueio(portao, { dungeon: portao.escolha.dungeon, difficulty: dificuldade.id });
    return { id: dificuldade.id, nome: dificuldade.name, icone: '', falta: fechada ? motivo(fechada) : null };
  });
}

export function andares(portao: Portao): number[] {
  return entryFloors(portao.estado.progresso, portao.escolha);
}

/** Trocar de masmorra leva junto a dificuldade mais alta aberta nela e o totem mais fundo. */
export function escolherMasmorra(portao: Portao, dungeon: DungeonId): Portao {
  if (portao.fixa || bloqueio(portao, { dungeon, difficulty: 'normal' })) return portao;
  const escolha: DungeonRun = { dungeon, difficulty: dificuldadeAberta(portao.estado, dungeon) };
  return { ...portao, escolha, andar: andarMaisFundo(portao.estado, escolha) };
}

export function escolherDificuldade(portao: Portao, difficulty: DifficultyId): Portao {
  const escolha: DungeonRun = { dungeon: portao.escolha.dungeon, difficulty };
  if (bloqueio(portao, escolha)) return portao;
  return { ...portao, escolha, andar: andarMaisFundo(portao.estado, escolha) };
}

export function escolherAndar(portao: Portao, andar: number): Portao {
  return andares(portao).includes(andar) ? { ...portao, andar } : portao;
}

export interface Entrada {
  estado: EstadoNaMasmorra;
  /** "Entre na masmorra" do tutorial, quando fecha agora. */
  recado: Recado | null;
  texto: string;
}

/**
 * Atravessa o portão. `null` se a escolha estiver fechada — a tela não
 * oferece, mas um clique atrasado depois de o nível mudar não pode passar.
 *
 * É aqui, e não ao pisar no portão, que fecha "Entre na masmorra": abrir a
 * escolha e desistir não é entrar.
 */
export function entrar(portao: Portao, rng: Rng = defaultRng, now?: () => number): Entrada | null {
  if (bloqueio(portao, portao.escolha) || !andares(portao).includes(portao.andar)) return null;
  const dentro = entrarNaMasmorra(portao.estado, rng, portao.escolha, portao.andar, now, !!portao.app);
  const etapa = marcar(dentro, 'dungeon', rng, now);
  const comEtapa = etapa.estado as EstadoNaMasmorra;
  const pelo = portao.andar === 1 ? 'Andar 1' : `Andar ${portao.andar}, pelo totem`;
  return { estado: comEtapa, recado: etapa.recado, texto: `Você atravessa o portão: ${runName(portao.escolha)}. ${pelo}.` };
}
