/**
 * `/api/account/status` e `/health` — as duas rotas de diagnóstico do
 * servidor original, as únicas que respondem sem sessão e sem banco.
 *
 * `/health` é o que monitor de uptime e o painel do host chamam; por isso
 * ele nunca pode depender do banco pra responder 200. Quem está fora do ar
 * aparece dentro do corpo (`accounts.connected`), não como erro HTTP.
 */

import { Controller, Get } from '@nestjs/common';

import { RoomRegistry } from '../realtime/room-registry';
import { probeDatabase } from './database-probe';

const VERSION = 'nest-phase-2';

@Controller()
export class StatusController {
  constructor(private readonly rooms: RoomRegistry) {}

  @Get('api/account/status')
  accountStatus() {
    return probeDatabase();
  }

  @Get('health')
  async health() {
    return {
      online: true,
      rooms: this.rooms.size,
      validation: true,
      version: VERSION,
      accounts: await probeDatabase(),
    };
  }
}
