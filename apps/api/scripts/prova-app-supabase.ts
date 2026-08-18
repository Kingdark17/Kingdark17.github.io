/**
 * Prova que o código do app fala com o banco — não só que as tabelas
 * existem. Usa o `schema.ts` de verdade e o `getDb()` de verdade, então
 * um nome de coluna errado, um tipo trocado ou um default que não existe
 * aparecem aqui e não em produção.
 *
 * Escreve um usuário de teste, lê de volta, e apaga no fim (inclusive se
 * der erro no meio). Não deixa lixo no banco.
 *
 * Uso: pnpm --filter api db:smoke
 *
 * Aponta pro que estiver no `.env` — então **confira contra qual banco
 * está rodando antes**. Escrever num banco com gente dentro não é a
 * ideia, mesmo apagando depois.
 *
 * Nunca imprime a string de conexão nem a senha.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { eq } from 'drizzle-orm';

import { closeDb, getDb } from '../src/db/client';
import { cloudSaves, users } from '../src/db/schema';

const linha = readFileSync(join(__dirname, '..', '.env'), 'utf8').match(/^DATABASE_URL=(.+)$/m);
if (!linha) throw new Error('sem DATABASE_URL no .env');
// Antes de qualquer `getDb()`: o pool nasce na primeira chamada, não na
// importação — é o que deixa este arquivo escolher o destino.
process.env.DATABASE_URL = linha[1].trim();

const APELIDO = `__prova_${Date.now()}`;

async function main(): Promise<void> {
  const db = getDb();
  let id: number | null = null;

  try {
    const [criado] = await db
      .insert(users)
      .values({ username: APELIDO, passwordHash: 'hash-de-mentira', passwordSalt: 'sal-de-mentira' })
      .returning({ id: users.id, avatarUrl: users.avatarUrl, cosmetics: users.cosmetics, criadoEm: users.createdAt });
    id = criado.id;

    console.log('inseriu usuario  : id', criado.id);
    console.log('default aplicado : avatar_url =', JSON.stringify(criado.avatarUrl), '| cosmetics =', JSON.stringify(criado.cosmetics));
    console.log('created_at veio  :', criado.criadoEm instanceof Date ? 'como Date' : 'TIPO ERRADO');

    await db.insert(cloudSaves).values({ userId: id, slot: 1, data: { hero: { name: 'Prova', level: 7 }, floor: 3 } });
    const [save] = await db.select().from(cloudSaves).where(eq(cloudSaves.userId, id));
    console.log('jsonb ida e volta:', JSON.stringify(save.data));
    console.log('updated_at veio  :', save.updatedAt instanceof Date ? 'como Date' : 'TIPO ERRADO');

    const [lido] = await db.select({ nome: users.username }).from(users).where(eq(users.id, id));
    console.log('leu de volta     :', lido.nome === APELIDO ? 'igual ao que escreveu' : 'DIFERENTE');
  } finally {
    if (id !== null) {
      await getDb().delete(users).where(eq(users.id, id));
      const sobrou = await getDb().select({ id: cloudSaves.userId }).from(cloudSaves).where(eq(cloudSaves.userId, id));
      console.log('limpou           :', sobrou.length === 0 ? 'usuario e save apagados (cascade funcionou)' : 'SOBROU LIXO');
    }
    await closeDb();
  }
}

main().catch((erro) => {
  console.error('FALHOU:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
