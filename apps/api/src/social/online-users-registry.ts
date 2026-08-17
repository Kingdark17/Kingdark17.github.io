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
 *
 * **O mapa de conexões é local e continua sendo** — socket não atravessa
 * processo. O que atravessa é a resposta de "está online?" e a entrega do
 * evento, através de `PresencaCompartilhada`. Sem `REDIS_URL` ela é a
 * `PresencaLocal`, e tudo se comporta como antes.
 */

import { PresencaLocal, type PresencaCompartilhada } from '../shared-state/presenca';
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

  constructor(private readonly compartilhada: PresencaCompartilhada = new PresencaLocal()) {
    // Evento vindo de outra instância chega aqui e segue o mesmo caminho
    // de um evento nascido nesta.
    this.compartilhada.aoReceber((userId, evento, payload) => this.entregarLocal(userId, evento, payload));
  }

  add(userId: number, connection: OnlineConnection): void {
    this.remove(connection.id);
    let connections = this.byUser.get(userId);
    if (!connections) {
      connections = new Map();
      this.byUser.set(userId, connections);
    }
    connections.set(connection.id, connection);
    this.userByConnection.set(connection.id, userId);
    this.compartilhada.entrou(userId);
  }

  /** Devolve o usuário que estava nessa conexão, ou `null` se não havia. */
  remove(connectionId: string): number | null {
    const userId = this.userByConnection.get(connectionId);
    if (userId === undefined) return null;

    this.userByConnection.delete(connectionId);
    const connections = this.byUser.get(userId);
    if (connections) {
      connections.delete(connectionId);
      if (!connections.size) {
        this.byUser.delete(userId);
        // Só sai da presença compartilhada quando a última aba fecha.
        this.compartilhada.saiu(userId);
      }
    }
    return userId;
  }

  /**
   * `PresenceChecker`: quais destes estão online, aqui ou em qualquer
   * outra instância. Em lote, e não um por vez, porque a lista de amigos
   * pergunta por todo mundo de uma vez — com Redis, uma pergunta por
   * amigo seria uma ida e volta por amigo.
   */
  async onlineAmong(userIds: number[]): Promise<Set<number>> {
    const online = new Set<number>();
    for (const id of userIds) if (this.byUser.has(id)) online.add(id);

    const faltando = userIds.filter((id) => !online.has(id));
    for (const id of await this.compartilhada.onlineEmOutras(faltando)) online.add(id);
    return online;
  }

  /** `SocialNotifier`: entrega o evento em todas as conexões do alvo. */
  notify(type: SocialEventType, targetUserId: number, payload: unknown): void {
    this.deliver(targetUserId, type, payload);
  }

  /** Entrega direta usada também por eventos fora do social (convite de sala). */
  deliver(userId: number, event: string, payload: unknown): void {
    this.compartilhada.empurrar(userId, event, payload);
  }

  private entregarLocal(userId: number, event: string, payload: unknown): void {
    const connections = this.byUser.get(userId);
    if (!connections) return;
    for (const connection of connections.values()) connection.emit(event, payload);
  }

  connectionCount(userId: number): number {
    return this.byUser.get(userId)?.size ?? 0;
  }

  /**
   * Fecha a conexão de assinatura e o batimento. O Nest chama isto no
   * `app.close()` — sem ele, cada teste que sobe o app deixaria um
   * intervalo rodando e o processo não morreria sozinho.
   */
  onModuleDestroy(): Promise<void> {
    return this.compartilhada.encerrar();
  }
}
