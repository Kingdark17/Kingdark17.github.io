import { Module } from '@nestjs/common';

import { RateLimiter } from '../common/rate-limiter';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { DrizzleSessionsRepository } from './drizzle-sessions-repository';
import { DrizzleUsersRepository } from './drizzle-users-repository';
import { AUTH_RATE_LIMITER, IP_ATTEMPT_LIMIT, IP_WINDOW_MS } from './ip-rate-limit.guard';

/** Mesma validade de sessão do accounts.js original: `NOW()+INTERVAL '30 days'`. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: AuthService,
      useFactory: () =>
        new AuthService(new DrizzleUsersRepository(), new DrizzleSessionsRepository(), {
          adminUsername: process.env.ADMIN_USERNAME || 'ADM',
          sessionTtlMs: SESSION_TTL_MS,
        }),
    },
    AuthGuard,
    // Instância única: as 12 tentativas por minuto são contadas juntas
    // entre registro e login, como no `attempts` de módulo do original.
    { provide: AUTH_RATE_LIMITER, useFactory: () => new RateLimiter(IP_ATTEMPT_LIMIT, IP_WINDOW_MS) },
  ],
  // AuthService/AuthGuard exportados pra outros módulos (ex: SaveModule) protegerem rotas com @UseGuards(AuthGuard).
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
