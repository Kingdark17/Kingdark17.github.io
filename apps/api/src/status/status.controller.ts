/**
 * `/api/account/status` e `/health` — as duas rotas de diagnóstico do
 * servidor original, as únicas que respondem sem sessão e sem banco.
 *
 * `/health` é o que monitor de uptime e o painel do host chamam; por isso
 * ele nunca pode depender do banco pra responder 200. Quem está fora do ar
 * aparece dentro do corpo (`accounts.connected`), não como erro HTTP. A
 * mesma regra vale pros campos que chegaram depois: nenhum deles pode
 * transformar uma sonda em erro.
 *
 * O corpo cresceu por um motivo. Duas coisas foram entregues e ficaram
 * inertes em produção sem ninguém perceber — a compressão do socket e a
 * persistência de sala —, e não havia como saber de fora, porque as três
 * perguntas que separariam as hipóteses não tinham resposta:
 *
 * - **Que commit está rodando?** `version` é constante escrita à mão.
 * - **A `REDIS_URL` chegou?** Sem ela a sala não sobrevive ao deploy, e o
 *   depósito engole o próprio erro de propósito — silêncio idêntico ao do
 *   caso em que tudo funciona.
 * - **A compressão foi negociada?** De fora, deploy velho e proxy que tira
 *   a extensão são indistinguíveis.
 *
 * Os campos antigos continuam onde estavam: quem já lê `online`, `rooms`,
 * `validation`, `version` ou `accounts` não quebra.
 */

import { Controller, Get, Inject } from '@nestjs/common';

import { RealtimeGateway } from '../realtime/realtime.gateway';
import { RoomRegistry } from '../realtime/room-registry';
import { REDIS, type ClienteRedis } from '../shared-state/cliente-redis';
import { probeDatabase } from './database-probe';
import { probeRedis } from './redis-probe';
import { versaoEmExecucao } from './versao-em-execucao';

const VERSION = 'nest-phase-2';

@Controller()
export class StatusController {
  constructor(
    private readonly rooms: RoomRegistry,
    private readonly gateway: RealtimeGateway,
    @Inject(REDIS) private readonly redis: ClienteRedis | null,
  ) {}

  @Get('api/account/status')
  accountStatus() {
    return probeDatabase();
  }

  @Get('health')
  async health() {
    // As duas sondas são ida e volta pela rede e não dependem uma da
    // outra; em série, o `/health` esperaria a soma das duas.
    const [accounts, redis] = await Promise.all([probeDatabase(), probeRedis(this.redis)]);
    const versao = versaoEmExecucao();

    return {
      online: true,
      rooms: this.rooms.size,
      validation: true,
      version: VERSION,
      commit: versao.commit,
      branch: versao.branch,
      accounts,
      // `redis.configured` é também o interruptor da persistência de sala:
      // é ele que decide qual depósito o `RoomRegistry` recebe.
      redis,
      socket: this.gateway.diagnosticoDoSocket,
    };
  }
}
