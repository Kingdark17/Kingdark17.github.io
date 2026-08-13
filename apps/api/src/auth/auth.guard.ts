/**
 * Guard reusável por qualquer rota protegida — equivalente ao bloco
 * `const user=await session(req);if(!user){...401...}` repetido antes de
 * cada rota não-pública em accounts.js. Anexa o usuário resolvido em
 * `request.user`, pra `@CurrentUser()` ler depois.
 */

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { extractBearerToken } from './bearer-token';
import type { SafeUser } from './cosmetics';

export type RequestWithUser = Request & { user?: SafeUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const result = await this.authService.me(extractBearerToken(request.headers.authorization));
    if (result.kind === 'unauthenticated') {
      throw new UnauthorizedException({ error: 'Entre novamente na sua conta.' });
    }
    request.user = result.user;
    return true;
  }
}
