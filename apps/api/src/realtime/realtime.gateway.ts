/**
 * Gateway de tempo real — porta do `wss.on('connection')` inteiro do
 * server.js original, das duas coisas que moravam ali: presença/chat de
 * amigos e o relay de sala co-op.
 *
 * Mudanças conscientes em relação ao original:
 *
 * - socket.io no lugar do `ws` cru (decisão já fechada no CLAUDE.md).
 *   Cada `type` do envelope `{type:...}` virou um evento nomeado com o
 *   mesmo nome, então a tabela de mensagens continua legível lado a lado
 *   com o original — mas o protocolo é outro, o cliente atual em
 *   `rpg-legend/js/multiplayer.js` (WebSocket cru) não fala com isto.
 *   Quem passa a falar é o front da fase 3.
 * - Cada evento devolvido é montado campo a campo, em vez de ecoar o
 *   objeto que o cliente mandou. O original ecoava `data` inteiro, o que
 *   deixava qualquer campo extra do remetente chegar na tela do parceiro.
 * - `error` sempre leva `room` quando existe sala. No original não levava,
 *   e o cliente descarta mensagem sem `room` — ou seja, "Sala já existe."
 *   e "Sala cheia." nunca apareciam pra ninguém.
 * - Anfitrião que cai **promove** quem ficou (evento `role-changed`). No
 *   original a sala travava: só o papel 1 conduz exploração e só o papel 2
 *   pede `boss-advance`, então quem sobrava não conseguia fazer nem um
 *   nem outro.
 *
 * O que continua igual: papéis (1 cria e conduz exploração, 2 acompanha),
 * saneamento autoritativo de perfil/estado, 30 mensagens por segundo por
 * conexão, sala descartada quando esvazia.
 */

import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

import { AuthService } from '../auth/auth.service';
import { lerTokenDoCookie } from '../auth/session-cookie';
import { lerCors } from '../bootstrap';
import { RateLimiter } from '../common/rate-limiter';
import { OnlineUsersRegistry } from '../social/online-users-registry';
import { SocialService } from '../social/social.service';
import { clampInt } from './numeric';
import {
  HOST_ROLE,
  GUEST_ROLE,
  RoomRegistry,
  normalizePlayerName,
  normalizeRoomCode,
  type Room,
  type RoomMember,
  type RoomRole,
  type RoomState,
} from './room-registry';
import { isUiAction, sanitizeUiActionPayload } from './ui-action';
import { comoTexto } from '../common/texto';

const CHAT_ERROR_MESSAGES = {
  'target-not-found': 'Jogador não encontrado.',
  'not-friends': 'Vocês precisam ser amigos para conversar.',
  'empty-message': 'Mensagem vazia.',
} as const;

/** Mesmo teto do `ws.rate` original: 30 mensagens por segundo por conexão. */
const SOCKET_MESSAGE_LIMIT = 30;
const SOCKET_WINDOW_MS = 1000;

const MAX_TURN = 1_000_000;
const MAX_HEAL = 500;
const MAX_BOSS_NAME = 80;
const BOSS_FLOOR_INTERVAL = 5;

interface SocketState {
  userId?: number;
  username?: string;
}

/**
 * Quantas conexões chegaram desde que o processo subiu e quantas
 * negociaram compressão — a única forma de responder, com fato, se o
 * `perMessageDeflate` lá embaixo está valendo em produção.
 *
 * De fora não dá: o handshake volta `101` sem `Sec-WebSocket-Extensions`
 * tanto se o deploy não pegou quanto se um proxy no caminho tirou a
 * extensão, e não há endereço da API que não passe pelo proxy. De dentro
 * dá, porque quem negocia é o `ws` deste processo.
 *
 * Os contadores zeram junto com o processo, e isso é bom: eles falam
 * sempre da build que está rodando agora, nunca da anterior.
 */
export interface DiagnosticoDoSocket {
  conexoes: number;
  comprimidas: number;
}

/**
 * O `ws` guarda o que negociou em `WebSocket#extensions` — string vazia
 * quando não houve acordo. O engine.io guarda esse socket no transporte.
 *
 * Nenhum dos dois tipos declara o caminho, daí o molde estreito e o
 * `try`: isto roda em toda conexão e **nunca** pode ser o motivo de uma
 * conexão falhar. Diagnóstico que derruba o que diagnostica não presta.
 *
 * O front fixa `transports: ['websocket']`, então o transporte já é o
 * definitivo aqui — não há upgrade de polling depois pra perder de vista.
 */
function negociouCompressao(socket: Socket): boolean {
  try {
    const transporte = socket.conn?.transport as { socket?: { extensions?: unknown } } | undefined;
    const extensoes = transporte?.socket?.extensions;
    return typeof extensoes === 'string' && extensoes.includes('permessage-deflate');
  } catch {
    return false;
  }
}

// `lerCors()` em vez de `origin` solto: sem `credentials`, o navegador não
// anexa o cookie de sessão ao handshake, e o `auth` do front novo — que
// manda o corpo vazio de propósito — nunca autenticaria.
@WebSocketGateway({
  cors: lerCors(),
  maxHttpBufferSize: 512 * 1024,
  /**
   * Compressão do WebSocket. **O socket.io não liga isso sozinho** — não
   * está nos padrões do engine.io, só existe se vier daqui.
   *
   * É o que substitui um protocolo de delta escrito à mão. Pacotes de sala
   * seguidos são quase idênticos entre si, e o deflate com contexto
   * compartilhado referencia a mensagem anterior em vez de repeti-la:
   * medido num andar 8 com 76 itens, 9,2 KB crus viram **0,25 KB no fio**.
   * Um patch por célula do mapa daria ~0,5 KB e traria um invariante que
   * pode divergir calado; isto não muda contrato nenhum.
   *
   * Cada número aqui foi medido, não herdado:
   *
   * - `serverMaxWindowBits: 14` (16 KB). **A janela precisa ser maior que o
   *   pacote**, ou não há como alcançar a mensagem anterior — com 8 KB o
   *   regime pula pra 1,10 KB. Com 32 KB cairia pra 0,09 KB, mas custaria
   *   288 KB por conexão em vez de 160 KB, e 140 bytes por ação não pagam
   *   isso. É por essa razão que este ajuste e o recorte da mochila se
   *   somam: foi encolher o pacote pra dentro da janela que fez a
   *   compressão render 10× mais.
   * - `level: 6`. O 3 rende 0,82 KB e o 9 não melhora o 6; a diferença de
   *   CPU entre 3 e 6 é 40 ms por mil mensagens.
   * - `clientMaxWindowBits` fica **de fora de propósito**: como número, o
   *   `ws` recusa a oferta inteira de quem não anunciar o campo, e recusa
   *   derruba a conexão. Ausente, cada cliente usa o padrão dele.
   * - `threshold` no padrão de 1 KB: chat, `move-lock` e `hello` não valem
   *   o ciclo de compressão.
   *
   * Bomba-zip não passa: o `maxHttpBufferSize` acima vira o `maxPayload` do
   * `ws`, que o cobra sobre o tamanho **descomprimido**.
   */
  perMessageDeflate: {
    serverMaxWindowBits: 14,
    zlibDeflateOptions: { level: 6, memLevel: 7 },
  },
})
export class RealtimeGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly limiter = new RateLimiter(SOCKET_MESSAGE_LIMIT, SOCKET_WINDOW_MS);
  private readonly socketsVistos: DiagnosticoDoSocket = { conexoes: 0, comprimidas: 0 };

  /** Cópia, não o objeto: o `/health` lê, não mexe. */
  get diagnosticoDoSocket(): DiagnosticoDoSocket {
    return { ...this.socketsVistos };
  }

  constructor(
    private readonly auth: AuthService,
    private readonly social: SocialService,
    private readonly online: OnlineUsersRegistry,
    private readonly rooms: RoomRegistry,
  ) {}

  handleConnection(socket: Socket): void {
    this.socketsVistos.conexoes += 1;
    if (negociouCompressao(socket)) this.socketsVistos.comprimidas += 1;

    // Middleware de socket vale pra todo pacote que chega, igual ao teto
    // que o original checava no topo do `ws.on('message')`.
    socket.use((_packet, next) => {
      if (this.limiter.allow(socket.id)) {
        next();
        return;
      }
      socket.emit('error', { message: 'Muitas ações em pouco tempo.' });
    });
  }

  handleDisconnect(socket: Socket): void {
    this.limiter.forget(socket.id);
    this.online.remove(socket.id);
    const left = this.rooms.leave(socket.id);
    if (!left) return;
    for (const peer of left.remaining) peer.emit('peer-left', { room: left.code });

    // Quem ficou assumiu o papel 1 e precisa saber: sem isso ele continua
    // se achando papel 2 e não manda `welcome`/`move-lock` nunca mais.
    if (left.promoted) left.promoted.connection.emit('role-changed', { room: left.code, role: left.promoted.to });
  }

  // ---------------------------------------------------------------- social

  /**
   * Token do corpo, ou o cookie de sessão que veio no handshake.
   *
   * Navegador não consegue ler cookie `httpOnly`, então o front novo manda
   * `auth` com o corpo vazio — quem prova a identidade é o cookie que o
   * próprio navegador anexou ao abrir a conexão. O corpo continua valendo
   * pro cliente antigo e pra qualquer coisa que não seja navegador.
   */
  private tokenDaConexao(socket: Socket, body: { token?: unknown }): string {
    return comoTexto(body?.token) || lerTokenDoCookie(socket.handshake.headers.cookie);
  }

  @SubscribeMessage('auth')
  async handleAuth(@ConnectedSocket() socket: Socket, @MessageBody() body: { token?: unknown }): Promise<void> {
    await this.guard(socket, 'auth', null, async () => {
      const result = await this.auth.me(this.tokenDaConexao(socket, body));
      if (result.kind !== 'ok') {
        socket.emit('auth-error', {});
        return;
      }
      const state = socket.data as SocketState;
      state.userId = result.user.id;
      state.username = result.user.username;
      this.online.add(result.user.id, socket);
      socket.emit('authed', { username: result.user.username });
    });
  }

  @SubscribeMessage('chat')
  async handleChat(@ConnectedSocket() socket: Socket, @MessageBody() body: { to?: unknown; body?: unknown; tempId?: unknown }): Promise<void> {
    const sender = this.senderOf(socket);
    if (!sender) return;

    const to = comoTexto(body?.to);
    const tempId = comoTexto(body?.tempId);
    try {
      const result = await this.social.sendChatMessage(sender, to, body?.body);
      if (result.kind !== 'ok') {
        socket.emit('chat-error', { to, tempId, message: CHAT_ERROR_MESSAGES[result.kind] });
        return;
      }
      socket.emit('chat-ack', { to, tempId, id: result.message.id, body: result.message.body, createdAt: result.message.createdAt });
    } catch (err) {
      // Erro de chat responde no canal do chat, com o tempId: se cair no
      // `error` genérico o cliente não reconhece como resposta e fica
      // esperando o timeout local achando que a mensagem sumiu.
      this.logger.error(`Erro ao enviar mensagem de chat (from=${sender.id} to=${to})`, err as Error);
      socket.emit('chat-error', { to, tempId, message: 'Erro interno ao enviar a mensagem.' });
    }
  }

  @SubscribeMessage('room-invite')
  async handleRoomInvite(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { to?: unknown; code?: unknown; hostName?: unknown },
  ): Promise<void> {
    const sender = this.senderOf(socket);
    if (!sender) return;

    try {
      const resolved = await this.social.resolveInviteTarget(sender.id, comoTexto(body?.to));
      if (resolved.kind === 'target-not-found') {
        socket.emit('room-invite-error', { message: 'Jogador não encontrado.' });
        return;
      }
      if (resolved.kind === 'not-friends') {
        socket.emit('room-invite-error', { message: 'Vocês precisam ser amigos para convidar.' });
        return;
      }

      const code = normalizeRoomCode(body?.code);
      if (!code) return;

      this.online.deliver(resolved.target.id, 'room-invite', {
        from: sender.username,
        code,
        hostName: normalizePlayerName(body?.hostName ?? sender.username),
      });
      socket.emit('room-invite-sent', { to: resolved.target.username });
    } catch (err) {
      this.logger.error(`Erro ao enviar convite de sala (from=${sender.id} to=${comoTexto(body?.to)})`, err as Error);
      socket.emit('room-invite-error', { message: 'Erro interno ao enviar o convite.' });
    }
  }

  @SubscribeMessage('room-invite-response')
  async handleRoomInviteResponse(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { to?: unknown; code?: unknown; accepted?: unknown },
  ): Promise<void> {
    const sender = this.senderOf(socket);
    if (!sender) return;

    try {
      const target = await this.social.findUser(comoTexto(body?.to));
      if (!target) return;
      this.online.deliver(target.id, 'room-invite-response', {
        from: sender.username,
        code: normalizeRoomCode(body?.code),
        accepted: !!body?.accepted,
      });
    } catch (err) {
      this.logger.error('Erro ao responder convite de sala', err as Error);
    }
  }

  // ----------------------------------------------------------------- salas

  @SubscribeMessage('create')
  async handleCreate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { room?: unknown; name?: unknown; public?: unknown; accountToken?: unknown },
  ): Promise<void> {
    const code = normalizeRoomCode(body?.room);
    if (!code) return;

    await this.guard(socket, 'create', code, async () => {
      const admin = await this.isAdminToken(this.tokenDaConexao(socket, { token: body?.accountToken }));
      // Antes de criar, procura no depósito: se a API reiniciou no meio da
      // partida, o mundo da sala está lá esperando e criar por cima o
      // apagaria. Ver `deposito-de-salas.ts`.
      await this.rooms.hidratar(code);
      const result = this.rooms.create(code, socket, {
        admin,
        isPublic: !!body?.public,
        hostName: normalizePlayerName(body?.name),
      });
      if (result.kind === 'already-exists') {
        socket.emit('error', { room: code, message: 'Sala já existe.' });
        return;
      }
      // `resumida` avisa o front de que o mapa veio de volta: ele reenvia o
      // próprio perfil (que de propósito não sobrevive) e reabre a aventura.
      socket.emit('created', { room: code, resumida: result.resumida });
    });
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { room?: unknown; name?: unknown; accountToken?: unknown },
  ): Promise<void> {
    const code = normalizeRoomCode(body?.room);
    if (!code) return;

    await this.guard(socket, 'join', code, async () => {
      const admin = await this.isAdminToken(this.tokenDaConexao(socket, { token: body?.accountToken }));
      // Mesmo motivo do `create`: sem isto, quem volta primeiro depois de
      // um reinício ouve "Sala não encontrada" e teria que esperar o
      // parceiro recriar — uma corrida que ninguém sabe que está correndo.
      await this.rooms.hidratar(code);
      const result = this.rooms.join(code, socket, { admin });
      if (result.kind === 'not-found') {
        socket.emit('error', { room: code, message: 'Sala não encontrada.' });
        return;
      }
      if (result.kind === 'full') {
        socket.emit('error', { room: code, message: 'Sala cheia.' });
        return;
      }
      const name = normalizePlayerName(body?.name);
      for (const peer of result.peers) peer.emit('hello', { room: code, name, role: result.role });

      /**
       * **E pra quem entrou, com o papel dele.**
       *
       * Faltava, e não era detalhe: o front só descobre o próprio papel por
       * aqui (`created` cobre só quem cria), e sem papel nada em
       * `tela-jogo.tsx` roda — `sincronizar` e a adoção do estado remoto
       * abrem os dois com `if (!sala.papel) return`. O convidado entrava na
       * sala e não sincronizava nada.
       *
       * O front já esperava por isto: o ramo `souEu` do ouvinte de `hello`
       * ("Você entrou na sala.") nunca tinha como disparar.
       */
      socket.emit('hello', { room: code, name, role: result.role });
    });
  }

  /**
   * Voltar pra sala em que se estava, depois de a conexão cair.
   *
   * Existe pra o front não ter que adivinhar entre `create` e `join`. Ele
   * não tem como saber: depois de um reinício da API a sala pode estar
   * viva (o parceiro voltou antes), retomada do depósito (ninguém voltou
   * ainda) ou perdida (sem `REDIS_URL`). Se cada lado escolhesse sozinho,
   * os dois voltando ao mesmo tempo dariam "Sala já existe" pra um deles —
   * uma corrida decidida por latência de rede.
   *
   * Aqui é uma mensagem só e o servidor resolve, que é onde a informação
   * está: existe → entra (sala vazia entrega o papel 1, ver `join`);
   * não existe → cria.
   */
  @SubscribeMessage('rejoin')
  async handleRejoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { room?: unknown; name?: unknown; public?: unknown; accountToken?: unknown },
  ): Promise<void> {
    const code = normalizeRoomCode(body?.room);
    if (!code) return;

    await this.guard(socket, 'rejoin', code, async () => {
      const admin = await this.isAdminToken(this.tokenDaConexao(socket, { token: body?.accountToken }));
      const name = normalizePlayerName(body?.name);
      await this.rooms.hidratar(code);

      const resultado = this.rooms.get(code)
        ? this.rooms.join(code, socket, { admin })
        : this.rooms.create(code, socket, { admin, isPublic: !!body?.public, hostName: name });

      if (resultado.kind === 'full') {
        socket.emit('error', { room: code, message: 'Sala cheia.' });
        return;
      }
      if (resultado.kind !== 'joined' && resultado.kind !== 'created') {
        socket.emit('error', { room: code, message: 'Não foi possível voltar para a sala.' });
        return;
      }

      const role = resultado.kind === 'created' ? HOST_ROLE : resultado.role;
      if (resultado.kind === 'joined') {
        for (const peer of resultado.peers) peer.emit('hello', { room: code, name, role });
      }
      // Mesmo evento do `join`: pro front, voltar e entrar são a mesma
      // coisa — ele recebe o papel e refaz o que precisa a partir dele.
      socket.emit('hello', { room: code, name, role });
    });
  }

  @SubscribeMessage('profile')
  handleProfile(@ConnectedSocket() socket: Socket, @MessageBody() body: { room?: unknown; profile?: unknown }): void {
    const seat = this.seatOf(socket, body?.room);
    if (!seat) return;

    const profile = this.rooms.applyProfile(seat.room, seat.role, body?.profile);
    // Pro parceiro vai a versão enxuta: a tela dele lê nome, nível, classe e
    // cosméticos, e nunca a mochila. Pra quem mandou volta o perfil inteiro,
    // que é o que o front usa pra se corrigir contra o saneamento.
    this.relay(seat.room, socket, 'profile', {
      room: seat.room.code,
      role: seat.role,
      profile: this.rooms.peerProfileOf(seat.room, seat.role),
    });
    socket.emit('profile-accepted', { room: seat.room.code, role: seat.role, profile });
  }

  @SubscribeMessage('welcome')
  handleWelcome(@ConnectedSocket() socket: Socket, @MessageBody() body: { room?: unknown; state?: unknown; turn?: unknown }): void {
    const seat = this.seatOf(socket, body?.room);
    if (!seat || seat.role !== HOST_ROLE) return;

    if (body?.state) this.rooms.applyState(seat.room, HOST_ROLE, body.state);
    const turnoInicial = clampInt(body?.turn, 1, MAX_TURN);
    // `welcome` é a sincronização cheia da sala: mochila vai sempre, ainda
    // que o servidor ache que já mandou. É o que cura quem reconecta.
    this.relayPorMembro(seat.room, socket, 'welcome', (membro) => ({
      room: seat.room.code,
      role: HOST_ROLE,
      state: this.estadoPara(seat.room, seat.room.state, membro, true),
      profiles: this.rooms.profilesForMember(seat.room, membro, true),
      turn: turnoInicial,
    }));
  }

  @SubscribeMessage('state')
  handleState(@ConnectedSocket() socket: Socket, @MessageBody() body: { room?: unknown; state?: unknown; turn?: unknown }): void {
    const seat = this.seatOf(socket, body?.room);
    if (!seat) return;

    const state = this.rooms.applyState(seat.room, seat.role, body?.state);
    const turn = clampInt(body?.turn, 1, MAX_TURN);
    // Este é o caminho quente: sai a cada ação de jogo, nos dois sentidos.
    // Medido num save de andar 8 com 76 itens, eram 20,3 KB por lado, dos
    // quais 11,5 KB a mochila de quem recebe — ecoada de volta sem ter
    // mudado. O perfil vai recortado por destinatário, e a mochila só
    // quando é outra (ver `profilesForMember`).
    this.relayPorMembro(seat.room, socket, 'state', (membro) => ({
      room: seat.room.code,
      role: seat.role,
      state: this.estadoPara(seat.room, state, membro),
      turn,
    }));
    socket.emit('authoritative', {
      room: seat.room.code,
      role: seat.role,
      state: this.estadoPara(seat.room, state, seat.member),
      turn,
    });
  }

  @SubscribeMessage('move-lock')
  handleMoveLock(@ConnectedSocket() socket: Socket, @MessageBody() body: { room?: unknown }): void {
    const seat = this.seatOf(socket, body?.room);
    if (!seat || seat.role !== HOST_ROLE) return;
    this.relay(seat.room, socket, 'move-lock', { room: seat.room.code, role: seat.role });
  }

  @SubscribeMessage('ui-action')
  handleUiAction(@ConnectedSocket() socket: Socket, @MessageBody() body: { room?: unknown; action?: unknown; payload?: unknown }): void {
    const seat = this.seatOf(socket, body?.room);
    if (!seat || !isUiAction(body?.action)) return;

    this.relay(seat.room, socket, 'ui-action', {
      room: seat.room.code,
      role: seat.role,
      action: body.action,
      payload: sanitizeUiActionPayload(body.action, body?.payload),
    });
  }

  @SubscribeMessage('team-heal')
  handleTeamHeal(@ConnectedSocket() socket: Socket, @MessageBody() body: { room?: unknown; amount?: unknown }): void {
    const seat = this.seatOf(socket, body?.room);
    if (!seat) return;
    this.relay(seat.room, socket, 'team-heal', {
      room: seat.room.code,
      role: seat.role,
      amount: clampInt(body?.amount, 0, MAX_HEAL),
    });
  }

  @SubscribeMessage('boss-advance-request')
  handleBossAdvanceRequest(@ConnectedSocket() socket: Socket, @MessageBody() body: { room?: unknown; bossName?: unknown }): void {
    const seat = this.seatOf(socket, body?.room);
    if (!seat || seat.role !== GUEST_ROLE) return;

    const state = seat.room.state;
    if (!state || Number(state.floor) % BOSS_FLOOR_INTERVAL !== 0) return;
    if (!hasBeatenBoss(state.map)) return;

    this.relay(seat.room, socket, 'boss-advance', {
      room: seat.room.code,
      role: GUEST_ROLE,
      bossName: (comoTexto(body?.bossName) || 'o chefe').replace(/[<>]/g, '').slice(0, MAX_BOSS_NAME),
    });
  }

  // -------------------------------------------------------------- internos

  private relay(room: Room, sender: Socket, event: string, payload: unknown): void {
    for (const peer of this.rooms.peersOf(room, sender.id)) peer.emit(event, payload);
  }

  /**
   * Como `relay`, mas monta um pacote por destinatário.
   *
   * Existe porque o perfil é recortado por destinatário: cada jogador
   * recebe o próprio e o do parceiro sem mochila nem grupo. Um pacote só
   * não serve pros dois — e desde que a própria mochila só viaja quando
   * muda, o recorte depende da **conexão**, não do papel: é ela que sabe o
   * que já recebeu.
   */
  private relayPorMembro(room: Room, sender: Socket, event: string, montar: (membro: RoomMember) => unknown): void {
    for (const membro of this.rooms.peerMembersOf(room, sender.id)) {
      membro.connection.emit(event, montar(membro));
    }
  }

  /** O estado com os perfis recortados pra quem vai receber. */
  private estadoPara(room: Room, estado: RoomState | null, membro: RoomMember, forcarMochila = false): RoomState | null {
    return estado ? { ...estado, profiles: this.rooms.profilesForMember(room, membro, forcarMochila) } : estado;
  }

  private senderOf(socket: Socket): { id: number; username: string } | null {
    const state = socket.data as SocketState;
    if (state.userId === undefined || state.username === undefined) return null;
    return { id: state.userId, username: state.username };
  }

  /** Resolve sala + papel do remetente, checando que ele é mesmo dessa sala. */
  private seatOf(socket: Socket, rawCode: unknown): { room: Room; role: RoomRole; member: RoomMember } | null {
    const code = normalizeRoomCode(rawCode);
    if (!code) return null;
    const membership = this.rooms.membershipOf(socket.id);
    if (!membership || membership.code !== code) return null;
    const room = this.rooms.get(code);
    if (!room) return null;
    const member = this.rooms.memberOf(room, socket.id);
    if (!member) return null;
    return { room, role: membership.role, member };
  }

  /**
   * `isAdminToken()` do original: identidade de conta, não a sessão do
   * socket — daí não usar o `state.userId` que o `auth` já resolveu.
   *
   * Quem chama passa por `tokenDaConexao`, então o cookie cobre o front
   * novo (que não tem token pra mandar) sem tirar o `accountToken` do
   * corpo, que o cliente antigo continua enviando.
   */
  private async isAdminToken(token: unknown): Promise<boolean> {
    const result = await this.auth.me(comoTexto(token));
    return result.kind === 'ok' && result.user.isAdmin;
  }

  /** Uma falha isolada não pode derrubar a conexão — loga e avisa quem mandou. */
  private async guard(socket: Socket, context: string, room: string | null, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (err) {
      this.logger.error(`Erro ao processar "${context}"`, err as Error);
      socket.emit('error', room ? { room, message: 'Erro interno ao processar sua ação.' } : { message: 'Erro interno ao processar sua ação.' });
    }
  }
}

function hasBeatenBoss(map: unknown): boolean {
  if (!Array.isArray(map)) return false;
  return map.some(
    (row) =>
      Array.isArray(row) &&
      row.some((cell) => !!cell && (cell as { type?: unknown; beaten?: unknown }).type === 'boss' && !!(cell as { beaten?: unknown }).beaten),
  );
}
