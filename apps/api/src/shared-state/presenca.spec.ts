import { PresencaLocal, PresencaNoRedis, VALIDADE_MS, type PresencaCompartilhada } from './presenca';
import { RedisDeMentira } from './testing/redis-de-mentira';

describe('PresencaLocal', () => {
  it('não conhece outras instâncias e entrega no mesmo lugar', async () => {
    // Pelo tipo da interface: `PresencaLocal` ignora os argumentos, mas
    // quem chama sempre passa.
    const local: PresencaCompartilhada = new PresencaLocal();
    const entregues: { userId: number; evento: string }[] = [];
    local.aoReceber((userId, evento) => entregues.push({ userId, evento }));

    local.entrou(7);
    expect(await local.onlineEmOutras([7, 9])).toEqual(new Set());

    local.empurrar(7, 'chat', { body: 'oi' });
    expect(entregues).toEqual([{ userId: 7, evento: 'chat' }]);
  });
});

describe('PresencaNoRedis', () => {
  function duasInstancias(agora: () => number) {
    const servidor = new RedisDeMentira(agora);
    return {
      servidor,
      a: new PresencaNoRedis(servidor.cliente(), 'instancia-A'),
      b: new PresencaNoRedis(servidor.cliente(), 'instancia-B'),
    };
  }

  it('cada instância enxerga quem está na outra', async () => {
    const { a, b } = duasInstancias(() => 1000);
    a.entrou(7);
    b.entrou(9);
    await Promise.resolve();

    // A pergunta é só sobre "as outras": quem está aqui o registro local
    // já sabe sem sair do processo.
    expect(await a.onlineEmOutras([7, 9])).toEqual(new Set([9]));
    expect(await b.onlineEmOutras([7, 9])).toEqual(new Set([7]));

    await a.encerrar();
    await b.encerrar();
  });

  it('quem sai some da conta da outra instância', async () => {
    const { a, b } = duasInstancias(() => 1000);
    b.entrou(9);
    await Promise.resolve();
    expect(await a.onlineEmOutras([9])).toEqual(new Set([9]));

    b.saiu(9);
    await Promise.resolve();
    expect(await a.onlineEmOutras([9])).toEqual(new Set());

    await a.encerrar();
    await b.encerrar();
  });

  it('instância que morre sem avisar some sozinha quando o prazo vence', async () => {
    let agora = 1000;
    const { a, b } = duasInstancias(() => agora);
    b.entrou(9);
    await Promise.resolve();
    expect(await a.onlineEmOutras([9])).toEqual(new Set([9]));

    // B caiu: para de renovar e nunca chama `saiu`. Sem prazo, o 9 ficaria
    // "online" pra sempre.
    agora += VALIDADE_MS + 1;
    expect(await a.onlineEmOutras([9])).toEqual(new Set());

    await a.encerrar();
    await b.encerrar();
  });

  it('evento nasce numa instância e chega na conexão da outra', async () => {
    const { a, b } = duasInstancias(() => 1000);
    const recebidosPorB: { userId: number; evento: string; payload: unknown }[] = [];
    b.aoReceber((userId, evento, payload) => recebidosPorB.push({ userId, evento, payload }));

    b.entrou(9);
    a.empurrar(9, 'chat', { body: 'oi' });
    await Promise.resolve();

    expect(recebidosPorB).toEqual([{ userId: 9, evento: 'chat', payload: { body: 'oi' } }]);

    await a.encerrar();
    await b.encerrar();
  });

  it('quem publica não entrega duas vezes pra si mesmo', async () => {
    const { a } = duasInstancias(() => 1000);
    const recebidosPorA: number[] = [];
    a.aoReceber((userId) => recebidosPorA.push(userId));

    a.entrou(7);
    a.empurrar(7, 'chat', {});
    await Promise.resolve();

    // Entrega local direta + eco da publicação daria duas.
    expect(recebidosPorA).toEqual([7]);

    await a.encerrar();
  });

  it('Redis fora do ar reduz a presença ao que a instância enxerga, sem estourar', async () => {
    const { servidor, a, b } = duasInstancias(() => 1000);
    b.entrou(9);
    await Promise.resolve();

    servidor.quebrado = true;
    expect(await a.onlineEmOutras([9])).toEqual(new Set());
    expect(() => a.empurrar(9, 'chat', {})).not.toThrow();

    await a.encerrar();
    await b.encerrar();
  });
});
