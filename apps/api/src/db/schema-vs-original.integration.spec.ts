/**
 * A migração gerada por `pnpm db:generate` cria **o mesmo banco** que o
 * `init()` do servidor original criou em produção?
 *
 * A pergunta importa na mudança pro Supabase: um banco novo nasce da
 * migração, e o banco de produção nasceu do DDL. Se os dois divergirem, o
 * jogo funciona nos testes (que rodam sobre o DDL) e se comporta diferente
 * no banco novo — que é o pior tipo de diferença, porque não falha, só
 * fica errada.
 *
 * O teste sobe dois Postgres de verdade, um de cada jeito, e compara
 * coluna a coluna, índice a índice, constraint a constraint. Não usa o
 * `pglite-harness` porque não precisa de `DATABASE_URL` nem do pool: aqui
 * o assunto é só o formato do banco.
 *
 * Ele já pegou uma diferença que ninguém veria de olho: o `.desc()` do
 * Drizzle gera `DESC NULLS LAST`, e `DESC` puro no Postgres é `NULLS
 * FIRST`. Índice com ordem de nulos diferente da consulta **não é usado
 * pra ordenar** — o banco cria o índice, não reclama de nada, e ordena na
 * mão. Só apareceria como lentidão em produção.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';

import { ORIGINAL_DDL } from './testing/original-ddl';

jest.setTimeout(60_000);

const PASTA_DA_MIGRACAO = join(__dirname, '..', '..', 'drizzle');

function comandosDaMigracao(): string[] {
  const arquivos = readdirSync(PASTA_DA_MIGRACAO)
    .filter((nome) => nome.endsWith('.sql'))
    .sort();

  return arquivos.flatMap((nome) =>
    readFileSync(join(PASTA_DA_MIGRACAO, nome), 'utf8')
      .split('--> statement-breakpoint')
      .map((comando) => comando.trim())
      .filter(Boolean),
  );
}

async function bancoCom(comandos: string[]): Promise<PGlite> {
  const banco = await PGlite.create();
  for (const comando of comandos) await banco.exec(comando);
  return banco;
}

const COLUNAS = `
  select table_name, column_name, data_type, is_nullable, coalesce(column_default, '') as padrao,
         coalesce(character_maximum_length, -1) as tamanho
  from information_schema.columns where table_schema = 'public' order by 1, 2`;

const INDICES = `select tablename, indexdef from pg_indexes where schemaname = 'public' order by 1, 2`;

const CHAVES = `
  select table_name, constraint_name, constraint_type from information_schema.table_constraints
  where table_schema = 'public' and constraint_type in ('PRIMARY KEY', 'UNIQUE')
  order by 1, 2`;

/**
 * Estrangeiras comparadas **sem o nome**: o Postgres batiza sozinho de
 * `sessions_user_id_fkey`, o Drizzle de `sessions_user_id_users_id_fk`, e
 * nenhum código lê esses nomes — `isUniqueViolation` olha só o SQLSTATE.
 * O que precisa bater é para onde a chave aponta e o que ela faz quando o
 * alvo some, que é o `ON DELETE CASCADE` do qual a conta apagada depende.
 */
const ESTRANGEIRAS = `
  select tc.table_name, kcu.column_name, ccu.table_name as alvo, ccu.column_name as coluna_alvo, rc.delete_rule
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
  join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
  join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
  where tc.table_schema = 'public' and tc.constraint_type = 'FOREIGN KEY'
  order by 1, 2, 3, 4`;

async function retrato(banco: PGlite, consulta: string): Promise<string[]> {
  const { rows } = await banco.query<Record<string, unknown>>(consulta);
  return rows.map((linha) => JSON.stringify(linha));
}

describe('migração gerada × DDL do servidor original', () => {
  let doOriginal: PGlite;
  let daMigracao: PGlite;

  beforeAll(async () => {
    doOriginal = await bancoCom(ORIGINAL_DDL);
    daMigracao = await bancoCom(comandosDaMigracao());
  });

  afterAll(async () => {
    await doOriginal?.close();
    await daMigracao?.close();
  });

  it('existe migração gerada pra comparar', () => {
    // Sem isto, apagar a pasta `drizzle/` faria os outros testes passarem
    // comparando dois bancos vazios.
    expect(comandosDaMigracao().length).toBeGreaterThan(0);
  });

  it('as mesmas colunas, com os mesmos tipos, tamanhos e padrões', async () => {
    expect(await retrato(daMigracao, COLUNAS)).toEqual(await retrato(doOriginal, COLUNAS));
  });

  /**
   * Comparado pela **definição**, não pelo nome: é a definição que diz se
   * o índice serve pra consulta. Nome diferente só confunde quem lê o
   * `EXPLAIN`; ordem de nulos diferente muda o plano.
   */
  it('os mesmos índices, com a mesma definição', async () => {
    expect(await retrato(daMigracao, INDICES)).toEqual(await retrato(doOriginal, INDICES));
  });

  it('as mesmas chaves primárias e únicas, com os mesmos nomes', async () => {
    expect(await retrato(daMigracao, CHAVES)).toEqual(await retrato(doOriginal, CHAVES));
  });

  it('as mesmas estrangeiras, apontando pro mesmo lugar e com o mesmo ON DELETE', async () => {
    expect(await retrato(daMigracao, ESTRANGEIRAS)).toEqual(await retrato(doOriginal, ESTRANGEIRAS));
  });
});
