/**
 * Configuração que vale pro app inteiro, num lugar só, pra o `main.ts` e
 * os testes de ponta a ponta subirem exatamente a mesma coisa. Sem isso o
 * CORS só existiria em produção e nenhum teste pegaria uma regressão.
 *
 * CORS reproduz os cabeçalhos que o `json()` do accounts.js original
 * mandava em toda resposta. Não é detalhe: o jogo é servido pelo GitHub
 * Pages e a API mora em outro domínio, então sem isso o navegador
 * bloqueia toda chamada antes mesmo de sair.
 *
 * `ALLOWED_ORIGIN` continua caindo pra `*` quando não definida, como no
 * original — vale apertar isso pra o domínio do jogo quando a API for
 * pro ar, mas trocar o padrão agora quebraria o cliente atual.
 */

import type { NestExpressApplication } from '@nestjs/platform-express';

import { DatabaseNotConfiguredFilter } from './common/database-not-configured.filter';
import { NoStoreInterceptor } from './common/no-store.interceptor';

/**
 * Mesmo teto do `body()` do accounts.js original. O padrão do Express é
 * 100 KB, que não dá conta de dois corpos que o cliente manda todo dia: o
 * save completo em `PUT /api/save` e a foto de perfil em base64 (até ~400
 * KB depois da compressão que `compressPhoto()` faz no navegador).
 */
export const MAX_BODY_BYTES = 700_000;

export function configureApp(app: NestExpressApplication): NestExpressApplication {
  app.useBodyParser('json', { limit: MAX_BODY_BYTES });
  app.enableCors({
    origin: process.env.ALLOWED_ORIGIN || '*',
    methods: 'GET,POST,PUT,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
  });
  app.useGlobalInterceptors(new NoStoreInterceptor());
  app.useGlobalFilters(new DatabaseNotConfiguredFilter());
  return app;
}
