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
