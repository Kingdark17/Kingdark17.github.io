import { RedisDeMentira } from '../shared-state/testing/redis-de-mentira';
import { deInstantaneo, DepositoNoRedis, DepositoNulo, paraInstantaneo, PRAZO_DA_SALA_MS, type DepositoDeSalas } from './deposito-de-salas';
import { GUEST_ROLE, HOST_ROLE, RoomRegistry, type Room, type RoomConnection } from './room-registry';

function conexao(id: string): RoomConnection {
  return { id, emit() {} };
}

/** Uma sala como o registro a deixa depois de uma partida em andamento. */
function salaCheia(): Room {
  const registry = new RoomRegistry();
  const criada = registry.create('ABC123', conexao('host'), { admin: true, isPublic: true, hostName: 'Aria' });
  if (criada.kind !== 'created') throw new Error('esperava sala criada');
  registry.join('ABC123', conexao('guest'), { admin: false });

  registry.applyProfile(criada.room, HOST_ROLE, { name: 'Aria', inventory: [{ uid: 'secreto' }] });
  registry.applyProfile(criada.room, GUEST_ROLE, { name: 'Bree', inventory: [{ uid: 'do-outro' }] });
  registry.applyState(criada.room, HOST_ROLE, { floor: 7, pos: { x: 2, y: 3 }, mapRows: 9, mapCols: 9, map: [[{ type: 'start' }]] });

  return criada.room;
}

describe('paraInstantaneo — o que atravessa o reinício', () => {
  it('leva o mundo: andar, posição e mapa', () => {
    const instantaneo = paraInstantaneo(salaCheia());

    expect(instantaneo.code).toBe('ABC123');
    expect(instantaneo.state?.floor).toBe(7);
    expect(instantaneo.state?.pos).toEqual({ x: 2, y: 3 });
    expect(instantaneo.state?.map).toEqual([[{ type: 'start' }]]);
  });

  /**
   * A decisão de segurança do módulo, presa por teste.
   *
   * Código de sala tem seis caracteres e é o único segredo que existe.
   * Guardar perfil faria quem digitasse um código abandonado receber
   * `profiles[seuPapel]` como se fosse seu — e `profilesForMember` manda o
   * próprio perfil **inteiro, com mochila**. Seria entregar o herói de
   * outra pessoa a quem chutou seis letras.
   */
  it('NÃO leva perfil de ninguém, nem solto nem embutido no estado', () => {
    const instantaneo = paraInstantaneo(salaCheia());

    expect(JSON.stringify(instantaneo)).not.toContain('secreto');
    expect(JSON.stringify(instantaneo)).not.toContain('do-outro');
    expect(instantaneo.state).not.toHaveProperty('profiles');
    expect(instantaneo).not.toHaveProperty('profiles');
  });

  it('NÃO leva a marca de ADM', () => {
    // Herdar o modo GOD por reconexão seria ganhar 999 em tudo digitando
    // um código. Ela sai do cookie a cada create/join, e só de lá.
    expect(paraInstantaneo(salaCheia())).not.toHaveProperty('adminRoles');
  });

  it('a sala renasce vazia de gente e cheia de mundo', () => {
    const renascida = deInstantaneo(paraInstantaneo(salaCheia()));

    expect(renascida.members).toEqual([]);
    expect(renascida.profiles).toEqual({});
    expect(renascida.adminRoles).toEqual({});
    expect(renascida.inventoryVersions).toEqual({});
    expect(renascida.state?.floor).toBe(7);
  });
});

describe('DepositoNoRedis', () => {
  it('guarda e devolve o mesmo mundo', async () => {
    const redis = new RedisDeMentira();
    const deposito = new DepositoNoRedis(redis.cliente());

    await deposito.guardar(paraInstantaneo(salaCheia()));
    const voltou = await deposito.carregar('ABC123');

    expect(voltou?.state?.floor).toBe(7);
    expect(voltou?.hostName).toBe('Aria');
    expect(voltou?.isPublic).toBe(true);
  });

  it('esquecer apaga; código some e pode ser reusado', async () => {
    const redis = new RedisDeMentira();
    const deposito = new DepositoNoRedis(redis.cliente());

    await deposito.guardar(paraInstantaneo(salaCheia()));
    await deposito.esquecer('ABC123');

    expect(await deposito.carregar('ABC123')).toBeNull();
  });

  it('a sala expira sozinha', async () => {
    let agora = 1_000;
    const redis = new RedisDeMentira(() => agora);
    const deposito = new DepositoNoRedis(redis.cliente());

    await deposito.guardar(paraInstantaneo(salaCheia()));
    agora += PRAZO_DA_SALA_MS + 1;

    expect(await deposito.carregar('ABC123')).toBeNull();
  });

  /**
   * Redis fora do ar não pode recusar partida. Perder a retomada é ruim;
   * derrubar o multiplayer porque o cache caiu é pior — mesmo acordo do
   * contador de tentativas.
   */
  it('Redis fora do ar não estoura: guardar silencia, carregar vira "não achei"', async () => {
    const redis = new RedisDeMentira();
    redis.quebrado = true;
    const deposito = new DepositoNoRedis(redis.cliente());

    await expect(deposito.guardar(paraInstantaneo(salaCheia()))).resolves.toBeUndefined();
    await expect(deposito.carregar('ABC123')).resolves.toBeNull();
    await expect(deposito.esquecer('ABC123')).resolves.toBeUndefined();
  });

  it('JSON corrompido vira sala nova, não exceção', async () => {
    const redis = new RedisDeMentira();
    redis.textos.set('rpg:sala:ABC123', '{isto não é json');

    expect(await new DepositoNoRedis(redis.cliente()).carregar('ABC123')).toBeNull();
  });

  /**
   * O instantâneo já esteve fora deste processo: outra versão do código
   * pode tê-lo escrito. Perfil que apareça na volta morre aqui, e não na
   * tela de alguém.
   */
  it('perfil que volte do Redis por engano é raspado na leitura', async () => {
    const redis = new RedisDeMentira();
    redis.textos.set(
      'rpg:sala:ABC123',
      JSON.stringify({ code: 'ABC123', isPublic: false, hostName: 'Aria', state: { floor: 3, profiles: { 1: { inventory: ['vazado'] } } } }),
    );

    const voltou = await new DepositoNoRedis(redis.cliente()).carregar('ABC123');

    expect(voltou?.state?.floor).toBe(3);
    expect(voltou?.state).not.toHaveProperty('profiles');
  });

  it('campo torto cai pro padrão em vez de viajar como undefined', async () => {
    const redis = new RedisDeMentira();
    redis.textos.set('rpg:sala:ABC123', JSON.stringify({ code: 'OUTRO', isPublic: 'sim', hostName: 42 }));

    const voltou = await new DepositoNoRedis(redis.cliente()).carregar('ABC123');

    expect(voltou).toEqual({ code: 'ABC123', isPublic: false, hostName: 'Aventureiro', state: null });
  });
});

describe('DepositoNulo — o caminho sem REDIS_URL', () => {
  it('não guarda e nunca acha nada', async () => {
    // Pelo tipo da interface, que é como o `RoomRegistry` o enxerga.
    const deposito: DepositoDeSalas = new DepositoNulo();

    await deposito.guardar(paraInstantaneo(salaCheia()));

    expect(await deposito.carregar('ABC123')).toBeNull();
  });
});

describe('RoomRegistry com depósito', () => {
  function registroComRedis() {
    const redis = new RedisDeMentira();
    return { redis, registry: new RoomRegistry(new DepositoNoRedis(redis.cliente())) };
  }

  /** O que o reinício faz: o processo esquece tudo, o Redis não. */
  function reiniciar(redis: RedisDeMentira) {
    return new RoomRegistry(new DepositoNoRedis(redis.cliente()));
  }

  it('depois de um reinício, o anfitrião recria e o mapa está lá', async () => {
    const { redis, registry } = registroComRedis();
    const criada = registry.create('ABC123', conexao('host'), { admin: false, isPublic: false, hostName: 'Aria' });
    if (criada.kind !== 'created') throw new Error('esperava sala criada');
    registry.applyState(criada.room, HOST_ROLE, { floor: 4, pos: { x: 1, y: 1 } });

    const depois = reiniciar(redis);
    expect(depois.get('ABC123')).toBeUndefined();

    await depois.hidratar('ABC123');
    const recriada = depois.create('ABC123', conexao('host-2'), { admin: false, isPublic: false, hostName: 'Aria' });

    if (recriada.kind !== 'created') throw new Error('esperava sala recriada');
    expect(recriada.resumida).toBe(true);
    expect(recriada.room.state?.floor).toBe(4);
  });

  /**
   * A corrida que o depósito tira: sem ele, quem volta primeiro ouve "Sala
   * não encontrada" e precisa que o parceiro recrie antes — sem ninguém
   * saber que há uma ordem obrigatória.
   */
  it('depois de um reinício, o convidado consegue voltar mesmo chegando primeiro', async () => {
    const { redis, registry } = registroComRedis();
    const criada = registry.create('ABC123', conexao('host'), { admin: false, isPublic: false, hostName: 'Aria' });
    if (criada.kind !== 'created') throw new Error('esperava sala criada');
    registry.applyState(criada.room, HOST_ROLE, { floor: 4 });

    const depois = reiniciar(redis);
    await depois.hidratar('ABC123');
    const entrada = depois.join('ABC123', conexao('guest-2'), { admin: false });

    expect(entrada.kind).toBe('joined');
  });

  it('a sala retomada não devolve perfil nem ADM de quem estava antes', async () => {
    const { redis, registry } = registroComRedis();
    const criada = registry.create('ABC123', conexao('host'), { admin: true, isPublic: false, hostName: 'Aria' });
    if (criada.kind !== 'created') throw new Error('esperava sala criada');
    registry.applyProfile(criada.room, HOST_ROLE, { name: 'Aria', inventory: [{ uid: 'secreto' }] });
    registry.applyState(criada.room, HOST_ROLE, { floor: 4 });

    const depois = reiniciar(redis);
    await depois.hidratar('ABC123');
    const recriada = depois.create('ABC123', conexao('estranho'), { admin: false, isPublic: false, hostName: 'Quem' });
    if (recriada.kind !== 'created') throw new Error('esperava sala recriada');

    expect(recriada.room.profiles).toEqual({});
    expect(depois.isAdmin(recriada.room, HOST_ROLE)).toBe(false);
    expect(JSON.stringify(recriada.room.state)).not.toContain('secreto');
  });

  it('sala fechada de propósito não ressuscita', async () => {
    const { redis, registry } = registroComRedis();
    const criada = registry.create('ABC123', conexao('host'), { admin: false, isPublic: false, hostName: 'Aria' });
    if (criada.kind !== 'created') throw new Error('esperava sala criada');
    registry.applyState(criada.room, HOST_ROLE, { floor: 4 });
    registry.leave('host');

    const depois = reiniciar(redis);
    await depois.hidratar('ABC123');

    expect(depois.get('ABC123')).toBeUndefined();
  });

  it('hidratar não mexe em sala que já está no processo', async () => {
    const { redis, registry } = registroComRedis();
    const criada = registry.create('ABC123', conexao('host'), { admin: false, isPublic: false, hostName: 'Aria' });
    if (criada.kind !== 'created') throw new Error('esperava sala criada');
    registry.applyState(criada.room, HOST_ROLE, { floor: 9 });

    // O depósito tem uma versão mais velha; o processo é a verdade.
    await new DepositoNoRedis(redis.cliente()).guardar({ code: 'ABC123', isPublic: false, hostName: 'Aria', state: { floor: 1 } });
    await registry.hidratar('ABC123');

    expect(registry.get('ABC123')?.state?.floor).toBe(9);
  });
});
