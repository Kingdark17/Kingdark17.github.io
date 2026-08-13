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
 *
 * O que continua igual: papéis (1 cria e conduz exploração, 2 acompanha),
 * saneamento autoritativo de perfil/estado, 30 mensagens por segundo por
 * conexão, sala descartada quando esvazia.
 */

import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

import { AuthService } from '../auth/auth.service';
import { OnlineUsersRegistry } from '../social/online-users-registry';
import { SocialService } from '../social/social.service';
import { clampInt } from './numeric';
import { RateLimiter } from './rate-limiter';
import { HOST_ROLE, GUEST_ROLE, RoomRegistry, normalizePlayerName, normalizeRoomCode, type Room, type RoomRole } from './room-registry';
import { isUiAction, sanitizeUiActionPayload } from './ui-action';

const CHAT_ERROR_MESSAGES = {
  'target-not-found': 'Jogador não encontrado.',
  'not-friends': 'Vocês precisam ser amigos para conversar.',
  'empty-message': 'Mensagem vazia.',
} as const;

const MAX_TURN = 1_000_000;
const MAX_HEAL = 500;
const MAX_BOSS_NAME = 80;
const BOSS_FLOOR_INTERVAL = 5;

interface SocketState {
  userId?: number;
  username?: string;
}

@WebSocketGateway({
  cors: { origin: process.env.ALLOWED_ORIGIN || '*' },
  maxHttpBufferSize: 512 * 1024,
})
export class RealtimeGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly limiter = new RateLimiter();

  constructor(
    private readonly auth: AuthService,
    private readonly social: SocialService,
    private readonly online: OnlineUsersRegistry,
    private readonly rooms: RoomRegistry,
  ) {}

  handleConnection(socket: Socket): void {
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
  }

  // ---------------------------------------------------------------- social

  @SubscribeMessage('auth')
  async handleAuth(@ConnectedSocket() socket: Socket, @MessageBody() body: { token?: unknown }): Promise<void> {
    await this.guard(socket, 'auth', null, async () => {
      const result = await this.auth.me(String(body?.token ?? ''));
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

    const to = String(body?.to ?? '');
    const tempId = String(body?.tempId ?? '');
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
      const resolved = await this.social.resolveInviteTarget(sender.id, String(body?.to ?? ''));
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
      this.logger.error(`Erro ao enviar convite de sala (from=${sender.id} to=${String(body?.to ?? '')})`, err as Error);
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
      const target = await this.social.findUser(String(body?.to ?? ''));
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
      const admin = await this.isAdminToken(body?.accountToken);
      const result = this.rooms.create(code, socket, {
        admin,
        isPublic: !!body?.public,
        hostName: normalizePlayerName(body?.name),
      });
      if (result.kind === 'already-exists') {
        socket.emit('error', { room: code, message: 'Sala já existe.' });
        return;
      }
      socket.emit('created', { room: code });
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
      const admin = await this.isAdminToken(body?.accountToken);
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
    });
  }

  @SubscribeMessage('profile')
  handleProfile(@ConnectedSocket() socket: Socket, @MessageBody() body: { room?: unknown; profile?: unknown }): void {
    const seat = this.seatOf(socket, body?.room);
    if (!seat) return;

    const profile = this.rooms.applyProfile(seat.room, seat.role, body?.profile);
    this.relay(seat.room, socket, 'profile', { room: seat.room.code, role: seat.role, profile });
    socket.emit('profile-accepted', { room: seat.room.code, role: seat.role, profile });
  }

  @SubscribeMessage('welcome')
  handleWelcome(@ConnectedSocket() socket: Socket, @MessageBody() body: { room?: unknown; state?: unknown; turn?: unknown }): void {
    const seat = this.seatOf(socket, body?.room);
    if (!seat || seat.role !== HOST_ROLE) return;

    if (body?.state) this.rooms.applyState(seat.room, HOST_ROLE, body.state);
    this.relay(seat.room, socket, 'welcome', {
      room: seat.room.code,
      role: HOST_ROLE,
      state: seat.room.state,
      profiles: this.rooms.publicProfiles(seat.room),
      turn: clampInt(body?.turn, 1, MAX_TURN),
    });
  }

  @SubscribeMessage('state')
  handleState(@ConnectedSocket() socket: Socket, @MessageBody() body: { room?: unknown; state?: unknown; turn?: unknown }): void {
    const seat = this.seatOf(socket, body?.room);
    if (!seat) return;

    const state = this.rooms.applyState(seat.room, seat.role, body?.state);
    const turn = clampInt(body?.turn, 1, MAX_TURN);
    this.relay(seat.room, socket, 'state', { room: seat.room.code, role: seat.role, state, turn });
    socket.emit('authoritative', { room: seat.room.code, role: seat.role, state, turn });
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
      bossName: String(body?.bossName || 'o chefe')
        .replace(/[<>]/g, '')
        .slice(0, MAX_BOSS_NAME),
    });
  }

  // -------------------------------------------------------------- internos

  private relay(room: Room, sender: Socket, event: string, payload: unknown): void {
    for (const peer of this.rooms.peersOf(room, sender.id)) peer.emit(event, payload);
  }

  private senderOf(socket: Socket): { id: number; username: string } | null {
    const state = socket.data as SocketState;
    if (state.userId === undefined || state.username === undefined) return null;
    return { id: state.userId, username: state.username };
  }

  /** Resolve sala + papel do remetente, checando que ele é mesmo dessa sala. */
  private seatOf(socket: Socket, rawCode: unknown): { room: Room; role: RoomRole } | null {
    const code = normalizeRoomCode(rawCode);
    if (!code) return null;
    const membership = this.rooms.membershipOf(socket.id);
    if (!membership || membership.code !== code) return null;
    const room = this.rooms.get(code);
    if (!room) return null;
    return { room, role: membership.role };
  }

  /** `isAdminToken()` do original: token de conta, não a sessão do socket. */
  private async isAdminToken(token: unknown): Promise<boolean> {
    const result = await this.auth.me(String(token ?? ''));
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
  return map.some((row) => Array.isArray(row) && row.some((cell) => !!cell && (cell as { type?: unknown; beaten?: unknown }).type === 'boss' && !!(cell as { beaten?: unknown }).beaten));
}
