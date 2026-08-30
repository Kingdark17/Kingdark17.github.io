/**
 * A volta inteira: **o servidor de verdade comprime, este módulo lê.**
 *
 * O `zlib` daqui é exatamente o que `apps/api/src/realtime/compressao.ts`
 * usa, com os mesmos parâmetros — se os dois lados divergirem (nível,
 * janela, `Z_SYNC_FLUSH`, deflate cru vs. zlib), estes testes quebram, que
 * é o ponto. Um teste que compusesse e lesse com o mesmo módulo provaria
 * só que ele é consistente consigo mesmo.
 */

import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { Descompressor, suportaDeflate, type PacoteComprimido } from './descomprimir';

/** O lado servidor, tal como `FluxoDeCompressao` o faz. */
function servidor() {
  const deflate = zlib.createDeflateRaw({ level: 6, windowBits: 14, memLevel: 7 });
  const saida: Buffer[] = [];
  deflate.on('data', (pedaco: Buffer) => saida.push(pedaco));

  return async (evento: string, payload: unknown): Promise<PacoteComprimido> => {
    const cru = Buffer.from(JSON.stringify(payload), 'utf8');
    deflate.write(cru);
    await new Promise<void>((pronto) => deflate.flush(zlib.constants.Z_SYNC_FLUSH, () => pronto()));
    const juntos = Buffer.concat(saida.splice(0));
    // Cópia com `ArrayBuffer` próprio: o Buffer do Node vive num pool
    // compartilhado, e passar o `.buffer` dele traria bytes de outra coisa.
    return { e: evento, b: new Uint8Array(juntos), n: cru.length };
  };
}

/** Pacote com a cara do real: mapa grande e parado, posição mudando. */
function pacoteDaSala(turno: number) {
  const mapa = Array.from({ length: 49 }, (_, i) => ({
    id: i,
    tipo: i % 5,
    visto: i < 20,
    portas: ['N', 'S', 'L', 'O'].slice(0, (i % 4) + 1),
    rotulo: `Sala do Corredor Antigo ${i}`,
  }));
  return { room: 'ABCD', role: 1, turn: turno, state: { floor: 8, pos: { r: turno % 7, c: (turno * 3) % 7 }, map: mapa } };
}

describe('suportaDeflate', () => {
  it('reconhece o ambiente em que roda', () => {
    // No Node 18+ e em todo navegador atual isto é `true`. O valor importa
    // menos que o contrato: a função não pode lançar em ambiente nenhum,
    // porque é ela que decide se o handshake anuncia compressão.
    expect(typeof suportaDeflate()).toBe('boolean');
  });
});

describe('Descompressor', () => {
  it('reconstitui byte a byte o que o servidor comprimiu', async () => {
    const comprime = servidor();
    const leitor = new Descompressor();

    for (let turno = 0; turno < 12; turno++) {
      const original = pacoteDaSala(turno);
      const lido = await leitor.ler(await comprime('state', original));

      expect(lido).not.toBeNull();
      expect(JSON.parse(lido!)).toEqual(original);
    }
  });

  /**
   * O motivo do contexto compartilhado existir. Se alguém trocar por um
   * deflate por mensagem, o ganho cai ~10× e este teste é quem avisa.
   */
  it('o contexto compartilhado encolhe as mensagens seguintes', async () => {
    const comprime = servidor();
    const primeira = await comprime('state', pacoteDaSala(0));
    const segunda = await comprime('state', pacoteDaSala(1));

    expect(segunda.b.byteLength * 4).toBeLessThan(primeira.b.byteLength);
    // E o pacote no fio é uma fração do JSON que ele carrega.
    expect(segunda.b.byteLength * 20).toBeLessThan(segunda.n);
  });

  /**
   * A fronteira é o `n`, não o pedaço que o fluxo devolve. Nada promete
   * "um pedaço por mensagem" — se um `read` trouxer duas mensagens juntas,
   * a sobra tem que ficar guardada pra próxima leitura.
   */
  it('não conta com um pedaço por mensagem', async () => {
    const comprime = servidor();
    const leitor = new Descompressor();

    const a = pacoteDaSala(0);
    const b = pacoteDaSala(1);
    const pa = await comprime('state', a);
    const pb = await comprime('state', b);

    // Os dois escritos antes de qualquer leitura: é o caso em que o fluxo
    // pode devolver as duas mensagens num pedaço só.
    const [lidoA, lidoB] = await Promise.all([leitor.ler(pa), leitor.ler(pb)]);

    expect(JSON.parse(lidoA!)).toEqual(a);
    expect(JSON.parse(lidoB!)).toEqual(b);
  });

  /**
   * A fila é o que garante isso. Sem ela, duas leituras concorrentes
   * intercalariam escrita e leitura no mesmo fluxo e devolveriam os bytes
   * de uma mensagem como se fossem da outra — estado corrompido chegando
   * na tela com cara de bom.
   */
  it('mantém a ordem mesmo com leituras disparadas juntas', async () => {
    const comprime = servidor();
    const leitor = new Descompressor();

    const originais = [pacoteDaSala(0), pacoteDaSala(1), pacoteDaSala(2), pacoteDaSala(3)];
    const pacotes = [];
    for (const original of originais) pacotes.push(await comprime('state', original));

    const lidos = await Promise.all(pacotes.map((p) => leitor.ler(p)));

    expect(lidos.map((l) => JSON.parse(l!))).toEqual(originais);
  });

  /**
   * Com contexto compartilhado, um pedaço estragado envenena todos os
   * seguintes: o dicionário do inflate passa a divergir do dicionário do
   * deflate. Parar de vez é a resposta certa — melhor a tela pedir
   * sincronização do que adotar estado corrompido.
   */
  it('morre de vez quando os bytes não prestam, em vez de entregar lixo', async () => {
    const comprime = servidor();
    const leitor = new Descompressor();

    await leitor.ler(await comprime('state', pacoteDaSala(0)));

    const estragado: PacoteComprimido = { e: 'state', b: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), n: 500 };
    expect(await leitor.ler(estragado)).toBeNull();

    // E não volta a funcionar depois: o contexto já não vale mais.
    expect(await leitor.ler(await comprime('state', pacoteDaSala(1)))).toBeNull();
  });
});
