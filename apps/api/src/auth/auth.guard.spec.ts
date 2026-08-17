import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';

import { AuthGuard, type RequestWithUser } from './auth.guard';
import type { AuthService, MeResult } from './auth.service';
import type { SafeUser } from './cosmetics';

const SOME_USER: SafeUser = {
  id: 1,
  username: 'Jogador1',
  isAdmin: false,
  email: 'a@b.com',
  emailVerified: true,
  avatarUrl: '',
  frame: 'none',
  nameColor: '#e8d7a5',
  pet: 'none',
  cosmetics: { frames: ['none'], colors: ['#e8d7a5'], pets: ['none'] },
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

function makeContext(authorization: string | undefined): { context: ExecutionContext; request: RequestWithUser } {
  const request = { headers: { authorization } } as RequestWithUser;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

function makeFakeAuthService(meResult: MeResult): AuthService {
  return { me: () => Promise.resolve(meResult) } as unknown as AuthService;
}

describe('AuthGuard', () => {
  it('permite a requisição e anexa o usuário quando o token é válido', async () => {
    const guard = new AuthGuard(makeFakeAuthService({ kind: 'ok', user: SOME_USER }));
    const { context, request } = makeContext('Bearer algum-token-valido');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBe(SOME_USER);
  });

  it('rejeita com 401 quando não autenticado', async () => {
    const guard = new AuthGuard(makeFakeAuthService({ kind: 'unauthenticated' }));
    const { context } = makeContext('Bearer token-invalido');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejeita quando não há cabeçalho Authorization', async () => {
    const guard = new AuthGuard(makeFakeAuthService({ kind: 'unauthenticated' }));
    const { context } = makeContext(undefined);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
