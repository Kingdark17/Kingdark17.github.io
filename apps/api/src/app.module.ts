import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { SaveModule } from './save/save.module';

@Module({
  imports: [AuthModule, SaveModule, ProfileModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
