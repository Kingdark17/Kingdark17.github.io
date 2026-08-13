/**
 * Diz se um usuário está "online" — equivalente a `isOnline()`/
 * `setOnline()` no accounts.js original, que rastreava conexões
 * WebSocket ativas num `Set` em memória.
 *
 * A implementação é `OnlineUsersRegistry`, alimentada pelo gateway de
 * tempo real. `SocialService` só conhece esta interface, então dá pra
 * testar sem conexão nenhuma.
 */

export interface PresenceChecker {
  isOnline(userId: number): boolean;
}
