/**
 * Teste de ponta a ponta do gateway: sobe o app Nest de verdade, conecta
 * dois clientes socket.io e joga a sequência que o multiplayer usa
 * (criar → entrar → perfil → estado → sair).
 *
 * Roda sem `DATABASE_URL`: nenhum dos eventos exercitados aqui manda
 * `accountToken`, e `AuthService.me('')` recusa antes de tocar no banco.
 * É de propósito — o objetivo é provar que a fiação do gateway funciona,
 * não testar de novo o saneamento (isso está em `sanitize.spec.ts` e
 * `room-registry.spec.ts`).
 */

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, type Socket as ClientSocket } from 'socket.io-client';

import { AppModule } from '../app.module';

jest.setTimeout(20_000);

function waitFor<T = unknown>(socket: ClientSocket, event: string, timeoutMs = 5_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`tempo esgotado esperando "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('RealtimeGateway (socket.io de verdade)', () => {
  let app: INestApplication;
  let url: string;
  const clients: ClientSocket[] = [];

  function connect(): ClientSocket {
    const client = io(url, { transports: ['websocket'], forceNew: true });
    clients.push(client);
    return client;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    // `getUrl()` pode devolver o literal IPv6 (`[::1]`) no Windows; o
    // endereço do servidor dá a porta direto e evita esse atrito.
    const address = app.getHttpServer().address() as { port: number };
    url = `http://127.0.0.1:${address.port}`;
  });

  afterEach(() => {
    while (clients.length) clients.pop()?.disconnect();
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria sala, recebe o parceiro e devolve o estado autoritativo', async () => {
    const host = connect();
    await waitFor(host, 'connect');
    host.emit('create', { room: 'ABC123', name: 'Aria', public: true });
    expect(await waitFor(host, 'created')).toEqual({ room: 'ABC123' });

    const guest = connect();
    await waitFor(guest, 'connect');
    const helloPromise = waitFor(host, 'hello');
    guest.emit('join', { room: 'ABC123', name: 'Bree' });
    expect(await helloPromise).toEqual({ room: 'ABC123', name: 'Bree', role: 2 });

    const profileRelayed = waitFor(guest, 'profile');
    host.emit('profile', { room: 'ABC123', profile: { name: 'Aria', hero: { level: 99, gold: 99999 } } });
    const accepted = await waitFor<{ role: number; profile: { hero: Record<string, unknown> } }>(host, 'profile-accepted');
    expect(accepted.role).toBe(1);
    expect(accepted.profile.hero.level).toBe(1);
    expect((await profileRelayed) as { role: number }).toMatchObject({ role: 1 });

    const stateRelayed = waitFor<{ state: Record<string, unknown> }>(guest, 'state');
    host.emit('state', { room: 'ABC123', turn: 3, state: { pos: { x: 2, y: 2 }, floor: 999999, mapRows: 8, mapCols: 8 } });
    const authoritative = await waitFor<{ state: Record<string, unknown>; turn: number }>(host, 'authoritative');
    expect(authoritative.turn).toBe(3);
    expect(authoritative.state.floor).toBe(10000);
    expect((await stateRelayed).state.floor).toBe(10000);
  });

  it('recusa sala inexistente e sala cheia com mensagem', async () => {
    const perdido = connect();
    await waitFor(perdido, 'connect');
    perdido.emit('join', { room: 'NADA01' });
    expect(await waitFor(perdido, 'error')).toEqual({ room: 'NADA01', message: 'Sala não encontrada.' });

    const host = connect();
    await waitFor(host, 'connect');
    host.emit('create', { room: 'CHE101', name: 'Aria' });
    await waitFor(host, 'created');

    const guest = connect();
    await waitFor(guest, 'connect');
    guest.emit('join', { room: 'CHE101', name: 'Bree' });
    await waitFor(host, 'hello');

    const terceiro = connect();
    await waitFor(terceiro, 'connect');
    terceiro.emit('join', { room: 'CHE101', name: 'Caio' });
    expect(await waitFor(terceiro, 'error')).toEqual({ room: 'CHE101', message: 'Sala cheia.' });
  });

  it('avisa peer-left quando o parceiro cai', async () => {
    const host = connect();
    await waitFor(host, 'connect');
    host.emit('create', { room: 'SAI001', name: 'Aria' });
    await waitFor(host, 'created');

    const guest = connect();
    await waitFor(guest, 'connect');
    guest.emit('join', { room: 'SAI001', name: 'Bree' });
    await waitFor(host, 'hello');

    const left = waitFor(host, 'peer-left');
    guest.disconnect();
    expect(await left).toEqual({ room: 'SAI001' });
  });

  it('anfitrião que cai promove quem ficou, e o promovido passa a conduzir', async () => {
    const host = connect();
    await waitFor(host, 'connect');
    host.emit('create', { room: 'PRO001', name: 'Aria' });
    await waitFor(host, 'created');

    const guest = connect();
    await waitFor(guest, 'connect');
    guest.emit('join', { room: 'PRO001', name: 'Bree' });
    await waitFor(host, 'hello');

    const promovido = waitFor(guest, 'role-changed');
    host.disconnect();
    expect(await promovido).toEqual({ room: 'PRO001', role: 1 });

    // Antes da promoção, `move-lock` do papel 2 era descartado em silêncio;
    // agora ele conduz — o eco autoritativo confirma o papel novo.
    const eco = waitFor<{ role: number }>(guest, 'authoritative');
    guest.emit('state', { room: 'PRO001', turn: 1, state: { pos: { x: 3, y: 3 }, floor: 2 } });
    expect((await eco).role).toBe(1);
  });

  it('convidado não conduz exploração: move-lock dele não chega no criador', async () => {
    const host = connect();
    await waitFor(host, 'connect');
    host.emit('create', { room: 'LCK001', name: 'Aria' });
    await waitFor(host, 'created');

    const guest = connect();
    await waitFor(guest, 'connect');
    guest.emit('join', { room: 'LCK001', name: 'Bree' });
    await waitFor(host, 'hello');

    const recebidos: unknown[] = [];
    host.on('move-lock', (payload: unknown) => recebidos.push(payload));

    guest.emit('move-lock', { room: 'LCK001' });
    // Um round-trip qualquer serve de barreira: se o move-lock fosse
    // relayado, chegaria antes desta resposta.
    guest.emit('team-heal', { room: 'LCK001', amount: 10 });
    expect(await waitFor(host, 'team-heal')).toEqual({ room: 'LCK001', role: 2, amount: 10 });
    expect(recebidos).toEqual([]);
  });

  it('mensagem de sala de quem não está na sala é ignorada', async () => {
    const host = connect();
    await waitFor(host, 'connect');
    host.emit('create', { room: 'INT001', name: 'Aria' });
    await waitFor(host, 'created');

    const intruso = connect();
    await waitFor(intruso, 'connect');
    const recebidos: unknown[] = [];
    host.on('team-heal', (payload: unknown) => recebidos.push(payload));

    intruso.emit('team-heal', { room: 'INT001', amount: 500 });

    const guest = connect();
    await waitFor(guest, 'connect');
    guest.emit('join', { room: 'INT001', name: 'Bree' });
    await waitFor(host, 'hello');

    expect(recebidos).toEqual([]);
  });

  it('chat sem autenticar não responde nada', async () => {
    const client = connect();
    await waitFor(client, 'connect');
    client.emit('chat', { to: 'alguem', body: 'oi', tempId: 't1' });

    await expect(waitFor(client, 'chat-ack', 500)).rejects.toThrow(/tempo esgotado/);
  });

  it('barra quem passa de 30 mensagens por segundo', async () => {
    const client = connect();
    await waitFor(client, 'connect');
    client.emit('create', { room: 'FLD001', name: 'Aria' });
    await waitFor(client, 'created');

    const barrado = waitFor<{ message: string }>(client, 'error');
    for (let i = 0; i < 40; i += 1) client.emit('team-heal', { room: 'FLD001', amount: 1 });

    expect((await barrado).message).toBe('Muitas ações em pouco tempo.');
  });

  it('auth com token inválido responde auth-error sem derrubar a conexão', async () => {
    const client = connect();
    await waitFor(client, 'connect');
    client.emit('auth', { token: 'curto-demais' });

    await waitFor(client, 'auth-error');
    expect(client.connected).toBe(true);
  });
});
