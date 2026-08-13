import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../app.module';

describe('StatusController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/account/status diz que o banco não está configurado, sem erro', async () => {
    const response = await request(app.getHttpServer()).get('/api/account/status');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ configured: false, connected: false });
  });

  it('/health responde 200 mesmo com o banco fora', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      online: true,
      rooms: 0,
      validation: true,
      accounts: { configured: false, connected: false },
    });
  });
});
