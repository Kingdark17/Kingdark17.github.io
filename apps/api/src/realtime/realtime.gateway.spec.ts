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
import { servidorDe } from '../testing/servidor';

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
    const address = servidorDe(app).address() as { port: number };
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
    // `resumida: false` porque a sala nasce agora. `true` só quando o mundo
    // veio do depósito depois de um reinício da API.
    expect(await waitFor(host, 'created')).toEqual({ room: 'ABC123', resumida: false });

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

  // O pacote de `state` sai a cada ação de jogo. Medido num save com 76
  // itens, ele era 14 KB, dos quais 10,5 KB eram a mochila — que o
  // destinatário não lê em lugar nenhum. O recorte tem que ser por
  // destinatário: mandar o enxuto pros dois faria o front esvaziar a mochila
  // de quem recebesse o próprio perfil sem ela (`meuPerfil.inventory ?? []`).
  it('manda a mochila só pro dono dela, nunca pro parceiro', async () => {
    const host = connect();
    await waitFor(host, 'connect');
    host.emit('create', { room: 'MOC001', name: 'Aria' });
    await waitFor(host, 'created');

    const guest = connect();
    await waitFor(guest, 'connect');
    guest.emit('join', { room: 'MOC001', name: 'Bree' });
    await waitFor(host, 'hello');

    // Os dois com mochila, pra dar pra distinguir a de cada um no pacote.
    host.emit('profile', { room: 'MOC001', profile: { name: 'Aria', inventory: [{ uid: 'do-anfitriao' }] } });
    await waitFor(host, 'profile-accepted');
    guest.emit('profile', { room: 'MOC001', profile: { name: 'Bree', inventory: [{ uid: 'do-convidado' }] } });
    await waitFor(guest, 'profile-accepted');

    type Perfil = { name: string; inventory?: unknown[] };
    type Pacote = { state: { profiles: Record<string, Perfil> } };

    const paraOConvidado = waitFor<Pacote>(guest, 'state');
    host.emit('state', { room: 'MOC001', turn: 1, state: { pos: { x: 1, y: 1 }, floor: 1 } });
    const paraOAnfitriao = await waitFor<Pacote>(host, 'authoritative');

    // Quem mandou recebe a própria mochila de volta — é assim que o front se
    // corrige contra o saneamento.
    expect(paraOAnfitriao.state.profiles['1'].inventory).toEqual([{ uid: 'do-anfitriao' }]);
    expect(paraOAnfitriao.state.profiles['2']).not.toHaveProperty('inventory');

    // E o parceiro recebe a dele, não a do outro.
    const recebido = await paraOConvidado;
    expect(recebido.state.profiles['2'].inventory).toEqual([{ uid: 'do-convidado' }]);
    expect(recebido.state.profiles['1']).not.toHaveProperty('inventory');
    // O nome continua vindo dos dois: é o que a tela do parceiro mostra.
    expect(recebido.state.profiles['1'].name).toBe('Aria');
  });

  /**
   * O caminho quente inteiro, no fio de verdade.
   *
   * Medido num save de andar 8 com 76 itens, o pacote de `state` era 20,3 KB
   * por lado e 11,5 KB disso era a mochila de **quem recebe** — devolvida
   * pelo servidor a cada ação sem ter mudado. Andar, lutar e abrir porta não
   * mexem na mochila; ela agora só viaja quando é outra.
   */
  it('a mochila de quem recebe não volta a cada ação, e volta quando muda', async () => {
    const host = connect();
    await waitFor(host, 'connect');
    host.emit('create', { room: 'ECO001', name: 'Aria' });
    await waitFor(host, 'created');

    host.emit('profile', { room: 'ECO001', profile: { name: 'Aria', inventory: [{ uid: 'a' }, { uid: 'b' }] } });
    await waitFor(host, 'profile-accepted');

    type Pacote = { state: { profiles: Record<string, { inventory?: unknown[] }> } };
    const andar = async () => {
      host.emit('state', { room: 'ECO001', turn: 1, state: { pos: { x: 1, y: 1 }, floor: 1 } });
      return (await waitFor<Pacote>(host, 'authoritative')).state.profiles['1'];
    };

    // A primeira leva; as seguintes, não — ausência quer dizer "não mudou".
    expect(await andar()).toHaveProperty('inventory');
    expect(await andar()).not.toHaveProperty('inventory');
    expect(await andar()).not.toHaveProperty('inventory');

    // Pegou um item: volta a viajar, uma vez.
    host.emit('state', {
      room: 'ECO001',
      turn: 2,
      state: { pos: { x: 1, y: 1 }, floor: 1, profiles: { 1: { name: 'Aria', inventory: [{ uid: 'a' }, { uid: 'b' }, { uid: 'c' }] } } },
    });
    const comItemNovo = await waitFor<Pacote>(host, 'authoritative');
    expect(comItemNovo.state.profiles['1'].inventory).toHaveLength(3);
    expect(await andar()).not.toHaveProperty('inventory');
  });

  /**
   * `welcome` é a sincronização cheia. Omitir a mochila ali mandaria o
   * parceiro jogar sem mochila — e ele a devolveria vazia na primeira
   * sincronização, virando perda de verdade.
   */
  it('welcome leva a mochila mesmo depois de o servidor já tê-la mandado', async () => {
    const host = connect();
    await waitFor(host, 'connect');
    host.emit('create', { room: 'WEL001', name: 'Aria' });
    await waitFor(host, 'created');

    const guest = connect();
    await waitFor(guest, 'connect');
    guest.emit('join', { room: 'WEL001', name: 'Bree' });
    await waitFor(host, 'hello');

    guest.emit('profile', { room: 'WEL001', profile: { name: 'Bree', inventory: [{ uid: 'da-bree' }] } });
    await waitFor(guest, 'profile-accepted');

    type Pacote = { state: { profiles: Record<string, { inventory?: unknown[] }> } };

    // Uma ação primeiro, pra o servidor marcar que já mandou a mochila dela.
    const primeiro = waitFor<Pacote>(guest, 'state');
    host.emit('state', { room: 'WEL001', turn: 1, state: { pos: { x: 1, y: 1 }, floor: 1 } });
    expect((await primeiro).state.profiles['2']).toHaveProperty('inventory');

    const boasVindas = waitFor<Pacote>(guest, 'welcome');
    host.emit('welcome', { room: 'WEL001', turn: 1, state: { pos: { x: 2, y: 2 }, floor: 1 } });
    expect((await boasVindas).state.profiles['2'].inventory).toEqual([{ uid: 'da-bree' }]);
  });

  /**
   * Quem entra precisa saber o próprio papel — e não sabia.
   *
   * O `created` só cobre quem cria; o `hello` ia só pros outros. Sem papel,
   * `tela-jogo.tsx` barra tudo: `sincronizar` e a adoção do estado remoto
   * abrem os dois com `if (!sala.papel) return`. O convidado entrava e não
   * sincronizava nada — e o ramo "Você entrou na sala." do front nunca
   * tinha como disparar.
   */
  it('quem entra recebe o próprio papel', async () => {
    const host = connect();
    await waitFor(host, 'connect');
    host.emit('create', { room: 'PAP001', name: 'Aria' });
    await waitFor(host, 'created');

    const guest = connect();
    await waitFor(guest, 'connect');
    const meuHello = waitFor<{ room: string; role: number }>(guest, 'hello');
    guest.emit('join', { room: 'PAP001', name: 'Bree' });

    expect(await meuHello).toEqual({ room: 'PAP001', name: 'Bree', role: 2 });
  });

  /**
   * `rejoin` numa sala que o reinício levou. Sem `REDIS_URL` (que é o caso
   * aqui) o mundo não volta, mas a sala é recriada e quem voltou conduz —
   * o que importa é que ninguém fica de fora ouvindo "Sala não encontrada".
   */
  it('voltar pra sala que sumiu recria e devolve o papel 1', async () => {
    const host = connect();
    await waitFor(host, 'connect');
    host.emit('create', { room: 'VOL001', name: 'Aria' });
    await waitFor(host, 'created');
    host.disconnect();

    const devolta = connect();
    await waitFor(devolta, 'connect');
    const meuHello = waitFor<{ role: number }>(devolta, 'hello');
    devolta.emit('rejoin', { room: 'VOL001', name: 'Aria' });

    expect((await meuHello).role).toBe(1);
  });

  /**
   * O outro caminho do mesmo `rejoin`: o parceiro voltou primeiro e a sala
   * está viva. Quem chega entra nela em vez de tentar criar por cima — é a
   * corrida que o evento existe pra tirar.
   */
  it('voltar pra sala que o parceiro segurou entra nela, sem "já existe"', async () => {
    const host = connect();
    await waitFor(host, 'connect');
    host.emit('create', { room: 'VOL002', name: 'Aria' });
    await waitFor(host, 'created');

    const devolta = connect();
    await waitFor(devolta, 'connect');
    const avisoDoParceiro = waitFor<{ name: string; role: number }>(host, 'hello');
    const meuHello = waitFor<{ role: number }>(devolta, 'hello');
    devolta.emit('rejoin', { room: 'VOL002', name: 'Bree' });

    expect((await meuHello).role).toBe(2);
    expect(await avisoDoParceiro).toEqual({ room: 'VOL002', name: 'Bree', role: 2 });
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
