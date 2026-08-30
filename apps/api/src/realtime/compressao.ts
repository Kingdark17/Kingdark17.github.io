/**
 * Compressão do pacote de sala **por dentro da mensagem**, e não no
 * WebSocket.
 *
 * ## Por que isto existe
 *
 * O gateway pede `perMessageDeflate` e o socket.io o configura direito —
 * há teste ponta a ponta provando que a extensão é negociada quando não há
 * proxy no meio. Só que **não existe endereço da API sem proxy**: tanto
 * `api.rpglegend.com.br` quanto `rpg-legend-api.onrender.com` respondem
 * `Server: cloudflare`, e o `101` volta dos dois **sem**
 * `Sec-WebSocket-Extensions`. A compressão do WebSocket nunca valeu em
 * produção — foi por isso que o `/health` ganhou `socket.comprimidas`.
 *
 * A saída é comprimir onde o proxy não mexe: o corpo da mensagem. Pro
 * Cloudflare é um punhado de bytes opacos como qualquer outro.
 *
 * ## Por que um fluxo por conexão, e não um deflate por mensagem
 *
 * O ganho inteiro está no **contexto compartilhado**. Pacotes de sala
 * seguidos são quase idênticos, e o deflate com contexto referencia a
 * mensagem anterior em vez de repeti-la. Medido com um pacote real de
 * andar 8 (hero + mapa, já sem a mochila que o recorte tira):
 *
 * | regime | por ação | ganho |
 * |---|---|---|
 * | cru | 10,8 KB | — |
 * | deflate por mensagem | 1,9 KB | 5,8× |
 * | deflate com contexto | **0,2 KB** | **56×** |
 *
 * Quase 10× de diferença entre os dois últimos. Um deflate por mensagem
 * ficaria **pior** que o protocolo de delta que já tinha sido descartado
 * por trazer um invariante arriscado — teria o custo sem o prêmio.
 *
 * ## As duas armadilhas, e o que este arquivo faz sobre elas
 *
 * 1. **A janela precisa ser maior que o pacote.** Com `windowBits: 14` são
 *    16 KB. Medido: o mesmo teste com um pacote de 21,4 KB viu o ganho
 *    despencar de 56× pra 10,9×, porque não há como alcançar a mensagem
 *    anterior de dentro da janela. É por isso que o recorte da mochila e
 *    esta compressão se somam — foi encolher o pacote pra dentro da janela
 *    que fez a compressão render.
 *
 * 2. **A ordem passa a ser um invariante.** Contexto compartilhado quer
 *    dizer que a mensagem N só se descomprime depois da N−1. `flush()` é
 *    assíncrono, e duas chamadas concorrentes poderiam comprimir numa
 *    ordem e emitir noutra — o cliente receberia lixo a partir dali.
 *    {@link FluxoDeCompressao.enfileirar} resolve isso encadeando
 *    comprimir-e-emitir numa fila por conexão: a emissão da mensagem N+1
 *    só começa depois que a N saiu.
 *
 * O tamanho cru viaja junto (`n`) porque o lado de lá lê de um fluxo, e
 * fluxo não tem fronteira: sem o tamanho, o cliente não sabe onde uma
 * mensagem acaba e a próxima começa. Contar com "um pedaço por mensagem"
 * seria contar com um detalhe que nenhuma especificação promete.
 */

import zlib from 'node:zlib';

/** O que vai no fio no lugar do JSON. */
export interface PacoteComprimido {
  /** Nome do evento original (`state`, `authoritative`, `welcome`). */
  e: string;
  /** Bytes do deflate cru, com o contexto da conexão. */
  b: Buffer;
  /** Tamanho do JSON **antes** de comprimir — a fronteira da mensagem. */
  n: number;
}

/** Nível 6: o 3 rende bem menos e o 9 não melhora o 6. Medido. */
const NIVEL = 6;
/** 16 KB. Ver a armadilha 1 no cabeçalho — precisa caber o pacote inteiro. */
const JANELA = 14;

export class FluxoDeCompressao {
  private readonly deflate = zlib.createDeflateRaw({ level: NIVEL, windowBits: JANELA, memLevel: 7 });
  private readonly saida: Buffer[] = [];
  /** A fila que preserva a ordem. Ver a armadilha 2 no cabeçalho. */
  private fila: Promise<unknown> = Promise.resolve();
  private encerrado = false;

  constructor() {
    this.deflate.on('data', (pedaco: Buffer) => this.saida.push(pedaco));
    // O deflate não pode derrubar a conexão: se ele falhar, o
    // `enfileirar` cai no caminho cru e a partida segue.
    this.deflate.on('error', () => this.encerrar());
  }

  /**
   * Comprime e devolve o pacote pronto pra emitir — ou `null` se o fluxo já
   * morreu, caso em que quem chamou manda o JSON cru.
   *
   * **Não chame direto no caminho quente**: use {@link enfileirar}, que é o
   * que garante a ordem.
   */
  private async comprimir(evento: string, payload: unknown): Promise<PacoteComprimido | null> {
    if (this.encerrado) return null;

    const cru = Buffer.from(JSON.stringify(payload), 'utf8');
    this.deflate.write(cru);
    await new Promise<void>((pronto) => this.deflate.flush(zlib.constants.Z_SYNC_FLUSH, () => pronto()));
    if (this.encerrado) return null;

    return { e: evento, b: Buffer.concat(this.saida.splice(0)), n: cru.length };
  }

  /**
   * Comprime e entrega **em ordem**, uma mensagem de cada vez.
   *
   * `entregar` recebe `null` quando não deu pra comprimir — aí ela manda o
   * pacote cru, e o cliente segue funcionando com um pacote maior em vez de
   * ficar sem o pacote.
   */
  enfileirar(evento: string, payload: unknown, entregar: (pacote: PacoteComprimido | null) => void): void {
    this.fila = this.fila
      .then(() => this.comprimir(evento, payload))
      .then(entregar)
      .catch(() => entregar(null));
  }

  encerrar(): void {
    if (this.encerrado) return;
    this.encerrado = true;
    this.deflate.removeAllListeners('data');
    this.deflate.destroy();
    this.saida.length = 0;
  }
}
