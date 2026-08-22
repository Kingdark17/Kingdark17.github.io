/**
 * Mede um sprite e devolve os números que o gabarito do paperdoll precisa:
 * tamanho do arquivo, onde a arte começa e termina, quantas cores tem, qual
 * é o contorno, e se há pixel meio-transparente — o defeito que estraga
 * `image-rendering: pixelated` e que não dá pra ver no olho.
 *
 * Uso:  node apps/api/scripts/mede-sprite.mjs caminho/*.png
 */
import { readFileSync } from 'node:fs';

import { lerPng } from './png.mjs';

const hex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

function medir(caminho) {
  const { largura, altura, dados } = lerPng(readFileSync(caminho));
  const em = (x, y) => {
    const i = (y * largura + x) * 4;
    return [dados[i], dados[i + 1], dados[i + 2], dados[i + 3]];
  };

  let minX = largura;
  let maxX = -1;
  let minY = altura;
  let maxY = -1;
  let meioTransparentes = 0;
  const cores = new Map();
  const linhas = [];

  for (let y = 0; y < altura; y += 1) {
    let esq = -1;
    let dir = -1;
    for (let x = 0; x < largura; x += 1) {
      const [r, g, b, a] = em(x, y);
      if (a === 0) continue;
      if (a < 255) meioTransparentes += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      if (esq === -1) esq = x;
      dir = x;
      const c = hex(r, g, b);
      cores.set(c, (cores.get(c) || 0) + 1);
    }
    if (esq !== -1) linhas.push({ y, esq, dir, larg: dir - esq + 1 });
  }

  if (!linhas.length) {
    console.log(`\n=== ${caminho} ===\narquivo inteiro transparente`);
    return;
  }

  // O contorno é a cor escura mais frequente — é o que cerca cada forma.
  const escuras = [...cores.entries()].filter(([c]) => parseInt(c.slice(1, 3), 16) + parseInt(c.slice(3, 5), 16) + parseInt(c.slice(5, 7), 16) < 180).sort((a, b) => b[1] - a[1]);

  const maisLarga = linhas.reduce((a, b) => (b.larg > a.larg ? b : a));

  console.log(`\n=== ${caminho} ===`);
  console.log(`arquivo          : ${largura} x ${altura}${largura === altura ? '' : '  (não é quadrado)'}`);
  console.log(`arte ocupa       : x ${minX}..${maxX}   y ${minY}..${maxY}   (${maxX - minX + 1} x ${maxY - minY + 1})`);
  console.log(`margem           : ${minY} em cima, ${altura - 1 - maxY} embaixo, ${minX} à esquerda, ${largura - 1 - maxX} à direita`);
  console.log(`cores distintas  : ${cores.size}`);
  console.log(`contorno provável: ${escuras.length ? `${escuras[0][0]} (${escuras[0][1]} px)` : '(nenhuma cor escura)'}`);
  console.log(`meio-transparente: ${meioTransparentes === 0 ? 'nenhum — certo' : `${meioTransparentes} px — PRECISA CORRIGIR`}`);
  console.log(`linha mais larga : y ${maisLarga.y}  (${maisLarga.larg} px, de x ${maisLarga.esq} a ${maisLarga.dir})`);

  const passo = Math.max(1, Math.round(linhas.length / 18));
  console.log('perfil (y:largura):');
  console.log(
    '  ' +
      linhas
        .filter((_, i) => i % passo === 0)
        .map((l) => `${l.y}:${l.larg}`)
        .join('  '),
  );
}

const alvos = process.argv.slice(2);
if (!alvos.length) {
  console.log('Passe um ou mais caminhos de PNG.');
  process.exit(1);
}
for (const alvo of alvos) {
  try {
    medir(alvo);
  } catch (erro) {
    console.log(`\n=== ${alvo} ===\nfalhou: ${erro.message}`);
  }
}
