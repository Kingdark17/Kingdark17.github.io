import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../app.module';
import { servidorDe } from '../testing/servidor';

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
    const response = await request(servidorDe(app)).get('/api/account/status');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ configured: false, connected: false });
  });

  it('/health responde 200 mesmo com o banco fora', async () => {
    const response = await request(servidorDe(app)).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      online: true,
      rooms: 0,
      validation: true,
      accounts: { configured: false, connected: false },
    });
  });

  /**
   * Sem `REDIS_URL` a sala não sobrevive a um deploy, e o depósito engole
   * o próprio erro de propósito — o silêncio é igualzinho ao do caso em
   * que tudo funciona. Este campo é o que separa os dois.
   */
  it('/health diz se o Redis chegou até o processo', async () => {
    const response = await request(servidorDe(app)).get('/health');

    expect(response.body).toMatchObject({ redis: { configured: false, connected: false } });
  });

  /**
   * Sem as variáveis do host, `null`. O que importa é que os campos
   * **apareçam** no corpo: `undefined` sumiria do JSON e o campo pareceria
   * nunca ter existido — a mesma falha calada que ele veio consertar.
   */
  it('/health traz commit e branch, ainda que vazios fora do host', async () => {
    const response = await request(servidorDe(app)).get('/health');

    expect(response.body).toHaveProperty('commit');
    expect(response.body).toHaveProperty('branch');
  });

  it('/health traz o contador de compressão do socket', async () => {
    const response = await request(servidorDe(app)).get('/health');

    expect((response.body as { socket: unknown }).socket).toEqual({ conexoes: 0, comprimidas: 0 });
  });

  /** Quem já lê o corpo antigo não pode quebrar por causa dos campos novos. */
  it('/health mantém os campos que o original respondia', async () => {
    const response = await request(servidorDe(app)).get('/health');

    expect(response.body).toMatchObject({ online: true, validation: true, version: 'nest-phase-2' });
  });
});
