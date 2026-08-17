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

export interface SaveHistoryEntry {
  id: string;
  createdAt: Date;
}

export interface SaveRepository {
  listSlots(userId: number): Promise<CloudSaveRow[]>;
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
