import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { SaveModule } from './save/save.module';
import { SocialModule } from './social/social.module';

@Module({
  imports: [AuthModule, SaveModule, ProfileModule, SocialModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
