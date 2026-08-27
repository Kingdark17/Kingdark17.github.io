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

import { deInstantaneo, DepositoNulo, paraInstantaneo, type DepositoDeSalas } from './deposito-de-salas';
import { clampInt, cloneJson } from './numeric';
import {
  sanitizeProfile,
  toOwnProfile,
  toPeerProfile,
  toPublicProfile,
  type OwnProfile,
  type PeerProfile,
  type PublicProfile,
  type SanitizedProfile,
} from './sanitize';
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
  /**
   * Qual versão da própria mochila esta conexão já recebeu. Ausente = nunca
   * recebeu nenhuma, então a próxima vai inteira — é o que faz uma
   * reconexão se curar sozinha. Ver `profilesForMember`.
   */
  inventorySent?: number;
}

export interface Room {
  code: string;
  members: RoomMember[];
  profiles: Partial<Record<RoomRole, SanitizedProfile>>;
  /**
   * Sobe um a cada mochila **nova** aceita de um papel. Serve só pra
   * comparar com o `inventorySent` de cada conexão; o número em si não
   * significa nada e não vai pro fio.
   */
  inventoryVersions: Partial<Record<RoomRole, number>>;
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

export type CreateRoomResult =
  /** `resumida` quando o mundo veio do depósito — o anfitrião voltando depois de um reinício. */
  { kind: 'created'; room: Room; resumida: boolean } | { kind: 'already-exists' };

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

  /**
   * Onde a sala espera enquanto o processo não está de pé. `DepositoNulo`
   * sem `REDIS_URL`, e aí tudo se comporta como sempre se comportou.
   *
   * O processo continua sendo a verdade **enquanto está vivo**: o depósito
   * é escrita passante, não fonte de leitura no caminho quente. Só o
   * `hidratar` lê, e só quando a sala não está aqui.
   */
  constructor(private readonly deposito: DepositoDeSalas = new DepositoNulo()) {}

  get size(): number {
    return this.rooms.size;
  }

  /**
   * Traz de volta uma sala que o reinício levou, se houver.
   *
   * Chamado antes de `create` e `join`. Não faz nada quando a sala já está
   * no processo — o que está em memória é mais novo que o instantâneo, por
   * construção.
   */
  async hidratar(code: string): Promise<void> {
    if (this.rooms.has(code)) return;
    const instantaneo = await this.deposito.carregar(code);
    if (!instantaneo) return;
    // Outra conexão pode ter criado a sala enquanto o `await` acima
    // corria; quem chegou primeiro fica.
    if (this.rooms.has(code)) return;
    this.rooms.set(code, deInstantaneo(instantaneo));
  }

  /** Escrita passante. Falha do Redis não pode derrubar a jogada em curso. */
  private gravar(room: Room): void {
    void this.deposito.guardar(paraInstantaneo(room));
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

    /**
     * Sala presente e vazia só acontece por retomada (`hidratar`) — quando
     * a última pessoa sai de verdade, `leave` a apaga. Então aqui o mundo
     * dela é preservado: é o anfitrião voltando depois de um deploy, e
     * jogar fora o mapa seria desfazer exatamente o que o depósito salvou.
     *
     * O que **não** é preservado é gente: perfil e marca de ADM saem do
     * instantâneo e continuam vazios aqui. Ver `deposito-de-salas.ts`.
     */
    const room: Room = {
      code,
      members: [{ connection, role: HOST_ROLE }],
      profiles: {},
      inventoryVersions: {},
      state: existing?.state ?? null,
      adminRoles: { [HOST_ROLE]: options.admin },
      // Nome e visibilidade vêm de quem está criando agora, não do
      // instantâneo: quem digita o código é o anfitrião de agora, e pode
      // nem ser a mesma pessoa. Só o mundo atravessa.
      isPublic: options.isPublic,
      hostName: options.hostName,
    };
    this.rooms.set(code, room);
    this.membership.set(connection.id, { code, role: HOST_ROLE });
    this.gravar(room);
    return { kind: 'created', room, resumida: !!existing };
  }

  join(code: string, connection: RoomConnection, options: { admin: boolean }): JoinRoomResult {
    const room = this.rooms.get(code);
    if (!room) return { kind: 'not-found' };
    if (room.members.length >= MAX_ROOM_SIZE) return { kind: 'full' };

    this.forget(connection.id);

    /**
     * **Sala vazia entrega o papel 1 a quem chegar.**
     *
     * Vazia só acontece por retomada (`hidratar`) — quando a última pessoa
     * sai de verdade, `leave` apaga a sala. Depois de um reinício, os dois
     * jogadores voltam ao mesmo tempo e não há como saber quem chega
     * primeiro; se quem chegasse recebesse sempre o papel 2, a sala
     * nasceria sem anfitrião e travaria, que é exatamente o defeito que
     * `promoverSobrevivente` existe pra consertar do outro lado.
     *
     * Antes daqui vinha um `!room.members.length` que devolvia
     * `not-found` — sala retomada era invisível pra quem tentava entrar, e
     * o convidado teria que esperar o anfitrião recriar primeiro, sem
     * ninguém saber que havia uma ordem obrigatória.
     */
    const role: RoomRole = room.members.length === 0 ? HOST_ROLE : GUEST_ROLE;
    room.adminRoles[role] = options.admin;
    room.members.push({ connection, role });
    this.membership.set(connection.id, { code, role });
    // Renova o prazo: sala com gente dentro não pode expirar embaixo deles.
    this.gravar(room);
    return { kind: 'joined', room, role, peers: this.peersOf(room, connection.id) };
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
      // Saída de verdade apaga o instantâneo também. O depósito existe pra
      // cobrir queda e redeploy, não pra ressuscitar sala que a última
      // pessoa fechou de propósito — e sem isto o código ficaria preso
      // por meia hora, recusando quem quisesse reusá-lo.
      void this.deposito.esquecer(membership.code);
      return { code: membership.code, role: membership.role, remaining: [] };
    }

    const resultado = {
      code: membership.code,
      role: membership.role,
      remaining: room.members.map((member) => member.connection),
      ...(membership.role === HOST_ROLE ? { promoted: this.promoverSobrevivente(room) } : {}),
    };
    this.gravar(room);
    return resultado;
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
    room.inventoryVersions[HOST_ROLE] = room.inventoryVersions[anterior];
    delete room.inventoryVersions[anterior];

    // Esquece o que já mandou: a mochila dele mudou de papel, e as versões
    // dos dois papéis não têm relação nenhuma entre si. Sem isto, uma
    // colisão de número faria o próximo pacote omitir a mochila achando que
    // ela já foi — e omitir sem ter mandado é apagar.
    delete sucessor.inventorySent;

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
   * Os perfis como **esta conexão** deve recebê-los: o dela, o do parceiro
   * sem mochila nem grupo.
   *
   * O recorte é por destinatário porque os dois lados leem coisas
   * diferentes do mesmo pacote. Quem recebe usa `perfis[meuPapel]` pra
   * corrigir o próprio herói e a própria mochila contra a versão
   * autoritativa (`aplicarRemoto`, no front); do parceiro, a tela lê só
   * nome, nível, classe e cosméticos.
   *
   * A própria mochila só vai **quando mudou** — mesma regra que a subida já
   * tem (`instantaneoDaSala`, no front) e que `sanitizeProfile` já entende
   * ("ausente = não mudou"). Era 57% do pacote indo e voltando sem
   * novidade nenhuma; ver `toOwnProfile`.
   *
   * É por conexão, e não por papel, porque a resposta depende do que
   * **aquela conexão** já recebeu. Quem reconecta entra como membro novo,
   * sem `inventorySent`, e a primeira mensagem já leva a mochila inteira.
   *
   * `forcarMochila` é pra `welcome`: ele é a sincronização cheia, e quem
   * acabou de entrar não tem o que preservar.
   */
  profilesForMember(room: Room, member: RoomMember, forcarMochila = false): Record<string, OwnProfile | PeerProfile> {
    const versao = room.inventoryVersions[member.role] ?? 0;
    const mandarMochila = forcarMochila || member.inventorySent !== versao;

    const result: Record<string, OwnProfile | PeerProfile> = {};
    for (const chave of Object.keys(room.profiles)) {
      const papel = Number(chave) as RoomRole;
      const profile = room.profiles[papel];
      if (profile) result[chave] = papel === member.role ? toOwnProfile(profile, mandarMochila) : toPeerProfile(profile);
    }

    if (mandarMochila) member.inventorySent = versao;
    return result;
  }

  /** O membro de uma conexão dentro da sala — quem monta pacote precisa dele. */
  memberOf(room: Room, connectionId: string): RoomMember | undefined {
    return room.members.find((member) => member.connection.id === connectionId);
  }

  /** O perfil de um papel na forma que o parceiro recebe. */
  peerProfileOf(room: Room, role: RoomRole): PeerProfile | null {
    const profile = room.profiles[role];
    return profile ? toPeerProfile(profile) : null;
  }

  /**
   * `type:'profile'`: aceita o perfil saneado e devolve a versão pública —
   * **com mochila**, sempre. É a resposta a uma submissão explícita de
   * perfil, e é onde o cliente se corrige contra o saneamento.
   */
  applyProfile(room: Room, role: RoomRole, candidate: unknown): PublicProfile {
    return toPublicProfile(this.aceitarPerfil(room, role, candidate));
  }

  /**
   * Guarda o perfil saneado e marca se a mochila é nova.
   *
   * A comparação é por **identidade de array**, não por conteúdo, e é
   * exata: `sanitizeProfile` devolve o *mesmo* array quando a mochila não
   * veio no pacote, e um clone novo quando veio. Comparar o conteúdo seria
   * varrer 120 itens a cada ação pra descobrir o que a referência já diz.
   */
  private aceitarPerfil(room: Room, role: RoomRole, candidate: unknown): SanitizedProfile {
    const anterior = room.profiles[role] ?? null;
    const aceito = sanitizeProfile(candidate, anterior, this.isAdmin(room, role));
    room.profiles[role] = aceito;
    if (!anterior || aceito.inventory !== anterior.inventory) {
      room.inventoryVersions[role] = (room.inventoryVersions[role] ?? 0) + 1;
    }
    return aceito;
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
    if (incoming) this.aceitarPerfil(room, role, incoming);
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
    // O caminho quente: sai a cada ação. A gravação é passante e sem
    // `await` — o jogo não espera o Redis pra seguir.
    this.gravar(room);
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
