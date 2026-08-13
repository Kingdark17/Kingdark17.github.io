/**
 * Postgres local pra desenvolvimento, sem Docker e sem credencial: o
 * mesmo PGlite dos testes de integração, mas persistindo em disco e
 * ficando de pé até você matar o processo.
 *
 * Uso:
 *   pnpm --filter api dev:db          # deixa rodando, imprime a DATABASE_URL
 *   DATABASE_URL=... pnpm --filter api start:dev
 *
 * Os dados vivem em `.pglite-dev/` (ignorado pelo git). Apagar a pasta
 * zera o banco.
 *
 * NÃO é o Neon: serve pra desenvolver e ver o app funcionando de ponta a
 * ponta, não pra validar comportamento específico do provedor.
 */

import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

import { ORIGINAL_DDL } from '../src/db/testing/original-ddl';

const PORT = Number(process.env.DEV_DB_PORT || 5433);
const DATA_DIR = '.pglite-dev';

async function main(): Promise<void> {
  const db = await PGlite.create(DATA_DIR);
  for (const statement of ORIGINAL_DDL) await db.exec(statement);

  const server = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1' });
  await server.start();

  const url = `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`;
  console.log(`Banco de desenvolvimento no ar. Dados em ${DATA_DIR}/`);
  console.log('');
  console.log(`  DATABASE_URL=${url}`);
  console.log('  DATABASE_SSL=false');
  console.log('');
  console.log('Ctrl+C encerra.');

  const encerrar = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', encerrar);
  process.on('SIGTERM', encerrar);
}

main().catch((err) => {
  console.error('Falha ao subir o banco de desenvolvimento:', err);
  process.exit(1);
});
