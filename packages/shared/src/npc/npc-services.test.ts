import { describe, expect, it } from 'vitest';

import { derivedStats } from '../hero/derived.js';
import type { Attributes } from '../hero/stats.js';
import { DEBUFFS } from '../hero/catalog.js';
import type { Companion, Hero, HeroEquipment } from '../hero/hero.js';
import { instantiate, itemCategory, type Item } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import type { DungeonCell } from '../dungeon/generate.js';
import { seededRng } from '../rng.js';
import {
  applyNpcBlessing,
  npcServiceInfo,
  resolveBarter,
  resolveBlessing,
  resolveHeal,
  resolveRecruit,
  resolveReveal,
  type NpcService,
} from './npc-services.js';

const SEM_DEBUFF = DEBUFFS.find((d) => !d.effect)!;

function baseAttrs(overrides: Partial<Attributes> = {}): Attributes {
  return { forca: 10, destreza: 10, constituicao: 10, intelecto: 10, sabedoria: 10, carisma: 10, ...overrides };
}

function heroFixture(opts: { attrs?: Partial<Attributes>; hero?: Partial<Hero> } = {}): Hero {
  const attrs = baseAttrs(opts.attrs);
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
    gold: 100,
    powerNames: [],
    debuff: SEM_DEBUFF,
    killCount: 0,
    derived,
    maxHp: derived.maxHp,
    hp: derived.maxHp,
    maxMp: derived.maxMp,
    mp: derived.maxMp,
    buffs: {},
    ...opts.hero,
  };
}

function itemFixture(templateId: string, overrides: Partial<Item> = {}): Item {
  return { ...instantiate(templateById(templateId)!, RARITIES[0]!), ...overrides };
}

function companionFixture(overrides: Partial<Companion> = {}): Companion {
  return {
    name: 'C',
    raceIcon: '',
    race: 'Humano',
    className: 'Guerreiro',
    classIcon: '',
    hp: 20,
    maxHp: 20,
    attack: 5,
    attrs: baseAttrs(),
    stance: 'equilibrada',
    ability: '',
    abilityDesc: '',
    ...overrides,
  };
}

describe('npcServiceInfo', () => {
  it('resolve os 5 serviços conhecidos, e null pra um desconhecido', () => {
    expect(npcServiceInfo('heal')?.label).toBe('Receber Tratamento');
    expect(npcServiceInfo('blessing')?.label).toBe('Receber Bênção');
    expect(npcServiceInfo('barter')?.label).toBe('Trocar Material');
    expect(npcServiceInfo('reveal')?.label).toBe('Pedir Informações');
    expect(npcServiceInfo('recruit')?.label).toBe('Convidar para a Equipe');
    expect(npcServiceInfo('inexistente' as NpcService)).toBeNull();
  });
});

describe('resolveHeal', () => {
  it('recusa sem ouro suficiente, sem tocar no herói', () => {
    const hero = heroFixture({ hero: { gold: 5 } }); // preço com carisma 10 e andar 5 é 23
    const result = resolveHeal(hero, 5);
    expect(result.used).toBe(false);
    expect(result.outcome).toEqual({ kind: 'insufficient_gold', required: 23 });
    expect(result.hero).toBe(hero);
  });

  it('recusa quando Vida e Mana já estão cheias', () => {
    const hero = heroFixture();
    const result = resolveHeal(hero, 5);
    expect(result.used).toBe(false);
    expect(result.outcome).toEqual({ kind: 'already_full' });
  });

  it('cura proporcional ao teto e cobra o preço com desconto de carisma', () => {
    const hero = heroFixture({ hero: { gold: 100, hp: 50, mp: 20 } });
    const result = resolveHeal(hero, 5);
    // preço: max(5, round((14+5*2)*(1-0.05))) = 23; cura: round(125*0.45)=56; mana: round(62*0.35)=22
    expect(result.used).toBe(true);
    expect(result.outcome).toEqual({ kind: 'healed', goldSpent: 23, hpGained: 56, mpGained: 22 });
    expect(result.hero.gold).toBe(77);
    expect(result.hero.hp).toBe(106);
    expect(result.hero.mp).toBe(42);
  });

  it('a cura nunca passa do teto de Vida/Mana', () => {
    const hero = heroFixture({ hero: { gold: 100, hp: 120, mp: 55 } }); // maxHp 125, maxMp 62
    const result = resolveHeal(hero, 5);
    expect(result.hero.hp).toBe(125);
    expect(result.hero.mp).toBe(62);
  });
});

describe('resolveBlessing / applyNpcBlessing', () => {
  it('sempre concede a bênção de 3 combates e +12% esquiva', () => {
    const hero = heroFixture();
    const result = resolveBlessing(hero);
    expect(result.used).toBe(true);
    expect(result.outcome).toEqual({ kind: 'blessed', combats: 3, dodge: 12 });
    expect(result.hero.npcBlessing).toEqual({ combats: 3, dodge: 12 });
  });

  it('applyNpcBlessing não faz nada sem bênção ativa', () => {
    const hero = heroFixture();
    const result = applyNpcBlessing(hero);
    expect(result.applied).toBe(false);
    expect(result.hero).toBe(hero);
  });

  it('applyNpcBlessing converte em buff de esquiva do combate e decrementa', () => {
    const hero = heroFixture({ hero: { npcBlessing: { combats: 3, dodge: 12 } } });
    const result = applyNpcBlessing(hero);
    expect(result.applied).toBe(true);
    expect(result.hero.buffs?.esquivaTurns).toBe(999);
    expect(result.hero.buffs?.esquivaAmount).toBe(12);
    expect(result.hero.npcBlessing).toEqual({ combats: 2, dodge: 12 });
  });

  it('applyNpcBlessing remove a bênção quando o último combate é consumido', () => {
    const hero = heroFixture({ hero: { npcBlessing: { combats: 1, dodge: 12 } } });
    const result = applyNpcBlessing(hero);
    expect(result.hero.npcBlessing).toBeUndefined();
  });
});

describe('resolveBarter', () => {
  it('recusa sem material não equipado na mochila', () => {
    const arma = itemFixture('espada');
    const materialEquipado = itemFixture('minerio', { equipped: true });
    const result = resolveBarter([arma, materialEquipado], 5, { rng: seededRng(1) });
    expect(result.used).toBe(false);
    expect(result.outcome).toEqual({ kind: 'no_material' });
    expect(result.inventory).toEqual([arma, materialEquipado]);
  });

  it('troca o primeiro material não equipado por uma poção', () => {
    const material = itemFixture('minerio');
    const arma = itemFixture('espada');
    const result = resolveBarter([arma, material], 5, { rng: seededRng(1), now: () => 1700000000000 });
    expect(result.used).toBe(true);
    expect(result.outcome.kind).toBe('bartered');
    expect(result.outcome.kind === 'bartered' && result.outcome.given).toBe(material);
    expect(result.inventory).toHaveLength(2); // arma + poção nova, material saiu
    expect(result.inventory).toContain(arma);
    expect(result.inventory.some((it) => it.uid === material.uid)).toBe(false);
    const potion = result.inventory.find((it) => it.uid !== arma.uid);
    expect(itemCategory(potion!)).toBe('consumivel');
  });
});

describe('resolveReveal', () => {
  function gridFixture(): DungeonCell[][] {
    const grid: DungeonCell[][] = [];
    for (let y = 0; y < 3; y++) {
      const row: DungeonCell[] = [];
      for (let x = 0; x < 3; x++) row.push({ type: 'normal', x, y, doors: {} });
      grid.push(row);
    }
    grid[0]![1]!.type = 'void'; // (1,0): void, nunca revela
    grid[0]![2]!.revealed = true; // (2,0): já revelada, não conta de novo
    grid[1]![1]!.type = 'start'; // posição do jogador
    return grid;
  }

  it('revela toda sala não-void a até 2 de distância que ainda não estava revelada', () => {
    const grid = gridFixture();
    const result = resolveReveal(grid, { x: 1, y: 1 });
    // 9 células - 1 void - 1 já revelada = 7 novas revelações
    expect(result.outcome).toEqual({ kind: 'revealed', count: 7 });
    expect(result.used).toBe(true);
    expect(result.grid[0]![1]!.revealed).toBeUndefined(); // void continua sem revealed
    expect(result.grid[1]![1]!.revealed).toBe(true); // a própria sala do jogador conta
  });

  it('não muta a grade recebida', () => {
    const grid = gridFixture();
    const snapshot = JSON.stringify(grid);
    resolveReveal(grid, { x: 1, y: 1 });
    expect(JSON.stringify(grid)).toBe(snapshot);
  });

  it('sem nada novo pra revelar, count fica em 0', () => {
    const grid = gridFixture();
    const first = resolveReveal(grid, { x: 1, y: 1 });
    const second = resolveReveal(first.grid, { x: 1, y: 1 });
    expect(second.outcome).toEqual({ kind: 'revealed', count: 0 });
  });
});

describe('resolveRecruit', () => {
  it('recusa quando a equipe já tem 3 membros', () => {
    const party = [companionFixture(), companionFixture(), companionFixture()];
    const result = resolveRecruit(party, seededRng(1));
    expect(result.used).toBe(false);
    expect(result.outcome).toEqual({ kind: 'party_full' });
    expect(result.party).toEqual(party);
  });

  it('recruta um companheiro temporário por 3 combates', () => {
    const result = resolveRecruit([], seededRng(1));
    expect(result.used).toBe(true);
    expect(result.outcome.kind).toBe('recruited');
    expect(result.party).toHaveLength(1);
    expect(result.party[0]?.temporary).toBe(true);
    expect(result.party[0]?.combatsLeft).toBe(3);
  });
});
