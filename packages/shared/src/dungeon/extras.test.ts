import { describe, expect, it } from 'vitest';

import { RARITIES } from '../items/rarity.js';
import { isEquippable, templateById } from '../items/templates.js';
import { seededRng } from '../rng.js';
import { EXTRA_POTIONS, EXTRA_TILES, extraChestGold, potCoins, signHint, type DungeonExtra } from './extras.js';
import { generateDungeonFloor, type DungeonCell } from './generate.js';
import { CONTENT_TILE, DOOR_TILE } from './room-walk.js';

const AGORA = () => 1_700_000_000_000;

function andares(quantos: number) {
  return Array.from({ length: quantos }, (_, i) => generateDungeonFloor(1 + (i % 12), 6, 6, { rng: seededRng(100 + i), now: AGORA }));
}

describe('placeExtras (na geração do andar)', () => {
  const muitos = andares(60);

  it('toda sala ganha 1 ou 2 extras de canto, em quadrados diferentes e fora da cruz do meio', () => {
    for (const andar of muitos) {
      for (const sala of andar.rooms) {
        const doCanto = (sala.extras ?? []).filter((e) => e.kind !== 'crack');
        expect(doCanto.length).toBeGreaterThanOrEqual(1);
        expect(doCanto.length).toBeLessThanOrEqual(2);
        const lugares = new Set(doCanto.map((e) => `${e.col},${e.row}`));
        expect(lugares.size).toBe(doCanto.length);
        for (const e of doCanto) {
          expect(EXTRA_TILES.some((t) => t.col === e.col && t.row === e.row)).toBe(true);
          expect(e.col).not.toBe(CONTENT_TILE.col);
          expect(e.row).not.toBe(CONTENT_TILE.row);
        }
      }
    }
  });

  it('no máximo uma parede rachada por andar, numa parede sem porta, no lugar do vão', () => {
    let comRachadura = 0;
    for (const andar of muitos) {
      const rachaduras = andar.rooms.flatMap((sala) => (sala.extras ?? []).filter((e) => e.kind === 'crack').map((e) => ({ sala, e })));
      expect(rachaduras.length).toBeLessThanOrEqual(1);
      for (const { sala, e } of rachaduras) {
        comRachadura++;
        expect(e.side).toBeDefined();
        expect(sala.doors?.[e.side!]).toBeFalsy();
        expect({ col: e.col, row: e.row }).toEqual(DOOR_TILE[e.side!]);
        expect(e.used).toBe(false);
        expect(e.secretCollected).toBe(false);
      }
    }
    // A chance é de 40%: em 60 andares sai pelo menos uma, e não em todos.
    expect(comRachadura).toBeGreaterThan(0);
    expect(comRachadura).toBeLessThan(muitos.length);
  });

  it('o baú da sala secreta guarda um equipamento, nunca comum', () => {
    const itens = muitos.flatMap((a) => a.rooms.flatMap((s) => (s.extras ?? []).filter((e) => e.kind === 'crack').map((e) => e.secretItem!)));
    expect(itens.length).toBeGreaterThan(0);
    for (const item of itens) {
      expect(isEquippable(templateById(item.templateId)!.category)).toBe(true);
      expect(RARITIES.findIndex((r) => r.id === item.rarity)).toBeGreaterThanOrEqual(1);
    }
  });

  it('o baú pequeno guarda uma poção comum ou nada (aí dá ouro); vaso e placa não guardam item', () => {
    const extras: DungeonExtra[] = muitos.flatMap((a) => a.rooms.flatMap((s) => s.extras ?? []));
    for (const e of extras.filter((x) => x.kind === 'chest')) {
      if (e.item) {
        expect(EXTRA_POTIONS as readonly string[]).toContain(e.item.templateId);
        expect(e.item.rarity).toBe('comum');
      } else expect(e.item).toBeNull();
    }
    for (const e of extras.filter((x) => x.kind === 'pot' || x.kind === 'sign')) expect(e.item).toBeUndefined();
  });

  it('a mesma semente dá os mesmos extras', () => {
    const a = generateDungeonFloor(3, 6, 6, { rng: seededRng(7), now: AGORA });
    const b = generateDungeonFloor(3, 6, 6, { rng: seededRng(7), now: AGORA });
    expect(a.rooms.map((s) => s.extras)).toEqual(b.rooms.map((s) => s.extras));
  });
});

describe('prêmios', () => {
  it('o baú pequeno dá menos que o baú da sala de tesouro', () => {
    for (let s = 0; s < 200; s++) {
      const ouro = extraChestGold(10, seededRng(s));
      expect(ouro).toBeGreaterThanOrEqual(13);
      expect(ouro).toBeLessThanOrEqual(20);
    }
  });

  it('o vaso dá de 1 a 5 moedas', () => {
    const vistos = new Set<number>();
    for (let s = 0; s < 300; s++) vistos.add(potCoins(seededRng(s)));
    expect([...vistos].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('signHint', () => {
  function grade(): DungeonCell[][] {
    const vazia = (x: number, y: number): DungeonCell => ({ type: 'void', x, y, doors: {} });
    const g = Array.from({ length: 6 }, (_, y) => Array.from({ length: 6 }, (_, x) => vazia(x, y)));
    g[0]![0] = { type: 'normal', x: 0, y: 0, doors: {} };
    g[0]![4] = { type: 'stairs', x: 4, y: 0, doors: {} };
    return g;
  }

  it('aponta a escada pelo rumo da grade', () => {
    const g = grade();
    expect(signHint(g, g[0]![0]!)).toContain('a escada fica a leste');
  });

  it('é sempre a mesma pra mesma placa, sem sorteio', () => {
    const g = grade();
    expect(signHint(g, g[0]![0]!)).toBe(signHint(g, g[0]![0]!));
  });

  it('avisa da parede oca e do que o guardião teme', () => {
    const g = grade();
    g[2]![0] = { type: 'normal', x: 0, y: 2, doors: {}, extras: [{ kind: 'crack', col: 4, row: 0, side: 'N', used: false }] };
    g[5]![5] = { type: 'boss', x: 5, y: 5, doors: {}, beaten: false, monsters: [{ speciesId: 'slime', enemyClassId: 'guerreiro', floor: 5, hp: 1, maxHp: 1, dmg: 1, speed: 1, xp: 1, gold: 1, isBoss: true }] };
    const dicas = new Set(Array.from({ length: 6 }, (_, y) => signHint(g, { type: 'normal', x: 1, y, doors: {} })));
    expect([...dicas].some((d) => d.includes('parede oca'))).toBe(true);
    expect([...dicas].some((d) => d.includes('escada'))).toBe(true);
  });

  it('sem nada a dizer, a placa está gasta', () => {
    const sozinha: DungeonCell = { type: 'normal', x: 0, y: 0, doors: {} };
    expect(signHint([[sozinha]], sozinha)).toBe('A placa está gasta demais para ler.');
  });
});
