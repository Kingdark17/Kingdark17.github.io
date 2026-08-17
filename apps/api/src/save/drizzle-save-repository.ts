/**
 * Implementação de `SaveRepository` sobre `cloud_saves`/`cloud_save_history`
 * (`db/schema.ts`). Mesma regra de `../auth/drizzle-users-repository.ts`:
 * `getDb()` só roda dentro dos métodos, nunca no construtor.
 *
 * `store()` reproduz a transação do `storeSave()` original (BEGIN/COMMIT,
 * `SELECT ... FOR UPDATE` pra travar a linha contra saves concorrentes do
 * mesmo slot) via `db.transaction()` do Drizzle, em vez de um client de
 * pool manual.
 */

import { and, desc, eq, gt, notInArray } from 'drizzle-orm';

import { getDb } from '../db/client';
import { cloudSaveHistory, cloudSaves } from '../db/schema';
import type { CloudSaveRow, SaveHistoryEntry, SaveRepository } from './save-repository';

const HISTORY_LIMIT = 10;
const HISTORY_THROTTLE_MS = 15 * 60 * 1000;

export class DrizzleSaveRepository implements SaveRepository {
  async listSlots(userId: number): Promise<CloudSaveRow[]> {
    const rows = await getDb().select().from(cloudSaves).where(eq(cloudSaves.userId, userId)).orderBy(cloudSaves.slot);
    return rows.map((row) => ({ slot: row.slot, data: row.data, updatedAt: row.updatedAt }));
  }

  async getSlot(userId: number, slot: number): Promise<CloudSaveRow | null> {
    const rows = await getDb()
      .select()
      .from(cloudSaves)
      .where(and(eq(cloudSaves.userId, userId), eq(cloudSaves.slot, slot)))
      .limit(1);
    const row = rows[0];
    return row ? { slot: row.slot, data: row.data, updatedAt: row.updatedAt } : null;
  }

  async resetSlot(userId: number, slot: number): Promise<void> {
    await getDb().transaction(async (tx) => {
      await tx.delete(cloudSaveHistory).where(and(eq(cloudSaveHistory.userId, userId), eq(cloudSaveHistory.slot, slot)));
      await tx.delete(cloudSaves).where(and(eq(cloudSaves.userId, userId), eq(cloudSaves.slot, slot)));
    });
  }

  async store(userId: number, slot: number, data: unknown, forceHistory: boolean, now: Date): Promise<void> {
    await getDb().transaction(async (tx) => {
      const currentRows = await tx
        .select()
        .from(cloudSaves)
        .where(and(eq(cloudSaves.userId, userId), eq(cloudSaves.slot, slot)))
        .for('update');
      const current = currentRows[0];

      if (current) {
        const threshold = new Date(now.getTime() - HISTORY_THROTTLE_MS);
        const recentRows = await tx
          .select({ id: cloudSaveHistory.id })
          .from(cloudSaveHistory)
          .where(and(eq(cloudSaveHistory.userId, userId), eq(cloudSaveHistory.slot, slot), gt(cloudSaveHistory.createdAt, threshold)))
          .limit(1);

        if (forceHistory || recentRows.length === 0) {
          await tx.insert(cloudSaveHistory).values({ userId, slot, data: current.data });

          const keepRows = await tx
            .select({ id: cloudSaveHistory.id })
            .from(cloudSaveHistory)
            .where(and(eq(cloudSaveHistory.userId, userId), eq(cloudSaveHistory.slot, slot)))
            .orderBy(desc(cloudSaveHistory.createdAt))
            .limit(HISTORY_LIMIT);
          const keepIds = keepRows.map((row) => row.id);
          if (keepIds.length > 0) {
            await tx
              .delete(cloudSaveHistory)
              .where(and(eq(cloudSaveHistory.userId, userId), eq(cloudSaveHistory.slot, slot), notInArray(cloudSaveHistory.id, keepIds)));
          }
        }
      }

      await tx
        .insert(cloudSaves)
        .values({ userId, slot, data, updatedAt: now })
        .onConflictDoUpdate({ target: [cloudSaves.userId, cloudSaves.slot], set: { data, updatedAt: now } });
    });
  }

  async listHistory(userId: number, slot: number): Promise<SaveHistoryEntry[]> {
    const rows = await getDb()
      .select({ id: cloudSaveHistory.id, createdAt: cloudSaveHistory.createdAt })
      .from(cloudSaveHistory)
      .where(and(eq(cloudSaveHistory.userId, userId), eq(cloudSaveHistory.slot, slot)))
      .orderBy(desc(cloudSaveHistory.createdAt))
      .limit(HISTORY_LIMIT);
    return rows.map((row) => ({ id: String(row.id), createdAt: row.createdAt }));
  }

  async getHistoryEntry(userId: number, slot: number, id: string): Promise<unknown> {
    const rows = await getDb()
      .select({ data: cloudSaveHistory.data })
      .from(cloudSaveHistory)
      .where(and(eq(cloudSaveHistory.id, Number(id)), eq(cloudSaveHistory.userId, userId), eq(cloudSaveHistory.slot, slot)))
      .limit(1);
    return rows[0] ? rows[0].data : null;
  }
}
