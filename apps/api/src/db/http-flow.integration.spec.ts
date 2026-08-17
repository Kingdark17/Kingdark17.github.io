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
import { servidorDe } from '../testing/servidor';

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

/** PNGs de 1×1 — o formato que `compressPhoto()` produz no navegador. */
const PNG_DE_TESTE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const OUTRO_PNG_DE_TESTE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function waitFor<T = unknown>(socket: ClientSocket, event: string, timeoutMs = 5_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`tempo esgotado esperando "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/**
 * `supertest` devolve `body` como `any`, e `any` desliga a checagem no
 * meio de um teste de ponta a ponta. Aqui o formato esperado é declarado
 * no ponto de uso: se a rota mudar de forma, o teste deixa de compilar em
 * vez de comparar `undefined` com `undefined` e passar.
 */
function corpo<T>(resposta: request.Response): T {
  return resposta.body as T;
}

/** Formato de `/api/friends`, o que este teste usa dele. */
interface Relacoes {
  friends: { username: string; avatarUrl: string; online: boolean }[];
}

async function registrar(username: string): Promise<string> {
  const resposta = await request(servidorDe(app))
    .post('/api/account/register')
    .send({ username, email: `${username.toLowerCase()}@exemplo.com`, password: 'segredo123' });
  expect(resposta.status).toBe(201);
  return corpo<{ token: string }>(resposta).token;
}

beforeAll(async () => {
  harness = await startPglite();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = configureApp(moduleRef.createNestApplication<NestExpressApplication>());
  await app.listen(0);
  const address = servidorDe(app).address() as { port: number };
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

    const eu = await request(servidorDe(app)).get('/api/account/me').set('Authorization', `Bearer ${token}`);
    expect(eu.status).toBe(200);
    const usuario = corpo<{ user: Record<string, unknown> }>(eu).user;
    expect(usuario).toMatchObject({ username: 'Aria', isAdmin: false, emailVerified: false });
    expect(usuario.passwordHash).toBeUndefined();

    const login = await request(servidorDe(app)).post('/api/account/login').send({ username: 'aria', password: 'segredo123' });
    expect(login.status).toBe(200);
    expect(corpo<{ token: string }>(login).token).not.toBe(token);
  });

  it('login com senha errada não vaza se a conta existe', async () => {
    await registrar('Aria');

    const errada = await request(servidorDe(app)).post('/api/account/login').send({ username: 'aria', password: 'chute-errado' });
    const inexistente = await request(servidorDe(app)).post('/api/account/login').send({ username: 'ninguem', password: 'chute-errado' });

    expect(errada.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(errada.body).toEqual(inexistente.body);
  });

  it('salva na nuvem, recupera e a assinatura confere', async () => {
    const token = await registrar('Aria');
    const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

    const gravado = await auth(request(servidorDe(app)).put('/api/save')).send({ slot: 1, save: saveDe(100), source: 'game' });
    expect(gravado.status).toBe(200);
    const assinaturaGravada = corpo<{ signature: string }>(gravado).signature;
    expect(assinaturaGravada).toHaveLength(64);

    const lido = await auth(request(servidorDe(app)).get('/api/save?slot=1'));
    const guardado = corpo<{ save: unknown; signature: string }>(lido);
    expect(guardado.save).toMatchObject({ hero: { gold: 100 } });
    expect(guardado.signature).toBe(assinaturaGravada);

    const conferido = await auth(request(servidorDe(app)).post('/api/save/verify')).send({
      slot: 1,
      save: guardado.save,
      signature: guardado.signature,
    });
    expect(conferido.body).toEqual({ valid: true });

    const adulterado = await auth(request(servidorDe(app)).post('/api/save/verify')).send({
      slot: 1,
      save: saveDe(999999),
      signature: guardado.signature,
    });
    expect(adulterado.body).toEqual({ valid: false });
  });

  it('save sem sessão é recusado', async () => {
    const semToken = await request(servidorDe(app))
      .put('/api/save')
      .send({ slot: 1, save: saveDe(100) });
    expect(semToken.status).toBe(401);
  });

  it('comprar cosmético desconta o ouro do save do slot', async () => {
    const token = await registrar('Aria');
    const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);
    await auth(request(servidorDe(app)).put('/api/save')).send({ slot: 1, save: saveDe(500), source: 'game' });

    const compra = await auth(request(servidorDe(app)).post('/api/account/profile/purchase')).send({ id: 'frame_bronze', slot: 1 });

    expect(compra.status).toBe(200);
    const comprado = corpo<{ save: unknown; user: { cosmetics: { frames: string[] } } }>(compra);
    expect(comprado.save).toMatchObject({ hero: { gold: 400 } });
    expect(comprado.user.cosmetics.frames).toContain('bronze');

    const catalogo = await auth(request(servidorDe(app)).get('/api/account/profile/catalog'));
    expect(corpo<{ owned: { frames: string[] } }>(catalogo).owned.frames).toContain('bronze');
  });
});

describe('fluxo social com presença de verdade', () => {
  it('amizade, mensagem e o amigo aparecendo online quando conecta no socket', async () => {
    const tokenAria = await registrar('Aria');
    const tokenBree = await registrar('Bree');
    const comoAria = (req: request.Test) => req.set('Authorization', `Bearer ${tokenAria}`);
    const comoBree = (req: request.Test) => req.set('Authorization', `Bearer ${tokenBree}`);

    await comoBree(request(servidorDe(app)).put('/api/account/profile')).send({ avatarUrl: PNG_DE_TESTE });
    await comoAria(request(servidorDe(app)).post('/api/friends/request')).send({ username: 'Bree' });
    await comoBree(request(servidorDe(app)).post('/api/friends/accept')).send({ username: 'Aria' });

    const amigosDaAria = await comoAria(request(servidorDe(app)).get('/api/friends'));
    const relacoes = corpo<Relacoes>(amigosDaAria);
    expect(relacoes.friends).toHaveLength(1);
    expect(relacoes.friends[0]).toMatchObject({ username: 'Bree', online: false });

    // A foto não viaja mais dentro do JSON: vem como endereço, e o
    // endereço serve a imagem **sem** Authorization — que é tudo o que um
    // `<img src>` consegue mandar.
    const endereco = relacoes.friends[0].avatarUrl;
    expect(JSON.stringify(relacoes)).not.toContain('base64');
    expect(endereco).toMatch(/^\/api\/users\/Bree\/avatar\?v=[0-9a-f]{12}$/);

    const foto = await request(servidorDe(app)).get(endereco);
    expect(foto.status).toBe(200);
    expect(foto.headers['content-type']).toBe('image/png');
    expect(foto.headers['cache-control']).toContain('max-age=31536000');
    expect(Buffer.from(foto.body as Buffer).subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    // A versão do endereço é calculada **em SQL** (`md5` na consulta), pra
    // o base64 não atravessar a rede até o banco. Só um teste com Postgres
    // de verdade prova que ela muda quando a foto muda — e é disso que o
    // cache de um ano depende.
    await comoBree(request(servidorDe(app)).put('/api/account/profile')).send({ avatarUrl: OUTRO_PNG_DE_TESTE });
    const depois = await comoAria(request(servidorDe(app)).get('/api/friends'));
    expect(corpo<Relacoes>(depois).friends[0].avatarUrl).not.toBe(endereco);

    // Bree conecta e autentica no socket: agora a presença muda de verdade.
    const socketDaBree = io(url, { transports: ['websocket'], forceNew: true });
    clients.push(socketDaBree);
    await waitFor(socketDaBree, 'connect');
    socketDaBree.emit('auth', { token: tokenBree });
    expect(await waitFor(socketDaBree, 'authed')).toEqual({ username: 'Bree' });

    const agoraOnline = await comoAria(request(servidorDe(app)).get('/api/friends'));
    expect(corpo<Relacoes>(agoraOnline).friends[0]).toMatchObject({ username: 'Bree', online: true });

    // Chat pelo socket chega no banco e é lido pelo histórico HTTP.
    socketDaBree.emit('chat', { to: 'Aria', body: 'bora jogar', tempId: 't1' });
    const confirmacao = await waitFor<{ tempId: string; body: string }>(socketDaBree, 'chat-ack');
    expect(confirmacao).toMatchObject({ tempId: 't1', body: 'bora jogar' });

    const historico = await comoAria(request(servidorDe(app)).get('/api/messages/Bree'));
    const mensagens = corpo<{ messages: { body: string; fromMe: boolean }[] }>(historico).messages;
    expect(mensagens.map((m) => [m.body, m.fromMe])).toEqual([['bora jogar', false]]);

    // Desconectou, voltou a ficar offline.
    socketDaBree.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 200));
    const offlineDeNovo = await comoAria(request(servidorDe(app)).get('/api/friends'));
    expect(corpo<Relacoes>(offlineDeNovo).friends[0]).toMatchObject({ online: false });
  });

  it('mensagem pra quem não é amigo é recusada', async () => {
    const tokenAria = await registrar('Aria');
    await registrar('Bree');

    const tentativa = await request(servidorDe(app)).post('/api/messages/Bree').set('Authorization', `Bearer ${tokenAria}`).send({ body: 'oi' });

    expect(tentativa.status).toBe(400);
    expect(tentativa.body).toEqual({ error: 'Vocês precisam ser amigos para conversar.' });
  });
});
