import { describe, expect, it } from 'vitest';

import { instantiate, type Item } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import { addItem, findByUid, removeByUid } from './inventory.js';

function itemFixture(templateId = 'minerio'): Item {
  return instantiate(templateById(templateId)!, RARITIES[0]!);
}

describe('addItem', () => {
  it('acrescenta ao fim sem mutar a lista recebida', () => {
    const original: Item[] = [];
    const item = itemFixture();
    const next = addItem(original, item);
    expect(original).toHaveLength(0);
    expect(next).toEqual([item]);
  });
});

describe('removeByUid', () => {
  it('remove o item pelo uid e devolve o item removido', () => {
    const item = itemFixture();
    const outro = itemFixture('essencia');
    const original = [item, outro];
    const result = removeByUid(original, item.uid);
    expect(result.removed).toBe(item);
    expect(result.inventory).toEqual([outro]);
    expect(original).toHaveLength(2); // não mutado
  });

  it('devolve removed:null e cópia intacta quando o uid não existe', () => {
    const item = itemFixture();
    const result = removeByUid([item], 'uid-inexistente');
    expect(result.removed).toBeNull();
    expect(result.inventory).toEqual([item]);
    expect(result.inventory).not.toBe([item]); // é uma cópia, não a mesma referência
  });
});

describe('findByUid', () => {
  it('acha pelo uid ou devolve null', () => {
    const item = itemFixture();
    expect(findByUid([item], item.uid)).toBe(item);
    expect(findByUid([item], 'outro-uid')).toBeNull();
  });
});
