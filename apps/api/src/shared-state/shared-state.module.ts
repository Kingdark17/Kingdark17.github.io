/**
 * A conexão com o Redis, num lugar só, pra quem precisa dela pedir por
 * injeção em vez de abrir a sua.
 *
 * O provider resolve pra `null` quando não há `REDIS_URL`, e cada peça
 * escolhe a sua versão em memória — é o mesmo acordo do banco: **o app
 * sobe e funciona sem a variável**, com o estado no processo, como antes
 * desta fase.
 */

import { Module } from '@nestjs/common';

import { criarClienteRedis, REDIS } from './cliente-redis';

@Module({
  providers: [{ provide: REDIS, useFactory: criarClienteRedis }],
  exports: [REDIS],
})
export class SharedStateModule {}
