/**
 * A CLI da cópia Neon → Supabase.
 *
 * Uso (sempre com ORIGEM_URL e DESTINO_URL no ambiente):
 *   pnpm --filter api db:copia                                    ensaio
 *   pnpm --filter api db:copia -- --escrever --confirmo=<host>    copia o que falta
 *   pnpm --filter api db:copia -- --espelhar                      ensaio do espelho
 *   pnpm --filter api db:copia -- --escrever --confirmo=<host> --espelhar
 *   pnpm --filter api db:copia -- --conferir                      só compara
 *
 * Dois modos de cópia, e a diferença decide a virada:
 *
 * - **padrão (`inserir`)**: só acrescenta o que falta. Nunca sobrescreve.
 *   Certo pra destino vazio. Rodar de novo pra "pegar o atraso" **não
 *   traz alteração nenhuma** — `cloud_saves` é a mesma chave com `data`
 *   novo, e ele pula.
 * - **`--espelhar`**: deixa o destino idêntico à origem — acrescenta,
 *   atualiza o que mudou e apaga o que sumiu. É o que fecha uma cópia
 *   quente depois de congelar a escrita.
 *
 * **Não lê o `.env`.** O drizzle-kit lê, e foi exatamente isso que já
 * quase mandou um comando pro banco errado (ver "Fase 5" nas notas). Aqui
 * as duas pontas são explícitas ou o script não roda.
 *
 * Sem `--escrever` ele só lê e relata. Com `--escrever` ele ainda exige
 * `--confirmo=<host do destino>`, e o host tem que bater com o do
 * `DESTINO_URL` de verdade — quem digita o host errado descobre antes de
 * escrever, não depois.
 *
 * Nunca imprime a string de conexão nem a senha.
 */
import { Client } from 'pg';

import { conferir, copiar, type LinhaDeConferencia, type ModoDeCopia, type RelatorioDeCopia } from '../src/db/migracao/copia';

const args = process.argv.slice(2);
const temFlag = (nome: string) => args.includes(`--${nome}`);
const valorDaFlag = (nome: string) =>
  args
    .find((a) => a.startsWith(`--${nome}=`))
    ?.split('=')
    .slice(1)
    .join('=');

function exigirUrl(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    console.error(`falta ${nome}. As duas pontas são explícitas de propósito — este script não lê o .env.`);
    process.exit(2);
  }
  return valor;
}

/** Host e banco, sem usuário nem senha — é o que dá pra imprimir com segurança. */
function apelidoDe(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`;
  } catch {
    return '(url ilegível)';
  }
}

function hostDe(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function tabelaDeCopia(relatorio: RelatorioDeCopia): void {
  console.log('\n  tabela                origem   destino    novas   atualiz.   apagadas   iguais');
  console.log('  ' + '-'.repeat(76));
  for (const t of relatorio.tabelas) {
    console.log(
      `  ${t.tabela.padEnd(20)}${String(t.naOrigem).padStart(7)}${String(t.noDestinoAntes).padStart(9)}` +
        `${String(t.inseridas).padStart(9)}${String(t.atualizadas).padStart(11)}${String(t.apagadas).padStart(11)}${String(t.puladas).padStart(9)}`,
    );
  }

  console.log('\n  sequences no destino:');
  for (const s of relatorio.sequences) {
    const estado = s.valor === null ? 'tabela vazia (sequence volta ao início)' : `próximo id = ${s.valor + 1}`;
    console.log(`    ${`${s.tabela}.${s.coluna}`.padEnd(30)} ${estado}`);
  }
}

function tabelaDeConferencia(linhas: LinhaDeConferencia[]): boolean {
  console.log('\n  tabela                origem   destino   conteúdo');
  console.log('  ' + '-'.repeat(58));
  let tudoBate = true;
  for (const l of linhas) {
    if (!l.bate) tudoBate = false;
    const conteudo = l.digestOrigem === l.digestDestino ? 'igual' : `DIFERE (${l.digestOrigem?.slice(0, 8)} vs ${l.digestDestino?.slice(0, 8)})`;
    console.log(`  ${l.tabela.padEnd(20)}${String(l.origem).padStart(7)}${String(l.destino).padStart(10)}   ${conteudo}`);
  }
  return tudoBate;
}

async function main(): Promise<number> {
  const origemUrl = exigirUrl('ORIGEM_URL');
  const destinoUrl = exigirUrl('DESTINO_URL');

  if (origemUrl === destinoUrl) {
    console.error('ORIGEM_URL e DESTINO_URL são a mesma coisa. Recusando.');
    return 2;
  }

  const escrever = temFlag('escrever');
  const soConferir = temFlag('conferir');
  const modo: ModoDeCopia = temFlag('espelhar') ? 'espelhar' : 'inserir';

  const comoEsta = soConferir ? 'só conferir' : escrever ? 'ESCREVENDO' : 'ensaio (nada é escrito)';
  console.log(`  origem : ${apelidoDe(origemUrl)}`);
  console.log(`  destino: ${apelidoDe(destinoUrl)}`);
  console.log(`  modo   : ${comoEsta}`);
  if (!soConferir) {
    console.log(
      modo === 'espelhar'
        ? '  cópia  : espelhar — acrescenta, ATUALIZA o que mudou e APAGA o que sumiu da origem'
        : '  cópia  : inserir — só acrescenta o que falta; não atualiza nem apaga nada',
    );
  }
  console.log('');

  if (escrever && !soConferir) {
    const confirmado = valorDaFlag('confirmo');
    const esperado = hostDe(destinoUrl);
    if (confirmado !== esperado) {
      console.error(`Pra escrever, repita o host do destino: --confirmo=${esperado}`);
      console.error(confirmado ? `  (você escreveu "${confirmado}")` : '  (a flag não veio)');
      return 2;
    }
  }

  const origem = new Client({ connectionString: origemUrl, ssl: { rejectUnauthorized: false } });
  const destino = new Client({ connectionString: destinoUrl, ssl: { rejectUnauthorized: false } });

  await origem.connect();
  await destino.connect();

  try {
    if (soConferir) {
      const ok = tabelaDeConferencia(await conferir(origem, destino));
      console.log(ok ? '\nRESULTADO: origem e destino batem' : '\nRESULTADO: DIVERGÊNCIA');
      return ok ? 0 : 1;
    }

    const relatorio = await copiar(origem, destino, {
      escrever,
      modo,
      aoAndar: (texto) => process.stdout.write(`\r${texto.padEnd(70)}`),
    });
    if (escrever) process.stdout.write('\n');

    tabelaDeCopia(relatorio);

    if (!escrever) {
      const espelharAviso = modo === 'espelhar' ? ' (em `espelhar`, a coluna "apagadas" é o que ele APAGARIA)' : '';
      console.log(`\nEnsaio: nenhuma linha foi escrita${espelharAviso}.`);
      console.log(`Pra valer: --escrever --confirmo=${hostDe(destinoUrl)}${modo === 'espelhar' ? ' --espelhar' : ''}`);
      return 0;
    }

    const ok = tabelaDeConferencia(await conferir(origem, destino));
    console.log(ok ? '\nRESULTADO: copiado e conferido' : '\nRESULTADO: copiou, mas a conferência DIVERGIU');
    return ok ? 0 : 1;
  } finally {
    await origem.end();
    await destino.end();
  }
}

main().then(
  (codigo) => process.exit(codigo),
  (erro: unknown) => {
    console.error(`\nFALHOU: ${erro instanceof Error ? erro.message : String(erro)}`);
    process.exit(1);
  },
);
