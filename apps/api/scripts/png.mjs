/**
 * Ler e gravar PNG sem dependência nenhuma.
 *
 * Existe porque não há biblioteca de imagem instalada no projeto e não
 * vale acrescentar uma para medir e empilhar sprite. Cobre o caso que
 * interessa — 8 bits por canal, sem entrelaçamento — que é o que qualquer
 * editor de pixel art exporta. Fora disso, lança em vez de adivinhar.
 */
import { deflateSync, inflateSync } from 'node:zlib';

const ASSINATURA = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CANAIS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

const TABELA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** Devolve `{ largura, altura, dados }`, com `dados` em RGBA de 4 bytes por pixel. */
export function lerPng(bruto) {
  if (!bruto.subarray(0, 8).equals(ASSINATURA)) throw new Error('não é um PNG');

  let pos = 8;
  let cab = null;
  const idat = [];
  let paleta = null;
  let trns = null;

  while (pos < bruto.length) {
    const tamanho = bruto.readUInt32BE(pos);
    const tipo = bruto.toString('ascii', pos + 4, pos + 8);
    const corpo = bruto.subarray(pos + 8, pos + 8 + tamanho);

    if (tipo === 'IHDR') cab = { largura: corpo.readUInt32BE(0), altura: corpo.readUInt32BE(4), profundidade: corpo[8], tipoDeCor: corpo[9], entrelacado: corpo[12] };
    else if (tipo === 'PLTE') paleta = Buffer.from(corpo);
    else if (tipo === 'tRNS') trns = Buffer.from(corpo);
    else if (tipo === 'IDAT') idat.push(Buffer.from(corpo));
    else if (tipo === 'IEND') break;

    pos += 12 + tamanho;
  }

  if (!cab) throw new Error('PNG sem IHDR');
  if (cab.profundidade !== 8) throw new Error(`${cab.profundidade} bits por canal — só sei ler 8`);
  if (cab.entrelacado) throw new Error('PNG entrelaçado — reexporte sem entrelaçamento');

  const bpp = CANAIS[cab.tipoDeCor];
  const porLinha = cab.largura * bpp;
  const cru = inflateSync(Buffer.concat(idat));
  const plano = Buffer.alloc(cab.altura * porLinha);

  for (let y = 0; y < cab.altura; y += 1) {
    const filtro = cru[y * (porLinha + 1)];
    const linha = cru.subarray(y * (porLinha + 1) + 1, (y + 1) * (porLinha + 1));
    for (let i = 0; i < porLinha; i += 1) {
      const a = i >= bpp ? plano[y * porLinha + i - bpp] : 0;
      const b = y > 0 ? plano[(y - 1) * porLinha + i] : 0;
      const c = i >= bpp && y > 0 ? plano[(y - 1) * porLinha + i - bpp] : 0;
      let v = linha[i];
      if (filtro === 1) v += a;
      else if (filtro === 2) v += b;
      else if (filtro === 3) v += (a + b) >> 1;
      else if (filtro === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      plano[y * porLinha + i] = v & 0xff;
    }
  }

  // Tudo vira RGBA, pra quem usa não precisar saber de tipo de cor.
  const dados = Buffer.alloc(cab.largura * cab.altura * 4);
  for (let i = 0, j = 0; i < cab.largura * cab.altura; i += 1, j += 4) {
    const k = i * bpp;
    if (cab.tipoDeCor === 6) dados.set([plano[k], plano[k + 1], plano[k + 2], plano[k + 3]], j);
    else if (cab.tipoDeCor === 2) dados.set([plano[k], plano[k + 1], plano[k + 2], 255], j);
    else if (cab.tipoDeCor === 4) dados.set([plano[k], plano[k], plano[k], plano[k + 1]], j);
    else if (cab.tipoDeCor === 0) dados.set([plano[k], plano[k], plano[k], 255], j);
    else {
      const idx = plano[k];
      dados.set([paleta[idx * 3], paleta[idx * 3 + 1], paleta[idx * 3 + 2], trns && idx < trns.length ? trns[idx] : 255], j);
    }
  }

  return { largura: cab.largura, altura: cab.altura, dados };
}

export function escreverPng({ largura, altura, dados }) {
  const cru = Buffer.alloc(altura * (largura * 4 + 1));
  for (let y = 0; y < altura; y += 1) {
    cru[y * (largura * 4 + 1)] = 0; // filtro "nenhum": o arquivo fica maior e o código, simples
    dados.copy(cru, y * (largura * 4 + 1) + 1, y * largura * 4, (y + 1) * largura * 4);
  }

  const pedaco = (tipo, corpo) => {
    const tamanho = Buffer.alloc(4);
    tamanho.writeUInt32BE(corpo.length);
    const comTipo = Buffer.concat([Buffer.from(tipo, 'ascii'), corpo]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(comTipo));
    return Buffer.concat([tamanho, comTipo, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([ASSINATURA, pedaco('IHDR', ihdr), pedaco('IDAT', deflateSync(cru, { level: 9 })), pedaco('IEND', Buffer.alloc(0))]);
}
