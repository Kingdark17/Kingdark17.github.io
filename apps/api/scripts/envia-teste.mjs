/**
 * Manda um e-mail de verdade usando a MESMA classe que a API usa em
 * produção (`ResendEmailSender` do dist), não uma cópia do request. É o
 * único jeito de derrubar o aviso "NÃO VERIFICADO CONTRA O RESEND DE
 * VERDADE" que está no topo do email-sender.ts.
 *
 * Uso:  node apps/api/scripts/envia-teste.mjs voce@exemplo.com
 *
 * Roda `pnpm --filter api build` antes se você mexeu no email-sender.ts —
 * este script lê o compilado, não o fonte.
 */
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raizApi = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const destino = process.argv[2];
if (!destino?.includes('@')) {
  console.log('Passe o e-mail de destino. Ex: node apps/api/scripts/envia-teste.mjs voce@exemplo.com');
  process.exitCode = 1;
} else {
  // O Nest carrega o .env sozinho; um script solto não, então carregamos aqui.
  const bruto = await readFile(join(raizApi, '.env'), 'utf8').catch(() => '');
  for (const linha of bruto.split('\n')) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) continue;
    const corte = limpa.indexOf('=');
    if (corte > 0 && !process.env[limpa.slice(0, corte).trim()]) {
      process.env[limpa.slice(0, corte).trim()] = limpa.slice(corte + 1).trim();
    }
  }

  const { ResendEmailSender } = require(join(raizApi, 'dist/auth/email-sender.js'));
  const sender = new ResendEmailSender();

  console.log(`de:   ${process.env.EMAIL_FROM}`);
  console.log(`para: ${destino}\n`);

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px">
      <h2 style="margin:0 0 12px">RPG Legend</h2>
      <p>Se você está lendo isto, o envio de e-mail da API está funcionando:
         domínio verificado, DKIM assinando e a classe do Nest fazendo a chamada.</p>
      <p style="color:#666;font-size:13px">Enviado por <code>envia-teste.mjs</code>
         em ${new Date().toLocaleString('pt-BR')}.</p>
    </div>`;

  const ok = await sender.send(destino, 'RPG Legend — teste de envio', html);

  console.log(
    ok
      ? '\nO Resend ACEITOU. Confira a caixa de entrada (e o spam, na primeira vez).'
      : '\nFALHOU. O motivo está no log acima, impresso pelo Logger do Nest.',
  );
  process.exitCode = ok ? 0 : 1;
}
