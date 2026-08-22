/**
 * Pergunta pro Resend o que ELE está enxergando do domínio, registro por
 * registro. Complementa o `confere-dns.mjs`: aquele olha o DNS pelo lado de
 * fora, este mostra o veredito de quem vai verificar.
 *
 * Uso:  node apps/api/scripts/confere-resend.mjs
 *
 * A chave sai do apps/api/.env — nunca passe ela por argumento de linha de
 * comando, senão ela fica gravada no histórico do terminal.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raizApi = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Lê o .env na mão: o script roda solto, sem o Nest pra carregar por ele. */
async function lerEnv() {
  const bruto = await readFile(join(raizApi, '.env'), 'utf8').catch(() => '');
  const pares = {};
  for (const linha of bruto.split('\n')) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) continue;
    const corte = limpa.indexOf('=');
    if (corte > 0) pares[limpa.slice(0, corte).trim()] = limpa.slice(corte + 1).trim();
  }
  return pares;
}

const env = await lerEnv();
const chave = process.env.RESEND_API_KEY || env.RESEND_API_KEY;
const remetente = process.env.EMAIL_FROM || env.EMAIL_FROM;

if (!chave) {
  console.log('Sem RESEND_API_KEY no apps/api/.env. Nada a conferir.');
  process.exit(1);
}

/** Erro que significa "a chave é boa, só não tem permissão de leitura". */
class ChaveSoDeEnvio extends Error {}

async function api(caminho) {
  const resposta = await fetch(`https://api.resend.com${caminho}`, {
    headers: { Authorization: `Bearer ${chave}` },
  });
  if (!resposta.ok) {
    const corpo = await resposta.text();
    // Chave com permissão "Sending access" autentica, mas o Resend recusa
    // qualquer rota que não seja de envio. Isso é a chave CERTA pra produção
    // — tratar como falha seria mentir pra quem rodou o script.
    if (resposta.status === 401 && corpo.includes('restricted_api_key')) {
      throw new ChaveSoDeEnvio();
    }
    throw new Error(`${resposta.status} ${corpo}`);
  }
  return resposta.json();
}

const SIMBOLO = { verified: 'ok   ', pending: 'espera', not_started: 'parado', failure: 'FALHOU', temporary_failure: 'tentando' };
const marca = (estado) => (SIMBOLO[estado] ?? estado).padEnd(8);

let dominios;
try {
  dominios = (await api('/domains')).data ?? [];
} catch (erro) {
  if (erro instanceof ChaveSoDeEnvio) {
    console.log('\nA chave é VÁLIDA e só tem permissão de envio ("Sending access").');
    console.log('É o tipo certo pra produção: se vazar, ninguém mexe na conta com ela.');
    console.log('O preço é este: ela não consegue ler o estado do domínio.');
    console.log('\nPra saber se o domínio verificou, use:');
    console.log('  node apps/api/scripts/confere-dns.mjs rpglegend.com.br');
    process.exitCode = 0;
  } else {
    console.log(`\nA chave foi recusada pelo Resend: ${erro.message}`);
    console.log('Confira se ela foi copiada inteira e se não foi revogada no painel.');
    process.exitCode = 1;
  }
  // `process.exit()` aqui derruba o processo com o socket do fetch ainda
  // aberto, e o Node no Windows morre com "Assertion failed" em async.c.
  // Sair pelo exitCode deixa ele fechar as coisas na ordem.
  dominios = null;
}

if (dominios) {
  console.log('\nA chave funciona e enxerga a conta inteira.');
  if (dominios.length === 0) {
    console.log('Mas nenhum domínio está cadastrado nesta conta do Resend.');
    process.exitCode = 1;
  }
}

for (const { id, name, status } of dominios ?? []) {
  console.log(`\n=== ${name} — ${status} ===`);

  const { records = [] } = await api(`/domains/${id}`);
  for (const r of records) {
    // O `name` do Resend já vem relativo; juntar com o domínio deixa igual
    // ao que aparece no painel do Registro.br, pra bater olho a olho.
    const alvo = r.name === '@' ? name : `${r.name}.${name}`;
    console.log(`  ${marca(r.status)} ${r.type.padEnd(5)} ${alvo}`);
  }

  if (status === 'verified' && remetente?.includes(`@${name}`)) {
    console.log(`\n  O EMAIL_FROM (${remetente}) pode enviar por este domínio.`);
  } else if (status !== 'verified') {
    console.log('\n  Enquanto não estiver "verified", todo envio volta 403.');
  }
}
