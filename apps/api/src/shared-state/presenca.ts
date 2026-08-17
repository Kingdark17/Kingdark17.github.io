/**
 * Presença e entrega de evento entre instâncias.
 *
 * O socket vive numa instância só, então a lista de conexões continua
 * onde estava (`OnlineUsersRegistry`). O que precisa ser compartilhado
 * são duas coisas:
 *
 * 1. **Quem está online**, pra `/api/friends` não dizer que um amigo
 *    conectado na instância B está offline.
 * 2. **Pra onde empurrar um evento**, porque presença que mente é pior
 *    que presença nenhuma: mostrar "online" e não entregar a mensagem é
 *    um bug com cara de funcionalidade.
 *
 * ## Como o online é mantido
 *
 * Cada instância publica **o seu próprio conjunto** de usuários
 * conectados (`rpg:online:<instância>`), com prazo de validade renovado
 * por batimento. Quem lê junta os conjuntos das instâncias vivas.
 *
 * Isso se conserta sozinho no caso que importa: instância que morre para
 * de renovar, a chave expira, e os usuários dela somem da lista. Com um
 * conjunto global e contagem de referências, um processo derrubado
 * deixaria gente "online" pra sempre.
 *
 * A instância nunca se consulta pelo Redis — ela já sabe quem tem. O que
 * vem de fora é só o resto.
 */

import { randomUUID } from 'node:crypto';

import type { ClienteRedis } from './cliente-redis';

export type Entrega = (userId: number, evento: string, payload: unknown) => void;

export interface PresencaCompartilhada {
  entrou(userId: number): void;
  saiu(userId: number): void;
  /** Só os que estão em **outras** instâncias — a local o chamador já conhece. */
  onlineEmOutras(userIds: number[]): Promise<Set<number>>;
  /** Entrega em qualquer instância. Melhor-esforço, como sempre foi. */
  empurrar(userId: number, evento: string, payload: unknown): void;
  aoReceber(entrega: Entrega): void;
  encerrar(): Promise<void>;
}

/** Uma instância só: não há "outras", e empurrar é entregar aqui mesmo. */
export class PresencaLocal implements PresencaCompartilhada {
  private entrega: Entrega = () => undefined;

  // Sem parâmetro porque não há o que fazer com ele: numa instância só,
  // entrar e sair já está registrado no mapa de conexões local.
  entrou(): void {}
  saiu(): void {}

  onlineEmOutras(): Promise<Set<number>> {
    return Promise.resolve(new Set());
  }

  empurrar(userId: number, evento: string, payload: unknown): void {
    this.entrega(userId, evento, payload);
  }

  aoReceber(entrega: Entrega): void {
    this.entrega = entrega;
  }

  encerrar(): Promise<void> {
    return Promise.resolve();
  }
}

const CHAVE_INSTANCIAS = 'rpg:instancias';
const CANAL = 'rpg:eventos';

/** Prazo da chave de presença e de quanto em quanto tempo ela é renovada. */
export const VALIDADE_MS = 30_000;
export const BATIMENTO_MS = 10_000;

interface Empurrado {
  de: string;
  userId: number;
  evento: string;
  payload: unknown;
}

export class PresencaNoRedis implements PresencaCompartilhada {
  private readonly meus = new Set<number>();
  private entrega: Entrega = () => undefined;
  private readonly assinante: ClienteRedis;
  private batimento: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly redis: ClienteRedis,
    /** Identifica esta instância. Explícito nos testes; aleatório em produção. */
    private readonly instancia: string = randomUUID(),
  ) {
    // Conexão separada porque um cliente inscrito num canal não aceita
    // mais comandos comuns — é regra do protocolo, não escolha nossa.
    this.assinante = redis.duplicate();
    void this.assinante.subscribe(CANAL);
    this.assinante.on('message', (_canal, mensagem) => this.receber(mensagem));

    void this.redis.sadd(CHAVE_INSTANCIAS, this.instancia);
    this.batimento = setInterval(() => void this.renovar(), BATIMENTO_MS);
    this.batimento.unref?.();
  }

  private get minhaChave(): string {
    return `rpg:online:${this.instancia}`;
  }

  private async renovar(): Promise<void> {
    try {
      await this.redis.pexpire(this.minhaChave, VALIDADE_MS);
    } catch {
      // Sem Redis a presença encolhe pro que esta instância enxerga, que
      // é o comportamento de antes. Não é motivo pra derrubar nada.
    }
  }

  entrou(userId: number): void {
    this.meus.add(userId);
    void this.gravar(userId);
  }

  private async gravar(userId: number): Promise<void> {
    try {
      await this.redis.sadd(this.minhaChave, String(userId));
      await this.redis.pexpire(this.minhaChave, VALIDADE_MS);
    } catch {
      /* melhor-esforço */
    }
  }

  saiu(userId: number): void {
    this.meus.delete(userId);
    void this.redis.srem(this.minhaChave, String(userId)).catch(() => undefined);
  }

  async onlineEmOutras(userIds: number[]): Promise<Set<number>> {
    const achados = new Set<number>();
    if (!userIds.length) return achados;

    try {
      const instancias = await this.redis.smembers(CHAVE_INSTANCIAS);
      const procurados = new Set(userIds.map(String));

      for (const outra of instancias) {
        if (outra === this.instancia) continue;
        // Chave expirada devolve conjunto vazio — é assim que instância
        // morta some da conta sem ninguém precisar limpar nada.
        for (const id of await this.redis.smembers(`rpg:online:${outra}`)) {
          if (procurados.has(id)) achados.add(Number(id));
        }
      }
    } catch {
      /* fica só com o que a instância local sabe */
    }
    return achados;
  }

  empurrar(userId: number, evento: string, payload: unknown): void {
    // Entrega local direto: quem está aqui não precisa de ida e volta.
    if (this.meus.has(userId)) this.entrega(userId, evento, payload);

    const pacote: Empurrado = { de: this.instancia, userId, evento, payload };
    void this.redis.publish(CANAL, JSON.stringify(pacote)).catch(() => undefined);
  }

  private receber(mensagem: string): void {
    let pacote: Empurrado;
    try {
      pacote = JSON.parse(mensagem) as Empurrado;
    } catch {
      return;
    }
    // O próprio publicador também recebe o que publicou. Sem esta linha o
    // usuário conectado aqui receberia o evento duas vezes.
    if (pacote.de === this.instancia) return;
    this.entrega(pacote.userId, pacote.evento, pacote.payload);
  }

  aoReceber(entrega: Entrega): void {
    this.entrega = entrega;
  }

  async encerrar(): Promise<void> {
    if (this.batimento) clearInterval(this.batimento);
    this.batimento = null;
    try {
      await this.redis.srem(CHAVE_INSTANCIAS, this.instancia);
      await this.assinante.quit();
    } catch {
      /* encerrando de qualquer jeito */
    }
  }
}
