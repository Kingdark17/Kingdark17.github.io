/**
 * O guard em si está coberto em `ip-rate-limit.guard.spec.ts`; aqui o que
 * se verifica é a fiação: que as rotas certas estão protegidas e que as
 * duas dividem o mesmo contador, como no `attempts` do original.
 *
 * Sem `DATABASE_URL` as tentativas liberadas respondem 503 — o que
 * importa é a 13ª virar 429 antes de chegar no banco.
 */

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../app.module';
import { configureApp } from '../bootstrap';
import { IP_ATTEMPT_LIMIT } from './ip-rate-limit.guard';
import { servidorDe } from '../testing/servidor';

describe('rate limit por IP nas rotas de conta', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registro e login dividem as 12 tentativas por minuto', async () => {
    const server = servidorDe(app);
    const login = () => request(server).post('/api/account/login').send({ username: 'aria', password: 'segredo123' });
    const register = () => request(server).post('/api/account/register').send({ username: 'aria', email: 'a@b.co', password: 'segredo123' });

    for (let i = 0; i < IP_ATTEMPT_LIMIT / 2; i += 1) {
      expect((await login()).status).not.toBe(429);
      expect((await register()).status).not.toBe(429);
    }

    const barrado = await login();
    expect(barrado.status).toBe(429);
    expect(barrado.body).toEqual({ error: 'Muitas tentativas. Aguarde um minuto.' });

    // Rota sem o guard continua respondendo normalmente.
    expect((await request(server).get('/api/account/status')).status).toBe(200);
  });
});

/**
 * O teto é por IP, e atrás de proxy o IP que o Express vê é o do proxy —
 * o que faria as 12 tentativas serem somadas entre os jogadores. Os dois
 * testes abaixo existem em par de propósito: um mostra o estrago, o
 * outro mostra o conserto. Ver `lerTrustProxy` em `bootstrap.ts`.
 */
describe('atrás de proxy', () => {
  const guardado = process.env.TRUST_PROXY;

  const subir = async (): Promise<INestApplication> => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = configureApp(moduleRef.createNestApplication());
    await app.init();
    return app;
  };

  const tentarComo = (app: INestApplication, ip: string) =>
    request(servidorDe(app)).post('/api/account/login').set('X-Forwarded-For', ip).send({ username: 'aria', password: 'segredo123' });

  afterEach(() => {
    if (guardado === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = guardado;
  });

  it('sem TRUST_PROXY, um jogador sozinho tranca o login dos outros', async () => {
    delete process.env.TRUST_PROXY;
    const app = await subir();

    for (let i = 0; i < IP_ATTEMPT_LIMIT; i += 1) expect((await tentarComo(app, '203.0.113.7')).status).not.toBe(429);

    // Outro jogador, outro IP — e mesmo assim barrado, porque o contador
    // ficou na chave do proxy. É o comportamento que o TRUST_PROXY corrige.
    expect((await tentarComo(app, '203.0.113.9')).status).toBe(429);
    await app.close();
  });

  it('com TRUST_PROXY, cada jogador tem o teto dele', async () => {
    process.env.TRUST_PROXY = '1';
    const app = await subir();

    for (let i = 0; i < IP_ATTEMPT_LIMIT; i += 1) expect((await tentarComo(app, '203.0.113.7')).status).not.toBe(429);

    expect((await tentarComo(app, '203.0.113.7')).status).toBe(429);
    expect((await tentarComo(app, '203.0.113.9')).status).not.toBe(429);
    await app.close();
  });
});
