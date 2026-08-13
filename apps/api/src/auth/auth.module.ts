import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DrizzleSessionsRepository } from './drizzle-sessions-repository';
import { DrizzleUsersRepository } from './drizzle-users-repository';

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
  ],
})
export class AuthModule {}
