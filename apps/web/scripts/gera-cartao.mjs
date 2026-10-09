/**
 * Separa o cartão de guilda do usuário em fundo e selo, ampliados 4×.
 *
 *     node scripts/gera-cartao.mjs <Guilda_card.pixil>
 *
 * A arte (Pixilart, 2026-10-09) é um cartão de 41×24 numa tela de 100×100:
 * pergaminho, uma volta de papel por fora, a linha vermelha e um selo roxo
 * no canto de baixo. No jogo o cartão é o painel do herói e cresce com o
 * que vai escrito, então o fundo vira moldura de 9 fatias — e o selo, no
 * meio dela, seria repetido junto com o papel. Por isso sai à parte, e o
 * lugar dele embaixo vira pergaminho.
 *
 * O que sai casa com `cartao-de-guilda.module.css`: corte de 2 px de arte
 * (8 px em 4×) e selo de 7×7 (28 px). Mexer num sem o outro corta o
 * cartão torto. Fundo e selo remontados voltam idênticos ao desenho — o
 * script confere e para se não voltarem.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { gravarPng, lerPng } from './gera-botoes.mjs';

const ESCALA = 4;
/** A volta de papel e a linha vermelha: o que o CSS corta como borda. */
const BORDA = 2;

const ehSelo = (px, i) => px[i + 3] > 0 && px[i + 2] > 150 && px[i + 1] < 50;

/** O retângulo dos pixels que passam no filtro. */
function caixa(w, h, passa) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!passa(x, y)) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function recortar(px, largura, { x, y, w, h }) {
  const out = Buffer.alloc(w * h * 4);
  for (let j = 0; j < h; j++) px.copy(out, j * w * 4, ((y + j) * largura + x) * 4, ((y + j) * largura + x + w) * 4);
  return out;
}

function ampliar(px, w, h) {
  const out = Buffer.alloc(w * ESCALA * h * ESCALA * 4);
  for (let y = 0; y < h * ESCALA; y++) {
    for (let x = 0; x < w * ESCALA; x++) {
      px.copy(out, (y * w * ESCALA + x) * 4, (((y / ESCALA) | 0) * w + ((x / ESCALA) | 0)) * 4, (((y / ESCALA) | 0) * w + ((x / ESCALA) | 0)) * 4 + 4);
    }
  }
  return out;
}

const [origem] = process.argv.slice(2);
if (!origem) {
  console.error('uso: node scripts/gera-cartao.mjs <Guilda_card.pixil>');
  console.error('');
  console.error('Regera apps/web/public/img/ui/cartao-de-guilda.png e selo-da-guilda.png.');
  process.exit(1);
}

const pixil = JSON.parse(readFileSync(origem, 'utf8'));
const camada = pixil.frames?.[0]?.layers?.[0]?.src;
if (typeof camada !== 'string') throw new Error('o .pixil não tem a camada do primeiro quadro');
const tela = lerPng(Buffer.from(camada.split('base64,')[1], 'base64'));

// O cartão é tudo o que não é transparente na tela do Pixilart.
const noCartao = caixa(tela.w, tela.h, (x, y) => tela.px[(y * tela.w + x) * 4 + 3] > 0);
const cartao = recortar(tela.px, tela.w, noCartao);
const { w: W, h: H } = noCartao;

const selo = caixa(W, H, (x, y) => ehSelo(cartao, (y * W + x) * 4));
if (selo.w < 1) throw new Error('não achei o selo roxo no cartão');

const fundo = Buffer.from(cartao);
const soSelo = Buffer.alloc(selo.w * selo.h * 4);
for (let y = selo.y; y < selo.y + selo.h; y++) {
  for (let x = selo.x; x < selo.x + selo.w; x++) {
    const i = (y * W + x) * 4;
    if (!ehSelo(cartao, i)) continue;
    // Embaixo do selo, o pergaminho da mesma linha, uma largura de selo à
    // esquerda: mesma textura, sem costura no meio do papel.
    const vizinho = (y * W + x - selo.w) * 4;
    if (ehSelo(cartao, vizinho)) throw new Error(`o pergaminho ao lado do selo também é selo em ${x},${y}`);
    cartao.copy(fundo, i, vizinho, vizinho + 4);
    cartao.copy(soSelo, ((y - selo.y) * selo.w + (x - selo.x)) * 4, i, i + 4);
  }
}

// Remontar tem que devolver o desenho, pixel por pixel.
const remontado = Buffer.from(fundo);
for (let y = 0; y < selo.h; y++) {
  for (let x = 0; x < selo.w; x++) {
    const o = (y * selo.w + x) * 4;
    if (soSelo[o + 3] > 0) soSelo.copy(remontado, ((selo.y + y) * W + selo.x + x) * 4, o, o + 4);
  }
}
if (!remontado.equals(cartao)) throw new Error('fundo + selo não remontam o desenho original');

const UI = fileURLToPath(new URL('../public/img/ui', import.meta.url));
gravarPng(join(UI, 'cartao-de-guilda.png'), W * ESCALA, H * ESCALA, ampliar(fundo, W, H));
gravarPng(join(UI, 'selo-da-guilda.png'), selo.w * ESCALA, selo.h * ESCALA, ampliar(soSelo, selo.w, selo.h));

console.log(`cartão ${W}×${H}, selo ${selo.w}×${selo.h} em ${selo.x},${selo.y} — ampliados ${ESCALA}×`);
// O CSS põe o selo colado na linha vermelha do canto de baixo à direita.
const folgaDireita = W - BORDA - (selo.x + selo.w);
const folgaDeBaixo = H - BORDA - (selo.y + selo.h);
if (folgaDireita !== 0 || folgaDeBaixo !== 0 || selo.w !== 7 || selo.h !== 7) {
  console.warn(`atenção: o selo mudou de tamanho ou de lugar (folga ${folgaDireita}×${folgaDeBaixo}).`);
  console.warn('Ajuste .selo em cartao-de-guilda.module.css (tamanho, right, bottom).');
}
