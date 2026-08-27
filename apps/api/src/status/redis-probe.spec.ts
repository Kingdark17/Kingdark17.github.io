import { RedisDeMentira } from '../shared-state/testing/redis-de-mentira';
import { probeRedis } from './redis-probe';

describe('probeRedis', () => {
  it('sem `REDIS_URL`, o cliente é `null`: nada configurado, nada conectado', async () => {
    expect(await probeRedis(null)).toEqual({ configured: false, connected: false });
  });

  it('com Redis de pé, responde configurado e conectado', async () => {
    expect(await probeRedis(new RedisDeMentira().cliente())).toEqual({ configured: true, connected: true });
  });

  /**
   * A distinção que importa no painel: "a variável não entrou" e "a
   * variável entrou mas o serviço está fora" pedem consertos diferentes, e
   * de fora pareciam a mesma coisa — a sala simplesmente não sobrevivia.
   */
  it('configurado mas fora do ar não vira "não configurado"', async () => {
    const redis = new RedisDeMentira();
    redis.quebrado = true;

    expect(await probeRedis(redis.cliente())).toEqual({ configured: true, connected: false });
  });

  it('Redis fora do ar não derruba a sonda', async () => {
    const redis = new RedisDeMentira();
    redis.quebrado = true;

    await expect(probeRedis(redis.cliente())).resolves.toBeDefined();
  });

  /** `/health` é chamado por monitor de uptime: não pode deixar rastro. */
  it('a sonda não escreve nada', async () => {
    const redis = new RedisDeMentira();

    await probeRedis(redis.cliente());

    expect(redis.textos.size).toBe(0);
    expect(redis.contadores.size).toBe(0);
    expect(redis.conjuntos.size).toBe(0);
  });
});
