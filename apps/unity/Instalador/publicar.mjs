// Publica o app de PC pra quem já tem o jogo se atualizar sozinho (Game/App/Atualizacao.cs).
//
//   node apps/unity/Instalador/publicar.mjs            publica o que está em apps/unity/Builds/AppWindows
//   node apps/unity/Instalador/publicar.mjs --conferir só diz o que publicaria, sem publicar
//
// Antes: o menu RPG Legend > Build do app (Windows), que deixa em Builds/AppWindows o instalador e o
// versao-pc.txt (a versão e o tamanho dele). Este script cria no GitHub o release "pc-<versão>" com os dois
// arquivos; o jogo olha sempre o release mais novo (releases/latest/download/…). Um release publicado vale na
// hora pra todo mundo que abrir o jogo: confira o instalador antes.
//
// A permissão é a mesma do git push: a variável GH_TOKEN, se houver, ou a credencial que o git já guarda pra
// github.com (git credential fill). O token não é escrito em lugar nenhum.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'Kingdark17/Kingdark17.github.io';
const INSTALADOR_LOCAL = 'RPG Legend - Instalação.exe';
// Os nomes que o jogo procura (Atualizacao.ArquivoDoInstalador e ArquivoDaVersao).
const INSTALADOR = 'RPGLegend-Instalacao.exe';
const VERSAO = 'versao-pc.txt';

const pasta = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'Builds', 'AppWindows');
const conferir = process.argv.includes('--conferir');

function falha(mensagem) {
  console.error(mensagem);
  process.exit(1);
}

const arquivoDaVersao = path.join(pasta, VERSAO);
const instalador = path.join(pasta, INSTALADOR_LOCAL);
if (!fs.existsSync(arquivoDaVersao) || !fs.existsSync(instalador))
  falha('Não achei o instalador e o versao-pc.txt em ' + pasta + '. Rode antes o menu RPG Legend > Build do app (Windows).');

const [versao, tamanhoDito] = fs.readFileSync(arquivoDaVersao, 'utf8').split(/\r?\n/);
const tamanho = fs.statSync(instalador).size;
if (!/^\d+(\.\d+){1,5}$/.test(versao)) falha('O versao-pc.txt não diz uma versão: "' + versao + '".');
if (String(tamanho) !== tamanhoDito) falha('O instalador tem ' + tamanho + ' bytes e o versao-pc.txt diz ' + tamanhoDito + ': rode o build de novo.');

const tag = 'pc-' + versao;
console.log('versão ' + versao + ', instalador de ' + Math.round(tamanho / 1024 / 1024) + ' MB -> release ' + tag + ' em ' + REPO);
if (conferir) process.exit(0);

function token() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  const saida = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' });
  const senha = /^password=(.+)$/m.exec(saida);
  if (!senha) falha('O git não tem credencial pra github.com. Defina GH_TOKEN.');
  return senha[1].trim();
}

const cabecalhos = { authorization: 'Bearer ' + token(), accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'publicar-app-de-pc' };

async function github(metodo, url, corpo, tipo) {
  const resposta = await fetch(url, {
    method: metodo,
    headers: { ...cabecalhos, ...(corpo ? { 'content-type': tipo ?? 'application/json' } : {}) },
    body: corpo,
    ...(corpo && tipo ? { duplex: 'half' } : {}),
  });
  const texto = await resposta.text();
  if (!resposta.ok) falha(metodo + ' ' + url + ' -> ' + resposta.status + ' ' + texto.slice(0, 300));
  return texto ? JSON.parse(texto) : null;
}

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
// Nasce como rascunho: só vira o "mais novo" depois que os dois arquivos subiram, pra ninguém baixar pela metade.
const release = await github('POST', 'https://api.github.com/repos/' + REPO + '/releases', JSON.stringify({
  tag_name: tag,
  target_commitish: 'main',
  name: 'RPG Legend para PC ' + versao,
  body: 'Instalador do app de PC (commit ' + commit.slice(0, 7) + '). Quem já tem o jogo instalado recebe o aviso de atualização ao abrir.',
  draft: true,
}));

const envio = release.upload_url.replace(/\{.*$/, '');
await github('POST', envio + '?name=' + INSTALADOR, fs.readFileSync(instalador), 'application/octet-stream');
console.log('subiu ' + INSTALADOR);
await github('POST', envio + '?name=' + VERSAO, fs.readFileSync(arquivoDaVersao), 'text/plain');
console.log('subiu ' + VERSAO);

const publicado = await github('PATCH', 'https://api.github.com/repos/' + REPO + '/releases/' + release.id, JSON.stringify({ draft: false, make_latest: 'true' }));
console.log('publicado: ' + publicado.html_url);
