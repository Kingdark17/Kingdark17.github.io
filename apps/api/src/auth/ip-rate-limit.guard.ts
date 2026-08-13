/**
 * Teto de tentativas por IP — porta do `limited()` do accounts.js
 * original: 12 requisições por minuto, contadas juntas entre todas as
 * rotas protegidas por ele (registro, login e, quando existirem, as de
 * recuperação de senha). Estourou, responde
 * `429 {error:'Muitas tentativas. Aguarde um minuto.'}`.
 *
 * Contagem única e compartilhada porque o guard é um provider singleton:
 * gastar as 12 tentativas no login não libera mais 12 no registro, igual
 * ao `attempts` de módulo do original.
 *
 * Limitação herdada do original, que vale registrar: a chave é o IP visto
 * pelo servidor. Atrás de proxy (Render, Vercel) isso é o IP do proxy, e
 * o limite viraria global — quando a API for pro ar é preciso ligar
 * `trust proxy` no Express pra `req.ip` voltar a ser o do cliente.
 */

import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { RateLimiter } from '../common/rate-limiter';

export const IP_ATTEMPT_LIMIT = 12;
export const IP_WINDOW_MS = 60_000;

/**
 * O contador entra por token porque o Nest instancia guard declarado em
 * `@UseGuards` por conta própria, sem passar pelos providers registrados
 * com o próprio guard como token — quem precisa ser singleton do módulo é
 * o `RateLimiter`, não o guard.
 */
export const AUTH_RATE_LIMITER = Symbol('AUTH_RATE_LIMITER');

@Injectable()
export class IpRateLimitGuard implements CanActivate {
  constructor(@Inject(AUTH_RATE_LIMITER) private readonly limiter: RateLimiter) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<Request>();
    const key = request.ip || request.socket?.remoteAddress || 'unknown';
    if (this.limiter.allow(key)) return true;

    throw new HttpException({ error: 'Muitas tentativas. Aguarde um minuto.' }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
