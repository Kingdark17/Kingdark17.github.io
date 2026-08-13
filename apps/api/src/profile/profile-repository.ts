import type { ProfileCatalogItem } from '../auth/cosmetics';
import type { AccountRecord } from '../auth/users-repository';
import type { PurchaseDecision } from './purchase-decision';

export interface UpdateProfileInput {
  avatarUrl: string;
  frame: string;
  nameColor: string;
  pet: string;
}

export type ProfilePurchaseOutcome = Exclude<PurchaseDecision, { kind: 'purchased' }> | { kind: 'purchased'; account: AccountRecord; save: unknown };

export interface ProfileRepository {
  updateProfile(userId: number, input: UpdateProfileInput): Promise<AccountRecord>;
  /** Trava users+cloud_saves do slot, decide com `resolvePurchase` e persiste — tudo numa transação. */
  purchase(userId: number, slot: number, item: ProfileCatalogItem): Promise<ProfilePurchaseOutcome>;
}
