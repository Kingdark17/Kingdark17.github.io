/**
 * Onde a sala fica guardada enquanto o processo não está de pé.
 *
 * Sem isto, todo deploy da API apaga as salas: quem estava jogando volta e
 * ouve "Sala não encontrada", porque o `Map` que as guardava morreu com o
 * processo. Com isto, o mundo compartilhado (mapa, andar, posição,
 * missões) espera os dois voltarem.
 *
 * **Só o mundo. Não as pessoas.** O que atravessa é o cenário; perfil,
 * conexão e permissão ficam de fora, e isso é decisão de segurança, não
 * economia de bytes:
 *
 * - **`profiles` não sobrevive.** Código de sala tem seis caracteres e é
 *   o único segredo que existe. Se o perfil ficasse guardado, quem
 *   entrasse numa sala abandonada receberia `profiles[seuPapel]` como se
 *   fosse seu — e `profilesForMember` manda o próprio perfil **inteiro**,
 *   com mochila. Seria entregar o herói de outra pessoa a quem digitou um
 *   código. Hoje isso não acontece porque sala nova nasce sem perfil
 *   nenhum, e é assim que tem que continuar.
 * - **`adminRoles` não sobrevive.** Herdar a marca de ADM de quem estava
 *   ali antes é ganhar modo GOD por reconexão. Ela é recalculada do
 *   cookie a cada `create`/`join`, e só de lá.
 * - **`state.profiles` é raspado junto.** `applyState` embute os perfis
 *   dentro do estado, então guardar o estado inteiro republicaria pela
 *   janela o que a porta acabou de barrar.
 *
 * Nada disso custa: cada cliente reenvia o próprio perfil ao voltar
 * (`mandarPerfil`, no front). O que ele não tem como reenviar é o mapa do
 * parceiro — e é justamente esse que fica.
 *
 * Sem `REDIS_URL` o depósito é o nulo e tudo se comporta como antes. É o
 * mesmo acordo do contador de tentativas e do `DATABASE_URL`.
 */

import type { ClienteRedis } from '../shared-state/cliente-redis';
import type { Room, RoomState } from './room-registry';

/**
 * Quanto tempo uma sala sem ninguém dentro espera no Redis.
 *
 * Sala que esvazia normalmente é apagada na hora (`leave`), então este
 * prazo cobre só queda e redeploy. Meia hora dá folga pro deploy e pra
 * quem demora a voltar, sem deixar sala fantasma acumulando.
 */
export const PRAZO_DA_SALA_MS = 30 * 60 * 1000;

const PREFIXO = 'rpg:sala:';

/** O que atravessa o reinício. Ver o cabeçalho pro que **não** atravessa. */
export interface InstantaneoDeSala {
  code: string;
  isPublic: boolean;
  hostName: string;
  state: RoomState | null;
}

export interface DepositoDeSalas {
  guardar(instantaneo: InstantaneoDeSala): Promise<void>;
  carregar(code: string): Promise<InstantaneoDeSala | null>;
  esquecer(code: string): Promise<void>;
}

/** O estado sem os perfis embutidos — ver a terceira armadilha do cabeçalho. */
function estadoSemPerfis(state: RoomState | null): RoomState | null {
  if (!state) return null;
  const copia = { ...state };
  delete copia.profiles;
  return copia;
}

export function paraInstantaneo(room: Room): InstantaneoDeSala {
  return {
    code: room.code,
    isPublic: room.isPublic,
    hostName: room.hostName,
    state: estadoSemPerfis(room.state),
  };
}

/**
 * A sala como ela renasce: com o mundo de volta e **vazia de gente**.
 *
 * `members`, `profiles`, `adminRoles` e `inventoryVersions` começam do
 * zero de propósito. Quem entrar depois é tratado como quem entra numa
 * sala nova — que é exatamente o que a pessoa é.
 */
export function deInstantaneo(instantaneo: InstantaneoDeSala): Room {
  return {
    code: instantaneo.code,
    members: [],
    profiles: {},
    inventoryVersions: {},
    state: instantaneo.state,
    adminRoles: {},
    isPublic: instantaneo.isPublic,
    hostName: instantaneo.hostName,
  };
}

/** Sem `REDIS_URL`: nada é guardado e nada é achado. O comportamento de sempre. */
export class DepositoNulo implements DepositoDeSalas {
  guardar(): Promise<void> {
    return Promise.resolve();
  }

  carregar(): Promise<InstantaneoDeSala | null> {
    return Promise.resolve(null);
  }

  esquecer(): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * **Redis fora do ar não derruba sala nenhuma.** Falha ao guardar é
 * engolida (a sala continua viva no processo, só não sobreviveria a um
 * reinício) e falha ao carregar vira "não achei" (a sala é criada nova).
 * Perder a retomada é ruim; recusar a partida porque o cache caiu é pior.
 */
export class DepositoNoRedis implements DepositoDeSalas {
  constructor(
    private readonly redis: ClienteRedis,
    private readonly prazoMs = PRAZO_DA_SALA_MS,
  ) {}

  async guardar(instantaneo: InstantaneoDeSala): Promise<void> {
    try {
      await this.redis.set(PREFIXO + instantaneo.code, JSON.stringify(instantaneo), 'PX', this.prazoMs);
    } catch {
      // Ver o comentário da classe.
    }
  }

  async carregar(code: string): Promise<InstantaneoDeSala | null> {
    try {
      const cru = await this.redis.get(PREFIXO + code);
      if (!cru) return null;
      return conferir(JSON.parse(cru) as unknown, code);
    } catch {
      // Inclui JSON corrompido: sala nova é melhor que exceção no `join`.
      return null;
    }
  }

  async esquecer(code: string): Promise<void> {
    try {
      await this.redis.del(PREFIXO + code);
    } catch {
      // Sobra até o prazo. Inofensivo.
    }
  }
}

/**
 * O que volta do Redis é JSON que já esteve fora daqui — outra versão do
 * código pode tê-lo escrito com outro formato. Campo torto vira o padrão
 * em vez de virar `undefined` viajando pra dentro do jogo.
 */
function conferir(cru: unknown, code: string): InstantaneoDeSala | null {
  if (!cru || typeof cru !== 'object') return null;
  const bruto = cru as Partial<InstantaneoDeSala>;

  return {
    code,
    isPublic: bruto.isPublic === true,
    hostName: typeof bruto.hostName === 'string' ? bruto.hostName : 'Aventureiro',
    // Raspa de novo na volta: se uma versão futura guardar perfis por
    // engano, eles morrem aqui em vez de chegarem na tela de alguém.
    state: bruto.state && typeof bruto.state === 'object' ? estadoSemPerfis(bruto.state) : null,
  };
}
