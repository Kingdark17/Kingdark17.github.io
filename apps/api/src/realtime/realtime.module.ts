/**
 * Camada de tempo real: gateway socket.io + a vitrine HTTP de salas
 * públicas, ambos em cima do mesmo `RoomRegistry` em memória.
 *
 * Presença e chat vêm do `SocialModule` (o mesmo `OnlineUsersRegistry`
 * que responde `online: true` em `/api/friends`), então a dependência
 * anda num sentido só: realtime → social. Nada em `social/` importa
 * daqui.
 *
 * `RealtimeGateway` é registrado como provider de classe, não por
 * fábrica: o Nest só reconhece um gateway lendo o metadado da classe em
 * `wrapper.metatype`, e provider por fábrica não tem metatype de classe.
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { REDIS, type ClienteRedis } from '../shared-state/cliente-redis';
import { SharedStateModule } from '../shared-state/shared-state.module';
import { SocialModule } from '../social/social.module';
import { DepositoNoRedis, DepositoNulo } from './deposito-de-salas';
import { RealtimeGateway } from './realtime.gateway';
import { RoomRegistry } from './room-registry';
import { RoomsController } from './rooms.controller';

@Module({
  imports: [AuthModule, SocialModule, SharedStateModule],
  controllers: [RoomsController],
  providers: [
    {
      // Com `REDIS_URL`, a sala sobrevive a um reinício da API: hoje todo
      // deploy apaga as partidas em andamento junto com o processo. Sem a
      // variável, `DepositoNulo` e tudo se comporta como antes.
      provide: RoomRegistry,
      useFactory: (redis: ClienteRedis | null) => new RoomRegistry(redis ? new DepositoNoRedis(redis) : new DepositoNulo()),
      inject: [REDIS],
    },
    RealtimeGateway,
  ],
  // `/health` conta as salas abertas a partir do mesmo registro, e lê no
  // gateway se a compressão do socket foi negociada de verdade.
  exports: [RoomRegistry, RealtimeGateway],
})
export class RealtimeModule {}
