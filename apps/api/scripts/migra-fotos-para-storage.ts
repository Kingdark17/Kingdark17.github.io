/**
 * Move as fotos de perfil que já existem — de `data:` dentro do Postgres
 * para objetos no Supabase Storage.
 *
 * Uso (sempre com as variáveis no ambiente, nunca no `.env`):
 *   pnpm --filter api fotos:migra                              ensaio
 *   pnpm --filter api fotos:migra -- --escrever --confirmo=<host>
 *
 * Precisa de `DATABASE_URL`, `SUPABASE_URL` e `SUPABASE_SERVICE_KEY`.
 *
 * **Não lê o `.env`**, pela mesma razão do copiador da virada: o
 * drizzle-kit lê, e foi isso que quase mandou comando pro banco errado.
 * Com `--escrever` ele ainda exige `--confirmo=<host do banco>`, e o host
 * tem que bater com o do `DATABASE_URL` de verdade.
 *
 * **Rodar de novo é seguro e retoma de onde parou.** Ele só olha linha
 * cujo `avatar_url` começa com `data:`, e a linha migrada deixa de casar.
 * O nome do objeto é o hash do conteúdo, então reenviar a mesma foto cai
 * no mesmo objeto em vez de duplicar.
 *
 * **A ordem importa e não é a óbvia.** Sobe primeiro, grava depois: se
 * gravasse o endereço antes de o objeto existir, uma falha no meio
 * deixaria a pessoa com um link quebrado — e o `data:` original já teria
 * sido perdido. Do jeito daqui, uma falha no meio deixa objeto órfão, que
 * não machuca ninguém e some na próxima troca de foto.
 *
 * Nunca imprime a string de conexão, a chave, nem os bytes.
 */
import { Client } from 'pg';

import { caminhoDaFoto, criarArmazenamento, ArmazenamentoNulo } from '../src/arquivos/armazenamento';
import { decodeAvatar } from '../src/social/avatar';

const args = process.argv.slice(2);
const escrever = args.includes('--escrever');
const confirmado = args.find((a) => a.startsWith('--confirmo='))?.slice('--confirmo='.length);

const bancoUrl = process.env.DATABASE_URL;
if (!bancoUrl) {
  console.error('Falta DATABASE_URL.');
  process.exit(1);
}

const armazenamento = criarArmazenamento();
if (armazenamento instanceof ArmazenamentoNulo) {
  console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_KEY.');
  process.exit(1);
}

const host = new URL(bancoUrl).host;
if (escrever && confirmado !== host) {
  console.error(`Pra escrever, repita o host do destino: --confirmo=${host}`);
  console.error(confirmado ? `Você escreveu "${confirmado}".` : 'Nada foi passado.');
  process.exit(1);
}

async function principal(): Promise<void> {
  const cliente = new Client({ connectionString: bancoUrl });
  await cliente.connect();

  try {
    const { rows } = await cliente.query<{ id: number; avatar_url: string }>(
      "SELECT id, avatar_url FROM users WHERE avatar_url LIKE 'data:%' ORDER BY id",
    );

    console.log(`${rows.length} foto(s) ainda no banco.`);
    if (!rows.length) return;

    const bytesNoBanco = rows.reduce((total, linha) => total + linha.avatar_url.length, 0);
    console.log(`${(bytesNoBanco / 1024 / 1024).toFixed(2)} MB de coluna que sai do Postgres.\n`);

    if (!escrever) {
      for (const linha of rows) {
        const foto = decodeAvatar(linha.avatar_url);
        const situacao = foto ? `${(foto.bytes.length / 1024).toFixed(0)} KB ${foto.mime}` : 'ILEGÍVEL — seria deixada como está';
        console.log(`  usuário ${linha.id}: ${situacao}`);
      }
      console.log(`\nEnsaio. Nada foi escrito. Pra valer: --escrever --confirmo=${host}`);
      return;
    }

    let movidas = 0;
    let intactas = 0;

    for (const linha of rows) {
      const foto = decodeAvatar(linha.avatar_url);
      // Foto que não decodifica fica onde está: a rota antiga ainda a
      // serve, e apagar dado de alguém por não entendê-lo é pior.
      if (!foto) {
        console.log(`  usuário ${linha.id}: ilegível, deixada no banco`);
        intactas += 1;
        continue;
      }

      const caminho = caminhoDaFoto(linha.id, foto.bytes, foto.mime);
      const endereco = await armazenamento.guardar(caminho, foto.bytes, foto.mime);
      await cliente.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [endereco, linha.id]);

      console.log(`  usuário ${linha.id}: ${(foto.bytes.length / 1024).toFixed(0)} KB -> ${caminho}`);
      movidas += 1;
    }

    console.log(`\n${movidas} movida(s), ${intactas} deixada(s) no banco.`);
  } finally {
    await cliente.end();
  }
}

principal().catch((erro: unknown) => {
  // Só a mensagem: o `stack` de um erro do `pg` pode trazer a query e,
  // com ela, o `data:` inteiro de alguém.
  console.error(erro instanceof Error ? erro.message : String(erro));
  process.exit(1);
});
