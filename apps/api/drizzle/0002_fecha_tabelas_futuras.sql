-- Fecha também as tabelas que ainda não existem.
--
-- A `0001` revoga o acesso de `anon`/`authenticated` tabela por tabela,
-- pelo nome. Isso protege as sete de hoje e mais nada: o Supabase deixa
-- um ALTER DEFAULT PRIVILEGES configurado pro papel `postgres` que dá
-- `arwdDxtm` (tudo: ler, inserir, atualizar, apagar) a `anon` e
-- `authenticated` em **toda tabela nova** criada no schema `public`.
--
-- Conferido no banco, não deduzido:
--
--   dono: postgres | tipo: r | acl: {postgres=arwdDxtm/postgres,
--     anon=arwdDxtm/postgres, authenticated=arwdDxtm/postgres, ...}
--
-- Sem isto, a próxima migração que criar uma tabela a entrega aberta pra
-- quem tiver a chave pública — e nenhum erro aparece, porque do ponto de
-- vista do Postgres está tudo certo. O jeito de não depender de alguém
-- lembrar de revogar é mudar o padrão.
--
-- `ALTER DEFAULT PRIVILEGES` sem `FOR ROLE` age sobre o papel corrente.
-- As migrações rodam como `postgres`, que é o dono das tabelas que
-- criamos, então é exatamente o conjunto certo. Os padrões de
-- `supabase_admin` ficam de fora de propósito: eles valem pras tabelas
-- internas do próprio Supabase, que não são nossas pra mexer.
--
-- Mesmo DO guardado da `0001`: fora do Supabase os papéis não existem e
-- este arquivo precisa ser um nada-a-fazer, não um erro.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    RAISE NOTICE 'Sem o papel anon: não é Supabase, nada a fechar.';
    RETURN;
  END IF;

  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated';
END $$;
