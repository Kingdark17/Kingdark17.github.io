/**
 * Diz se um usuário está "online" — equivalente a `isOnline()`/
 * `setOnline()` no accounts.js original, que rastreava conexões
 * WebSocket ativas num `Set` em memória.
 *
 * `AlwaysOfflinePresenceChecker` é o padrão até a camada de tempo real
 * existir: presença sempre volta `false` em vez de inventar um estado
 * que não dá pra saber sem uma conexão de verdade.
 */

export interface PresenceChecker {
  isOnline(userId: number): boolean;
}

export class AlwaysOfflinePresenceChecker implements PresenceChecker {
  isOnline(): boolean {
    return false;
  }
}
