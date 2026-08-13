/**
 * Quem está conectado agora, e como empurrar evento pra essa pessoa —
 * porta do par `onlineIds` (accounts.js) + `onlineSockets` (server.js) do
 * original, que eram duas estruturas separadas mantidas em sincronia na
 * mão via `setOnline()`. Aqui é uma só: presença é derivada de existir
 * conexão registrada, então não tem como as duas discordarem.
 *
 * Continua sem saber o que é socket.io: o gateway registra qualquer coisa
 * com `id` e `emit`. É o que permite testar presença e notificação sem
 * levantar servidor.
 *
 * Um usuário pode ter várias conexões (duas abas): só fica offline quando
 * a última cai, igual ao original.
 */

import type { PresenceChecker } from './presence-checker';
import type { SocialEventType, SocialNotifier } from './social-notifier';

/** O mínimo que o registro precisa de uma conexão — o gateway passa o socket. */
export interface OnlineConnection {
  readonly id: string;
  emit(event: string, payload: unknown): void;
}

export class OnlineUsersRegistry implements PresenceChecker, SocialNotifier {
  private readonly byUser = new Map<number, Map<string, OnlineConnection>>();
  private readonly userByConnection = new Map<string, number>();

  add(userId: number, connection: OnlineConnection): void {
    this.remove(connection.id);
    let connections = this.byUser.get(userId);
    if (!connections) {
      connections = new Map();
      this.byUser.set(userId, connections);
    }
    connections.set(connection.id, connection);
    this.userByConnection.set(connection.id, userId);
  }

  /** Devolve o usuário que estava nessa conexão, ou `null` se não havia. */
  remove(connectionId: string): number | null {
    const userId = this.userByConnection.get(connectionId);
    if (userId === undefined) return null;

    this.userByConnection.delete(connectionId);
    const connections = this.byUser.get(userId);
    if (connections) {
      connections.delete(connectionId);
      if (!connections.size) this.byUser.delete(userId);
    }
    return userId;
  }

  isOnline(userId: number): boolean {
    return this.byUser.has(userId);
  }

  /** `SocialNotifier`: entrega o evento em todas as conexões do alvo. */
  notify(type: SocialEventType, targetUserId: number, payload: unknown): void {
    this.deliver(targetUserId, type, payload);
  }

  /** Entrega direta usada também por eventos fora do social (convite de sala). */
  deliver(userId: number, event: string, payload: unknown): void {
    const connections = this.byUser.get(userId);
    if (!connections) return;
    for (const connection of connections.values()) connection.emit(event, payload);
  }

  connectionCount(userId: number): number {
    return this.byUser.get(userId)?.size ?? 0;
  }
}
