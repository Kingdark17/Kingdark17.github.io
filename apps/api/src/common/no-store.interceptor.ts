/**
 * `Cache-Control: no-store` em toda resposta de `/api/*`, como o
 * `json()` do accounts.js original fazia. Save na nuvem, lista de amigos
 * e sessão não podem ficar em cache de navegador nem de CDN: já bastaria
 * uma resposta reaproveitada pra alguém ver progresso velho como se
 * fosse o atual.
 *
 * Fora de `/api/*` (hoje só `/health` e a rota de fumaça) não mexe.
 */

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';

@Injectable()
export class NoStoreInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const http = context.switchToHttp();
      if (http.getRequest<Request>().path.startsWith('/api/')) {
        http.getResponse<Response>().setHeader('Cache-Control', 'no-store');
      }
    }
    return next.handle();
  }
}
