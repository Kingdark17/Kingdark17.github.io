/**
 * A fronteira com o Supabase Storage — e ela é estreita de propósito.
 *
 * A foto de perfil chega como `data:image/...;base64,...` de até 400 KB e
 * hoje mora **dentro do Postgres**, na coluna `users.avatar_url`. A rota
 * `/api/users/:username/avatar` decodifica isso a cada pedido, então toda
 * foto exibida é uma consulta ao banco de produção. O cache de um ano
 * segura a maior parte, mas o primeiro acesso de cada pessoa passa por ali.
 *
 * Com o Storage, os bytes saem do banco e o endereço vira público: o CDN
 * serve a imagem e nem a API nem o Postgres ficam no caminho. Quem enxerga
 * o quê não muda — a rota atual já é sem sessão, decidido em 2026-08-16.
 *
 * **Três chamadas, não um SDK.** O `@supabase/supabase-js` traz auth,
 * realtime e postgrest para fazer dois `fetch` e montar uma URL. O acordo
 * aqui é o mesmo do `cliente-redis.ts`: o tipo é o subconjunto que este
 * código usa, o que deixa o teste rodar contra um dublê sem rede.
 *
 * **Sem as variáveis, tudo se comporta como antes.** `ArmazenamentoNulo`
 * faz `updateProfile` guardar o `data:` no banco, exatamente como hoje. É o
 * mesmo acordo do `DATABASE_URL` e do `REDIS_URL`: nada de caminho que só
 * é exercitado em produção.
 */

import { createHash } from 'node:crypto';

export interface ArmazenamentoDeArquivos {
  /** Sobe os bytes e devolve o endereço público. */
  guardar(caminho: string, bytes: Buffer, mime: string): Promise<string>;
  apagar(caminho: string): Promise<void>;
  /**
   * Os caminhos sob um prefixo. Existe por causa da faxina: o nome do
   * objeto é o hash do conteúdo, então trocar de foto **cria** um objeto
   * em vez de substituir, e sem varrer a pasta da pessoa o antigo ficaria
   * pra sempre.
   */
  listar(prefixo: string): Promise<string[]>;
  /** O endereço público de um caminho, sem ir à rede. */
  endereco(caminho: string): string;
}

export const ARMAZENAMENTO = Symbol('ARMAZENAMENTO');

/**
 * O nome do objeto carrega o **hash do conteúdo**, e é isso que permite
 * cache eterno sem `?v=`: foto nova é endereço novo, e endereço que existe
 * nunca muda de conteúdo.
 *
 * O `id` da pessoa entra no caminho por um motivo prático: sem ele, duas
 * pessoas com a mesma foto dividiriam o mesmo objeto, e apagar a antiga de
 * uma apagaria a foto da outra. Com o id, apagar é sempre seguro.
 */
const EXTENSAO: Record<string, string> = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg' };

export function caminhoDaFoto(userId: number, bytes: Buffer, mime: string): string {
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 32);
  return `${userId}/${hash}.${EXTENSAO[mime] ?? 'jpg'}`;
}

/** Sem `SUPABASE_URL`: a foto continua indo pro Postgres, como sempre foi. */
export class ArmazenamentoNulo implements ArmazenamentoDeArquivos {
  guardar(): Promise<string> {
    return Promise.reject(new Error('armazenamento não configurado'));
  }

  apagar(): Promise<void> {
    return Promise.resolve();
  }

  listar(): Promise<string[]> {
    return Promise.resolve([]);
  }

  endereco(caminho: string): string {
    return caminho;
  }
}

export interface OpcoesDoSupabase {
  url: string;
  chave: string;
  balde: string;
  /** Injetável pra o teste não precisar de rede. */
  buscar?: typeof fetch;
}

export class ArmazenamentoNoSupabase implements ArmazenamentoDeArquivos {
  private readonly buscar: typeof fetch;

  constructor(private readonly opcoes: OpcoesDoSupabase) {
    this.buscar = opcoes.buscar ?? fetch;
  }

  /** Sem barra no fim. Laço em vez de `/\/+$/`, que backtracka em barra repetida. */
  private get raiz(): string {
    let url = this.opcoes.url;
    while (url.endsWith('/')) url = url.slice(0, -1);
    return url;
  }

  endereco(caminho: string): string {
    return `${this.raiz}/storage/v1/object/public/${this.opcoes.balde}/${caminho}`;
  }

  /**
   * `x-upsert` porque o nome é o hash: reenviar a mesma foto cai no mesmo
   * objeto, e falhar com "já existe" seria recusar um caso que está certo.
   */
  async guardar(caminho: string, bytes: Buffer, mime: string): Promise<string> {
    const resposta = await this.buscar(`${this.raiz}/storage/v1/object/${this.opcoes.balde}/${caminho}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.opcoes.chave}`,
        'content-type': mime,
        'cache-control': 'max-age=31536000, immutable',
        'x-upsert': 'true',
      },
      body: new Uint8Array(bytes),
    });

    // O corpo do erro entra na mensagem, mas a chave **nunca** — ela só
    // existe no cabeçalho, e este texto pode acabar num log.
    if (!resposta.ok) throw new Error(`Storage recusou (${resposta.status}): ${await resposta.text()}`);

    return this.endereco(caminho);
  }

  /**
   * O `list` do Storage devolve os objetos de uma "pasta" — que não existe
   * de verdade, é só prefixo. Falha vira lista vazia: não achar o que
   * apagar é bem menos grave do que recusar a troca de foto.
   */
  async listar(prefixo: string): Promise<string[]> {
    try {
      const resposta = await this.buscar(`${this.raiz}/storage/v1/object/list/${this.opcoes.balde}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.opcoes.chave}`, 'content-type': 'application/json' },
        body: JSON.stringify({ prefix: prefixo, limit: 100 }),
      });
      if (!resposta.ok) return [];

      const itens = (await resposta.json()) as { name?: unknown }[];
      return itens.filter((item) => typeof item.name === 'string').map((item) => `${prefixo}${item.name as string}`);
    } catch {
      return [];
    }
  }

  /**
   * Falha ao apagar é engolida: o objeto órfão custa alguns KB, enquanto
   * recusar a troca de foto por causa dele estragaria a ação que a pessoa
   * pediu. Mesmo acordo do depósito de salas.
   */
  async apagar(caminho: string): Promise<void> {
    try {
      await this.buscar(`${this.raiz}/storage/v1/object/${this.opcoes.balde}/${caminho}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${this.opcoes.chave}` },
      });
    } catch {
      // Ver o comentário acima.
    }
  }
}

/** Lido na hora, não no boot — a mesma razão do `getDb()` e do Redis. */
export function criarArmazenamento(env: NodeJS.ProcessEnv = process.env): ArmazenamentoDeArquivos {
  const url = env.SUPABASE_URL?.trim();
  const chave = env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !chave) return new ArmazenamentoNulo();

  return new ArmazenamentoNoSupabase({ url, chave, balde: env.SUPABASE_BUCKET?.trim() || 'avatares' });
}

/**
 * O endereço é nosso? Decide se a foto antiga pode ser apagada ao trocar.
 *
 * Link que a pessoa digitou (`https://` de outro site) não é nosso e não se
 * apaga; `data:` do banco não tem objeto pra apagar.
 */
export function caminhoDoEndereco(endereco: string, armazenamento: ArmazenamentoDeArquivos): string | null {
  const prefixo = armazenamento.endereco('');
  return endereco.startsWith(prefixo) && prefixo.length > 1 ? endereco.slice(prefixo.length) : null;
}
