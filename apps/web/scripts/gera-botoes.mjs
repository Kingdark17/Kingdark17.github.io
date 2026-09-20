/**
 * Remonta a arte de botão do Breno numa folha de 9-slice.
 *
 * A arte (`button_menu_*.png`, 58×21) parece fatiável e não é: o musgo
 * está espalhado pelo meio também, e o `border-image` do CSS repetiria
 * justamente esse meio — vira papel de parede. Este script reordena as
 * colunas pra que o que sobra entre os cortes seja a única faixa de pedra
 * pura da arte.
 *
 *     node scripts/gera-botoes.mjs <pasta com button_menu_*.png>
 *
 * O que sai (40×21) casa com `border-image-slice: 9 20 11 16` no
 * `acabamento.module.css`. Os dois números são a **mesma** geometria: se
 * um mudar sem o outro, o corte cai no lugar errado e ninguém liga o
 * botão torto à mudança. Ver NOTAS-MIGRACAO.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync, deflateSync } from 'node:zlib';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(tipo, dados) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([len, corpo, crc]);
}

export function gravarPng(caminho, w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const linhas = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    linhas[y * (1 + w * 4)] = 0;
    rgba.copy(linhas, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  writeFileSync(caminho, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(linhas)), chunk('IEND', Buffer.alloc(0)),
  ]));
}

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function lerPng(caminho) {
  const buf = readFileSync(caminho);
  let pos = 8, w = 0, h = 0, cor = 6, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const tipo = buf.toString('ascii', pos + 4, pos + 8);
    const dados = buf.subarray(pos + 8, pos + 8 + len);
    if (tipo === 'IHDR') { w = dados.readUInt32BE(0); h = dados.readUInt32BE(4); cor = dados[9]; }
    if (tipo === 'IDAT') idat.push(dados);
    pos += 12 + len;
  }
  const canais = cor === 6 ? 4 : cor === 2 ? 3 : cor === 4 ? 2 : 1;
  const bruto = inflateSync(Buffer.concat(idat));
  const bpp = canais;
  const linha = w * bpp;
  const px = Buffer.alloc(w * h * 4);
  let ant = Buffer.alloc(linha);
  for (let y = 0; y < h; y++) {
    const filtro = bruto[y * (linha + 1)];
    const atual = Buffer.from(bruto.subarray(y * (linha + 1) + 1, (y + 1) * (linha + 1)));
    for (let i = 0; i < linha; i++) {
      const a = i >= bpp ? atual[i - bpp] : 0, b = ant[i], c = i >= bpp ? ant[i - bpp] : 0;
      if (filtro === 1) atual[i] = (atual[i] + a) & 0xff;
      else if (filtro === 2) atual[i] = (atual[i] + b) & 0xff;
      else if (filtro === 3) atual[i] = (atual[i] + ((a + b) >> 1)) & 0xff;
      else if (filtro === 4) atual[i] = (atual[i] + paeth(a, b, c)) & 0xff;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, i = x * bpp;
      if (canais === 4) { px[o] = atual[i]; px[o + 1] = atual[i + 1]; px[o + 2] = atual[i + 2]; px[o + 3] = atual[i + 3]; }
      else if (canais === 3) { px[o] = atual[i]; px[o + 1] = atual[i + 1]; px[o + 2] = atual[i + 2]; px[o + 3] = 255; }
      else if (canais === 2) { px[o] = px[o + 1] = px[o + 2] = atual[i]; px[o + 3] = atual[i + 1]; }
      else { px[o] = px[o + 1] = px[o + 2] = atual[i]; px[o + 3] = 255; }
    }
    ant = atual;
  }
  return { w, h, px };
}


// ---------------------------------------------------------------------
// A remontagem
// ---------------------------------------------------------------------

/**
 * Colunas da arte original, na ordem em que entram na folha.
 *
 * O meio da arte tem musgo esparso (1–2 px por coluna) e o `border-image`
 * repetiria justamente ele. As colunas 34–37 são a única faixa de pedra
 * pura de 4 px, então são elas que ficam no meio — é o que o CSS vai
 * repetir. As duas pontas, onde o musgo é desenhado de verdade, passam
 * inteiras.
 */
const COLUNAS = [
  ...Array.from({ length: 16 }, (_, i) => i),
  34, 35, 36, 37,
  ...Array.from({ length: 20 }, (_, i) => 38 + i),
];

/**
 * A linha que o CSS repete na vertical. É a 9 porque é a única uniforme
 * nas três artes ao mesmo tempo — ver NOTAS-MIGRACAO.md: a 7 parecia
 * servir e vira listra de 4 px na arte apertada.
 */
const LINHA_DO_MIOLO = 9;

const ehVerde = (r, g, b, a) => a > 40 && g > r + 8 && g > b + 4;

function gerar(origem, destino) {
  const { w, h, px } = lerPng(origem);
  const L = COLUNAS.length;
  const out = Buffer.alloc(L * h * 4);

  for (let y = 0; y < h; y++) {
    COLUNAS.forEach((sx, dx) => {
      const o = (y * L + dx) * 4, i = (y * w + sx) * 4;
      px.copy(out, o, i, i + 4);
    });
  }

  // Musgo na linha que repete viraria risco vertical no botão alto. Sai,
  // copiando a pedra de cima.
  let limpos = 0;
  for (let dx = 0; dx < L; dx++) {
    const o = (LINHA_DO_MIOLO * L + dx) * 4;
    if (!ehVerde(out[o], out[o + 1], out[o + 2], out[o + 3])) continue;
    out.copy(out, o, o - L * 4, o - L * 4 + 4);
    limpos++;
  }

  gravarPng(destino, L, h, out);
  return { L, h, limpos };
}

// ---------------------------------------------------------------------

const [origem] = process.argv.slice(2);
if (!origem) {
  console.error('uso: node scripts/gera-botoes.mjs <pasta com button_menu_*.png>');
  console.error('');
  console.error('Regera apps/web/public/img/ui/botao*.png a partir da arte do Breno.');
  console.error('Os cortes do CSS (`border-image-slice: 9 20 11 16`) são a geometria');
  console.error('do que sai daqui — mexer num sem rodar o outro corta a arte torto.');
  process.exit(1);
}

const UI = fileURLToPath(new URL('../public/img/ui', import.meta.url));
const ESTADOS = {
  'botao.png': 'button_menu_layout',
  'botao-escuro.png': 'button_menu_dark_layout',
  'botao-apertado.png': 'button_menu_press_layout',
};

for (const [saida, fonte] of Object.entries(ESTADOS)) {
  const { L, h, limpos } = gerar(join(origem, `${fonte}.png`), join(UI, saida));
  console.log(`${saida}: ${L}×${h}, ${limpos} px de musgo tirados da linha ${LINHA_DO_MIOLO}`);
}
