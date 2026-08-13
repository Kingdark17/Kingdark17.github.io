import { randomBytes } from 'node:crypto';

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DrizzleSaveRepository } from './drizzle-save-repository';
import { SaveController } from './save.controller';
import { SaveService } from './save.service';

/**
 * Mesma cadeia de fallback do accounts.js original pro segredo de
 * assinatura dos saves: `SAVE_SIGNING_SECRET`, senão `DATABASE_URL`,
 * senão um valor aleatório gerado uma vez por processo (o que invalida
 * saves assinados por uma execução anterior — comportamento herdado do
 * original, não uma escolha nova daqui).
 */
function resolveSigningSecret(): string {
  return process.env.SAVE_SIGNING_SECRET || process.env.DATABASE_URL || randomBytes(32).toString('hex');
}

@Module({
  imports: [AuthModule],
  controllers: [SaveController],
  providers: [
    {
      provide: SaveService,
      useFactory: () => new SaveService(new DrizzleSaveRepository(), resolveSigningSecret()),
    },
  ],
})
export class SaveModule {}
