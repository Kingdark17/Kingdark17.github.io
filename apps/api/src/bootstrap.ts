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

/**
 * Traduz `TRUST_PROXY` pro que o Express espera, ou `null` pra não mexer.
 *
 * **Por que é opt-in e não ligado sempre.** As duas pontas erram feio:
 *
 * - Desligado atrás de proxy, `req.ip` é o IP do proxy. O teto de 12
 *   tentativas por minuto do `IpRateLimitGuard` passa a ser somado entre
 *   os jogadores, e meia dúzia deles logando junto tranca o login geral.
 * - Ligado sem proxy na frente, qualquer cliente manda o cabeçalho
 *   `X-Forwarded-For` que quiser e escolhe o próprio IP — o teto deixa de
 *   existir, que é pior que o primeiro caso.
 *
 * Não há como adivinhar qual é o certo lendo o processo: depende de onde
 * ele foi hospedado. Daí ser uma decisão declarada no ambiente, com o
 * padrão sendo o comportamento de hoje.
 *
 * Valores: um número (quantos proxies confiar — `1` serve pra
 * praticamente toda hospedagem gerenciada), `true` (confia em todos, só
 * se você souber o que está fazendo), ou qualquer expressão que o Express
 * aceite (`loopback`, lista de IPs/CIDRs separada por vírgula).
 */
export function lerTrustProxy(bruto = process.env.TRUST_PROXY): boolean | number | string | null {
  const valor = bruto?.trim();
  if (!valor || valor === 'false') return null;
  if (valor === 'true') return true;
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 0 ? numero : valor;
}

export function configureApp(app: NestExpressApplication): NestExpressApplication {
  const trustProxy = lerTrustProxy();
  if (trustProxy !== null) app.set('trust proxy', trustProxy);
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
