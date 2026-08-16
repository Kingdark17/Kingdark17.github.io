/**
 * O que interessa aqui é a fiação, não o decode (isso é `avatar.spec.ts`):
 * a rota responde **sem sessão**, e o `Cache-Control` que ela escreve
 * sobrevive ao `NoStoreInterceptor`, que põe `no-store` em toda resposta
 * de `/api/*`. Se essa parte quebrar, o navegador volta a rebaixar a foto
 * toda vez e a otimização inteira vira nada — sem nenhum teste falhar em
 * outro lugar.
 */

import { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { configureApp } from '../bootstrap';
import type { AvatarDecodificado } from './avatar';
import { AvatarController } from './avatar.controller';
import { SocialService } from './social.service';

const BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('GET /api/users/:username/avatar', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const service = {
      findAvatar: (username: string): Promise<AvatarDecodificado | null> =>
        Promise.resolve(username.toLowerCase() === 'aria' ? { mime: 'image/png', bytes: BYTES } : null),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AvatarController],
      providers: [{ provide: SocialService, useValue: service }],
    }).compile();

    app = configureApp(moduleRef.createNestApplication<NestExpressApplication>());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serve a imagem sem exigir sessão', async () => {
    const resposta = await request(app.getHttpServer()).get('/api/users/Aria/avatar?v=abc123');

    expect(resposta.status).toBe(200);
    expect(resposta.headers['content-type']).toBe('image/png');
    expect(Buffer.from(resposta.body as Buffer)).toEqual(BYTES);
  });

  it('com versão no endereço, manda guardar por muito tempo — e não `no-store`', async () => {
    const resposta = await request(app.getHttpServer()).get('/api/users/Aria/avatar?v=abc123');

    expect(resposta.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('sem versão no endereço não guarda: não haveria como saber que a foto mudou', async () => {
    const resposta = await request(app.getHttpServer()).get('/api/users/Aria/avatar');

    expect(resposta.headers['cache-control']).toBe('no-cache');
  });

  it('404 pra quem não tem foto enviada', async () => {
    const resposta = await request(app.getHttpServer()).get('/api/users/Bram/avatar');

    expect(resposta.status).toBe(404);
    expect(resposta.body).toEqual({ error: 'Foto não encontrada.' });
  });
});
