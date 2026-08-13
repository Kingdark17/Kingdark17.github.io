/**
 * DDL do `init()` do RPG-Legend-Server, copiado verbatim — inclusive a
 * ordem esquisita (cria a tabela, depois adiciona coluna, depois troca a
 * chave primária de `cloud_saves`), que é o histórico de como o banco de
 * produção foi ficando do jeito que está.
 *
 * É de propósito que o banco de teste nasça DISSO e não de
 * `drizzle-kit generate` a partir de `db/schema.ts`: gerar o DDL do nosso
 * próprio schema seria circular — o schema validaria a si mesmo. Partindo
 * do DDL real, qualquer divergência entre o que `db/schema.ts` acha que
 * existe e o que o banco de verdade tem estoura no primeiro teste.
 *
 * Se o servidor original mudar o `init()`, este arquivo precisa
 * acompanhar. Fonte: github.com/Kingdark17/RPG-Legend-Server,
 * `server/accounts.js` (NÃO a cópia velha em `rpg-legend/server/`).
 */

export const ORIGINAL_DDL: string[] = [
  `
  CREATE TABLE IF NOT EXISTS users(id BIGSERIAL PRIMARY KEY,username VARCHAR(24) UNIQUE NOT NULL,password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS sessions(token_hash CHAR(64) PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS cloud_saves(user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,data JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS cloud_save_history(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,data JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users(LOWER(username));
  CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS cloud_save_history_user_idx ON cloud_save_history(user_id,created_at DESC);
  `,
  `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(254);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_frame VARCHAR(32) NOT NULL DEFAULT 'none';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS name_color VARCHAR(16) NOT NULL DEFAULT '#e8d7a5';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS pet VARCHAR(32) NOT NULL DEFAULT 'none';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS cosmetics JSONB NOT NULL DEFAULT '{"frames":["none"],"colors":["#e8d7a5","#ffffff"],"pets":["none"]}'::jsonb;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token_hash CHAR(64);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token_hash CHAR(64);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;
  CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users(LOWER(email)) WHERE email IS NOT NULL;
  `,
  `
  CREATE TABLE IF NOT EXISTS friend_requests(id BIGSERIAL PRIMARY KEY,from_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,to_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(from_id,to_id));
  CREATE TABLE IF NOT EXISTS friendships(user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,friend_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,friend_id));
  CREATE TABLE IF NOT EXISTS chat_messages(id BIGSERIAL PRIMARY KEY,sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,body VARCHAR(2000) NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),read_at TIMESTAMPTZ);
  CREATE INDEX IF NOT EXISTS friend_requests_to_idx ON friend_requests(to_id);
  CREATE INDEX IF NOT EXISTS friendships_user_idx ON friendships(user_id);
  CREATE INDEX IF NOT EXISTS chat_messages_pair_idx ON chat_messages(LEAST(sender_id,recipient_id),GREATEST(sender_id,recipient_id),id DESC);
  `,
  `
  ALTER TABLE cloud_saves ADD COLUMN IF NOT EXISTS slot INT NOT NULL DEFAULT 1;
  ALTER TABLE cloud_saves DROP CONSTRAINT IF EXISTS cloud_saves_pkey;
  ALTER TABLE cloud_saves ADD CONSTRAINT cloud_saves_pkey PRIMARY KEY (user_id,slot);
  ALTER TABLE cloud_save_history ADD COLUMN IF NOT EXISTS slot INT NOT NULL DEFAULT 1;
  CREATE INDEX IF NOT EXISTS cloud_save_history_user_slot_idx ON cloud_save_history(user_id,slot,created_at DESC);
  `,
];

/** Ordem de limpeza entre testes: filha antes de mãe, por causa das FKs. */
export const TABLES_IN_DELETE_ORDER = ['chat_messages', 'friendships', 'friend_requests', 'cloud_save_history', 'cloud_saves', 'sessions', 'users'];
