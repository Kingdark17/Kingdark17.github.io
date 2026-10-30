/**
 * Lê um PNG de 8 bits sem entrelaçamento (RGB ou RGBA), só com o que vem no
 * Node: a colisão e as camadas da cidade (`planta-da-cidade.mjs`) e as camadas
 * das salas (`cobertura-das-salas.ts`). Devolve a largura, a altura, os
 * canais e os pixels, linha por linha.
 */

import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

export function lerPng(caminho) {
  const arquivo = readFileSync(caminho);
  let pos = 8;
  let largura = 0;
  let altura = 0;
  let canais = 4;
  const pedacos = [];
  while (pos < arquivo.length) {
    const tamanho = arquivo.readUInt32BE(pos);
    const tipo = arquivo.toString('ascii', pos + 4, pos + 8);
    const dados = arquivo.subarray(pos + 8, pos + 8 + tamanho);
    if (tipo === 'IHDR') {
      largura = dados.readUInt32BE(0);
      altura = dados.readUInt32BE(4);
      if (dados[8] !== 8 || dados[12] !== 0) throw new Error('só PNG de 8 bits sem entrelaçamento');
      canais = { 2: 3, 6: 4 }[dados[9]];
      if (!canais) throw new Error('só PNG RGB ou RGBA');
    } else if (tipo === 'IDAT') pedacos.push(dados);
    else if (tipo === 'IEND') break;
    pos += 12 + tamanho;
  }
  const cru = zlib.inflateSync(Buffer.concat(pedacos));
  const porLinha = largura * canais;
  const px = Buffer.alloc(altura * porLinha);
  for (let y = 0; y < altura; y++) {
    const filtro = cru[y * (porLinha + 1)];
    const entrada = cru.subarray(y * (porLinha + 1) + 1, (y + 1) * (porLinha + 1));
    const linha = px.subarray(y * porLinha, (y + 1) * porLinha);
    const acima = y > 0 ? px.subarray((y - 1) * porLinha, y * porLinha) : null;
    for (let x = 0; x < porLinha; x++) {
      const a = x >= canais ? linha[x - canais] : 0;
      const b = acima ? acima[x] : 0;
      const c = acima && x >= canais ? acima[x - canais] : 0;
      let previsto = 0;
      if (filtro === 1) previsto = a;
      else if (filtro === 2) previsto = b;
      else if (filtro === 3) previsto = (a + b) >> 1;
      else if (filtro === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        previsto = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      linha[x] = (entrada[x] + previsto) & 0xff;
    }
  }
  return { largura, altura, canais, px };
}
