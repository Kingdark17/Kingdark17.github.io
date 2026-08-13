import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { resolveSaveSigningSecret } from '../config/save-signing-secret';
import { DrizzleSaveRepository } from './drizzle-save-repository';
import { SaveController } from './save.controller';
import { SaveService } from './save.service';

@Module({
  imports: [AuthModule],
  controllers: [SaveController],
  providers: [
    {
      provide: SaveService,
      useFactory: () => new SaveService(new DrizzleSaveRepository(), resolveSaveSigningSecret()),
    },
  ],
})
export class SaveModule {}
