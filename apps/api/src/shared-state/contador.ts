/**
 * O contador de tentativas por IP, agora compartilhável entre instâncias.
 *
 * A versão em memória é o `RateLimiter` de sempre, com a mesma janela
 * fixa do `limited()` original. A versão Redis usa `INCR` + `PEXPIRE`,
 * que dá a mesma janela fixa: a primeira requisição da janela cria a
 * chave e marca o prazo; as seguintes só incrementam e a chave morre
 * sozinha no fim.
 *
 * `permitir` é assíncrono nos dois casos. Vale a pena mesmo na versão em
 * memória: se a assinatura mudasse junto com a implementação, trocar de
 * uma pra outra mudaria a forma de quem chama, e aí o caminho sem Redis
 * deixaria de ser o mesmo caminho.
 *
 * **Redis fora do ar não fecha o portão.** Se o `INCR` falhar, a
 * requisição passa: derrubar cadastro e login inteiros porque o cache
 * caiu é pior do que perder o teto por alguns segundos — e o teto existe
 * contra força bruta, não contra indisponibilidade.
 */

import { RateLimiter } from '../common/rate-limiter';
import type { ClienteRedis } from './cliente-redis';

export interface ContadorDeTentativas {
  permitir(chave: string): Promise<boolean>;
}

export class ContadorEmMemoria implements ContadorDeTentativas {
  private readonly limiter: RateLimiter;

  constructor(limite: number, janelaMs: number, agora: () => number = Date.now) {
    this.limiter = new RateLimiter(limite, janelaMs, agora);
  }

  permitir(chave: string): Promise<boolean> {
    return Promise.resolve(this.limiter.allow(chave));
  }
}

export class ContadorNoRedis implements ContadorDeTentativas {
  constructor(
    private readonly redis: ClienteRedis,
    private readonly limite: number,
    private readonly janelaMs: number,
    private readonly prefixo = 'rpg:tentativas:',
  ) {}

  async permitir(chave: string): Promise<boolean> {
    try {
      const contagem = await this.redis.incr(this.prefixo + chave);
      // Só a primeira da janela marca o prazo. Renovar a cada requisição
      // viraria janela deslizante, e quem batesse no teto sem parar
      // nunca destravaria.
      if (contagem === 1) await this.redis.pexpire(this.prefixo + chave, this.janelaMs);
      return contagem <= this.limite;
    } catch {
      return true;
    }
  }
}
