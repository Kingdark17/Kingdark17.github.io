/**
 * Fiação das rotas de e-mail. Sem `DATABASE_URL` o que dá pra afirmar é
 * quais rotas existem e quais exigem sessão — as respostas de sucesso
 * dependem do banco e estão cobertas em `account-email.service.spec.ts`
 * contra um repositório em memória.
 */

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../app.module';
import { configureApp } from '../bootstrap';

describe('rotas de e-mail e recuperação de senha', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('as cinco rotas do original existem', async () => {
    const server = app.getHttpServer();
    const respostas = await Promise.all([
      request(server).post('/api/account/verify-email').send({ token: 'x' }),
      request(server).post('/api/account/request-password-reset').send({ email: 'a@b.co' }),
      request(server).post('/api/account/reset-password').send({ token: 'x', password: 'senhanova123' }),
      request(server).put('/api/account/email').send({ email: 'a@b.co', password: 'segredo123' }),
      request(server).post('/api/account/resend-verification').send({}),
    ]);

    for (const resposta of respostas) expect(resposta.status).not.toBe(404);
  });

  it('trocar e-mail e reenviar confirmação exigem sessão', async () => {
    const server = app.getHttpServer();

    const semSessao = await request(server).put('/api/account/email').send({ email: 'a@b.co', password: 'segredo123' });
    expect(semSessao.status).toBe(401);

    const reenvio = await request(server).post('/api/account/resend-verification').send({});
    expect(reenvio.status).toBe(401);
  });

  it('senha curta é recusada antes de chegar no banco', async () => {
    const resposta = await request(app.getHttpServer()).post('/api/account/reset-password').send({ token: 'x', password: 'curta' });

    expect(resposta.status).toBe(400);
    expect(resposta.body).toEqual({ error: 'A senha precisa ter entre 8 e 128 caracteres.' });
  });

  it('o guard de sessão roda antes de olhar o corpo', async () => {
    // Corpo inválido + sem sessão responde 401, não 400: quem não está
    // autenticado não recebe pista nenhuma sobre a validação.
    const resposta = await request(app.getHttpServer()).put('/api/account/email').send({ email: 'sem-arroba', password: 'x' });

    expect(resposta.status).toBe(401);
  });
});
