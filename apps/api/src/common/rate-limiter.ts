/**
 * Teto de eventos por chave, com janela fixa que reinicia sozinha — a
 * mesma forma dos dois limitadores do servidor original: `ws.rate` (30
 * mensagens por segundo por conexão, no server.js) e `limited()` (12
 * tentativas por minuto por IP, no accounts.js).
 *
 * Janela fixa mesmo, não deslizante: é o que o original fazia e o que
 * basta aqui. `now` entra injetado pra o teste não depender de relógio
 * real.
 *
 * O estado é do processo, como no original. Quando o Redis entrar (fase
 * 6) e a API rodar em mais de uma instância, é esta classe que precisa de
 * um backend compartilhado — hoje cada instância conta a sua parte.
 */

interface Bucket {
  windowStart: number;
  count: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  allow(key: string): boolean {
    const timestamp = this.now();
    const bucket = this.buckets.get(key);
    if (!bucket || timestamp - bucket.windowStart > this.windowMs) {
      this.buckets.set(key, { windowStart: timestamp, count: 1 });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= this.limit;
  }

  forget(key: string): void {
    this.buckets.delete(key);
  }
}
