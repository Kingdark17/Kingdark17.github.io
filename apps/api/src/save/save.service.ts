/**
 * Orquestração dos saves na nuvem — porta de `/api/characters`, `/api/save`
 * (GET/PUT), `/api/save/reset`, `/api/save/verify`, `/api/save/history` e
 * `/api/save/restore` do `accounts.js` original, sem a camada HTTP.
 *
 * Reaproveita `isValidSlot`/`isValidSave`/`isValidTransition` de
 * `../auth/validation` e `signSave`/`validSignature` de
 * `../auth/save-signature` — a mesma lógica anti-cheat/assinatura já
 * portada e testada no slice de auth, sem duplicar nada aqui.
 */

import { isValidSave, isValidSlot, isValidTransition, MAX_SLOTS, type SaveData } from '../auth/validation';
import { signSave, validSignature, type JsonValue } from '../auth/save-signature';
import type { SaveRepository } from './save-repository';

export interface CharacterSummary {
  slot: number;
  updatedAt: Date;
  name: string;
  raceIcon: string;
  className: string;
  classIcon: string;
  level: number;
  floor: number;
}

export type GetSaveResult = { kind: 'invalid-slot' } | { kind: 'empty' } | { kind: 'ok'; save: unknown; signature: string; updatedAt: Date };

export type PutSaveResult =
  | { kind: 'invalid-slot' }
  | { kind: 'imported-backup-rejected' }
  | { kind: 'invalid-save' }
  | { kind: 'stale-signature' }
  | { kind: 'invalid-transition' }
  | { kind: 'ok'; signature: string };

export type ResetResult = { kind: 'invalid-slot' } | { kind: 'ok' };

export type VerifyResult = { kind: 'invalid-slot' } | { kind: 'ok'; valid: boolean };

export type HistoryResult = { kind: 'invalid-slot' } | { kind: 'ok'; versions: { id: string; createdAt: Date }[] };

export type RestoreResult = { kind: 'invalid-slot' } | { kind: 'invalid-version' } | { kind: 'not-found' } | { kind: 'ok'; save: unknown; signature: string };

function heroFieldsOf(data: unknown): Omit<CharacterSummary, 'slot' | 'updatedAt'> {
  const save = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const hero = save.hero && typeof save.hero === 'object' ? (save.hero as Record<string, unknown>) : {};
  return {
    name: typeof hero.name === 'string' ? hero.name : '',
    raceIcon: typeof hero.raceIcon === 'string' ? hero.raceIcon : '',
    className: typeof hero.className === 'string' ? hero.className : '',
    classIcon: typeof hero.classIcon === 'string' ? hero.classIcon : '',
    level: Number(hero.level) || 1,
    floor: Number(save.floor) || 1,
  };
}

export class SaveService {
  constructor(
    private readonly repo: SaveRepository,
    private readonly signingSecret: string,
    private readonly now: () => number = Date.now,
  ) {}

  async listCharacters(userId: number): Promise<{ characters: CharacterSummary[]; maxSlots: number }> {
    const rows = await this.repo.listSlots(userId);
    const characters = rows.map((row) => ({ slot: row.slot, updatedAt: row.updatedAt, ...heroFieldsOf(row.data) }));
    return { characters, maxSlots: MAX_SLOTS };
  }

  async getSave(userId: number, slotInput: unknown): Promise<GetSaveResult> {
    const slot = Number(slotInput);
    if (!isValidSlot(slot)) return { kind: 'invalid-slot' };
    const current = await this.repo.getSlot(userId, slot);
    if (!current) return { kind: 'empty' };
    return {
      kind: 'ok',
      save: current.data,
      signature: signSave(userId, slot, current.data as JsonValue, this.signingSecret),
      updatedAt: current.updatedAt,
    };
  }

  async putSave(userId: number, input: { slot: unknown; save: unknown; baseSignature?: unknown; source?: unknown }): Promise<PutSaveResult> {
    const slot = Number(input.slot);
    if (!isValidSlot(slot)) return { kind: 'invalid-slot' };
    if (input.source === 'imported-backup') return { kind: 'imported-backup-rejected' };
    if (!isValidSave(input.save)) return { kind: 'invalid-save' };

    const current = await this.repo.getSlot(userId, slot);
    if (current && !validSignature(userId, slot, current.data as JsonValue, input.baseSignature as string | undefined, this.signingSecret)) {
      return { kind: 'stale-signature' };
    }
    if (current && !isValidTransition(current.data as SaveData, input.save)) {
      return { kind: 'invalid-transition' };
    }

    await this.repo.store(userId, slot, input.save, false, new Date(this.now()));
    return { kind: 'ok', signature: signSave(userId, slot, input.save as JsonValue, this.signingSecret) };
  }

  async resetSave(userId: number, slotInput: unknown): Promise<ResetResult> {
    const slot = Number(slotInput);
    if (!isValidSlot(slot)) return { kind: 'invalid-slot' };
    await this.repo.resetSlot(userId, slot);
    return { kind: 'ok' };
  }

  verifySave(userId: number, input: { slot: unknown; save: unknown; signature?: unknown }): VerifyResult {
    const slot = Number(input.slot);
    if (!isValidSlot(slot)) return { kind: 'invalid-slot' };
    const valid = isValidSave(input.save) && validSignature(userId, slot, input.save as JsonValue, input.signature as string | undefined, this.signingSecret);
    return { kind: 'ok', valid };
  }

  async getHistory(userId: number, slotInput: unknown): Promise<HistoryResult> {
    const slot = Number(slotInput);
    if (!isValidSlot(slot)) return { kind: 'invalid-slot' };
    const versions = await this.repo.listHistory(userId, slot);
    return { kind: 'ok', versions };
  }

  async restoreSave(userId: number, input: { slot: unknown; id: unknown }): Promise<RestoreResult> {
    const slot = Number(input.slot);
    if (!isValidSlot(slot)) return { kind: 'invalid-slot' };
    const id = String(input.id || '');
    if (!/^\d+$/.test(id)) return { kind: 'invalid-version' };
    const chosen = await this.repo.getHistoryEntry(userId, slot, id);
    if (chosen === null) return { kind: 'not-found' };
    await this.repo.store(userId, slot, chosen, true, new Date(this.now()));
    return { kind: 'ok', save: chosen, signature: signSave(userId, slot, chosen as JsonValue, this.signingSecret) };
  }
}
