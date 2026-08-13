/**
 * Empurra eventos sociais em tempo real pro usuário-alvo, se estiver
 * conectado — equivalente a `emitSocial()`/`onSocialEvent()` no
 * accounts.js original, que um listener de WebSocket assinava.
 *
 * A implementação é `OnlineUsersRegistry`. Notificação é melhor-esforço:
 * se o alvo estiver offline, a operação de dados (pedido de amizade,
 * aceite, mensagem) acontece do mesmo jeito e ele vê da próxima vez que
 * abrir a lista — igual ao original.
 */

export type SocialEventType = 'friend-request' | 'friend-accept' | 'chat';

export interface SocialNotifier {
  notify(type: SocialEventType, targetUserId: number, payload: unknown): void;
}
