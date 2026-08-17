import { signSave } from '../auth/save-signature';
import { SaveService } from './save.service';
import type { CloudSaveRow, SaveHistoryEntry, SaveRepository } from './save-repository';

const SECRET = 'segredo-de-teste';
const USER_ID = 1;
const HISTORY_THROTTLE_MS = 15 * 60 * 1000;

interface HistoryEntry {
  id: string;
  data: unknown;
  createdAt: Date;
}

class FakeSaveRepository implements SaveRepository {
  private slots = new Map<string, CloudSaveRow>();
  private history = new Map<string, HistoryEntry[]>();
  private nextHistoryId = 1;

  private key(userId: number, slot: number): string {
    return `${userId}:${slot}`;
  }

  listSlots(userId: number): Promise<CloudSaveRow[]> {
    return Promise.resolve(
      [...this.slots.entries()]
        .filter(([key]) => key.startsWith(`${userId}:`))
        .map(([, row]) => row)
        .sort((a, b) => a.slot - b.slot),
    );
  }

  getSlot(userId: number, slot: number): Promise<CloudSaveRow | null> {
    return Promise.resolve(this.slots.get(this.key(userId, slot)) ?? null);
  }

  resetSlot(userId: number, slot: number): Promise<void> {
    const key = this.key(userId, slot);
    this.slots.delete(key);
    this.history.delete(key);
    return Promise.resolve();
  }

  store(userId: number, slot: number, data: unknown, forceHistory: boolean, now: Date): Promise<void> {
    const key = this.key(userId, slot);
    const current = this.slots.get(key);
    if (current) {
      const list = this.history.get(key) ?? [];
      const threshold = new Date(now.getTime() - HISTORY_THROTTLE_MS);
      const hasRecent = list.some((entry) => entry.createdAt > threshold);
      if (forceHistory || !hasRecent) {
        list.unshift({ id: String(this.nextHistoryId++), data: current.data, createdAt: now });
        this.history.set(key, list.slice(0, 10));
      }
    }
    this.slots.set(key, { slot, data, updatedAt: now });
    return Promise.resolve();
  }

  listHistory(userId: number, slot: number): Promise<SaveHistoryEntry[]> {
    const list = this.history.get(this.key(userId, slot)) ?? [];
    return Promise.resolve(list.map(({ id, createdAt }) => ({ id, createdAt })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
  }

  getHistoryEntry(userId: number, slot: number, id: string): Promise<unknown> {
    const list = this.history.get(this.key(userId, slot)) ?? [];
    return Promise.resolve(list.find((entry) => entry.id === id)?.data ?? null);
  }
}

const DEFAULT_ATTRS = { forca: 5, destreza: 5, constituicao: 5, intelecto: 5, sabedoria: 5, carisma: 5 };

function makeValidSave(overrides: Record<string, unknown> = {}) {
  return {
    hero: { name: 'Aria', attrs: DEFAULT_ATTRS, equip: {}, level: 3, gold: 100 },
    inventory: [],
    party: [],
    floor: 1,
    ...overrides,
  };
}

function makeService(startTime = 1700000000000) {
  let currentTime = startTime;
  const repo = new FakeSaveRepository();
  const service = new SaveService(repo, SECRET, () => currentTime);
  return { service, repo, advanceTime: (ms: number) => (currentTime += ms) };
}

describe('SaveService.listCharacters', () => {
  it('devolve lista vazia e maxSlots quando não há saves', async () => {
    const { service } = makeService();
    expect(await service.listCharacters(USER_ID)).toEqual({ characters: [], maxSlots: 4 });
  });

  it('resume cada slot a partir do hero salvo', async () => {
    const { service } = makeService();
    await service.putSave(USER_ID, { slot: 1, save: makeValidSave({ hero: { name: 'Aria', attrs: {}, equip: {}, level: 5, gold: 0 }, floor: 3 }) });
    const { characters, maxSlots } = await service.listCharacters(USER_ID);
    expect(maxSlots).toBe(4);
    expect(characters).toHaveLength(1);
    expect(characters[0]).toMatchObject({ slot: 1, name: 'Aria', level: 5, floor: 3 });
  });
});

describe('SaveService.getSave', () => {
  it('rejeita slot inválido', async () => {
    const { service } = makeService();
    expect(await service.getSave(USER_ID, 0)).toEqual({ kind: 'invalid-slot' });
  });

  it('devolve empty quando o slot não tem save', async () => {
    const { service } = makeService();
    expect(await service.getSave(USER_ID, 1)).toEqual({ kind: 'empty' });
  });

  it('devolve o save com assinatura válida', async () => {
    const { service } = makeService();
    const save = makeValidSave();
    await service.putSave(USER_ID, { slot: 1, save });
    const result = await service.getSave(USER_ID, 1);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.save).toEqual(save);
    expect(result.signature).toBe(signSave(USER_ID, 1, save, SECRET));
  });
});

describe('SaveService.putSave', () => {
  it('rejeita slot inválido', async () => {
    const { service } = makeService();
    expect(await service.putSave(USER_ID, { slot: 0, save: makeValidSave() })).toEqual({ kind: 'invalid-slot' });
  });

  it('rejeita backup importado', async () => {
    const { service } = makeService();
    expect(await service.putSave(USER_ID, { slot: 1, save: makeValidSave(), source: 'imported-backup' })).toEqual({
      kind: 'imported-backup-rejected',
    });
  });

  it('rejeita save com formato inválido', async () => {
    const { service } = makeService();
    expect(await service.putSave(USER_ID, { slot: 1, save: { hero: {} } })).toEqual({ kind: 'invalid-save' });
  });

  it('aceita o primeiro save do slot mesmo sem baseSignature', async () => {
    const { service } = makeService();
    const result = await service.putSave(USER_ID, { slot: 1, save: makeValidSave() });
    expect(result.kind).toBe('ok');
  });

  it('rejeita quando a baseSignature não bate com o save atual', async () => {
    const { service } = makeService();
    await service.putSave(USER_ID, { slot: 1, save: makeValidSave() });
    const result = await service.putSave(USER_ID, { slot: 1, save: makeValidSave({ floor: 2 }), baseSignature: 'assinatura-errada' });
    expect(result).toEqual({ kind: 'stale-signature' });
  });

  it('aceita quando a baseSignature bate com o save atual', async () => {
    const { service } = makeService();
    const first = makeValidSave();
    await service.putSave(USER_ID, { slot: 1, save: first });
    const baseSignature = signSave(USER_ID, 1, first, SECRET);
    const result = await service.putSave(USER_ID, { slot: 1, save: makeValidSave({ floor: 2 }), baseSignature });
    expect(result.kind).toBe('ok');
  });

  it('rejeita transição inválida (nível subindo demais)', async () => {
    const { service } = makeService();
    const first = makeValidSave({ hero: { name: 'Aria', attrs: DEFAULT_ATTRS, equip: {}, level: 3, gold: 0 } });
    await service.putSave(USER_ID, { slot: 1, save: first });
    const baseSignature = signSave(USER_ID, 1, first, SECRET);
    const result = await service.putSave(USER_ID, {
      slot: 1,
      save: makeValidSave({ hero: { name: 'Aria', attrs: DEFAULT_ATTRS, equip: {}, level: 20, gold: 0 } }),
      baseSignature,
    });
    expect(result).toEqual({ kind: 'invalid-transition' });
  });
});

describe('SaveService.resetSave', () => {
  it('rejeita slot inválido', async () => {
    const { service } = makeService();
    expect(await service.resetSave(USER_ID, 5)).toEqual({ kind: 'invalid-slot' });
  });

  it('limpa o slot e o histórico', async () => {
    const { service } = makeService();
    await service.putSave(USER_ID, { slot: 1, save: makeValidSave() });
    expect(await service.resetSave(USER_ID, 1)).toEqual({ kind: 'ok' });
    expect(await service.getSave(USER_ID, 1)).toEqual({ kind: 'empty' });
  });
});

describe('SaveService.verifySave', () => {
  it('rejeita slot inválido', () => {
    const { service } = makeService();
    expect(service.verifySave(USER_ID, { slot: 0, save: makeValidSave() })).toEqual({ kind: 'invalid-slot' });
  });

  it('confirma uma assinatura válida', () => {
    const { service } = makeService();
    const save = makeValidSave();
    const signature = signSave(USER_ID, 1, save, SECRET);
    expect(service.verifySave(USER_ID, { slot: 1, save, signature })).toEqual({ kind: 'ok', valid: true });
  });

  it('rejeita um save adulterado', () => {
    const { service } = makeService();
    const save = makeValidSave();
    const signature = signSave(USER_ID, 1, save, SECRET);
    const tampered = makeValidSave({ floor: 999 });
    expect(service.verifySave(USER_ID, { slot: 1, save: tampered, signature })).toEqual({ kind: 'ok', valid: false });
  });
});

describe('histórico e restauração', () => {
  // O throttle de 15min é sobre a idade do último snapshot de histórico, não do
  // último save: o primeiro save após a criação do slot sempre arquiva (não há
  // histórico ainda pra estar "recente"). Por isso o cenário aqui tem 3 saves:
  // A cria o slot, A→B arquiva o snapshot #1, e só então B→C testa o throttle.
  async function putThreeSaves(advanceBeforeThirdMs: number) {
    const { service, advanceTime } = makeService();
    const saveA = makeValidSave({ floor: 1 });
    await service.putSave(USER_ID, { slot: 1, save: saveA });

    const saveB = makeValidSave({ floor: 2 });
    await service.putSave(USER_ID, { slot: 1, save: saveB, baseSignature: signSave(USER_ID, 1, saveA, SECRET) });

    advanceTime(advanceBeforeThirdMs);
    const saveC = makeValidSave({ floor: 3 });
    await service.putSave(USER_ID, { slot: 1, save: saveC, baseSignature: signSave(USER_ID, 1, saveB, SECRET) });

    return service;
  }

  it('não arquiva um segundo snapshot dentro de 15 minutos do primeiro', async () => {
    const service = await putThreeSaves(HISTORY_THROTTLE_MS - 1000);
    const history = await service.getHistory(USER_ID, 1);
    expect(history.kind).toBe('ok');
    if (history.kind !== 'ok') return;
    expect(history.versions).toHaveLength(1);
  });

  it('arquiva um segundo snapshot depois de 15 minutos do primeiro', async () => {
    const service = await putThreeSaves(HISTORY_THROTTLE_MS + 1000);
    const history = await service.getHistory(USER_ID, 1);
    expect(history.kind).toBe('ok');
    if (history.kind !== 'ok') return;
    expect(history.versions).toHaveLength(2);
  });

  it('rejeita slot inválido no histórico', async () => {
    const { service } = makeService();
    expect(await service.getHistory(USER_ID, 0)).toEqual({ kind: 'invalid-slot' });
  });

  it('restoreSave rejeita slot inválido, id inválido e versão inexistente', async () => {
    const { service } = makeService();
    expect(await service.restoreSave(USER_ID, { slot: 0, id: '1' })).toEqual({ kind: 'invalid-slot' });
    expect(await service.restoreSave(USER_ID, { slot: 1, id: 'abc' })).toEqual({ kind: 'invalid-version' });
    expect(await service.restoreSave(USER_ID, { slot: 1, id: '999' })).toEqual({ kind: 'not-found' });
  });

  it('restoreSave recupera uma versão antiga e arquiva a atual à força', async () => {
    const { service, advanceTime } = makeService();
    const original = makeValidSave({ floor: 1 });
    await service.putSave(USER_ID, { slot: 1, save: original });
    advanceTime(HISTORY_THROTTLE_MS + 1000);
    const baseSignature = signSave(USER_ID, 1, original, SECRET);
    await service.putSave(USER_ID, { slot: 1, save: makeValidSave({ floor: 2 }), baseSignature });

    const history = await service.getHistory(USER_ID, 1);
    if (history.kind !== 'ok') throw new Error('esperava histórico');
    const [entry] = history.versions;

    const restored = await service.restoreSave(USER_ID, { slot: 1, id: entry.id });
    expect(restored.kind).toBe('ok');
    if (restored.kind !== 'ok') return;
    expect(restored.save).toEqual(original);

    const current = await service.getSave(USER_ID, 1);
    expect(current.kind).toBe('ok');
    if (current.kind !== 'ok') return;
    expect(current.save).toEqual(original);
  });
});
