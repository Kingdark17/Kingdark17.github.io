/**
 * Implementação de `ProfileRepository` sobre `users`/`cloud_saves`
 * (`db/schema.ts`). Mesma regra dos outros repositórios Drizzle:
 * `getDb()` só roda dentro dos métodos, nunca no construtor.
 *
 * `purchase()` reproduz a transação BEGIN/FOR UPDATE/COMMIT de
 * `/api/account/profile/purchase` no accounts.js original: trava
 * users+cloud_saves do slot, decide com `resolvePurchase` (a mesma
 * função pura usada nos testes) e persiste os dois se aprovado.
 */

import { and, eq } from 'drizzle-orm';

import { cosmeticsFor, type ProfileCatalogItem } from '../auth/cosmetics';
import { toAccountRecord } from '../auth/to-account-record';
import { getDb } from '../db/client';
import { cloudSaves, users } from '../db/schema';
import type { ProfilePurchaseOutcome, ProfileRepository, UpdateProfileInput } from './profile-repository';
import { resolvePurchase } from './purchase-decision';

export class DrizzleProfileRepository implements ProfileRepository {
  constructor(private readonly adminUsername: string) {}

  async updateProfile(userId: number, input: UpdateProfileInput) {
    const [row] = await getDb()
      .update(users)
      .set({ avatarUrl: input.avatarUrl, profileFrame: input.frame, nameColor: input.nameColor, pet: input.pet })
      .where(eq(users.id, userId))
      .returning();
    return toAccountRecord(row);
  }

  async purchase(userId: number, slot: number, item: ProfileCatalogItem): Promise<ProfilePurchaseOutcome> {
    return getDb().transaction(async (tx) => {
      const [lockedUserRow] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
      const [lockedSaveRow] = await tx
        .select()
        .from(cloudSaves)
        .where(and(eq(cloudSaves.userId, userId), eq(cloudSaves.slot, slot)))
        .for('update');

      if (!lockedUserRow || !lockedSaveRow || !lockedSaveRow.data) {
        return { kind: 'no-character' };
      }

      const account = toAccountRecord(lockedUserRow);
      const cosmetics = cosmeticsFor(account, this.adminUsername);
      const decision = resolvePurchase({ cosmetics, save: lockedSaveRow.data }, item);
      if (decision.kind !== 'purchased') return decision;

      await tx
        .update(cloudSaves)
        .set({ data: decision.save, updatedAt: new Date() })
        .where(and(eq(cloudSaves.userId, userId), eq(cloudSaves.slot, slot)));
      const [updatedUserRow] = await tx.update(users).set({ cosmetics: decision.cosmetics }).where(eq(users.id, userId)).returning();

      return { kind: 'purchased', account: toAccountRecord(updatedUserRow), save: decision.save };
    });
  }
}
