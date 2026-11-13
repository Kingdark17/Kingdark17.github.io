#!/usr/bin/env node
// Os efeitos da luta do app (2026-11-13): cada um é um arquivo de código em fx/, no formato da pixelfx
// (github.com/patch-gg/pixelfx, MIT), desenhado no estilo da arte do Breno (formas gordas, poucos tons
// chapados, contorno escuro). Este script os desenha com a pixelfx, contorna o que é sólido e grava as folhas
// de quadros em Assets/RPGLegend/Art/Jogo/Resources/Efeitos, com o efeitos.json que o app lê.
//
//   node apps/unity/Efeitos~/exporta.mjs              todos
//   node apps/unity/Efeitos~/exporta.mjs golpe cura   só esses
//   --ver     só as folhas de conferência (em <pixelfx>/records/rpglegend), sem mexer no jogo
//
// A pixelfx fica fora do repositório, ao lado dele (Documents/projetos/pixelfx, no commit marcado
// versao-rpglegend); outra pasta com --pixelfx <pasta> ou a variável PIXELFX.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { EFEITOS, CONTORNO } from "./efeitos.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (nome) => {
  const i = args.indexOf("--" + nome);
  if (i < 0) return undefined;
  const valor = args[i + 1];
  args.splice(i, 2);
  return valor;
};
const soVer = args.includes("--ver");
const PIXELFX = flag("pixelfx") ?? process.env.PIXELFX ?? join(AQUI, "..", "..", "..", "..", "pixelfx");
const nomes = args.filter((a) => !a.startsWith("--"));
const DESTINO = join(AQUI, "..", "Assets", "RPGLegend", "Art", "Jogo", "Resources", "Efeitos");

if (!existsSync(join(PIXELFX, "tools", "lib", "fxlib.mjs"))) {
  console.error(`não achei a pixelfx em ${PIXELFX} (git clone https://github.com/patch-gg/pixelfx ao lado do repositório)`);
  process.exit(1);
}

// Os nossos efeitos entram na pixelfx como a categoria "rpglegend", pra importar o core dela como os outros.
const NOSSOS = join(PIXELFX, "src", "fx", "rpglegend");
rmSync(NOSSOS, { recursive: true, force: true });
mkdirSync(NOSSOS, { recursive: true });
for (const f of readdirSync(join(AQUI, "fx"))) if (f.endsWith(".js")) cpSync(join(AQUI, "fx", f), join(NOSSOS, f));

const lib = await import(pathToFileURL(join(PIXELFX, "tools", "lib", "fxlib.mjs")).href);

/** #rrggbb em [r, g, b]. */
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/**
 * O contorno do Breno: todo pixel vazio encostado (nos 4 lados) num pixel sólido da cor do efeito ganha a cor
 * do contorno. A luz (o brilho somado) não conta como sólida, então o brilho fica solto, como na arte dele.
 */
function contornar(quadro, w, h, cor) {
  const { clear, raw } = quadro;
  const solido = (x, y) => x >= 0 && y >= 0 && x < w && y < h && raw[y * w + x] >>> 24 === 255;
  const [r, g, b] = rgb(cor);
  const saida = new Uint8ClampedArray(clear);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (solido(x, y)) continue;
      if (!(solido(x - 1, y) || solido(x + 1, y) || solido(x, y - 1) || solido(x, y + 1))) continue;
      const j = (y * w + x) * 4;
      saida[j] = r; saida[j + 1] = g; saida[j + 2] = b; saida[j + 3] = 255;
    }
  return saida;
}

const escolhidos = nomes.length ? EFEITOS.filter((e) => nomes.includes(e.nome)) : EFEITOS;
if (!escolhidos.length) {
  console.error(`nenhum efeito com esse nome; há: ${EFEITOS.map((e) => e.nome).join(", ")}`);
  process.exit(1);
}

const indice = existsSync(join(DESTINO, "efeitos.json")) && nomes.length ? JSON.parse(readFileSync(join(DESTINO, "efeitos.json"), "utf8")).efeitos : [];
const FUNDO = [31, 37, 41, 255]; // o chão da Caverna, pra conferir como fica na sala

for (const e of escolhidos) {
  const fx = await lib.loadEffect(e.fonte.includes("/") ? e.fonte : "rpglegend/" + e.fonte, join(PIXELFX, "src", "fx"));
  const r = lib.renderFrames(fx, { bg: "none", actor: false, options: e.opcoes ?? {}, seed: e.semente });
  const { w, h, fps } = r;
  const quadros = r.frames.map((q) => (e.contorno === false ? q.clear : contornar(q, w, h, e.contorno ?? CONTORNO)));
  // um quadro vazio no fim não serve pra nada no jogo (o efeito some sozinho quando acaba)
  while (quadros.length > 1 && !quadros[quadros.length - 1].some((v, i) => i % 4 === 3 && v > 0)) quadros.pop();

  const n = quadros.length, colunas = Math.min(n, Math.max(1, Math.ceil(Math.sqrt((n * h) / w)))), linhas = Math.ceil(n / colunas);
  if (colunas * w > 2048 || linhas * h > 2048) throw new Error(`${e.nome}: a folha passa de 2048 px (${colunas * w} x ${linhas * h})`);
  const folha = lib.canvas(colunas * w, linhas * h, [0, 0, 0, 0]);
  quadros.forEach((q, i) => folha.paste(q, w, h, (i % colunas) * w, Math.floor(i / colunas) * h));

  // a conferência: os quadros ampliados sobre o chão da Caverna
  const k = 4, por = Math.min(n, 8), conf = lib.canvas(por * (w * k + 6) + 6, Math.ceil(n / por) * (h * k + 22) + 30, [12, 11, 16, 255]);
  conf.text(`${e.nome}  ${w}x${h}  ${n}F @${fps}`, 6, 6, 3);
  quadros.forEach((q, i) => {
    const x = 6 + (i % por) * (w * k + 6), y = 30 + Math.floor(i / por) * (h * k + 22);
    conf.text(String(i), x, y, 2, [140, 134, 160]);
    conf.rect(x, y + 16, w * k, h * k, FUNDO);
    conf.paste(lib.upscale(q, w, h, k), w * k, h * k, x, y + 16);
  });
  lib.save(join(PIXELFX, "records", "rpglegend", `${e.nome}.png`), conf.png());
  // a tira: 8 quadros espalhados, 3x, pra conferir vários efeitos lado a lado
  const z = 3, escolha = lib.pickFrames(n, 8), tira = lib.canvas(escolha.length * (w * z + 4) + 4, h * z + 24, [12, 11, 16, 255]);
  tira.text(e.nome, 4, 4, 2);
  escolha.forEach((fi, j) => {
    const x = 4 + j * (w * z + 4);
    tira.rect(x, 20, w * z, h * z, FUNDO);
    tira.paste(lib.upscale(quadros[fi], w, h, z), w * z, h * z, x, 20);
  });
  lib.save(join(PIXELFX, "records", "rpglegend", "tiras", `${e.nome}.png`), tira.png());

  if (!soVer) {
    mkdirSync(DESTINO, { recursive: true });
    writeFileSync(join(DESTINO, `${e.nome}.png`), folha.png());
    const [ox, oy] = fx.meta.origin;
    const dados = { nome: e.nome, fps, quadros: n, largura: w, altura: h, colunas, origemX: ox, origemY: oy, laco: !!fx.meta.loop };
    const i = indice.findIndex((x) => x.nome === e.nome);
    if (i >= 0) indice[i] = dados;
    else indice.push(dados);
  }
  console.log(`${e.nome}: ${n} quadros de ${w}x${h} a ${fps} fps -> ${join(PIXELFX, "records", "rpglegend", e.nome + ".png")}`);
}

if (!soVer) {
  indice.sort((a, b) => a.nome.localeCompare(b.nome));
  writeFileSync(join(DESTINO, "efeitos.json"), JSON.stringify({ efeitos: indice }, null, 1) + "\n");
}
