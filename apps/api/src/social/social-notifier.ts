/**
 * Empurra eventos sociais em tempo real pro usuário-alvo, se estiver
 * conectado — equivalente a `emitSocial()`/`onSocialEvent()` no
 * accounts.js original, que um listener de WebSocket assinava.
 *
 * `NoopSocialNotifier` é o padrão até a camada de tempo real (socket.io,
 * decisão ainda em aberto pra este monorepo) existir aqui: as operações
 * de dados (pedido de amizade, aceitar, mensagem) funcionam normalmente
 * — só não empurram notificação instantânea pro outro usuário. Trocar
 * por uma implementação real de socket.io não muda `SocialService` nem
 * o controller, só a injeção no módulo.
 */

export type SocialEventType = 'friend-request' | 'friend-accept' | 'chat';

export interface SocialNotifier {
  notify(type: SocialEventType, targetUserId: number, payload: unknown): void;
}

export class NoopSocialNotifier implements SocialNotifier {
  notify(): void {
    // sem camada de tempo real configurada ainda
  }
}
