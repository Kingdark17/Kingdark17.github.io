import { describe, expect, it } from 'vitest';

import { derivedStats } from '../hero/derived.js';
import type { Attributes } from '../hero/stats.js';
import { DEBUFFS } from '../hero/catalog.js';
import type { Companion, Hero, HeroEquipment } from '../hero/hero.js';
import { DIR_OPP, DIR_VECTORS, type Direction } from '../dungeon/graph.js';
import { cityEntryText, cityIconFor, cityRoomDesc, cityShortLabel, generateCityLayout, restAtTavern, type CityCell } from './city.js';

const SEM_DEBUFF = DEBUFFS.find((d) => !d.effect)!;

function baseAttrs(): Attributes {
  return { forca: 10, destreza: 10, constituicao: 10, intelecto: 10, sabedoria: 10, carisma: 10 };
}

function heroFixture(overrides: Partial<Hero> = {}): Hero {
  const attrs = baseAttrs();
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
    hp: 10,
    maxMp: derived.maxMp,
    mp: 5,
    buffs: {},
    ...overrides,
  };
}

function companionFixture(overrides: Partial<Companion> = {}): Companion {
  return {
    name: 'C',
    raceIcon: '',
    race: 'Humano',
    className: 'Guerreiro',
    classIcon: '',
    hp: 3,
    maxHp: 20,
    attack: 5,
    attrs: baseAttrs(),
    stance: 'equilibrada',
    ability: '',
    abilityDesc: '',
    ...overrides,
  };
}

function cellFixture(overrides: Partial<CityCell> = {}): CityCell {
  return { type: 'normal', x: 0, y: 0, doors: {}, ...overrides };
}

describe('generateCityLayout', () => {
  it('a sala start fica em (3,3), como no original', () => {
    const layout = generateCityLayout(6, 6);
    expect(layout.start.type).toBe('start');
    expect(layout.start.x).toBe(3);
    expect(layout.start.y).toBe(3);
    expect(layout.grid[3]?.[3]).toBe(layout.start);
  });

  it('tem exatamente as 11 salas do layout fixo, o resto é void', () => {
    const layout = generateCityLayout(6, 6);
    expect(layout.rooms).toHaveLength(11);
    const nonVoid = layout.grid.flat().filter((c) => c.type !== 'void');
    expect(nonVoid).toHaveLength(11);
  });

  it('as 2 salas de NPC resolvem serviços distintos (barter e blessing)', () => {
    const layout = generateCityLayout(6, 6);
    const npcRooms = layout.rooms.filter((r) => r.type === 'npc');
    expect(npcRooms).toHaveLength(2);
    expect(npcRooms.map((r) => r.npc?.service).sort()).toEqual(['barter', 'blessing']);
    expect(npcRooms.every((r) => r.npc?.serviceUsed === false)).toBe(true);
  });

  it('todas as salas de tipo fixo (loja/ferreiro/taverna/quadro/portão) existem uma vez cada', () => {
    const layout = generateCityLayout(6, 6);
    for (const type of ['shop', 'blacksmith', 'tavern', 'questboard', 'gate'] as const) {
      expect(layout.rooms.filter((r) => r.type === type)).toHaveLength(1);
    }
  });

  it('portas são sempre simétricas', () => {
    const layout = generateCityLayout(6, 6);
    for (const cell of layout.rooms) {
      for (const dir of Object.keys(cell.doors) as Direction[]) {
        const v = DIR_VECTORS[dir];
        const neighbor = layout.grid[cell.y + v.y]?.[cell.x + v.x];
        expect(neighbor?.doors[DIR_OPP[dir]]).toBe(true);
      }
    }
  });

  it('é determinístico: sem RNG, duas chamadas produzem o mesmo layout', () => {
    const a = generateCityLayout(6, 6);
    const b = generateCityLayout(6, 6);
    expect(JSON.stringify(a.grid)).toBe(JSON.stringify(b.grid));
  });
});

describe('restAtTavern', () => {
  it('restaura Vida e Mana do herói e Vida de toda a equipe, sem mutar a entrada', () => {
    const hero = heroFixture({ hp: 10, mp: 5 });
    const party = [companionFixture({ hp: 3, maxHp: 20 }), companionFixture({ hp: 1, maxHp: 15 })];
    const result = restAtTavern(hero, party);

    expect(result.hero.hp).toBe(hero.maxHp);
    expect(result.hero.mp).toBe(hero.maxMp);
    expect(result.party[0]?.hp).toBe(20);
    expect(result.party[1]?.hp).toBe(15);
    expect(hero.hp).toBe(10); // entrada intacta
    expect(party[0]?.hp).toBe(3);
  });
});

describe('apresentação pura da cidade', () => {
  it('cada tipo de sala tem ícone, rótulo curto e descrição próprios', () => {
    const npc = cellFixture({ type: 'npc', npc: { name: 'Bram', role: 'Ferreiro', service: 'barter', icon: '🔨', lines: [], serviceUsed: false } });
    expect(cityIconFor(npc)).toBe('🧙');
    expect(cityShortLabel(npc)).toBe('um NPC');
    expect(cityRoomDesc(npc)).not.toBe('');
    expect(cityEntryText(npc)).toContain('Bram');

    expect(cityIconFor(cellFixture({ type: 'gate' }))).toBe('🌟');
    expect(cityEntryText(cellFixture({ type: 'gate' }))).toContain('masmorra');

    expect(cityIconFor(cellFixture({ type: 'tavern' }))).toBe('🍺');
    expect(cityShortLabel(cellFixture({ type: 'tavern' }))).toBe('uma taverna');
  });

  it('sala normal cai no texto genérico', () => {
    const normal = cellFixture({ type: 'normal' });
    expect(cityShortLabel(normal)).toBe('uma sala vazia');
    expect(cityEntryText(normal)).toBe('Deseja entrar?');
  });
});
