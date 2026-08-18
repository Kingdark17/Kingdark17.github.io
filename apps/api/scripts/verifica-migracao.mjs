/**
 * Prova, contra um Postgres de verdade e vazio, que `pnpm db:migrate`
 * funciona de ponta a ponta — o runner do drizzle-kit, o journal, a
 * tabela de controle, tudo. Roda duas vezes pra confirmar que repetir é
 * um nada-a-fazer.
 *
 * **Por que `spawn` e não `spawnSync`.** O `PGLiteSocketServer` mora neste
 * mesmo processo, e `spawnSync` trava o event loop do Node até o filho
 * terminar. O drizzle-kit tentava conectar, o servidor que devia atendê-lo
 * estava congelado esperando o próprio drizzle-kit acabar, e os dois
 * ficavam parados pra sempre. Com `spawn` o loop continua girando e o
 * servidor atende.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

/** Caminho fixo em vez de `npx`: não depende do PATH nem baixa nada. */
const DRIZZLE_KIT = fileURLToPath(new URL(`../node_modules/.bin/drizzle-kit${process.platform === 'win32' ? '.CMD' : ''}`, import.meta.url));
const RAIZ_DO_PACOTE = new URL('..', import.meta.url);

const PORT = 54329;
const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1', maxConnections: 10 });
await server.start();

const url = `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`;

function migrar(rodada) {
  return new Promise((resolve) => {
    const filho = spawn(`"${DRIZZLE_KIT}" migrate`, {
      // `cwd` explícito: o drizzle.config.ts está na raiz do pacote, não
      // aqui em `scripts/`, e o comando é achado por caminho relativo.
      cwd: RAIZ_DO_PACOTE,
      // O drizzle-kit lê o `.env` do pacote sozinho — que hoje aponta pro
      // Supabase. Variável já presente no ambiente ganha do arquivo, e é
      // isso que mantém esta verificação dentro do PGlite descartável. A
      // listagem de tabelas no fim é lida do PGlite, então se um dia essa
      // precedência mudar, o resultado vem vazio em vez de mentir.
      env: { ...process.env, DATABASE_URL: url, DATABASE_SSL: 'false' },
      shell: true,
    });

    let saida = '';
    filho.stdout.on('data', (pedaco) => (saida += pedaco));
    filho.stderr.on('data', (pedaco) => (saida += pedaco));

    filho.on('close', (status) => {
      console.log(`--- rodada ${rodada}: saída ${status} ---`);
      console.log(saida.trim() || '(sem saída)');
      resolve(status);
    });
  });
}

const tabelas = async () =>
  (await db.query(`select table_name from information_schema.tables where table_schema='public' order by 1`)).rows.map((r) => r.table_name);

const primeira = await migrar(1);
const depoisDaPrimeira = await tabelas();
console.log('\ntabelas criadas:', depoisDaPrimeira.join(', '));

const segunda = await migrar(2);
const depoisDaSegunda = await tabelas();

console.log('\nrepetir mudou alguma coisa?', depoisDaSegunda.length === depoisDaPrimeira.length ? 'não' : 'SIM — problema');
console.log('resultado:', primeira === 0 && segunda === 0 ? 'OK' : 'FALHOU');

await server.stop();
await db.close();
