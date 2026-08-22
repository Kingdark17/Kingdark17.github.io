/**
 * Diz se o DNS do domínio já está com o que o Resend precisa pra verificar,
 * e o que falta. Serve pra parar de recarregar o painel esperando ficar
 * verde sem saber o que está errado.
 *
 * Uso:  node apps/api/scripts/confere-dns.mjs rpglegend.com.br
 *
 * Consulta os servidores públicos do Google (8.8.8.8) em vez do resolvedor
 * do sistema: o do seu provedor pode ter cacheado a ausência do registro e
 * responder "não existe" por até algumas horas depois de você criar.
 */
import { Resolver } from 'node:dns/promises';

const dominio = process.argv[2];
if (!dominio) {
  console.log('Passe o domínio. Ex: node apps/api/scripts/confere-dns.mjs rpglegend.com.br');
  process.exit(1);
}

const resolver = new Resolver({ timeout: 5000, tries: 2 });
resolver.setServers(['8.8.8.8', '1.1.1.1']);

const achou = (texto) => `  ok    ${texto}`;
const faltou = (texto) => `  falta ${texto}`;

async function txt(nome) {
  try {
    return (await resolver.resolveTxt(nome)).map((partes) => partes.join(''));
  } catch {
    return [];
  }
}

async function mx(nome) {
  try {
    return await resolver.resolveMx(nome);
  } catch {
    return [];
  }
}

async function cname(nome) {
  try {
    return await resolver.resolveCname(nome);
  } catch {
    return [];
  }
}

async function ns(nome) {
  try {
    return await resolver.resolveNs(nome);
  } catch {
    return [];
  }
}

let pendentes = 0;
const conferir = (ok, texto) => {
  if (!ok) pendentes += 1;
  console.log(ok ? achou(texto) : faltou(texto));
};

console.log(`\n=== ${dominio} ===`);

const servidores = await ns(dominio);
console.log(servidores.length ? `servidores de nome: ${servidores.join(', ')}` : 'servidores de nome: NENHUM — o domínio ainda não resolve');

console.log('\n--- o que o Resend precisa ---');

/** ` → valor` quando achou, nada quando não — evita template dentro de template. */
const detalhe = (valor) => (valor ? ` → ${valor}` : '');

// O DKIM é igual nos dois formatos: TXT com a chave pública.
const dkim = await txt(`resend._domainkey.${dominio}`);
conferir(dkim.length > 0, `DKIM (TXT) em resend._domainkey${detalhe(dkim.length && dkim[0].slice(0, 24) + '…')}`);

// A partir de 2026 o Resend entrega o envio por CNAME (`send` e `rsend`)
// em vez do par MX + TXT/SPF que usava antes. Painel antigo e painel novo
// convivem, então aqui aceitamos os dois — o que não pode é dar falha
// falsa em quem seguiu a tela que viu.
const envio = `send.${dominio}`;
const cnameSend = await cname(envio);
const cnameRsend = await cname(`rsend.${dominio}`);
const formatoNovo = cnameSend.length > 0 || cnameRsend.length > 0;

if (formatoNovo) {
  conferir(cnameSend.length > 0, `CNAME em send${detalhe(cnameSend[0])}`);
  conferir(cnameRsend.length > 0, `CNAME em rsend${detalhe(cnameRsend[0])}`);
} else {
  const registrosMx = await mx(envio);
  const spf = (await txt(envio)).filter((t) => t.startsWith('v=spf1'));
  if (registrosMx.length || spf.length) {
    conferir(registrosMx.length > 0, `MX em send${detalhe(registrosMx.map((r) => r.exchange).join(', '))}`);
    conferir(spf.length > 0, `SPF (TXT) em send${detalhe(spf[0])}`);
  } else {
    conferir(false, 'os dois CNAME de envio (send e rsend) — nenhum registro de envio encontrado');
  }
}

console.log('\n--- opcionais, mas recomendados ---');
const dmarc = await txt(`_dmarc.${dominio}`);
console.log(dmarc.length ? achou(`DMARC → ${dmarc[0]}`) : `  (sem DMARC — não impede o envio, melhora a entrega)`);

console.log('\n--- o site (só se você for apontar o jogo pra cá) ---');
let raiz = [];
try {
  raiz = await resolver.resolve4(dominio);
} catch {
  /* sem A */
}
console.log(raiz.length ? achou(`A na raiz → ${raiz.join(', ')}`) : '  (sem A na raiz — o jogo continua no github.io)');

console.log(
  pendentes === 0
    ? '\nRESULTADO: o Resend tem tudo que precisa. Se o painel dele ainda estiver amarelo, é só propagação — espere e clique em Verify.'
    : `\nRESULTADO: faltam ${pendentes} registro(s). Crie no painel do DNS e rode de novo.`,
);
