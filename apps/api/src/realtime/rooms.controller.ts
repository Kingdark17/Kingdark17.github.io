/**
 * `GET /api/rooms` — lista de salas públicas esperando parceiro, mesma
 * rota e mesma forma de resposta (`{rooms:[{code,hostName}]}`) do
 * server.js original. Sem autenticação, igual ao original: é a vitrine
 * que o menu de multiplayer lê antes de entrar em qualquer sala.
 */

import { Controller, Get } from '@nestjs/common';

import { RoomRegistry } from './room-registry';

@Controller()
export class RoomsController {
  constructor(private readonly rooms: RoomRegistry) {}

  @Get('api/rooms')
  listRooms() {
    return { rooms: this.rooms.listPublic() };
  }
}
