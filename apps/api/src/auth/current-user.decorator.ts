import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { RequestWithUser } from './auth.guard';
import type { SafeUser } from './cosmetics';

/** Só funciona atrás de `@UseGuards(AuthGuard)`, que é quem preenche `request.user`. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): SafeUser => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  return request.user as SafeUser;
});
