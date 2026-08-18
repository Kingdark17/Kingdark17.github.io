/**
 * Confere, no banco de verdade, o que a migração deixou — em vez de
 * confiar no "migrations applied successfully" do drizzle-kit.
 *
 * A parte que importa mais é a última: não pergunta se o privilégio foi
 * revogado, ela **vira o papel `anon`** e tenta ler a tabela `users`. Se
 * conseguir, o vazamento é real e o teste falha. `anon` é o papel por trás
 * da chave pública que vai no navegador de qualquer pessoa.
 *
 * Nunca imprime a string de conexão nem a senha.
 */
import { readFileSync } from 'node:fs';

import pg from 'pg';

const TABELAS = ['users', 'sessions', 'cloud_saves', 'cloud_save_history', 'friend_requests', 'friendships', 'chat_messages'];

const linha = readFileSync(new URL('../.env', import.meta.url), 'utf8').match(/^DATABASE_URL=(.+)$/m);
const client = new pg.Client({ connectionString: linha[1].trim(), ssl: { rejectUnauthorized: false } });
await client.connect();

const uma = async (sql, args) => (await client.query(sql, args)).rows;
let falhas = 0;
const conferir = (ok, texto) => {
  if (!ok) falhas += 1;
  console.log(`  ${ok ? 'ok  ' : 'FALHA'} ${texto}`);
};

console.log('=== tabelas ===');
const achadas = (await uma(`select table_name from information_schema.tables where table_schema='public'`)).map((r) => r.table_name);
for (const t of TABELAS) conferir(achadas.includes(t), t);
const sobrando = achadas.filter((t) => !TABELAS.includes(t) && t !== '__drizzle_migrations');
if (sobrando.length) console.log('  (tabelas a mais:', sobrando.join(', ') + ')');

console.log('\n=== colunas por tabela ===');
for (const t of TABELAS) {
  const cols = await uma(`select column_name from information_schema.columns where table_schema='public' and table_name=$1`, [t]);
  console.log(`  ${t}: ${cols.length} colunas`);
}

console.log('\n=== indices ===');
const indices = await uma(`select tablename, indexname from pg_indexes where schemaname='public' order by 1,2`);
for (const t of TABELAS) {
  const meus = indices.filter((i) => i.tablename === t).map((i) => i.indexname);
  console.log(`  ${t}: ${meus.join(', ')}`);
}

console.log('\n=== chaves estrangeiras ===');
const fks = await uma(`
  select tc.table_name, kcu.column_name, ccu.table_name as alvo, rc.delete_rule
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
  join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
  join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
  where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public'
  order by 1,2`);
for (const f of fks) console.log(`  ${f.table_name}.${f.column_name} -> ${f.alvo} (on delete ${f.delete_rule})`);
conferir(fks.length > 0, `${fks.length} chaves estrangeiras`);

console.log('\n=== RLS ligado? ===');
const rls = await uma(`select relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r'`);
for (const t of TABELAS) conferir(rls.find((r) => r.relname === t)?.relrowsecurity === true, `${t} com RLS`);

console.log('\n=== acesso publico fechado? ===');
// Nao se pergunta por USAGE no schema: `PUBLIC` tem `=U` por padrao no
// Postgres, entao `has_schema_privilege('anon', ...)` responde `true`
// mesmo com o REVOKE da 0001 aplicado. E responder `true` ali nao e
// vazamento nenhum — USAGE sozinho resolve nome, nao le linha. Quem
// responde de verdade e o privilegio de tabela, logo abaixo.
for (const papel of ['anon', 'authenticated']) {
  const podem = [];
  for (const t of TABELAS) {
    const [{ p }] = await uma(`select has_table_privilege($1, 'public.'||$2, 'SELECT') as p`, [papel, t]);
    if (p) podem.push(t);
  }
  conferir(podem.length === 0, `${papel} nao le nenhuma tabela${podem.length ? ' (LE: ' + podem.join(', ') + ')' : ''}`);
}

console.log('\n=== e a proxima tabela, nasce fechada? ===');
// O Supabase deixa um ALTER DEFAULT PRIVILEGES dando tudo a anon nas
// tabelas futuras. Revogar as sete de hoje pelo nome nao alcanca a
// oitava. Este teste cria uma tabela descartavel e pergunta a ela.
await client.query('create table if not exists public.__teste_privilegio_padrao (id int)');
const [{ p: futuraLe }] = await uma(`select has_table_privilege('anon', 'public.__teste_privilegio_padrao', 'SELECT') as p`);
const [{ p: futuraEscreve }] = await uma(`select has_table_privilege('anon', 'public.__teste_privilegio_padrao', 'INSERT') as p`);
await client.query('drop table public.__teste_privilegio_padrao');
conferir(futuraLe === false, 'tabela nova nao nasce legivel por anon');
conferir(futuraEscreve === false, 'tabela nova nao nasce gravavel por anon');

console.log('\n=== a prova de fogo: virar anon e tentar ler users ===');
try {
  await client.query('set role anon');
  const r = await client.query('select email, password_hash from public.users limit 1');
  conferir(false, `anon LEU a tabela users (${r.rowCount} linhas) — vazamento real`);
} catch (erro) {
  conferir(true, `anon barrado ao ler users: ${erro.message.split('\n')[0]}`);
}
await client.query('reset role');

console.log(falhas === 0 ? '\nRESULTADO: tudo certo' : `\nRESULTADO: ${falhas} FALHA(S)`);
await client.end();
process.exit(falhas === 0 ? 0 : 1);
