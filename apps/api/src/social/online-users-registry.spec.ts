import { OnlineUsersRegistry, type OnlineConnection } from './online-users-registry';

function fakeConnection(id: string): OnlineConnection & { sent: { event: string; payload: unknown }[] } {
  const sent: { event: string; payload: unknown }[] = [];
  return {
    id,
    sent,
    emit(event: string, payload: unknown) {
      sent.push({ event, payload });
    },
  };
}

describe('OnlineUsersRegistry', () => {
  it('marca online ao registrar e offline quando a última conexão sai', async () => {
    const registry = new OnlineUsersRegistry();
    const aba1 = fakeConnection('c1');
    const aba2 = fakeConnection('c2');

    expect((await registry.onlineAmong([7])).has(7)).toBe(false);

    registry.add(7, aba1);
    registry.add(7, aba2);
    expect((await registry.onlineAmong([7])).has(7)).toBe(true);
    expect(registry.connectionCount(7)).toBe(2);

    expect(registry.remove('c1')).toBe(7);
    expect((await registry.onlineAmong([7])).has(7)).toBe(true);

    expect(registry.remove('c2')).toBe(7);
    expect((await registry.onlineAmong([7])).has(7)).toBe(false);
    expect(registry.connectionCount(7)).toBe(0);
  });

  it('remover conexão desconhecida não faz nada', () => {
    const registry = new OnlineUsersRegistry();
    expect(registry.remove('fantasma')).toBeNull();
  });

  it('entrega o evento em todas as conexões do alvo', () => {
    const registry = new OnlineUsersRegistry();
    const aba1 = fakeConnection('c1');
    const aba2 = fakeConnection('c2');
    const alheio = fakeConnection('c3');
    registry.add(7, aba1);
    registry.add(7, aba2);
    registry.add(9, alheio);

    registry.notify('chat', 7, { from: 'Aria', body: 'oi' });

    expect(aba1.sent).toEqual([{ event: 'chat', payload: { from: 'Aria', body: 'oi' } }]);
    expect(aba2.sent).toEqual(aba1.sent);
    expect(alheio.sent).toEqual([]);
  });

  it('entregar pra quem está offline não estoura', () => {
    const registry = new OnlineUsersRegistry();
    expect(() => registry.deliver(404, 'chat', {})).not.toThrow();
  });

  it('reautenticar a mesma conexão com outro usuário move a presença', async () => {
    const registry = new OnlineUsersRegistry();
    const conexao = fakeConnection('c1');

    registry.add(7, conexao);
    registry.add(9, conexao);

    expect((await registry.onlineAmong([7])).has(7)).toBe(false);
    expect((await registry.onlineAmong([9])).has(9)).toBe(true);
    expect(registry.remove('c1')).toBe(9);
  });
});
