/**
 * Carrega o `.env` **antes de qualquer outro import**, e a ordem aqui é
 * obrigatória, não estilo.
 *
 * Decorador é avaliado quando o módulo é importado, não quando o Nest sobe.
 * O `@WebSocketGateway({ cors: lerCors() })` do gateway lê o ambiente nesse
 * instante — se o `.env` entrar depois, ele já congelou a configuração
 * errada e o cookie de sessão não atravessa no socket.
 *
 * Em produção não existe `.env`, e o `dotenv` simplesmente não acha nada:
 * as variáveis vêm da hospedagem e não são sobrescritas.
 *
 * Isto faltava desde a fase 5. O `.env` era lido pelo `drizzle-kit`, que
 * carrega sozinho, e por scripts que fazem o parsing na mão — mas nunca
 * pelo processo da API, que subia sem `DATABASE_URL` e respondia
 * `{"configured":false}` em desenvolvimento.
 */
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  await app.listen(process.env.PORT ?? 3000);
}

// Sem o `catch`, uma falha ao subir (porta ocupada, por exemplo) virava
// rejeição não tratada: o processo morria sem dizer o que houve.
bootstrap().catch((err) => {
  console.error('Falha ao subir a API:', err);
  process.exit(1);
});
