/**
 * Registro em memória das salas de co-op — porta do `rooms = new Map()` e
 * do `sanitizeState()` do `server.js` original.
 *
 * Fica de propósito fora do gateway socket.io: o registro só conhece
 * `RoomConnection` (um id + `emit`), então dá pra testar todo o ciclo de
 * vida da sala sem levantar servidor nenhum. Quem traduz mensagem de
 * socket em chamada daqui é o gateway.
 *
 * Estado da sala mora no processo, igual ao original. Quando o Redis
 * entrar (fase 6 do plano) é essa classe que vira a fronteira a
 * substituir — nada mais do relay guarda estado de sala.
 */

import { clampInt, cloneJson } from './numeric';
import { sanitizeProfile, toPeerProfile, toPublicProfile, type PeerProfile, type PublicProfile, type SanitizedProfile } from './sanitize';
import { comoTexto } from '../common/texto';

export type RoomRole = 1 | 2;

/** Papel de quem criou a sala: só ele conduz posição/andar/mapa. */
export const HOST_ROLE: RoomRole = 1;
export const GUEST_ROLE: RoomRole = 2;

const MAX_ROOM_SIZE = 2;
const MAX_CODE_LENGTH = 6;
const MAX_NAME_LENGTH = 20;
const MAX_MAP_SIZE = 12;
const MAX_FLOOR = 10000;

/** O mínimo que o registro precisa de uma conexão — o gateway passa o socket. */
export interface RoomConnection {
  readonly id: string;
  emit(event: string, payload: unknown): void;
}

/** Estado de jogo cru: JSON arbitrário do cliente, saneado em `applyState`. */
export type RoomState = Record<string, unknown>;

export interface RoomMember {
  connection: RoomConnection;
  role: RoomRole;
}

export interface Room {
  code: string;
  members: RoomMember[];
  profiles: Partial<Record<RoomRole, SanitizedProfile>>;
  state: RoomState | null;
  adminRoles: Partial<Record<RoomRole, boolean>>;
  isPublic: boolean;
  hostName: string;
}

export interface RoomMembership {
  code: string;
  role: RoomRole;
}

export interface PublicRoomSummary {
  code: string;
  hostName: string;
}

export type CreateRoomResult = { kind: 'created'; room: Room } | { kind: 'already-exists' };

export type JoinRoomResult = { kind: 'joined'; room: Room; role: RoomRole; peers: RoomConnection[] } | { kind: 'not-found' } | { kind: 'full' };

export interface LeaveRoomResult {
  code: string;
  role: RoomRole;
  /** Quem sobrou na sala; vazio quando a sala foi descartada. */
  remaining: RoomConnection[];
  /** Preenchido quando o anfitrião saiu e quem ficou assumiu o papel 1. */
  promoted?: { connection: RoomConnection; from: RoomRole; to: RoomRole };
}

export function normalizeRoomCode(value: unknown): string {
  return comoTexto(value).toUpperCase().slice(0, MAX_CODE_LENGTH);
}

export function normalizePlayerName(value: unknown): string {
  return (comoTexto(value) || 'Aventureiro').slice(0, MAX_NAME_LENGTH);
}

export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();

  /** conexão -> sala/papel, no lugar do `ws.room`/`ws.role` do original. */
  private readonly membership = new Map<string, RoomMembership>();

  get size(): number {
    return this.rooms.size;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  membershipOf(connectionId: string): RoomMembership | undefined {
    return this.membership.get(connectionId);
  }

  /** Salas públicas ainda esperando o segundo jogador. */
  listPublic(): PublicRoomSummary[] {
    const list: PublicRoomSummary[] = [];
    for (const room of this.rooms.values()) {
      if (room.isPublic && room.members.length === 1) {
        list.push({ code: room.code, hostName: room.hostName });
      }
    }
    return list;
  }

  create(code: string, connection: RoomConnection, options: { admin: boolean; isPublic: boolean; hostName: string }): CreateRoomResult {
    const existing = this.rooms.get(code);
    if (existing && existing.members.length) return { kind: 'already-exists' };

    this.forget(connection.id);
    const room: Room = {
      code,
      members: [{ connection, role: HOST_ROLE }],
      profiles: {},
      state: null,
      adminRoles: { [HOST_ROLE]: options.admin },
      isPublic: options.isPublic,
      hostName: options.hostName,
    };
    this.rooms.set(code, room);
    this.membership.set(connection.id, { code, role: HOST_ROLE });
    return { kind: 'created', room };
  }

  join(code: string, connection: RoomConnection, options: { admin: boolean }): JoinRoomResult {
    const room = this.rooms.get(code);
    if (!room || !room.members.length) return { kind: 'not-found' };
    if (room.members.length >= MAX_ROOM_SIZE) return { kind: 'full' };

    this.forget(connection.id);
    // Quem entra é sempre papel 2. Sala sem anfitrião não existe mais: se
    // o papel 1 cai, `leave()` promove quem ficou (ver ali).
    room.adminRoles[GUEST_ROLE] = options.admin;
    room.members.push({ connection, role: GUEST_ROLE });
    this.membership.set(connection.id, { code, role: GUEST_ROLE });
    return { kind: 'joined', room, role: GUEST_ROLE, peers: this.peersOf(room, connection.id) };
  }

  /** Todo mundo na sala menos quem mandou a mensagem — o `relay()` do original. */
  peersOf(room: Room, senderConnectionId: string): RoomConnection[] {
    return room.members.filter((member) => member.connection.id !== senderConnectionId).map((member) => member.connection);
  }

  /**
   * Como `peersOf`, mas com o papel de cada um. Quem monta um pacote
   * diferente por destinatário precisa saber pra quem está mandando — e
   * desde que o perfil passou a ser recortado por papel, é o caso do
   * `state` e do `welcome`.
   */
  peerMembersOf(room: Room, senderConnectionId: string): RoomMember[] {
    return room.members.filter((member) => member.connection.id !== senderConnectionId);
  }

  leave(connectionId: string): LeaveRoomResult | null {
    const membership = this.membership.get(connectionId);
    this.membership.delete(connectionId);
    if (!membership) return null;

    const room = this.rooms.get(membership.code);
    if (!room) return null;

    room.members = room.members.filter((member) => member.connection.id !== connectionId);
    if (!room.members.length) {
      this.rooms.delete(membership.code);
      return { code: membership.code, role: membership.role, remaining: [] };
    }

    return {
      code: membership.code,
      role: membership.role,
      remaining: room.members.map((member) => member.connection),
      ...(membership.role === HOST_ROLE ? { promoted: this.promoverSobrevivente(room) } : {}),
    };
  }

  /**
   * O anfitrião caiu e alguém ficou: quem ficou vira papel 1.
   *
   * **Divergência do original**, decidida com o dono do projeto: no
   * `server.js` quem entra é sempre papel 2 e ninguém é promovido, então
   * uma sala que perde o papel 1 fica travada — só o papel 1 manda
   * `welcome`/`move-lock` e conduz posição/andar, e só o papel 2 pode
   * pedir `boss-advance`. Sem promoção o jogador que ficou não consegue
   * nem andar nem avançar; a sala só morre quando ele desiste.
   *
   * Promover carrega junto perfil e flag de admin: `applyState` compara o
   * perfil novo com o anterior *do mesmo papel*, e deixar o perfil no
   * papel 2 abriria a porta pra ele voltar com atributos inflados.
   */
  private promoverSobrevivente(room: Room): LeaveRoomResult['promoted'] {
    const sucessor = room.members[0];
    if (!sucessor || sucessor.role === HOST_ROLE) return undefined;

    const anterior = sucessor.role;
    sucessor.role = HOST_ROLE;
    this.membership.set(sucessor.connection.id, { code: room.code, role: HOST_ROLE });

    room.profiles[HOST_ROLE] = room.profiles[anterior];
    delete room.profiles[anterior];
    room.adminRoles[HOST_ROLE] = room.adminRoles[anterior];
    delete room.adminRoles[anterior];

    return { connection: sucessor.connection, from: anterior, to: HOST_ROLE };
  }

  isAdmin(room: Room, role: RoomRole): boolean {
    return !!room.adminRoles[role];
  }

  /** Perfis como os outros jogadores podem vê-los (sem `baseAttrs`). */
  publicProfiles(room: Room): Record<string, PublicProfile> {
    const result: Record<string, PublicProfile> = {};
    for (const role of Object.keys(room.profiles)) {
      const profile = room.profiles[Number(role) as RoomRole];
      if (profile) result[role] = toPublicProfile(profile);
    }
    return result;
  }

  /**
   * Os perfis como **quem tem o papel `role`** deve recebê-los: o dele
   * inteiro, o do parceiro sem mochila nem grupo.
   *
   * O recorte é por destinatário porque os dois lados leem coisas
   * diferentes do mesmo pacote. Quem recebe usa `perfis[meuPapel]` pra
   * corrigir o próprio herói e a própria mochila contra a versão
   * autoritativa (`aplicarRemoto`, no front); do parceiro, a tela lê só
   * nome, nível, classe e cosméticos.
   *
   * **Mandar o enxuto pra todo mundo apagaria mochila.** O front faz
   * `meuPerfil.inventory ?? []`, então um perfil próprio sem `inventory`
   * não é "sem novidade", é "esvaziou" — e isso viajaria de volta no
   * próximo `state`, virando perda de verdade.
   */
  profilesForRole(room: Room, role: RoomRole): Record<string, PublicProfile | PeerProfile> {
    const result: Record<string, PublicProfile | PeerProfile> = {};
    for (const chave of Object.keys(room.profiles)) {
      const papel = Number(chave) as RoomRole;
      const profile = room.profiles[papel];
      if (profile) result[chave] = papel === role ? toPublicProfile(profile) : toPeerProfile(profile);
    }
    return result;
  }

  /** O perfil de um papel na forma que o parceiro recebe. */
  peerProfileOf(room: Room, role: RoomRole): PeerProfile | null {
    const profile = room.profiles[role];
    return profile ? toPeerProfile(profile) : null;
  }

  /** `type:'profile'`: aceita o perfil saneado e devolve a versão pública. */
  applyProfile(room: Room, role: RoomRole, candidate: unknown): PublicProfile {
    const accepted = sanitizeProfile(candidate, room.profiles[role] ?? null, this.isAdmin(room, role));
    room.profiles[role] = accepted;
    return toPublicProfile(accepted);
  }

  /**
   * `type:'state'`/`welcome`: porta do `sanitizeState()`. Sanea o perfil
   * embutido, recorta o mapa e — para o convidado — devolve posição/andar
   * do estado autoritativo em vez do que ele mandou.
   */
  applyState(room: Room, role: RoomRole, candidate: unknown): RoomState {
    const state = cloneJson((candidate ?? {}) as RoomState);

    const incomingProfiles = state.profiles as Record<string, unknown> | undefined;
    const incoming = incomingProfiles ? incomingProfiles[String(role)] : undefined;
    if (incoming) {
      room.profiles[role] = sanitizeProfile(incoming, room.profiles[role] ?? null, this.isAdmin(room, role));
    }
    state.profiles = this.publicProfiles(room);

    state.floor = clampInt(state.floor, 1, MAX_FLOOR);
    state.mapRows = clampInt(state.mapRows, 1, MAX_MAP_SIZE);
    state.mapCols = clampInt(state.mapCols, 1, MAX_MAP_SIZE);

    // Na exploração, somente o criador da sala conduz posição, andar e
    // local. O convidado ainda atualiza combate, perfil e interações
    // compartilhadas.
    const authoritative = room.state;
    if (role !== HOST_ROLE && authoritative) {
      // O original faz `clone(room.state.pos)` direto, que estoura quando a
      // posição ainda não existe; aqui só copia se houver o que copiar.
      state.pos = authoritative.pos === undefined ? undefined : cloneJson(authoritative.pos);
      state.floor = authoritative.floor;
      state.mapMode = authoritative.mapMode;
      state.mapRows = authoritative.mapRows;
      state.mapCols = authoritative.mapCols;
    }

    if (Array.isArray(state.map)) {
      const linhas = state.map as unknown[];
      state.map = linhas.slice(0, MAX_MAP_SIZE).map((row) => (Array.isArray(row) ? (row as unknown[]).slice(0, MAX_MAP_SIZE) : []));
    }

    room.state = state;
    return state;
  }

  private forget(connectionId: string): void {
    const previous = this.membership.get(connectionId);
    if (!previous) return;
    this.membership.delete(connectionId);
    const room = this.rooms.get(previous.code);
    if (!room) return;
    room.members = room.members.filter((member) => member.connection.id !== connectionId);
    if (!room.members.length) this.rooms.delete(previous.code);
  }
}
