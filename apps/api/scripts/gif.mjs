/**
 * Ler GIF sem dependência nenhuma, pelo mesmo motivo do `png.mjs`: não há
 * biblioteca de imagem no projeto e não vale acrescentar uma para converter
 * arte de pet.
 *
 * Devolve os quadros já compostos em RGBA — quer dizer, com o descarte
 * (`disposal`) aplicado. Isso importa: quadro de GIF quase nunca é a imagem
 * inteira, é um retângulo que se cola por cima do anterior. Quem lê quadro
 * cru e grava direto acaba com sprites pela metade, e o buraco só aparece
 * depois, na tela.
 *
 * Cobre o que editor de pixel art exporta: LZW, paleta global ou local,
 * transparência por índice, entrelaçamento, e os descartes 0/1/2/3. Fora
 * disso lança, em vez de adivinhar.
 */

const ASSINATURAS = ['GIF87a', 'GIF89a'];

/** Desempacota os sub-blocos de tamanho variável num buffer só. */
function juntarSubBlocos(bruto, pos) {
  const pedacos = [];
  for (;;) {
    const tamanho = bruto[pos];
    pos += 1;
    if (tamanho === 0) break;
    pedacos.push(bruto.subarray(pos, pos + tamanho));
    pos += tamanho;
  }
  return { dados: Buffer.concat(pedacos), pos };
}

/**
 * LZW do GIF. Difere do LZW clássico em dois pontos que costumam morder:
 * os códigos são lidos do bit menos significativo pra cima, e o dicionário
 * cresce em largura de código até 12 bits, quando só o código de limpeza
 * pode reiniciá-lo.
 */
function descomprimirLzw(dados, larguraMinima, quantos) {
  const limpar = 1 << larguraMinima;
  const fim = limpar + 1;

  let dicionario = [];
  const reiniciar = () => {
    dicionario = [];
    for (let i = 0; i < limpar; i += 1) dicionario[i] = [i];
    dicionario[limpar] = [];
    dicionario[fim] = null;
  };
  reiniciar();

  const saida = Buffer.alloc(quantos);
  let escritos = 0;
  let largura = larguraMinima + 1;
  let anterior = null;
  let acumulador = 0;
  let bits = 0;

  for (let i = 0; i < dados.length && escritos < quantos; i += 1) {
    acumulador |= dados[i] << bits;
    bits += 8;

    while (bits >= largura && escritos < quantos) {
      const codigo = acumulador & ((1 << largura) - 1);
      acumulador >>= largura;
      bits -= largura;

      if (codigo === limpar) {
        reiniciar();
        largura = larguraMinima + 1;
        anterior = null;
        continue;
      }
      if (codigo === fim) return saida;

      let entrada;
      if (dicionario[codigo]) {
        entrada = dicionario[codigo];
      } else if (codigo === dicionario.length && anterior) {
        // O caso KwKwK: o código ainda não está no dicionário porque ele
        // *é* o que acabaria de ser criado. Sem este ramo, GIF exportado
        // por editor de pixel art estoura na primeira faixa de cor lisa.
        entrada = [...anterior, anterior[0]];
      } else {
        throw new Error(`código LZW inválido: ${codigo}`);
      }

      for (const byte of entrada) {
        if (escritos < quantos) saida[escritos++] = byte;
      }

      if (anterior) {
        dicionario.push([...anterior, entrada[0]]);
        if (dicionario.length === 1 << largura && largura < 12) largura += 1;
      }
      anterior = entrada;
    }
  }
  return saida;
}

/** As quatro passadas do entrelaçamento, na ordem em que o formato define. */
function desentrelacar(indices, largura, altura) {
  const saida = Buffer.alloc(indices.length);
  const passadas = [
    [0, 8],
    [4, 8],
    [2, 4],
    [1, 2],
  ];
  let origem = 0;
  for (const [inicio, passo] of passadas) {
    for (let y = inicio; y < altura; y += passo) {
      indices.copy(saida, y * largura, origem * largura, (origem + 1) * largura);
      origem += 1;
    }
  }
  return saida;
}

function lerPaleta(bruto, pos, quantas) {
  const paleta = new Array(quantas);
  for (let i = 0; i < quantas; i += 1) {
    paleta[i] = [bruto[pos + i * 3], bruto[pos + i * 3 + 1], bruto[pos + i * 3 + 2]];
  }
  return paleta;
}

/**
 * Devolve `{ largura, altura, quadros }`, cada quadro com `{ dados, atraso }`
 * — `dados` em RGBA de 4 bytes por pixel, do tamanho da tela inteira.
 */
export function lerGif(bruto) {
  const assinatura = bruto.subarray(0, 6).toString('latin1');
  if (!ASSINATURAS.includes(assinatura)) throw new Error(`não é GIF: ${assinatura}`);

  const largura = bruto.readUInt16LE(6);
  const altura = bruto.readUInt16LE(8);
  const empacotado = bruto[10];
  let pos = 13;

  let paletaGlobal = null;
  if (empacotado & 0x80) {
    const quantas = 1 << ((empacotado & 0x07) + 1);
    paletaGlobal = lerPaleta(bruto, pos, quantas);
    pos += quantas * 3;
  }

  const quadros = [];
  // A tela viva: cada quadro se cola nela, e é dela que sai a cópia.
  let tela = Buffer.alloc(largura * altura * 4);
  let controle = { transparente: -1, atraso: 0, descarte: 0 };

  for (;;) {
    const marcador = bruto[pos];
    pos += 1;

    if (marcador === 0x3b || marcador === undefined) break;

    if (marcador === 0x21) {
      const tipo = bruto[pos];
      pos += 1;
      if (tipo === 0xf9) {
        const tamanho = bruto[pos];
        const campos = bruto[pos + 1];
        controle = {
          transparente: campos & 0x01 ? bruto[pos + 4] : -1,
          atraso: bruto.readUInt16LE(pos + 2) * 10,
          descarte: (campos >> 2) & 0x07,
        };
        pos += 1 + tamanho + 1;
      } else {
        // `pos` já está no byte de tamanho do primeiro sub-bloco, que é
        // exatamente onde `juntarSubBlocos` começa a ler — igual à leitura
        // dos dados da imagem lá embaixo. Somar 1 aqui pulava esse byte e
        // fazia o primeiro byte de dado ser lido como tamanho, jogando a
        // posição pra dentro do lixo. O sintoma é "marcador desconhecido"
        // num offset qualquer, e **só aparece em GIF que tem extensão** —
        // ou seja, em todo GIF exportado com laço (`NETSCAPE2.0`), que é o
        // que qualquer editor de pixel art escreve por padrão.
        pos = juntarSubBlocos(bruto, pos).pos;
      }
      continue;
    }

    if (marcador !== 0x2c) throw new Error(`marcador desconhecido 0x${marcador.toString(16)} em ${pos - 1}`);

    const esquerda = bruto.readUInt16LE(pos);
    const topo = bruto.readUInt16LE(pos + 2);
    const larguraQ = bruto.readUInt16LE(pos + 4);
    const alturaQ = bruto.readUInt16LE(pos + 6);
    const campos = bruto[pos + 8];
    pos += 9;

    let paleta = paletaGlobal;
    if (campos & 0x80) {
      const quantas = 1 << ((campos & 0x07) + 1);
      paleta = lerPaleta(bruto, pos, quantas);
      pos += quantas * 3;
    }
    if (!paleta) throw new Error('quadro sem paleta global nem local');

    const larguraMinima = bruto[pos];
    pos += 1;
    const comprimido = juntarSubBlocos(bruto, pos);
    pos = comprimido.pos;

    let indices = descomprimirLzw(comprimido.dados, larguraMinima, larguraQ * alturaQ);
    if (campos & 0x40) indices = desentrelacar(indices, larguraQ, alturaQ);

    // Guardado antes de pintar: o descarte 3 manda voltar ao que havia.
    const antes = controle.descarte === 3 ? Buffer.from(tela) : null;

    for (let y = 0; y < alturaQ; y += 1) {
      for (let x = 0; x < larguraQ; x += 1) {
        const indice = indices[y * larguraQ + x];
        if (indice === controle.transparente) continue;
        const cor = paleta[indice];
        if (!cor) continue;
        const d = ((topo + y) * largura + (esquerda + x)) * 4;
        tela[d] = cor[0];
        tela[d + 1] = cor[1];
        tela[d + 2] = cor[2];
        tela[d + 3] = 255;
      }
    }

    quadros.push({ dados: Buffer.from(tela), atraso: controle.atraso });

    if (controle.descarte === 2) {
      for (let y = 0; y < alturaQ; y += 1) {
        tela.fill(0, ((topo + y) * largura + esquerda) * 4, ((topo + y) * largura + esquerda + larguraQ) * 4);
      }
    } else if (controle.descarte === 3 && antes) {
      tela = antes;
    }
  }

  if (!quadros.length) throw new Error('GIF sem quadro nenhum');
  return { largura, altura, quadros };
}
