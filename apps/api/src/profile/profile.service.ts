/**
 * Orquestração de perfil/cosméticos — porta de `/api/account/profile`
 * (PUT), `/api/account/profile/catalog` (GET) e
 * `/api/account/profile/purchase` (POST) do `accounts.js` original.
 */

import {
  PROFILE_CATALOG,
  PROFILE_COLORS,
  PROFILE_FRAMES,
  PROFILE_PETS,
  safeUser,
  type Cosmetics,
  type ProfileCatalogItem,
  type SafeUser,
} from '../auth/cosmetics';
import { isValidSlot } from '../auth/validation';
import { signSave, type JsonValue } from '../auth/save-signature';
import type { ProfileRepository } from './profile-repository';
import { comoTexto } from '../common/texto';

const REMOTE_PHOTO_PATTERN = /^https:\/\//i;
const UPLOADED_PHOTO_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i;
const MAX_REMOTE_PHOTO_LENGTH = 500;
const MAX_UPLOADED_PHOTO_LENGTH = 400000;

const ALL_FRAMES: readonly string[] = PROFILE_FRAMES;
const ALL_COLORS: readonly string[] = PROFILE_COLORS;
const ALL_PETS: readonly string[] = PROFILE_PETS;

export type UpdateProfileResult =
  { kind: 'invalid-avatar' } | { kind: 'invalid-selection' } | { kind: 'not-unlocked' } | { kind: 'ok'; user: SafeUser };

export type PurchaseResult =
  | { kind: 'item-not-found' }
  | { kind: 'admin-only' }
  | { kind: 'invalid-slot' }
  | { kind: 'no-character' }
  | { kind: 'already-owned' }
  | { kind: 'insufficient-gold' }
  | { kind: 'purchased'; item: ProfileCatalogItem; user: SafeUser; save: unknown; signature: string };

export class ProfileService {
  constructor(
    private readonly repo: ProfileRepository,
    private readonly adminUsername: string,
    private readonly signingSecret: string,
  ) {}

  listCatalog(isAdmin: boolean, cosmetics: Cosmetics): { catalog: ProfileCatalogItem[]; owned: Cosmetics } {
    return { catalog: PROFILE_CATALOG.filter((item) => !item.adminOnly || isAdmin), owned: cosmetics };
  }

  async updateProfile(
    userId: number,
    currentCosmetics: Cosmetics,
    input: { avatarUrl?: unknown; frame?: unknown; nameColor?: unknown; pet?: unknown },
  ): Promise<UpdateProfileResult> {
    const avatarUrl = comoTexto(input.avatarUrl).trim();
    const frame = comoTexto(input.frame, 'none');
    const nameColor = comoTexto(input.nameColor, '#e8d7a5').toLowerCase();
    const pet = comoTexto(input.pet, 'none');

    const remotePhoto = REMOTE_PHOTO_PATTERN.test(avatarUrl) && avatarUrl.length <= MAX_REMOTE_PHOTO_LENGTH;
    const uploadedPhoto = UPLOADED_PHOTO_PATTERN.test(avatarUrl) && avatarUrl.length <= MAX_UPLOADED_PHOTO_LENGTH;
    if (avatarUrl && !remotePhoto && !uploadedPhoto) return { kind: 'invalid-avatar' };

    if (!ALL_FRAMES.includes(frame) || !ALL_COLORS.includes(nameColor) || !ALL_PETS.includes(pet)) {
      return { kind: 'invalid-selection' };
    }
    if (!currentCosmetics.frames.includes(frame) || !currentCosmetics.colors.includes(nameColor) || !currentCosmetics.pets.includes(pet)) {
      return { kind: 'not-unlocked' };
    }

    const account = await this.repo.updateProfile(userId, { avatarUrl, frame, nameColor, pet });
    return { kind: 'ok', user: safeUser(account, this.adminUsername) };
  }

  async purchase(userId: number, input: { id?: unknown; slot?: unknown }, isAdmin: boolean): Promise<PurchaseResult> {
    const item = PROFILE_CATALOG.find((entry) => entry.id === comoTexto(input.id));
    if (!item) return { kind: 'item-not-found' };
    if (item.adminOnly && !isAdmin) return { kind: 'admin-only' };
    const slot = Number(input.slot);
    if (!isValidSlot(slot)) return { kind: 'invalid-slot' };

    const outcome = await this.repo.purchase(userId, slot, item);
    if (outcome.kind !== 'purchased') return outcome;

    return {
      kind: 'purchased',
      item,
      user: safeUser(outcome.account, this.adminUsername),
      save: outcome.save,
      signature: signSave(userId, slot, outcome.save as JsonValue, this.signingSecret),
    };
  }
}
