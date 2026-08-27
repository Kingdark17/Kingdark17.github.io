/**
 * Rotas de diagnóstico. Importa o `RealtimeModule` pra contar salas
 * abertas no `/health` (igual o original fazia com `rooms.size`) e pra
 * perguntar ao gateway se a compressão do socket pegou; o
 * `SharedStateModule` entra por causa do `REDIS`, que o `RealtimeModule`
 * usa mas não reexporta.
 */

import { Module } from '@nestjs/common';

import { RealtimeModule } from '../realtime/realtime.module';
import { SharedStateModule } from '../shared-state/shared-state.module';
import { StatusController } from './status.controller';

@Module({
  imports: [RealtimeModule, SharedStateModule],
  controllers: [StatusController],
})
export class StatusModule {}
