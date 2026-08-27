/**
 * GIF de pet vira **tira de sprites** — um PNG com os quadros lado a lado,
 * que o CSS percorre com `steps()`.
 *
 * Uso:
 *   node apps/api/scripts/gera-sprites-de-pet.mjs slime-normal ~/Downloads/slimePet_icon.gif
 *   node apps/api/scripts/gera-sprites-de-pet.mjs -s outra/pasta slime-heart entrada.gif
 *
 * Grava em `apps/web/public/img/pets/<nome>.png` e imprime a linha do
 * `ROSTOS_DE_PET` já pronta pra colar — o número de quadros e a duração
 * precisam bater com o arquivo, e digitar isso à mão é como o CSS passa a
 * mentir sobre a arte sem ninguém perceber.
 *
 * Três decisões moram aqui:
 *
 * 1. **Volta pra escala nativa.** O GIF que o editor exporta vem ampliado
 *    (o do slime é 50×50 guardado em 800×800, 16×). Guardar assim é 256×
 *    mais dado do que o desenho tem. A escala é **detectada**, não
 *    passada: procura o maior N em que a imagem inteira é feita de blocos
 *    N×N chapados. Se não for múltiplo exato, N=1 e nada é reduzido —
 *    nunca chuta um redimensionamento que borraria pixel art.
 *
 * 2. **Quadro repetido no lugar de tempo variável.** O `steps()` do CSS
 *    divide a animação em fatias iguais, mas GIF guarda um atraso por
 *    quadro (o de clique do slime mistura 50 ms e 100 ms). Em vez de
 *    aproximar tudo pra média — que muda o ritmo do desenho —, o quadro
 *    de 100 ms entra **duas vezes** na tira, e o passo do CSS vira o mdc
 *    dos atrasos. O ritmo sai idêntico ao do GIF, e custa alguns quadros
 *    a mais de 50×50.
 *
 * 3. **A moldura inteira, sem recorte.** Sobra transparente é tentadora
 *    de cortar, mas o slime *achata* no clique: recortando cada animação
 *    pelo próprio conteúdo, as duas parariam em alturas diferentes e o
 *    bicho pularia ao trocar de estado. A grade da origem é o que mantém
 *    idle e clique alinhados.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { lerGif } from './gif.mjs';
import { escreverPng } from './png.mjs';

const PASTA_PADRAO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'public', 'img', 'pets');

const args = process.argv.slice(2);
let pasta = PASTA_PADRAO;
const soltos = [];

for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '-s') pasta = args[(i += 1)];
  else soltos.push(args[i]);
}

const [nome, entrada] = soltos;
if (!nome || !entrada) {
  console.log('Uso: node apps/api/scripts/gera-sprites-de-pet.mjs <nome> <entrada.gif> [-s pasta]');
  process.exit(1);
}

/** O maior N em que a imagem inteira é feita de blocos N×N de uma cor só. */
function escalaDoPixel(dados, largura, altura) {
  const cabe = (n) => {
    if (largura % n || altura % n) return false;
    for (let by = 0; by < altura; by += n) {
      for (let bx = 0; bx < largura; bx += n) {
        const base = (by * largura + bx) * 4;
        for (let y = 0; y < n; y += 1) {
          for (let x = 0; x < n; x += 1) {
            const d = ((by + y) * largura + bx + x) * 4;
            for (let c = 0; c < 4; c += 1) if (dados[d + c] !== dados[base + c]) return false;
          }
        }
      }
    }
    return true;
  };

  let melhor = 1;
  for (let n = 2; n <= 64; n += 1) if (cabe(n)) melhor = n;
  return melhor;
}

/** Um pixel de cada bloco. Sem média: bloco chapado, então é cópia exata. */
function reduzir(dados, largura, altura, escala) {
  const l = largura / escala;
  const a = altura / escala;
  const saida = Buffer.alloc(l * a * 4);
  for (let y = 0; y < a; y += 1) {
    for (let x = 0; x < l; x += 1) {
      const origem = (y * escala * largura + x * escala) * 4;
      dados.copy(saida, (y * l + x) * 4, origem, origem + 4);
    }
  }
  return saida;
}

const mdc = (a, b) => (b ? mdc(b, a % b) : a);

const gif = lerGif(readFileSync(entrada));
const escala = escalaDoPixel(gif.quadros[0].dados, gif.largura, gif.altura);
const lado = { largura: gif.largura / escala, altura: gif.altura / escala };

// Atraso 0 é "o mais rápido possível"; navegador trata como ~100 ms, e é
// o que o passo precisa assumir pra não virar divisão por zero.
const atrasos = gif.quadros.map((q) => q.atraso || 100);
const passo = atrasos.reduce(mdc);
const repeticoes = atrasos.map((ms) => ms / passo);
const total = repeticoes.reduce((a, b) => a + b, 0);

const tira = Buffer.alloc(lado.largura * total * lado.altura * 4);
let coluna = 0;
for (let i = 0; i < gif.quadros.length; i += 1) {
  const quadro = reduzir(gif.quadros[i].dados, gif.largura, gif.altura, escala);
  for (let r = 0; r < repeticoes[i]; r += 1) {
    for (let y = 0; y < lado.altura; y += 1) {
      const origem = y * lado.largura * 4;
      quadro.copy(tira, (y * lado.largura * total + coluna * lado.largura) * 4, origem, origem + lado.largura * 4);
    }
    coluna += 1;
  }
}

const destino = join(pasta, `${nome}.png`);
writeFileSync(destino, escreverPng({ largura: lado.largura * total, altura: lado.altura, dados: tira }));

const duracao = passo * total;
const entradaKb = (readFileSync(entrada).length / 1024).toFixed(0);
const saidaKb = (readFileSync(destino).length / 1024).toFixed(1);

console.log(`${nome}.png  ${lado.largura * total}×${lado.altura}  (${entradaKb} KB -> ${saidaKb} KB)`);
console.log(`  origem   ${gif.largura}×${gif.altura}, escala ${escala}×, ${gif.quadros.length} quadros`);
if (total !== gif.quadros.length) console.log(`  ritmo    ${gif.quadros.length} quadros viraram ${total} a ${passo} ms (atraso variável)`);
console.log(`\n  pra colar em lib/pets/rostos.ts:`);
console.log(`    { src: '/img/pets/${nome}.png', quadros: ${total}, duracaoMs: ${duracao} },`);
