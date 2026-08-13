/**
 * Sobe um Postgres de verdade pros testes de integração: PGlite (Postgres
 * compilado em WASM) atrás de um socket que fala o protocolo do Postgres.
 *
 * A graça de passar pelo socket em vez de usar o driver `drizzle/pglite`
 * é que **nada** do código de produção muda nem sabe que está em teste: o
 * `getDb()` abre o mesmo `pg.Pool` de sempre contra uma `DATABASE_URL`
 * normal. Isso põe sob teste o `db/client.ts` inteiro — pool, SSL,
 * conexão preguiçosa — e não só as queries.
 *
 * Sem Docker e sem credencial. O banco vive em memória e morre no fim do
 * arquivo de teste.
 *
 * Limite conhecido: é Postgres de verdade, mas não é o Neon. Diferença de
 * versão, de extensão ou de comportamento do pooler não aparece aqui —
 * isso só um `DATABASE_URL` de staging pega.
 */

import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { sql } from 'drizzle-orm';

import { closeDb, getDb } from '../client';
import { ORIGINAL_DDL, TABLES_IN_DELETE_ORDER } from './original-ddl';

export interface PgliteHarness {
  /** Apaga o conteúdo de todas as tabelas, preservando o schema. */
  reset(): Promise<void>;
  stop(): Promise<void>;
}

/** Porta efêmera: `listen(0)` não dá pra usar porque o servidor pede número. */
function randomPort(): number {
  return 49152 + Math.floor(Math.random() * 10000);
}

async function startServer(db: PGlite): Promise<{ server: PGLiteSocketServer; port: number }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const port = randomPort();
    const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 10 });
    try {
      await server.start();
      return { server, port };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Precisa ser chamado antes de qualquer coisa que use `getDb()` — é aqui
 * que `DATABASE_URL` passa a existir.
 */
export async function startPglite(): Promise<PgliteHarness> {
  const pglite = await PGlite.create();
  const { server, port } = await startServer(pglite);

  process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
  process.env.DATABASE_SSL = 'false';

  for (const statement of ORIGINAL_DDL) await pglite.exec(statement);

  return {
    async reset() {
      // TRUNCATE ... CASCADE reinicia as sequences, o que mantém os ids
      // previsíveis entre testes.
      await getDb().execute(sql.raw(`TRUNCATE ${TABLES_IN_DELETE_ORDER.join(', ')} RESTART IDENTITY CASCADE`));
    },
    async stop() {
      await closeDb();
      await server.stop();
      await pglite.close();
      delete process.env.DATABASE_URL;
      delete process.env.DATABASE_SSL;
    },
  };
}
