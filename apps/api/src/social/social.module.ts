import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { REDIS, type ClienteRedis } from '../shared-state/cliente-redis';
import { PresencaLocal, PresencaNoRedis } from '../shared-state/presenca';
import { SharedStateModule } from '../shared-state/shared-state.module';
import { AvatarController } from './avatar.controller';
import { DrizzleSocialRepository } from './drizzle-social-repository';
import { OnlineUsersRegistry } from './online-users-registry';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  imports: [AuthModule, SharedStateModule],
  // `AvatarController` é o único sem `AuthGuard`: `<img src>` não manda
  // cabeçalho de sessão. Ver o comentário do arquivo.
  controllers: [SocialController, AvatarController],
  providers: [
    {
      // Sem `REDIS_URL` a presença é a desta instância, como sempre foi.
      // Com ela, um amigo conectado em outra instância também conta —
      // e o evento chega nele. Ver `shared-state/presenca.ts`.
      provide: OnlineUsersRegistry,
      useFactory: (redis: ClienteRedis | null) => new OnlineUsersRegistry(redis ? new PresencaNoRedis(redis) : new PresencaLocal()),
      inject: [REDIS],
    },
    {
      // O mesmo registro serve de presença e de notificador: quem está
      // conectado e pra onde empurrar o evento são a mesma informação.
      provide: SocialService,
      useFactory: (online: OnlineUsersRegistry) => new SocialService(new DrizzleSocialRepository(), online, online),
      inject: [OnlineUsersRegistry],
    },
  ],
  // O gateway de tempo real registra/remove conexões neste mesmo registro.
  exports: [SocialService, OnlineUsersRegistry],
})
export class SocialModule {}
