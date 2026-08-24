/**
 * Porta de acesso a `cloud_saves`/`cloud_save_history` que o `SaveService`
 * depende — implementada por cima do Drizzle depois. Interface primeiro
 * pra manter o service testável com um fake em memória, sem banco.
 */

export interface CloudSaveRow {
  slot: number;
  data: unknown;
  updatedAt: Date;
}

/**
 * A linha da tela de personagens — tipo separado de `CloudSaveRow` de
 * propósito, pra não voltar a ser o save inteiro.
 */
export interface CharacterHeadRow {
  slot: number;
  updatedAt: Date;
  /**
   * Só `{hero: {name, race, raceId, raceIcon, className, classIcon, level, equip}, floor}` —
   * os seis campos que o card mostra. Ler os quatro slots por completo
   * pra montar esse resumo é o mesmo desperdício da foto em base64 no
   * `/api/friends`.
   */
  data: unknown;
}

export interface SaveHistoryEntry {
  id: string;
  createdAt: Date;
}

export interface SaveRepository {
  /** Os slots ocupados, já reduzidos ao que a tela de personagens mostra. */
  listHeads(userId: number): Promise<CharacterHeadRow[]>;
  getSlot(userId: number, slot: number): Promise<CloudSaveRow | null>;
  resetSlot(userId: number, slot: number): Promise<void>;
  /**
   * Espelha `storeSave()` do accounts.js original: grava o slot e, se já
   * fizer 15 minutos do último snapshot (ou `forceHistory` for true),
   * arquiva o estado anterior em `cloud_save_history`, mantendo só os 10
   * mais recentes.
   */
  store(userId: number, slot: number, data: unknown, forceHistory: boolean, now: Date): Promise<void>;
  listHistory(userId: number, slot: number): Promise<SaveHistoryEntry[]>;
  /** `null` quando a versão não existe — `unknown` já cobre isso, e `unknown | null` seria redundante. */
  getHistoryEntry(userId: number, slot: number, id: string): Promise<unknown>;
}
