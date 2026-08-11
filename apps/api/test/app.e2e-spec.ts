import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ online: true, engine: '@rpg-legend/shared' });
  });

  it('/smoke/derived (GET) devolve os números da engine compartilhada', () => {
    return request(app.getHttpServer())
      .get('/smoke/derived')
      .expect(200)
      .expect((res: { body: Record<string, number> }) => {
        expect(res.body.maxHp).toBe(205);
        expect(res.body.maxMp).toBe(66);
        expect(res.body.xpNext).toBe(110);
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
