-- Fecha a porta que o Supabase abre sozinho.
--
-- O Supabase publica um PostgREST em cima do schema `public`, e a chave
-- `anon` é pública por natureza: ela vai no navegador. Com as tabelas em
-- `public` e sem RLS, qualquer pessoa com essa chave lê a tabela `users`
-- inteira — e-mail, hash e salt de senha, tudo. No Neon isso não existe,
-- porque não há API HTTP na frente do banco.
--
-- Nada no jogo fala com o PostgREST: a autenticação é própria (scrypt) e
-- a API se conecta como dona das tabelas. Então o certo é fechar a porta,
-- não usá-la.
--
-- Dono de tabela ignora RLS (não estamos usando FORCE), então a API
-- continua funcionando exatamente igual. Quem para na porta é só quem
-- chega pelo PostgREST.
--
-- Envolvido num DO que só age se o papel `anon` existir: fora do Supabase
-- esses papéis não existem, e a migração precisa ser um nada-a-fazer em
-- vez de um erro. É o que mantém este arquivo rodando também em PGlite,
-- Neon e num Postgres local.

DO $$
DECLARE
  tabela text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    RAISE NOTICE 'Sem o papel anon: não é Supabase, nada a fechar.';
    RETURN;
  END IF;

  FOREACH tabela IN ARRAY ARRAY['users', 'sessions', 'cloud_saves', 'cloud_save_history', 'friend_requests', 'friendships', 'chat_messages']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabela);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', tabela);
  END LOOP;

  -- Sem isto, um `nextval` ainda seria alcançável pelos mesmos papéis.
  REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
  REVOKE USAGE ON SCHEMA public FROM anon, authenticated;
END $$;
