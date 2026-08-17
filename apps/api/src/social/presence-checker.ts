/**
 * Diz quem está "online" — equivalente a `isOnline()`/`setOnline()` no
 * accounts.js original, que rastreava conexões WebSocket ativas num `Set`
 * em memória.
 *
 * A implementação é `OnlineUsersRegistry`, alimentada pelo gateway de
 * tempo real. `SocialService` só conhece esta interface, então dá pra
 * testar sem conexão nenhuma.
 *
 * **Em lote e assíncrono** porque quem pergunta é a lista de amigos, que
 * quer saber de todo mundo de uma vez, e porque com `REDIS_URL` a
 * resposta vem de fora do processo — uma pergunta por amigo seria uma ida
 * e volta por amigo.
 */

export interface PresenceChecker {
  onlineAmong(userIds: number[]): Promise<Set<number>>;
}
