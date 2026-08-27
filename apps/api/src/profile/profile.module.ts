import { Module } from '@nestjs/common';

import { criarArmazenamento } from '../arquivos/armazenamento';
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
        // Sem `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` isto é o armazenamento
        // nulo, e a foto continua indo pro Postgres como sempre foi.
        return new ProfileService(new DrizzleProfileRepository(adminUsername), adminUsername, resolveSaveSigningSecret(), criarArmazenamento());
      },
    },
  ],
})
export class ProfileModule {}
