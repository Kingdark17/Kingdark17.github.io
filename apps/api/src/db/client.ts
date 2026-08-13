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

let pool: Pool | null = null;
let db: Database | null = null;

export function getDb(): Database {
  if (db) return db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não configurada — defina antes de usar o banco de dados.');
  }

  pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
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
