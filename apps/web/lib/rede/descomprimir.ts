/**
 * O lado de cá da compressão de pacote — ver `apps/api/src/realtime/compressao.ts`
 * pro porquê de ela existir e pelos números.
 *
 * Resumo: o `permessage-deflate` do WebSocket nunca valeu em produção
 * porque o proxy tira a extensão do handshake, então o servidor comprime
 * por dentro da mensagem. O ganho vem do **contexto compartilhado** entre
 * mensagens seguidas (0,2 KB por ação em vez de 10,8 KB), e é isso que
 * dita a forma deste módulo:
 *
 * - **Um fluxo só, vivo pela conexão inteira.** Um `DecompressionStream`
 *   por mensagem perderia exatamente o contexto que dá o ganho.
 * - **A ordem importa.** A mensagem N só se descomprime depois da N−1. Por
 *   isso {@link Descompressor.ler} enfileira: duas chamadas concorrentes
 *   embaralhariam o fluxo e a partida ficaria ilegível a partir dali.
 * - **Fronteira explícita.** Fluxo não tem fronteira: o servidor manda
 *   quantos bytes a mensagem tinha antes de comprimir (`n`), e a leitura
 *   acumula até chegar lá. Contar com "um pedaço por mensagem" seria
 *   contar com um detalhe que nenhuma especificação promete — e sobra de
 *   um pedaço é guardada pro próximo `ler`.
 *
 * Sem `DecompressionStream` (navegador antigo), {@link suportaDeflate}
 * responde `false`, o cliente não anuncia nada no handshake e o servidor
 * manda JSON cru como sempre. Ninguém fica sem jogar por causa disto.
 */

/** O que o servidor manda no evento `z`. */
export interface PacoteComprimido {
  /** Nome do evento original — `state`, `authoritative` ou `welcome`. */
  e: string;
  /** Bytes do deflate cru. Chega como `ArrayBuffer` pelo socket.io. */
  b: ArrayBuffer | Uint8Array;
  /** Tamanho do JSON antes de comprimir: a fronteira desta mensagem. */
  n: number;
}

/**
 * O navegador sabe inflar `deflate-raw`?
 *
 * `deflate-raw` chegou depois de `gzip`/`deflate` no `DecompressionStream`,
 * então não basta o construtor existir — precisa aceitar este formato.
 * Construir e descartar é a única checagem honesta.
 */
export function suportaDeflate(): boolean {
  if (typeof DecompressionStream === 'undefined') return false;
  try {
    new DecompressionStream('deflate-raw');
    return true;
  } catch {
    return false;
  }
}

export class Descompressor {
  // `BufferSource` na escrita e `Uint8Array` na leitura são os tipos que o
  // `DecompressionStream` declara — não é escolha, é o que a lib do DOM diz.
  private readonly escritor: WritableStreamDefaultWriter<BufferSource>;
  private readonly leitor: ReadableStreamDefaultReader<Uint8Array>;
  private readonly decodificador = new TextDecoder();
  /** O que sobrou de um pedaço que atravessou a fronteira da mensagem. */
  private sobra = new Uint8Array(0);
  /** A fila que preserva a ordem — ver o cabeçalho. */
  private fila: Promise<unknown> = Promise.resolve();
  private morto = false;

  constructor() {
    const fluxo = new DecompressionStream('deflate-raw');
    this.escritor = fluxo.writable.getWriter();
    this.leitor = fluxo.readable.getReader();
  }

  /**
   * O JSON de uma mensagem, ou `null` se o fluxo já morreu.
   *
   * Morre pra sempre no primeiro erro, de propósito: com contexto
   * compartilhado, um pedaço mal lido envenena todos os seguintes. Melhor
   * parar de decodificar e deixar a tela pedir sincronização do que
   * entregar estado corrompido como se fosse bom.
   */
  ler(pacote: PacoteComprimido): Promise<string | null> {
    const proxima = this.fila.then(() => this.lerEmOrdem(pacote)).catch(() => this.encerrar());
    this.fila = proxima;
    return proxima;
  }

  private async lerEmOrdem(pacote: PacoteComprimido): Promise<string | null> {
    if (this.morto) return null;

    // O socket.io entrega binário como `ArrayBuffer` no navegador. O molde
    // aceita `Uint8Array` também porque o teste passa um direto; o `as` é
    // seguro porque `SharedArrayBuffer` não chega aqui por caminho nenhum.
    const bytes = pacote.b instanceof ArrayBuffer ? new Uint8Array(pacote.b) : (pacote.b as Uint8Array<ArrayBuffer>);
    await this.escritor.write(bytes);

    const partes: Uint8Array[] = [];
    let lidos = 0;
    if (this.sobra.length > 0) {
      partes.push(this.sobra);
      lidos = this.sobra.length;
      this.sobra = new Uint8Array(0);
    }

    while (lidos < pacote.n) {
      const { value, done } = await this.leitor.read();
      if (done || !value) return this.encerrar();
      partes.push(value);
      lidos += value.length;
    }

    const junto = new Uint8Array(lidos);
    let escrito = 0;
    for (const parte of partes) {
      junto.set(parte, escrito);
      escrito += parte.length;
    }
    if (lidos > pacote.n) this.sobra = junto.slice(pacote.n);

    return this.decodificador.decode(junto.subarray(0, pacote.n));
  }

  /** Devolve `null` pra `lerEmOrdem` poder encerrar e responder numa linha. */
  private encerrar(): null {
    this.morto = true;
    return null;
  }
}
