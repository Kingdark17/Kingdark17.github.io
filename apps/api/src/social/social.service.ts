/**
 * Orquestração de amigos/chat — porta de `/api/friends` (GET),
 * `/api/friends/{request,accept,decline,remove}` e `/api/messages/:username`
 * (GET/POST) do `accounts.js` original, sem a camada HTTP. Presença
 * online e push em tempo real ficam atrás de `PresenceChecker`/
 * `SocialNotifier` — ver os comentários desses arquivos.
 */

import { comoTexto } from '../common/texto';
import { decodeAvatar, publicAvatarUrl, type AvatarDecodificado } from './avatar';
import { cleanMessageText } from './message-text';
import type { PresenceChecker } from './presence-checker';
import type { SocialNotifier } from './social-notifier';
import type { InternalFriendRow, RecentMessage, SocialRepository, StoredMessage, UserLookup } from './social-repository';

export interface PublicFriendView {
  username: string;
  avatarUrl: string;
  frame: string;
  nameColor: string;
  pet: string;
  online: boolean;
}

export interface RelationsView {
  friends: PublicFriendView[];
  incoming: PublicFriendView[];
  outgoing: PublicFriendView[];
}

export type SendFriendRequestResult =
  | { kind: 'target-not-found' }
  | { kind: 'cannot-add-self' }
  | { kind: 'already-friends' }
  | { kind: 'already-requested' }
  | { kind: 'accepted' }
  | { kind: 'sent' };

export type AcceptFriendRequestResult = { kind: 'target-not-found' } | { kind: 'no-pending-request' } | { kind: 'ok' };

export type SimpleFriendResult = { kind: 'target-not-found' } | { kind: 'ok' };

export type SendChatMessageResult =
  { kind: 'target-not-found' } | { kind: 'not-friends' } | { kind: 'empty-message' } | { kind: 'ok'; message: StoredMessage };

export type RecentMessagesResult = { kind: 'target-not-found' } | { kind: 'not-friends' } | { kind: 'ok'; messages: RecentMessage[] };

export type InviteTargetResult = { kind: 'target-not-found' } | { kind: 'not-friends' } | { kind: 'ok'; target: UserLookup };

const CHAT_HISTORY_LIMIT_MIN = 1;
const CHAT_HISTORY_LIMIT_MAX = 80;
const CHAT_HISTORY_LIMIT_DEFAULT = 50;

export class SocialService {
  constructor(
    private readonly repo: SocialRepository,
    private readonly notifier: SocialNotifier,
    private readonly presence: PresenceChecker,
  ) {}

  async listRelations(userId: number): Promise<RelationsView> {
    const rows = await this.repo.listRelations(userId);
    const toPublic = (row: InternalFriendRow): PublicFriendView => ({
      username: row.username,
      // Foto enviada não viaja aqui: vira endereço pro endpoint, que o
      // navegador guarda em cache. Ver `avatar.ts`.
      avatarUrl: publicAvatarUrl(row.username, row.avatarUrl),
      frame: row.frame,
      nameColor: row.nameColor,
      pet: row.pet,
      online: this.presence.isOnline(row.id),
    });
    return { friends: rows.friends.map(toPublic), incoming: rows.incoming.map(toPublic), outgoing: rows.outgoing.map(toPublic) };
  }

  /** Foto de um jogador em bytes. `null` pra quem não existe, não tem foto ou usa link externo. */
  async findAvatar(username: string): Promise<AvatarDecodificado | null> {
    const guardado = await this.repo.findAvatarByUsername(username);
    return guardado ? decodeAvatar(guardado) : null;
  }

  async sendFriendRequest(fromUser: { id: number; username: string }, toUsername: string): Promise<SendFriendRequestResult> {
    const target = await this.repo.findUserByUsername(toUsername);
    if (!target) return { kind: 'target-not-found' };
    if (target.id === fromUser.id) return { kind: 'cannot-add-self' };
    if (await this.repo.areFriends(fromUser.id, target.id)) return { kind: 'already-friends' };

    if (await this.repo.hasPendingRequest(target.id, fromUser.id)) {
      await this.repo.acceptFriendRequest(target.id, fromUser.id);
      this.notifier.notify('friend-accept', target.id, { username: fromUser.username });
      return { kind: 'accepted' };
    }

    const outcome = await this.repo.createFriendRequest(fromUser.id, target.id);
    if (outcome === 'duplicate') return { kind: 'already-requested' };

    this.notifier.notify('friend-request', target.id, { username: fromUser.username });
    return { kind: 'sent' };
  }

  async acceptFriendRequest(toUser: { id: number; username: string }, fromUsername: string): Promise<AcceptFriendRequestResult> {
    const from = await this.repo.findUserByUsername(fromUsername);
    if (!from) return { kind: 'target-not-found' };
    if (!(await this.repo.hasPendingRequest(from.id, toUser.id))) return { kind: 'no-pending-request' };

    await this.repo.acceptFriendRequest(from.id, toUser.id);
    this.notifier.notify('friend-accept', from.id, { username: toUser.username });
    return { kind: 'ok' };
  }

  async declineFriendRequest(userId: number, otherUsername: string): Promise<SimpleFriendResult> {
    const other = await this.repo.findUserByUsername(otherUsername);
    if (!other) return { kind: 'target-not-found' };
    await this.repo.deleteFriendRequestBetween(userId, other.id);
    return { kind: 'ok' };
  }

  async removeFriend(userId: number, friendUsername: string): Promise<SimpleFriendResult> {
    const friend = await this.repo.findUserByUsername(friendUsername);
    if (!friend) return { kind: 'target-not-found' };
    await this.repo.deleteFriendship(userId, friend.id);
    return { kind: 'ok' };
  }

  async sendChatMessage(fromUser: { id: number; username: string }, toUsername: string, text: unknown): Promise<SendChatMessageResult> {
    const target = await this.repo.findUserByUsername(toUsername);
    if (!target) return { kind: 'target-not-found' };
    if (!(await this.repo.areFriends(fromUser.id, target.id))) return { kind: 'not-friends' };

    const clean = cleanMessageText(text);
    if (!clean) return { kind: 'empty-message' };

    const saved = await this.repo.recordMessage(fromUser.id, target.id, clean);
    this.notifier.notify('chat', target.id, { from: fromUser.username, id: saved.id, body: saved.body, createdAt: saved.createdAt });
    return { kind: 'ok', message: saved };
  }

  /** Convite de sala só vale entre amigos — regra do `room-invite` no server.js original. */
  async resolveInviteTarget(fromUserId: number, toUsername: string): Promise<InviteTargetResult> {
    const target = await this.repo.findUserByUsername(toUsername);
    if (!target) return { kind: 'target-not-found' };
    if (!(await this.repo.areFriends(fromUserId, target.id))) return { kind: 'not-friends' };
    return { kind: 'ok', target };
  }

  /** Resposta a convite não checa amizade (o original também não) — só resolve pra quem entregar. */
  findUser(username: string): Promise<UserLookup | null> {
    return this.repo.findUserByUsername(username);
  }

  async recentMessages(userId: number, otherUsername: string, beforeId: unknown, limit: unknown): Promise<RecentMessagesResult> {
    const target = await this.repo.findUserByUsername(otherUsername);
    if (!target) return { kind: 'target-not-found' };
    if (!(await this.repo.areFriends(userId, target.id))) return { kind: 'not-friends' };

    const cap = Math.max(CHAT_HISTORY_LIMIT_MIN, Math.min(CHAT_HISTORY_LIMIT_MAX, Number(limit) || CHAT_HISTORY_LIMIT_DEFAULT));
    const marcador = comoTexto(beforeId);
    const before = /^\d+$/.test(marcador) ? marcador : undefined;
    const messages = await this.repo.recentMessages(userId, target.id, before, cap);
    return { kind: 'ok', messages };
  }
}
