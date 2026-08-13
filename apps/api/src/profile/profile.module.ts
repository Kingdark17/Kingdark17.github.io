import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { resolveSaveSigningSecret } from '../config/save-signing-secret';
import { DrizzleProfileRepository } from './drizzle-profile-repository';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [AuthModule],
  controllers: [ProfileController],
  providers: [
    {
      provide: ProfileService,
      useFactory: () => {
        const adminUsername = process.env.ADMIN_USERNAME || 'ADM';
        return new ProfileService(new DrizzleProfileRepository(adminUsername), adminUsername, resolveSaveSigningSecret());
      },
    },
  ],
})
export class ProfileModule {}
