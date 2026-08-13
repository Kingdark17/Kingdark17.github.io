/**
 * O app inteiro contra Postgres real: HTTP + socket, do cadastro até a
 * presença online do amigo.
 *
 * É o único teste que amarra tudo ao mesmo tempo — guard de sessão,
 * assinatura de save, transação de compra, e o registro de presença que
 * o gateway alimenta e `/api/friends` lê. Cada peça já tem teste próprio;
 * o que se verifica aqui é que elas conversam.
 */

import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { io, type Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';

import { AppModule } from '../app.module';
import { configureApp } from '../bootstrap';
import { startPglite, type PgliteHarness } from './testing/pglite-harness';

jest.setTimeout(60_000);

let harness: PgliteHarness;
let app: NestExpressApplication;
let url: string;
const clients: ClientSocket[] = [];

const ATRIBUTOS = { forca: 5, destreza: 5, constituicao: 5, intelecto: 5, sabedoria: 5, carisma: 5 };

function saveDe(gold: number, level = 1) {
  return {
    hero: { name: 'Aria', level, gold, attrs: { ...ATRIBUTOS }, equip: {}, killCount: 0 },
    inventory: [],
    party: [],
    floor: 1,
  };
}

function waitFor<T = unknown>(socket: ClientSocket, event: string, timeoutMs = 5_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`tempo esgotado esperando "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function registrar(username: string): Promise<string> {
  const resposta = await request(app.getHttpServer())
    .post('/api/account/register')
    .send({ username, email: `${username.toLowerCase()}@exemplo.com`, password: 'segredo123' });
  expect(resposta.status).toBe(201);
  return resposta.body.token;
}

beforeAll(async () => {
  harness = await startPglite();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = configureApp(moduleRef.createNestApplication<NestExpressApplication>());
  await app.listen(0);
  const address = app.getHttpServer().address() as { port: number };
  url = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
  await harness.reset();
});

afterEach(() => {
  while (clients.length) clients.pop()?.disconnect();
});

afterAll(async () => {
  await app.close();
  await harness.stop();
});

describe('fluxo de conta e save', () => {
  it('cadastra, entra na sessão e recupera o próprio usuário', async () => {
    const token = await registrar('Aria');

    const eu = await request(app.getHttpServer()).get('/api/account/me').set('Authorization', `Bearer ${token}`);
    expect(eu.status).toBe(200);
    expect(eu.body.user).toMatchObject({ username: 'Aria', isAdmin: false, emailVerified: false });
    expect(eu.body.user.passwordHash).toBeUndefined();

    const login = await request(app.getHttpServer()).post('/api/account/login').send({ username: 'aria', password: 'segredo123' });
    expect(login.status).toBe(200);
    expect(login.body.token).not.toBe(token);
  });

  it('login com senha errada não vaza se a conta existe', async () => {
    await registrar('Aria');

    const errada = await request(app.getHttpServer()).post('/api/account/login').send({ username: 'aria', password: 'chute-errado' });
    const inexistente = await request(app.getHttpServer()).post('/api/account/login').send({ username: 'ninguem', password: 'chute-errado' });

    expect(errada.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(errada.body).toEqual(inexistente.body);
  });

  it('salva na nuvem, recupera e a assinatura confere', async () => {
    const token = await registrar('Aria');
    const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

    const gravado = await auth(request(app.getHttpServer()).put('/api/save')).send({ slot: 1, save: saveDe(100), source: 'game' });
    expect(gravado.status).toBe(200);
    expect(gravado.body.signature).toHaveLength(64);

    const lido = await auth(request(app.getHttpServer()).get('/api/save?slot=1'));
    expect(lido.body.save).toMatchObject({ hero: { gold: 100 } });
    expect(lido.body.signature).toBe(gravado.body.signature);

    const conferido = await auth(request(app.getHttpServer()).post('/api/save/verify')).send({
      slot: 1,
      save: lido.body.save,
      signature: lido.body.signature,
    });
    expect(conferido.body).toEqual({ valid: true });

    const adulterado = await auth(request(app.getHttpServer()).post('/api/save/verify')).send({
      slot: 1,
      save: saveDe(999999),
      signature: lido.body.signature,
    });
    expect(adulterado.body).toEqual({ valid: false });
  });

  it('save sem sessão é recusado', async () => {
    const semToken = await request(app.getHttpServer()).put('/api/save').send({ slot: 1, save: saveDe(100) });
    expect(semToken.status).toBe(401);
  });

  it('comprar cosmético desconta o ouro do save do slot', async () => {
    const token = await registrar('Aria');
    const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);
    await auth(request(app.getHttpServer()).put('/api/save')).send({ slot: 1, save: saveDe(500), source: 'game' });

    const compra = await auth(request(app.getHttpServer()).post('/api/account/profile/purchase')).send({ id: 'frame_bronze', slot: 1 });

    expect(compra.status).toBe(200);
    expect(compra.body.save).toMatchObject({ hero: { gold: 400 } });
    expect(compra.body.user.cosmetics.frames).toContain('bronze');

    const catalogo = await auth(request(app.getHttpServer()).get('/api/account/profile/catalog'));
    expect(catalogo.body.owned.frames).toContain('bronze');
  });
});

describe('fluxo social com presença de verdade', () => {
  it('amizade, mensagem e o amigo aparecendo online quando conecta no socket', async () => {
    const tokenAria = await registrar('Aria');
    const tokenBree = await registrar('Bree');
    const comoAria = (req: request.Test) => req.set('Authorization', `Bearer ${tokenAria}`);
    const comoBree = (req: request.Test) => req.set('Authorization', `Bearer ${tokenBree}`);

    await comoAria(request(app.getHttpServer()).post('/api/friends/request')).send({ username: 'Bree' });
    await comoBree(request(app.getHttpServer()).post('/api/friends/accept')).send({ username: 'Aria' });

    const amigosDaAria = await comoAria(request(app.getHttpServer()).get('/api/friends'));
    expect(amigosDaAria.body.friends).toHaveLength(1);
    expect(amigosDaAria.body.friends[0]).toMatchObject({ username: 'Bree', online: false });

    // Bree conecta e autentica no socket: agora a presença muda de verdade.
    const socketDaBree = io(url, { transports: ['websocket'], forceNew: true });
    clients.push(socketDaBree);
    await waitFor(socketDaBree, 'connect');
    socketDaBree.emit('auth', { token: tokenBree });
    expect(await waitFor(socketDaBree, 'authed')).toEqual({ username: 'Bree' });

    const agoraOnline = await comoAria(request(app.getHttpServer()).get('/api/friends'));
    expect(agoraOnline.body.friends[0]).toMatchObject({ username: 'Bree', online: true });

    // Chat pelo socket chega no banco e é lido pelo histórico HTTP.
    socketDaBree.emit('chat', { to: 'Aria', body: 'bora jogar', tempId: 't1' });
    const confirmacao = await waitFor<{ tempId: string; body: string }>(socketDaBree, 'chat-ack');
    expect(confirmacao).toMatchObject({ tempId: 't1', body: 'bora jogar' });

    const historico = await comoAria(request(app.getHttpServer()).get('/api/messages/Bree'));
    expect(historico.body.messages.map((m: { body: string; fromMe: boolean }) => [m.body, m.fromMe])).toEqual([['bora jogar', false]]);

    // Desconectou, voltou a ficar offline.
    socketDaBree.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 200));
    const offlineDeNovo = await comoAria(request(app.getHttpServer()).get('/api/friends'));
    expect(offlineDeNovo.body.friends[0]).toMatchObject({ online: false });
  });

  it('mensagem pra quem não é amigo é recusada', async () => {
    const tokenAria = await registrar('Aria');
    await registrar('Bree');

    const tentativa = await request(app.getHttpServer())
      .post('/api/messages/Bree')
      .set('Authorization', `Bearer ${tokenAria}`)
      .send({ body: 'oi' });

    expect(tentativa.status).toBe(400);
    expect(tentativa.body).toEqual({ error: 'Vocês precisam ser amigos para conversar.' });
  });
});
