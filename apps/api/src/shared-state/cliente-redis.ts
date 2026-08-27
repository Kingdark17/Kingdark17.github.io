/**
 * A fronteira com o Redis — e ela é estreita de propósito.
 *
 * A API guarda três coisas no processo, herdadas do servidor original:
 * contador de tentativas por IP, quem está online, e pra qual socket
 * empurrar um evento. **Funciona com uma instância; é exatamente o que
 * quebra na segunda.** O limite de 12 por minuto vira 12 por instância,
 * e um amigo conectado na instância B aparece offline pra quem falou com
 * a A.
 *
 * O acordo aqui é o mesmo do `DATABASE_URL`: **sem `REDIS_URL` o app
 * sobe e se comporta exatamente como antes**, com o estado no processo.
 * Com a variável, o mesmo estado passa a ser compartilhado. Nada de
 * "modo cluster" que só é exercitado em produção.
 *
 * O tipo abaixo é o subconjunto que usamos, não o `ioredis` inteiro: é o
 * que permite os testes rodarem contra um fake com semântica de Redis,
 * sem servidor. O que ele **não** cobre é o comportamento real do Redis
 * (expiração de verdade, reconexão, partição) — isso só um Redis de
 * verdade pega, e não há um aqui. Está anotado no NOTAS-MIGRACAO.
 */

/** O que este código chama num cliente Redis. Nada além disto. */
export interface ClienteRedis {
  incr(key: string): Promise<number>;
  pexpire(key: string, milissegundos: number): Promise<number>;
  get(key: string): Promise<string | null>;
  /** `PX` porque toda chave guardada aqui tem prazo — nada mora pra sempre. */
  set(key: string, valor: string, modo: 'PX', milissegundos: number): Promise<unknown>;
  del(key: string): Promise<number>;
  sadd(key: string, member: string): Promise<number>;
  srem(key: string, member: string): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  publish(canal: string, mensagem: string): Promise<number>;
  subscribe(canal: string): Promise<unknown>;
  on(evento: 'message', ouvinte: (canal: string, mensagem: string) => void): unknown;
  duplicate(): ClienteRedis;
  quit(): Promise<unknown>;
}

export const REDIS = Symbol('REDIS');

/**
 * `null` quando não há `REDIS_URL` — e aí cada peça cai na versão em
 * memória. Lido na hora, não no boot, pela mesma razão do `getDb()`.
 */
export async function criarClienteRedis(url = process.env.REDIS_URL): Promise<ClienteRedis | null> {
  if (!url) return null;

  // Export nomeado, não o `default`: com interop de CommonJS o `default`
  // do `import()` é o módulo inteiro, que não é construtível.
  const { Redis } = await import('ioredis');
  // `lazyConnect: false` é o padrão: a conexão sobe junto e reconecta
  // sozinha. Uma queda do Redis não pode derrubar a API — quem chama
  // trata a falha caindo pro comportamento de instância única.
  return new Redis(url, { maxRetriesPerRequest: 2 });
}
