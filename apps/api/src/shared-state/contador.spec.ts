import { IP_ATTEMPT_LIMIT, IP_WINDOW_MS } from '../auth/ip-rate-limit.guard';
import { ContadorEmMemoria, ContadorNoRedis } from './contador';
import { RedisDeMentira } from './testing/redis-de-mentira';

describe('ContadorEmMemoria', () => {
  it('libera até o limite e barra o seguinte', async () => {
    const contador = new ContadorEmMemoria(3, 1000, () => 500);

    expect(await contador.permitir('ip')).toBe(true);
    expect(await contador.permitir('ip')).toBe(true);
    expect(await contador.permitir('ip')).toBe(true);
    expect(await contador.permitir('ip')).toBe(false);
  });
});

describe('ContadorNoRedis', () => {
  it('conta junto o que chega por instâncias diferentes', async () => {
    const servidor = new RedisDeMentira(() => 1000);
    // Duas instâncias da API, dois contadores, um Redis: é o caso que a
    // versão em memória errava, liberando o limite inteiro pra cada uma.
    const instanciaA = new ContadorNoRedis(servidor.cliente(), IP_ATTEMPT_LIMIT, IP_WINDOW_MS);
    const instanciaB = new ContadorNoRedis(servidor.cliente(), IP_ATTEMPT_LIMIT, IP_WINDOW_MS);

    for (let i = 0; i < IP_ATTEMPT_LIMIT / 2; i += 1) {
      expect(await instanciaA.permitir('203.0.113.7')).toBe(true);
      expect(await instanciaB.permitir('203.0.113.7')).toBe(true);
    }

    expect(await instanciaA.permitir('203.0.113.7')).toBe(false);
    expect(await instanciaB.permitir('203.0.113.7')).toBe(false);
  });

  it('libera de novo quando a janela passa', async () => {
    let agora = 1000;
    const servidor = new RedisDeMentira(() => agora);
    const contador = new ContadorNoRedis(servidor.cliente(), 2, 60_000);

    expect(await contador.permitir('ip')).toBe(true);
    expect(await contador.permitir('ip')).toBe(true);
    expect(await contador.permitir('ip')).toBe(false);

    agora += 60_001;
    expect(await contador.permitir('ip')).toBe(true);
  });

  it('é janela fixa, não deslizante: bater no teto sem parar não adia a liberação', async () => {
    let agora = 1000;
    const servidor = new RedisDeMentira(() => agora);
    const contador = new ContadorNoRedis(servidor.cliente(), 2, 60_000);

    await contador.permitir('ip');
    await contador.permitir('ip');

    // Insistindo o tempo todo até quase o fim da janela.
    for (let i = 0; i < 5; i += 1) {
      agora += 10_000;
      expect(await contador.permitir('ip')).toBe(false);
    }

    agora += 15_000;
    expect(await contador.permitir('ip')).toBe(true);
  });

  it('conta cada IP separadamente', async () => {
    const servidor = new RedisDeMentira(() => 1000);
    const contador = new ContadorNoRedis(servidor.cliente(), 1, 60_000);

    expect(await contador.permitir('203.0.113.7')).toBe(true);
    expect(await contador.permitir('203.0.113.7')).toBe(false);
    expect(await contador.permitir('198.51.100.4')).toBe(true);
  });

  it('Redis fora do ar deixa passar em vez de fechar o portão', async () => {
    const servidor = new RedisDeMentira(() => 1000);
    const contador = new ContadorNoRedis(servidor.cliente(), 1, 60_000);

    expect(await contador.permitir('ip')).toBe(true);
    expect(await contador.permitir('ip')).toBe(false);

    // Derrubar cadastro e login porque o cache caiu é pior do que perder
    // o teto por alguns segundos.
    servidor.quebrado = true;
    expect(await contador.permitir('ip')).toBe(true);
  });
});
