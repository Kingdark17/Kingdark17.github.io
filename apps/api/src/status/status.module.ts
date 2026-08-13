/**
 * Rotas de diagnóstico. Importa o `RealtimeModule` só pra contar salas
 * abertas no `/health`, igual o original fazia com `rooms.size`.
 */

import { Module } from '@nestjs/common';

import { RealtimeModule } from '../realtime/realtime.module';
import { StatusController } from './status.controller';

@Module({
  imports: [RealtimeModule],
  controllers: [StatusController],
})
export class StatusModule {}
