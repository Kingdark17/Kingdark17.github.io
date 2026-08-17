import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  it('libera até o teto e barra o excedente dentro da janela', () => {
    const clock = 1_000;
    const limiter = new RateLimiter(3, 1000, () => clock);

    expect(limiter.allow('c1')).toBe(true);
    expect(limiter.allow('c1')).toBe(true);
    expect(limiter.allow('c1')).toBe(true);
    expect(limiter.allow('c1')).toBe(false);
    expect(limiter.allow('c1')).toBe(false);
  });

  it('reinicia a contagem quando a janela vira', () => {
    let clock = 1_000;
    const limiter = new RateLimiter(2, 1000, () => clock);

    expect(limiter.allow('c1')).toBe(true);
    expect(limiter.allow('c1')).toBe(true);
    expect(limiter.allow('c1')).toBe(false);

    clock += 1_001;
    expect(limiter.allow('c1')).toBe(true);
  });

  it('conta cada conexão separadamente', () => {
    const clock = 1_000;
    const limiter = new RateLimiter(1, 1000, () => clock);

    expect(limiter.allow('c1')).toBe(true);
    expect(limiter.allow('c1')).toBe(false);
    expect(limiter.allow('c2')).toBe(true);
  });

  it('esquecer a conexão zera a contagem dela', () => {
    const clock = 1_000;
    const limiter = new RateLimiter(1, 1000, () => clock);

    expect(limiter.allow('c1')).toBe(true);
    expect(limiter.allow('c1')).toBe(false);
    limiter.forget('c1');
    expect(limiter.allow('c1')).toBe(true);
  });
});
