import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DrizzleSocialRepository } from './drizzle-social-repository';
import { OnlineUsersRegistry } from './online-users-registry';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  imports: [AuthModule],
  controllers: [SocialController],
  providers: [
    { provide: OnlineUsersRegistry, useFactory: () => new OnlineUsersRegistry() },
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
