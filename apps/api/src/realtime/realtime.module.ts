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
import { SocialModule } from '../social/social.module';
import { RealtimeGateway } from './realtime.gateway';
import { RoomRegistry } from './room-registry';
import { RoomsController } from './rooms.controller';

@Module({
  imports: [AuthModule, SocialModule],
  controllers: [RoomsController],
  providers: [{ provide: RoomRegistry, useFactory: () => new RoomRegistry() }, RealtimeGateway],
  // `/health` conta as salas abertas a partir do mesmo registro.
  exports: [RoomRegistry],
})
export class RealtimeModule {}
