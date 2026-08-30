import zlib from 'node:zlib';

import { FluxoDeCompressao, type PacoteComprimido } from './compressao';

/**
 * O leitor do outro lado, tal como `apps/web/lib/rede/descomprimir.ts` o
 * faz: um `inflateRaw` só, vivo, alimentado na ordem. Escrito aqui em vez
 * de importado de propósito — se os dois lados divergirem, é este teste
 * que precisa quebrar.
 */
function leitor() {
  const inflate = zlib.createInflateRaw({ windowBits: 15 });
  const saida: Buffer[] = [];
  inflate.on('data', (pedaco: Buffer) => saida.push(pedaco));

  return async (pacote: PacoteComprimido): Promise<string> => {
    inflate.write(pacote.b);
    await new Promise<void>((pronto) => inflate.flush(zlib.constants.Z_SYNC_FLUSH, () => pronto()));
    return Buffer.concat(saida.splice(0)).toString('utf8');
  };
}

function pacoteDaSala(turno: number) {
  const mapa = Array.from({ length: 49 }, (_, i) => ({ id: i, tipo: i % 5, visto: i < 20, rotulo: `Sala do Corredor Antigo ${i}` }));
  return { room: 'ABCD', role: 1, turn: turno, state: { floor: 8, pos: { r: turno % 7 }, map: mapa } };
}

/** `enfileirar` entrega por callback; aqui vira promessa pra poder esperar. */
function comprimir(fluxo: FluxoDeCompressao, evento: string, payload: unknown): Promise<PacoteComprimido | null> {
  return new Promise((pronto) => fluxo.enfileirar(evento, payload, pronto));
}

describe('FluxoDeCompressao', () => {
  it('o que sai comprimido volta idêntico do outro lado', async () => {
    const fluxo = new FluxoDeCompressao();
    const le = leitor();

    for (let turno = 0; turno < 10; turno++) {
      const original = pacoteDaSala(turno);
      const pacote = await comprimir(fluxo, 'state', original);

      expect(pacote).not.toBeNull();
      expect(pacote!.e).toBe('state');
      expect(JSON.parse(await le(pacote!))).toEqual(original);
    }

    fluxo.encerrar();
  });

  /**
   * O motivo de o fluxo ser por conexão em vez de um deflate por mensagem.
   * Se alguém trocar, o ganho cai ~10× e é este teste que avisa.
   */
  it('a segunda mensagem é uma fração da primeira — é o contexto compartilhado', async () => {
    const fluxo = new FluxoDeCompressao();

    const primeira = await comprimir(fluxo, 'state', pacoteDaSala(0));
    const segunda = await comprimir(fluxo, 'state', pacoteDaSala(1));

    expect(segunda!.b.length * 4).toBeLessThan(primeira!.b.length);
    // E o que vai no fio é uma fração do JSON que ele carrega.
    expect(segunda!.b.length * 20).toBeLessThan(segunda!.n);

    fluxo.encerrar();
  });

  /**
   * **O invariante que a compressão com contexto cria.** `flush` é
   * assíncrono: sem a fila, duas chamadas concorrentes poderiam comprimir
   * numa ordem e entregar noutra, e a partir dali o leitor do outro lado
   * decodificaria lixo — com cara de estado bom.
   */
  it('entrega na ordem em que foi chamado, mesmo disparado tudo junto', async () => {
    const fluxo = new FluxoDeCompressao();
    const le = leitor();
    const originais = [pacoteDaSala(0), pacoteDaSala(1), pacoteDaSala(2), pacoteDaSala(3), pacoteDaSala(4)];

    const pacotes = await Promise.all(originais.map((o) => comprimir(fluxo, 'state', o)));

    // Lidos na ordem de entrega. Se a ordem tivesse embaralhado, o inflate
    // devolveria bytes de outra mensagem ou falharia aqui.
    for (const [i, pacote] of pacotes.entries()) {
      expect(JSON.parse(await le(pacote!))).toEqual(originais[i]);
    }

    fluxo.encerrar();
  });

  it('depois de encerrado devolve null, pra quem chamou mandar cru', async () => {
    const fluxo = new FluxoDeCompressao();
    fluxo.encerrar();

    expect(await comprimir(fluxo, 'state', pacoteDaSala(0))).toBeNull();
  });

  /** Encerrar duas vezes acontece: `handleDisconnect` e o erro do fluxo. */
  it('encerrar é idempotente', () => {
    const fluxo = new FluxoDeCompressao();

    expect(() => {
      fluxo.encerrar();
      fluxo.encerrar();
    }).not.toThrow();
  });
});
