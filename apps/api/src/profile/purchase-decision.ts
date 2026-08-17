/**
 * Decisão pura de compra de cosmético — dado o estado já travado
 * (cosmetics do usuário + save do slot), decide se a compra é possível
 * e, se for, devolve o novo estado a persistir. Sem I/O: quem chama
 * (repositório real ou fake de teste) trava as linhas antes e persiste
 * o resultado depois, dentro da mesma transação — replicando a seção
 * BEGIN/FOR UPDATE/COMMIT de `/api/account/profile/purchase` no
 * accounts.js original.
 */

import type { Cosmetics, ProfileCatalogItem } from '../auth/cosmetics';

export type PurchaseDecision =
  { kind: 'no-character' } | { kind: 'already-owned' } | { kind: 'insufficient-gold' } | { kind: 'purchased'; cosmetics: Cosmetics; save: unknown };

function bucketFor(item: ProfileCatalogItem): keyof Cosmetics {
  if (item.type === 'frame') return 'frames';
  if (item.type === 'color') return 'colors';
  return 'pets';
}

export function resolvePurchase(context: { cosmetics: Cosmetics; save: unknown } | null, item: ProfileCatalogItem): PurchaseDecision {
  if (!context || !context.save || typeof context.save !== 'object') return { kind: 'no-character' };

  const bucket = bucketFor(item);
  if (context.cosmetics[bucket].includes(item.value)) return { kind: 'already-owned' };

  const save = context.save as Record<string, unknown>;
  const hero = save.hero && typeof save.hero === 'object' ? (save.hero as Record<string, unknown>) : {};
  const gold = Number(hero.gold) || 0;
  if (gold < item.price) return { kind: 'insufficient-gold' };

  const cosmetics: Cosmetics = { ...context.cosmetics, [bucket]: [...context.cosmetics[bucket], item.value] };
  const newSave = { ...save, hero: { ...hero, gold: gold - item.price } };
  return { kind: 'purchased', cosmetics, save: newSave };
}
