/**
 * Empilha as camadas do paperdoll e grava a imagem composta — para ver o
 * boneco montado antes de existirem 31 sprites.
 *
 * Uso:
 *   node apps/api/scripts/monta-paperdoll.mjs corpo.png cabelo.png roupa.png espada.png
 *   node apps/api/scripts/monta-paperdoll.mjs -e 6 -s montado.png corpo.png ...
 *
 *   -e  quantas vezes ampliar (padrão 6, vizinho mais próximo)
 *   -s  onde gravar (padrão: paperdoll-montado.png ao lado do primeiro)
 *
 * A ordem dos argumentos é a ordem das camadas, de trás para frente. Se
 * duas camadas tiverem tamanhos diferentes, ele avisa e para: é a regra
 * que sustenta o sistema inteiro, e falhar alto aqui é melhor do que
 * descobrir com trinta arquivos prontos.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { escreverPng, lerPng } from './png.mjs';

const args = process.argv.slice(2);
let escala = 6;
let saida = null;
const camadas = [];

for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '-e') escala = Number(args[(i += 1)]);
  else if (args[i] === '-s') saida = args[(i += 1)];
  else camadas.push(args[i]);
}

if (!camadas.length) {
  console.log('Passe as camadas na ordem, de trás para frente.');
  process.exit(1);
}

const lidas = camadas.map((caminho) => {
  try {
    return { caminho, img: lerPng(readFileSync(caminho)) };
  } catch (erro) {
    console.log(`falhou em ${caminho}: ${erro.message}`);
    process.exit(1);
  }
});

const { largura, altura } = lidas[0].img;
const fora = lidas.filter(({ img }) => img.largura !== largura || img.altura !== altura);
if (fora.length) {
  console.log(`As camadas precisam ter o mesmo tamanho. A primeira tem ${largura} x ${altura}, e estas não batem:`);
  for (const { caminho, img } of fora) console.log(`  ${caminho}: ${img.largura} x ${img.altura}`);
  process.exit(1);
}

// Composição "source-over": a de cima manda onde é opaca, e mistura na borda.
const base = Buffer.alloc(largura * altura * 4);
for (const { img } of lidas) {
  for (let i = 0; i < largura * altura * 4; i += 4) {
    const alfa = img.dados[i + 3] / 255;
    if (alfa === 0) continue;
    const restante = (base[i + 3] / 255) * (1 - alfa);
    const total = alfa + restante;
    for (let c = 0; c < 3; c += 1) base[i + c] = Math.round((img.dados[i + c] * alfa + base[i + c] * restante) / total);
    base[i + 3] = Math.round(total * 255);
  }
}

// Ampliação por vizinho mais próximo: o pixel continua quadrado.
const largaFinal = largura * escala;
const altaFinal = altura * escala;
const ampliada = Buffer.alloc(largaFinal * altaFinal * 4);
for (let y = 0; y < altaFinal; y += 1) {
  for (let x = 0; x < largaFinal; x += 1) {
    const origem = (Math.floor(y / escala) * largura + Math.floor(x / escala)) * 4;
    base.copy(ampliada, (y * largaFinal + x) * 4, origem, origem + 4);
  }
}

const destino = saida ?? join(dirname(camadas[0]), 'paperdoll-montado.png');
writeFileSync(destino, escreverPng({ largura: largaFinal, altura: altaFinal, dados: ampliada }));

console.log(`camadas    : ${camadas.length} (${camadas.join(' → ')})`);
console.log(`base       : ${largura} x ${altura}`);
console.log(`gravado em : ${destino}  (${largaFinal} x ${altaFinal}, ampliado ${escala}×)`);
