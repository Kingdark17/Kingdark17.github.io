/**
 * Conexão com o Postgres (Neon), criada só quando pedida pela primeira vez
 * — não na importação do módulo. Lança se `DATABASE_URL` não estiver
 * configurada, de propósito: assim build/typecheck/test nunca tentam
 * conectar em lugar nenhum sem alguém decidir isso explicitamente.
 *
 * SSL segue a mesma regra do `accounts.js` original: desligado só se
 * `DATABASE_SSL=false`, ligado (sem verificar o certificado, igual o Neon
 * exige atrás de pooler) em qualquer outro caso.
 */

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

/**
 * Erro com tipo próprio (em vez de `Error` genérico) pra o filtro HTTP
 * distinguir "ninguém configurou o banco" de "a query falhou" sem
 * comparar texto de mensagem — o original respondia 503 nesse caso.
 */
export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super('DATABASE_URL não configurada — defina antes de usar o banco de dados.');
    this.name = 'DatabaseNotConfiguredError';
  }
}

let pool: Pool | null = null;
let db: Database | null = null;

export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

export function getDb(): Database {
  if (db) return db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new DatabaseNotConfiguredError();
  }

  pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    // O banco de desenvolvimento (`pnpm --filter api dev:db`) é PGlite
    // atrás de um servidor de socket que atende **uma conexão por vez**:
    // com o pool padrão de 10 as consultas concorrentes derrubam umas às
    // outras com ECONNRESET, e a API responde 500 sem motivo aparente.
    // Em produção a variável não existe e o padrão do `pg` vale.
    ...(process.env.DATABASE_POOL_MAX ? { max: Number(process.env.DATABASE_POOL_MAX) } : {}),
  });
  db = drizzle(pool, { schema });
  return db;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}
