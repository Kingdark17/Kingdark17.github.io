/**
 * Um Redis de mentira, em memória, com as poucas semânticas que este
 * código usa: contador que expira, conjunto, e publicação num canal.
 *
 * É o mesmo espírito do `pglite-harness`, com uma diferença que precisa
 * ficar dita: **o PGlite é um Postgres de verdade; isto aqui não é um
 * Redis de verdade.** Serve pra provar a lógica — que a janela reinicia,
 * que instância que para de renovar some, que o publicador não entrega
 * duas vezes pra si mesmo. Não prova nada sobre reconexão, partição de
 * rede ou o comportamento real do `PEXPIRE`. Isso só um Redis de verdade
 * pega, e não tem um aqui.
 *
 * O relógio entra injetado pra o teste de expiração não depender de
 * espera real.
 */

import type { ClienteRedis } from '../cliente-redis';

type Ouvinte = (canal: string, mensagem: string) => void;

export class RedisDeMentira {
  readonly contadores = new Map<string, number>();
  readonly conjuntos = new Map<string, Set<string>>();
  readonly prazos = new Map<string, number>();
  readonly ouvintes: { canal: string; ouvinte: Ouvinte }[] = [];
  /** Ligue pra simular Redis fora do ar. */
  quebrado = false;

  constructor(public agora: () => number = Date.now) {}

  /** Expiração preguiçosa, como a do Redis: só se percebe ao ler. */
  conferirPrazo(chave: string): void {
    const prazo = this.prazos.get(chave);
    if (prazo !== undefined && this.agora() >= prazo) {
      this.prazos.delete(chave);
      this.contadores.delete(chave);
      this.conjuntos.delete(chave);
    }
  }

  responder<T>(valor: T): Promise<T> {
    return this.quebrado ? Promise.reject(new Error('Redis fora do ar')) : Promise.resolve(valor);
  }

  cliente(): ClienteRedis {
    return new ClienteDeMentira(this);
  }
}

class ClienteDeMentira implements ClienteRedis {
  private canal = '';

  constructor(private readonly servidor: RedisDeMentira) {}

  incr(chave: string): Promise<number> {
    this.servidor.conferirPrazo(chave);
    const proximo = (this.servidor.contadores.get(chave) ?? 0) + 1;
    this.servidor.contadores.set(chave, proximo);
    return this.servidor.responder(proximo);
  }

  pexpire(chave: string, milissegundos: number): Promise<number> {
    this.servidor.prazos.set(chave, this.servidor.agora() + milissegundos);
    return this.servidor.responder(1);
  }

  sadd(chave: string, membro: string): Promise<number> {
    this.servidor.conferirPrazo(chave);
    const conjunto = this.servidor.conjuntos.get(chave) ?? new Set<string>();
    const novo = conjunto.has(membro) ? 0 : 1;
    conjunto.add(membro);
    this.servidor.conjuntos.set(chave, conjunto);
    return this.servidor.responder(novo);
  }

  srem(chave: string, membro: string): Promise<number> {
    this.servidor.conferirPrazo(chave);
    return this.servidor.responder(this.servidor.conjuntos.get(chave)?.delete(membro) ? 1 : 0);
  }

  exists(...chaves: string[]): Promise<number> {
    let achadas = 0;
    for (const chave of chaves) {
      this.servidor.conferirPrazo(chave);
      if (this.servidor.contadores.has(chave) || this.servidor.conjuntos.has(chave)) achadas += 1;
    }
    return this.servidor.responder(achadas);
  }

  smembers(chave: string): Promise<string[]> {
    this.servidor.conferirPrazo(chave);
    return this.servidor.responder([...(this.servidor.conjuntos.get(chave) ?? [])]);
  }

  publish(canal: string, mensagem: string): Promise<number> {
    // Como no Redis: todo inscrito recebe, inclusive quem publicou.
    for (const inscrito of this.servidor.ouvintes) if (inscrito.canal === canal) inscrito.ouvinte(canal, mensagem);
    return this.servidor.responder(this.servidor.ouvintes.length);
  }

  subscribe(canal: string): Promise<unknown> {
    this.canal = canal;
    return this.servidor.responder(1);
  }

  on(_evento: 'message', ouvinte: Ouvinte): this {
    this.servidor.ouvintes.push({ canal: this.canal, ouvinte });
    return this;
  }

  duplicate(): ClienteRedis {
    return new ClienteDeMentira(this.servidor);
  }

  quit(): Promise<unknown> {
    return Promise.resolve('OK');
  }
}
