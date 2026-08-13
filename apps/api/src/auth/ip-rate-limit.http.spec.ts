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
    const server = app.getHttpServer();
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
