/**
 * `app.getHttpServer()` é declarado `any` na tipagem do Nest. Todo uso
 * em cima disso — `request(server)`, `server.address()` — vira "unsafe"
 * pro ESLint, e o aviso é justo: `any` desliga a checagem inteira no
 * meio de um teste de ponta a ponta, que é justamente onde um engano de
 * tipo passa despercebido.
 *
 * Aqui ele ganha o tipo que de fato tem, num lugar só.
 */

import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

export function servidorDe(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}
