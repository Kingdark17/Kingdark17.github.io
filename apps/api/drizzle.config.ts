import { defineConfig } from 'drizzle-kit';

/**
 * `dbCredentials.url` fica vazia por padrão de propósito — `drizzle-kit
 * generate` (comparar schema.ts contra as migrações já geradas) não
 * precisa de conexão real. Só `push`/`migrate`/`studio` exigem uma
 * `DATABASE_URL` de verdade.
 *
 * **Atenção: o drizzle-kit carrega o `.env` sozinho.** Não é preciso
 * exportar nada no shell — se existir um `apps/api/.env`, `migrate` e
 * `push` vão nele. Isso é cômodo e é exatamente por isso que é
 * perigoso: o comando parece inofensivo e o destino fica invisível.
 * Variável já exportada no ambiente ganha do arquivo, então dá pra
 * escolher outro banco na hora sem editar nada.
 *
 * Daí o aviso abaixo, que imprime pra onde a coisa vai antes de ir. O
 * `CLAUDE.md` deste repo pede pra nunca apontar `push`/`migrate` pro
 * banco de produção sem decisão explícita — lá dentro há contas de
 * pessoas de verdade. Ver o host na tela é o que transforma "eu achei
 * que estava no banco de teste" em algo que dá pra perceber a tempo.
 */

function avisarDestino(url: string): void {
  if (!url) {
    console.log('drizzle-kit: sem DATABASE_URL (só `generate` funciona assim).');
    return;
  }
  try {
    const { hostname, pathname } = new URL(url);
    console.log(`drizzle-kit: vai mexer em ${hostname}${pathname}`);
  } catch {
    console.log('drizzle-kit: DATABASE_URL definida, mas não é uma URL válida.');
  }
}

const url = process.env.DATABASE_URL ?? '';
avisarDestino(url);

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
});
