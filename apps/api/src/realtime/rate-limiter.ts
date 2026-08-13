/**
 * Teto de mensagens por conexão — porta do `ws.rate` do server.js
 * original (30 mensagens por segundo, janela fixa que reinicia sozinha).
 *
 * Janela fixa mesmo, não deslizante: é o que o original fazia e o que
 * basta pra barrar flood de socket. `now` entra injetado pra o teste não
 * depender de relógio real.
 */

export const DEFAULT_MESSAGE_LIMIT = 30;
export const DEFAULT_WINDOW_MS = 1000;

interface Bucket {
  windowStart: number;
  count: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number = DEFAULT_MESSAGE_LIMIT,
    private readonly windowMs: number = DEFAULT_WINDOW_MS,
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
