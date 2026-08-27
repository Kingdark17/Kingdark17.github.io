/**
 * Estado da conexão com o Redis pro `/health`, no mesmo formato
 * `{configured, connected}` do banco — e pela mesma razão.
 *
 * `configured` responde "a `REDIS_URL` chegou até o processo?". É a
 * pergunta prática depois de mexer no painel do host: lá, variável de
 * ambiente só passa a valer com "Save, rebuild, and deploy", e um deploy
 * verde por si só não prova que a mudança entrou. Aqui a resposta vem de
 * dentro do processo que está rodando, que é o único lugar onde ela é
 * verdade.
 *
 * `connected` é medido na hora, não guardado no boot, pelo motivo que já
 * está escrito no `database-probe`: flag de boot continua dizendo `true`
 * depois do serviço cair.
 *
 * Isto também é o interruptor da persistência de sala: o `RealtimeModule`
 * entrega `DepositoNoRedis` quando há cliente e `DepositoNulo` quando não
 * há. Como o `DepositoNoRedis` engole os próprios erros de propósito —
 * Redis fora do ar não pode recusar partida —, uma sala que não sobrevive
 * ao deploy não faz barulho em lugar nenhum. `configured: false` aqui é o
 * que diz por quê.
 */

import type { ClienteRedis } from '../shared-state/cliente-redis';

export interface RedisStatus {
  configured: boolean;
  connected: boolean;
}

/**
 * `EXISTS` numa chave que ninguém escreve: é ida e volta de verdade até o
 * servidor, custo constante, e não cria nem altera nada. `/health` é
 * chamado por monitor de uptime — não pode deixar rastro.
 */
const CHAVE_DE_TOQUE = 'rpg:health';

export async function probeRedis(redis: ClienteRedis | null): Promise<RedisStatus> {
  if (!redis) return { configured: false, connected: false };
  try {
    await redis.exists(CHAVE_DE_TOQUE);
    return { configured: true, connected: true };
  } catch {
    return { configured: true, connected: false };
  }
}
