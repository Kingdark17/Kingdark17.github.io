import { ExecutionContext, HttpException } from '@nestjs/common';

import { RateLimiter } from '../common/rate-limiter';
import { IP_ATTEMPT_LIMIT, IP_WINDOW_MS, IpRateLimitGuard } from './ip-rate-limit.guard';

function httpContext(ip: string | undefined, remoteAddress?: string): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ ip, socket: { remoteAddress } }) }),
  } as unknown as ExecutionContext;
}

function makeGuard(clock: () => number) {
  return new IpRateLimitGuard(new RateLimiter(IP_ATTEMPT_LIMIT, IP_WINDOW_MS, clock));
}

describe('IpRateLimitGuard', () => {
  it('libera 12 tentativas por minuto e barra a 13ª com 429', () => {
    const now = 1_000;
    const guard = makeGuard(() => now);
    const context = httpContext('203.0.113.7');

    for (let i = 0; i < IP_ATTEMPT_LIMIT; i += 1) expect(guard.canActivate(context)).toBe(true);

    try {
      guard.canActivate(context);
      fail('esperava HttpException');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(429);
      expect((err as HttpException).getResponse()).toEqual({ error: 'Muitas tentativas. Aguarde um minuto.' });
    }
  });

  it('libera de novo depois que a janela de um minuto passa', () => {
    let now = 1_000;
    const guard = makeGuard(() => now);
    const context = httpContext('203.0.113.7');

    for (let i = 0; i < IP_ATTEMPT_LIMIT; i += 1) guard.canActivate(context);
    expect(() => guard.canActivate(context)).toThrow(HttpException);

    now += IP_WINDOW_MS + 1;
    expect(guard.canActivate(context)).toBe(true);
  });

  it('conta cada IP separadamente', () => {
    const guard = makeGuard(() => 1_000);
    for (let i = 0; i < IP_ATTEMPT_LIMIT; i += 1) guard.canActivate(httpContext('203.0.113.7'));

    expect(guard.canActivate(httpContext('198.51.100.4'))).toBe(true);
  });

  it('cai pro endereço do socket quando req.ip não existe', () => {
    const guard = makeGuard(() => 1_000);
    const context = httpContext(undefined, '198.51.100.9');

    for (let i = 0; i < IP_ATTEMPT_LIMIT; i += 1) expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(HttpException);
    // Sem IP nenhum a chave vira 'unknown', que é balde separado.
    expect(guard.canActivate(httpContext(undefined, undefined))).toBe(true);
  });

  it('não interfere fora do contexto HTTP', () => {
    const guard = makeGuard(() => 1_000);
    const wsContext = { getType: () => 'ws' } as unknown as ExecutionContext;

    for (let i = 0; i < IP_ATTEMPT_LIMIT + 5; i += 1) expect(guard.canActivate(wsContext)).toBe(true);
  });
});
