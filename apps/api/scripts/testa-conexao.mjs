/**
 * Confere que dá pra conectar no banco apontado por `DATABASE_URL` e conta
 * o que já existe lá, antes de qualquer migração escrever alguma coisa.
 *
 * Nunca imprime a string de conexão nem a senha.
 */
import { readFileSync } from 'node:fs';

import pg from 'pg';

const linha = readFileSync(new URL('../.env', import.meta.url), 'utf8').match(/^DATABASE_URL=(.+)$/m);
if (!linha) {
  console.log('Sem DATABASE_URL no .env');
  process.exit(1);
}

const client = new pg.Client({ connectionString: linha[1].trim(), ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
} catch (erro) {
  console.log('NAO CONECTOU:', erro.message);
  process.exit(1);
}

const uma = async (sql) => (await client.query(sql)).rows;

const [{ versao }] = await uma(`select split_part(version(), ' on ', 1) as versao`);
const [{ agora }] = await uma(`select current_database() || ' / ' || current_user as agora`);
const tabelas = await uma(`select table_name from information_schema.tables where table_schema='public' order by 1`);
const papeis = await uma(`select rolname from pg_roles where rolname in ('anon','authenticated','service_role') order by 1`);

console.log('conectou  :', versao);
console.log('banco/user:', agora);
console.log('e supabase:', papeis.length ? 'SIM (' + papeis.map((p) => p.rolname).join(', ') + ')' : 'nao achei os papeis do supabase');
console.log('');
console.log('tabelas em public:', tabelas.length ? tabelas.map((t) => t.table_name).join(', ') : '(NENHUMA - banco vazio)');

await client.end();
