/**
 * Configuração que vale pro app inteiro, exercitada por HTTP de verdade:
 * é o único jeito de pegar regressão em CORS e cabeçalho de cache, que
 * não aparecem em teste de unidade nenhum.
 *
 * Roda sem `DATABASE_URL` de propósito — inclusive a parte que verifica
 * que rota de banco responde 503 limpo em vez de estourar 500.
 */

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

describe('configureApp', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('libera CORS pra o jogo em outro domínio', async () => {
    const response = await request(app.getHttpServer()).get('/api/rooms').set('Origin', 'https://kingdark17.github.io');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('*');
  });

  it('responde o preflight com os métodos e cabeçalhos que o cliente usa', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/save')
      .set('Origin', 'https://kingdark17.github.io')
      .set('Access-Control-Request-Method', 'PUT');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-methods']).toBe('GET,POST,PUT,OPTIONS');
    expect(response.headers['access-control-allow-headers']).toBe('Content-Type, Authorization');
  });

  it('marca no-store em /api e deixa o resto em paz', async () => {
    const api = await request(app.getHttpServer()).get('/api/rooms');
    expect(api.headers['cache-control']).toBe('no-store');

    const health = await request(app.getHttpServer()).get('/health');
    expect(health.headers['cache-control']).toBeUndefined();
  });

  it('rota que precisa do banco responde 503 sem DATABASE_URL', async () => {
    const response = await request(app.getHttpServer()).post('/api/account/login').send({ username: 'aria', password: 'segredo123' });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'O banco de dados de contas ainda não foi configurado.' });
  });
});
