/**
 * Schema Drizzle para o Postgres (Neon) real do RPG-Legend-Server
 * (`accounts.js`'s `init()`, releitura direta do repo em
 * github.com/Kingdark17/RPG-Legend-Server, não da cópia desatualizada que
 * existe em `rpg-legend/server/` neste repo).
 *
 * Este arquivo é uma RECRIAÇÃO fiel do schema que já existe e já está em
 * produção, com contas de usuários reais — não uma proposta de schema novo.
 * Serve pra consultas tipadas no Nest, não pra "possuir" as migrações
 * dessas tabelas: elas já são criadas/alteradas de forma idempotente pelo
 * `init()` do servidor original (`CREATE TABLE IF NOT EXISTS` / `ALTER
 * TABLE ADD COLUMN IF NOT EXISTS`). Enquanto os dois servidores rodarem
 * lado a lado, `drizzle-kit push`/`migrate` NÃO deve ser apontado pro banco
 * de produção a partir daqui sem decisão explícita — o risco é standard
 * dessincronizar do que `accounts.js` espera ou, pior, apagar dado real.
 *
 * Dois índices do original usam expressão SQL (não uma coluna simples):
 * `users_email_lower_idx` é um índice único PARCIAL (`WHERE email IS NOT
 * NULL`), e `chat_messages_pair_idx` indexa `LEAST`/`GREATEST` dos dois ids
 * pra achar uma conversa nos dois sentidos. Reproduzidos aqui com `sql`,
 * mas ainda NÃO validados contra `drizzle-kit generate` de verdade (isso
 * exigiria decidir contra qual banco rodar primeiro).
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  char,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    username: varchar('username', { length: 24 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    passwordSalt: text('password_salt').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    email: varchar('email', { length: 254 }),
    avatarUrl: text('avatar_url').notNull().default(''),
    profileFrame: varchar('profile_frame', { length: 32 }).notNull().default('none'),
    nameColor: varchar('name_color', { length: 16 }).notNull().default('#e8d7a5'),
    pet: varchar('pet', { length: 32 }).notNull().default('none'),
    /** `{ frames: string[], colors: string[], pets: string[] }` — ver `cosmeticsFor()` em accounts.js. */
    cosmetics: jsonb('cosmetics')
      .notNull()
      .default({ frames: ['none'], colors: ['#e8d7a5', '#ffffff'], pets: ['none'] }),
    emailVerified: boolean('email_verified').notNull().default(false),
    emailVerificationTokenHash: char('email_verification_token_hash', { length: 64 }),
    emailVerificationExpiresAt: timestamp('email_verification_expires_at', { withTimezone: true }),
    passwordResetTokenHash: char('password_reset_token_hash', { length: 64 }),
    passwordResetExpiresAt: timestamp('password_reset_expires_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('users_username_lower_idx').on(sql`lower(${table.username})`),
    uniqueIndex('users_email_lower_idx')
      .on(sql`lower(${table.email})`)
      .where(sql`${table.email} is not null`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    tokenHash: char('token_hash', { length: 64 }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('sessions_user_idx').on(table.userId)],
);

/** Chave primária composta `(user_id, slot)` — até `MAX_SLOTS` (4) personagens por conta. */
export const cloudSaves = pgTable(
  'cloud_saves',
  {
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slot: integer('slot').notNull().default(1),
    /** Save inteiro do jogo (`{hero, inventory, party, floor, map, ...}`) — mesmo formato que o cliente envia, sem schema tipado do lado do banco. */
    data: jsonb('data').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.slot] })],
);

export const cloudSaveHistory = pgTable(
  'cloud_save_history',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slot: integer('slot').notNull().default(1),
    data: jsonb('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('cloud_save_history_user_idx').on(table.userId, table.createdAt.desc()),
    index('cloud_save_history_user_slot_idx').on(table.userId, table.slot, table.createdAt.desc()),
  ],
);

export const friendRequests = pgTable(
  'friend_requests',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    fromId: bigint('from_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    toId: bigint('to_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('friend_requests_from_to_idx').on(table.fromId, table.toId), index('friend_requests_to_idx').on(table.toId)],
);

export const friendships = pgTable(
  'friendships',
  {
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    friendId: bigint('friend_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.friendId] }), index('friendships_user_idx').on(table.userId)],
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    senderId: bigint('sender_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipientId: bigint('recipient_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: varchar('body', { length: 2000 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (table) => [
    index('chat_messages_pair_idx').on(
      sql`least(${table.senderId}, ${table.recipientId})`,
      sql`greatest(${table.senderId}, ${table.recipientId})`,
      table.id.desc(),
    ),
  ],
);
