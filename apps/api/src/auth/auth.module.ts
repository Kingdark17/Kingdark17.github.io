import { Module } from '@nestjs/common';

import { REDIS, type ClienteRedis } from '../shared-state/cliente-redis';
import { ContadorEmMemoria, ContadorNoRedis } from '../shared-state/contador';
import { SharedStateModule } from '../shared-state/shared-state.module';
import { AccountEmailController } from './account-email.controller';
import { AccountEmailService } from './account-email.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { DrizzleAccountEmailRepository } from './drizzle-account-email-repository';
import { DrizzleSessionsRepository } from './drizzle-sessions-repository';
import { DrizzleUsersRepository } from './drizzle-users-repository';
import { ResendEmailSender } from './email-sender';
import { normalizePublicGameUrl } from './email-templates';
import { AUTH_RATE_LIMITER, IP_ATTEMPT_LIMIT, IP_WINDOW_MS } from './ip-rate-limit.guard';
import { SESSION_TTL_MS } from './tokens';

function adminUsername(): string {
  return process.env.ADMIN_USERNAME || 'ADM';
}

@Module({
  imports: [SharedStateModule],
  controllers: [AuthController, AccountEmailController],
  providers: [
    {
      provide: AccountEmailService,
      useFactory: () =>
        new AccountEmailService(new DrizzleAccountEmailRepository(), new ResendEmailSender(), {
          adminUsername: adminUsername(),
          publicGameUrl: normalizePublicGameUrl(process.env.PUBLIC_GAME_URL),
        }),
    },
    {
      // O cadastro manda o e-mail de confirmação, como no original — daí
      // `AccountEmailService` entrar aqui como emissor.
      provide: AuthService,
      useFactory: (accountEmail: AccountEmailService) =>
        new AuthService(
          new DrizzleUsersRepository(),
          new DrizzleSessionsRepository(),
          { adminUsername: adminUsername(), sessionTtlMs: SESSION_TTL_MS },
          Date.now,
          accountEmail,
        ),
      inject: [AccountEmailService],
    },
    AuthGuard,
    // Instância única: as 12 tentativas por minuto são contadas juntas
    // entre registro, login e as rotas de recuperação de senha, como no
    // `attempts` de módulo do original. Com `REDIS_URL`, contadas juntas
    // também entre instâncias — senão o teto se multiplicaria por elas.
    {
      provide: AUTH_RATE_LIMITER,
      useFactory: (redis: ClienteRedis | null) =>
        redis ? new ContadorNoRedis(redis, IP_ATTEMPT_LIMIT, IP_WINDOW_MS) : new ContadorEmMemoria(IP_ATTEMPT_LIMIT, IP_WINDOW_MS),
      inject: [REDIS],
    },
  ],
  // AuthService/AuthGuard exportados pra outros módulos (ex: SaveModule) protegerem rotas com @UseGuards(AuthGuard).
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
