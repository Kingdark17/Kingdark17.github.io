import { describe, expect, it } from 'vitest';

import { DEBUFFS } from '../hero/catalog.js';
import { derivedStats } from '../hero/derived.js';
import type { Hero, HeroEquipment } from '../hero/hero.js';
import type { Attributes } from '../hero/stats.js';
import { instantiate, type Item } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import { addItem, findByUid, removeByUid, consumeItem } from './inventory.js';

function itemFixture(templateId = 'minerio'): Item {
  return instantiate(templateById(templateId)!, RARITIES[0]!);
}

const SEM_DEBUFF = DEBUFFS.find((d) => !d.effect)!;

function heroFixture(overrides: Partial<Hero> = {}): Hero {
  const attrs: Attributes = { forca: 10, destreza: 10, constituicao: 10, intelecto: 10, sabedoria: 10, carisma: 10 };
  const equip: HeroEquipment = { arma: null, secundaria: null, armadura: null, acessorio: null };
  const derived = derivedStats({ level: 1, attrs, equip });
  return {
    level: 1,
    attrs,
    equip,
    name: 'T',
    race: 'Humano',
    raceIcon: '',
    className: 'Guerreiro',
    classIcon: '',
    xp: 0,
    xpNext: 40,
    attrPoints: 0,
    gold: 0,
    powerNames: [],
    debuff: SEM_DEBUFF,
    killCount: 0,
    derived,
    maxHp: derived.maxHp,
    hp: derived.maxHp,
    maxMp: derived.maxMp,
    mp: derived.maxMp,
    buffs: {},
    ...overrides,
  };
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

describe('consumeItem', () => {
  it('poção de vida cura e some da mochila', () => {
    const pocao = itemFixture('pot_vida');
    const hero = heroFixture({ hp: 1 });

    const resultado = consumeItem(hero, [pocao], pocao);

    expect(resultado.outcome.kind).toBe('used');
    expect(resultado.hero.hp).toBe(1 + (pocao.stats.cura ?? 0));
    expect(resultado.inventory).toHaveLength(0);
  });

  it('não passa do máximo, e o ganho relatado é o real', () => {
    const pocao = itemFixture('pot_vida');
    const hero = heroFixture();
    const faltando = 2;

    const resultado = consumeItem({ ...hero, hp: hero.maxHp - faltando }, [pocao], pocao);

    expect(resultado.hero.hp).toBe(hero.maxHp);
    if (resultado.outcome.kind !== 'used') throw new Error('esperava uso');
    expect(resultado.outcome.hpGained).toBe(faltando);
  });

  it('poção de mana devolve mana', () => {
    const pocao = itemFixture('pot_mana');
    const hero = heroFixture({ mp: 0 });

    const resultado = consumeItem(hero, [pocao], pocao);

    expect(resultado.hero.mp).toBe(pocao.stats.curaMana ?? 0);
  });

  it('item sem cura não é gasto', () => {
    const espada = itemFixture('espada');
    const hero = heroFixture({ hp: 1 });

    const resultado = consumeItem(hero, [espada], espada);

    expect(resultado.outcome.kind).toBe('no_effect');
    expect(resultado.inventory).toHaveLength(1);
    expect(resultado.hero).toBe(hero);
  });

  it('não muta o herói nem a mochila de entrada', () => {
    const pocao = itemFixture('pot_vida');
    const mochila = [pocao];
    const hero = heroFixture({ hp: 1 });

    consumeItem(hero, mochila, pocao);

    expect(hero.hp).toBe(1);
    expect(mochila).toHaveLength(1);
  });
});
