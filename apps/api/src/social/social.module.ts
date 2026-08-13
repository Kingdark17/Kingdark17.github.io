import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AlwaysOfflinePresenceChecker } from './presence-checker';
import { DrizzleSocialRepository } from './drizzle-social-repository';
import { NoopSocialNotifier } from './social-notifier';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  imports: [AuthModule],
  controllers: [SocialController],
  providers: [
    {
      provide: SocialService,
      useFactory: () => new SocialService(new DrizzleSocialRepository(), new NoopSocialNotifier(), new AlwaysOfflinePresenceChecker()),
    },
  ],
})
export class SocialModule {}
