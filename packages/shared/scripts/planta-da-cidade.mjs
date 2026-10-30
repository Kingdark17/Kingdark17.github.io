/**
 * Lê a colisão da cidade do Breno (`hitbox.png`: 30 × 25 casas de 32 px) e
 * imprime a `PLANTA_DA_CIDADE` de `src/city/mapa-da-cidade.ts`, pronta pra
 * colar, mais as casas marcadas em verde e roxo, pra conferir com
 * `PONTOS_DA_CIDADE`.
 *
 *     node scripts/planta-da-cidade.mjs [caminho/do/hitbox.png]
 *
 * Sem caminho, lê a cópia ao lado (`hitbox-da-cidade.png`, a de 2026-10-23).
 * A colisão não vai pro jogo: só a planta que sai daqui.
 *
 * Depois imprime a `caixa` de cada camada da arte (`apps/web/public/img/cidade`):
 * o retângulo onde ela tem desenho, que vai em `CAMADAS_DA_CIDADE` e decide
 * quando a camada cobre o herói. Arte nova → conferir as caixas também.
 *
 * O desenho dele marca em vermelho a **borda** do que se pisa, e não o
 * cheio: dentro das casas e no meio das árvores fica sem cor, mas ninguém
 * chega lá. Por isso o chão é o que se alcança a partir da praça, andando
 * pelo que não é vermelho. Verde é porta ou coisa de encostar; roxo é
 * marca especial (a caverna, os troncos, a estrada da Torre). As duas cores
 * viram parede na planta: o que elas fazem mora nos pontos, que são
 * sólidos.
 *
 * Duas exceções, decididas com o usuário em 2026-10-23: os troncos (roxo,
 * no caminho da caverna) contam como chão, porque somem quando a Floresta é
 * zerada; e o verde perto da caveira, ao lado da caverna, também, porque é
 * um evento que ainda não existe.
 */

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { lerPng } from './ler-png.mjs';

const COLS = 30;
const ROWS = 25;
const LADO = 32;
/** De onde o alcance parte: a praça, logo abaixo da árvore central. */
const PRACA = { col: 12, row: 13 };
/** Casas coloridas que contam como chão (ver acima). */
const CHAO_MESMO_COLORIDO = new Set(['11,5', '12,5', '13,5', '11,6', '12,6', '13,6', '10,2']);

/** A cor que mais aparece numa grade de amostras da casa; sem cor nenhuma, chão. */
function corDaCasa(imagem, col, row) {
  const conta = { vermelho: 0, verde: 0, roxo: 0 };
  for (let y = 4; y < LADO; y += 6) {
    for (let x = 4; x < LADO; x += 6) {
      const o = ((row * LADO + y) * imagem.largura + col * LADO + x) * imagem.canais;
      const [r, g, b] = imagem.px.subarray(o, o + 3);
      const alfa = imagem.canais === 4 ? imagem.px[o + 3] : 255;
      if (alfa < 10) continue;
      if (r > 200 && g < 80 && b < 80) conta.vermelho++;
      else if (g > 200 && r < 120 && b < 120) conta.verde++;
      else if (r > 150 && b > 150 && g < 100) conta.roxo++;
    }
  }
  const [cor, vezes] = Object.entries(conta).sort((p, q) => q[1] - p[1])[0];
  return vezes > 0 ? cor : 'nada';
}

const imagem = lerPng(process.argv[2] ?? fileURLToPath(new URL('hitbox-da-cidade.png', import.meta.url)));
if (imagem.largura !== COLS * LADO || imagem.altura !== ROWS * LADO) throw new Error(`esperava ${COLS * LADO}×${ROWS * LADO}`);

const cores = [];
for (let row = 0; row < ROWS; row++) {
  const linha = [];
  for (let col = 0; col < COLS; col++) linha.push(CHAO_MESMO_COLORIDO.has(`${col},${row}`) ? 'nada' : corDaCasa(imagem, col, row));
  cores.push(linha);
}

const chao = cores.map((linha) => linha.map(() => false));
const fila = [PRACA];
while (fila.length) {
  const { col, row } = fila.pop();
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS || chao[row][col] || cores[row][col] !== 'nada') continue;
  chao[row][col] = true;
  fila.push({ col, row: row + 1 }, { col, row: row - 1 }, { col: col + 1, row }, { col: col - 1, row });
}

console.log('export const PLANTA_DA_CIDADE: readonly string[] = [');
for (const linha of chao) console.log(`  '${linha.map((pisa) => (pisa ? '.' : '#')).join('')}',`);
console.log('];\n');
for (const cor of ['verde', 'roxo']) {
  const casas = [];
  cores.forEach((linha, row) => linha.forEach((c, col) => c === cor && casas.push(`(${col},${row})`)));
  console.log(`${cor}: ${casas.join(' ')}`);
}

console.log('\ncaixas das camadas (esquerda, topo, direita, baixo):');
const pastaDaArte = fileURLToPath(new URL('../../../apps/web/public/img/cidade/', import.meta.url));
for (const arquivo of readdirSync(pastaDaArte).filter((nome) => nome.endsWith('.png')).sort()) {
  const camada = lerPng(pastaDaArte + arquivo);
  let esquerda = Infinity;
  let topo = Infinity;
  let direita = -1;
  let baixo = -1;
  for (let y = 0; y < camada.altura; y++) {
    for (let x = 0; x < camada.largura; x++) {
      if (camada.canais === 4 && camada.px[(y * camada.largura + x) * 4 + 3] === 0) continue;
      esquerda = Math.min(esquerda, x);
      topo = Math.min(topo, y);
      direita = Math.max(direita, x);
      baixo = Math.max(baixo, y);
    }
  }
  console.log(`  ${arquivo.replace('.png', '').padEnd(20)} [${esquerda}, ${topo}, ${direita}, ${baixo}]`);
}
