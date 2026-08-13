import { PROFILE_CATALOG } from '../auth/cosmetics';
import { resolvePurchase } from './purchase-decision';

const FRAME_ITEM = PROFILE_CATALOG.find((item) => item.id === 'frame_bronze')!; // frame/bronze, price 100
const PET_ITEM = PROFILE_CATALOG.find((item) => item.id === 'pet_chicken')!; // pet/chicken, price 500

function makeContext(overrides: { gold?: number; frames?: string[]; colors?: string[]; pets?: string[] } = {}) {
  return {
    cosmetics: { frames: overrides.frames ?? ['none'], colors: overrides.colors ?? ['#e8d7a5'], pets: overrides.pets ?? ['none'] },
    save: { hero: { gold: overrides.gold ?? 200, level: 3 }, floor: 2 },
  };
}

describe('resolvePurchase', () => {
  it('devolve no-character quando não há contexto', () => {
    expect(resolvePurchase(null, FRAME_ITEM)).toEqual({ kind: 'no-character' });
  });

  it('devolve no-character quando o save não tem dados', () => {
    expect(resolvePurchase({ cosmetics: { frames: [], colors: [], pets: [] }, save: null }, FRAME_ITEM)).toEqual({ kind: 'no-character' });
  });

  it('devolve already-owned quando o item já está no bucket certo', () => {
    const context = makeContext({ frames: ['none', 'bronze'] });
    expect(resolvePurchase(context, FRAME_ITEM)).toEqual({ kind: 'already-owned' });
  });

  it('devolve insufficient-gold quando o ouro do save é menor que o preço', () => {
    const context = makeContext({ gold: 50 });
    expect(resolvePurchase(context, FRAME_ITEM)).toEqual({ kind: 'insufficient-gold' });
  });

  it('aprova a compra, desconta o ouro e adiciona ao bucket certo', () => {
    const context = makeContext({ gold: 200, frames: ['none'] });
    const result = resolvePurchase(context, FRAME_ITEM);
    expect(result.kind).toBe('purchased');
    if (result.kind !== 'purchased') return;
    expect(result.cosmetics).toEqual({ frames: ['none', 'bronze'], colors: ['#e8d7a5'], pets: ['none'] });
    expect(result.save).toMatchObject({ hero: { gold: 100, level: 3 }, floor: 2 });
  });

  it('usa o bucket pets pra itens do tipo pet', () => {
    const context = makeContext({ gold: 500, pets: ['none'] });
    const result = resolvePurchase(context, PET_ITEM);
    expect(result.kind).toBe('purchased');
    if (result.kind !== 'purchased') return;
    expect(result.cosmetics.pets).toEqual(['none', 'chicken']);
    expect(result.save).toMatchObject({ hero: { gold: 0 } });
  });

  it('não muta o contexto original', () => {
    const context = makeContext({ gold: 200, frames: ['none'] });
    const snapshotCosmetics = JSON.parse(JSON.stringify(context.cosmetics));
    const snapshotSave = JSON.parse(JSON.stringify(context.save));
    resolvePurchase(context, FRAME_ITEM);
    expect(context.cosmetics).toEqual(snapshotCosmetics);
    expect(context.save).toEqual(snapshotSave);
  });
});
