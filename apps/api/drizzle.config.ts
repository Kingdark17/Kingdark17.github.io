import { defineConfig } from 'drizzle-kit';

/**
 * `dbCredentials.url` fica vazia por padrão de propósito — `drizzle-kit
 * generate` (comparar schema.ts contra as migrações já geradas) não
 * precisa de conexão real. Só `push`/`migrate`/`studio` exigem uma
 * `DATABASE_URL` de verdade, e devem ser rodados com o ambiente escolhido
 * explicitamente na hora (nunca hardcoded aqui).
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
