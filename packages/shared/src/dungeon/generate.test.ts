import { describe, expect, it } from 'vitest';

import { seededRng, type Rng } from '../rng.js';
import type { MonsterInstance } from '../monsters/generate.js';
import {
  entryText,
  generateDungeonFloor,
  iconFor,
  isBossFloor,
  monsterGroupSize,
  roomDesc,
  shortLabel,
  type DungeonCell,
} from './generate.js';

/** Devolve valores fixos em sequência — controla exatamente cada chamada de rng(). */
function sequenceRng(values: number[]): Rng {
  let i = 0;
  return () => (i < values.length ? (values[i++] as number) : (values[values.length - 1] ?? 0));
}

function monsterFixture(overrides: Partial<MonsterInstance> = {}): MonsterInstance {
  return {
    speciesId: 'goblin',
    enemyClassId: 'brutamontes',
    floor: 5,
    hp: 20,
    maxHp: 20,
    dmg: 5,
    speed: 8,
    xp: 10,
    gold: 10,
    isBoss: false,
    ...overrides,
  };
}

function cellFixture(overrides: Partial<DungeonCell> = {}): DungeonCell {
  return { type: 'normal', x: 0, y: 0, doors: {}, ...overrides };
}

describe('isBossFloor', () => {
  it('true a cada 5 andares, false no resto', () => {
    expect(isBossFloor(5)).toBe(true);
    expect(isBossFloor(10)).toBe(true);
    expect(isBossFloor(1)).toBe(false);
    expect(isBossFloor(4)).toBe(false);
    expect(isBossFloor(6)).toBe(false);
  });
});

describe('monsterGroupSize', () => {
  it('fica em 1 quando os dois rolos falham', () => {
    expect(monsterGroupSize(10, sequenceRng([0.99, 0.99]))).toBe(1);
  });

  it('sobe pra 2 quando o primeiro rolo acerta', () => {
    expect(monsterGroupSize(10, sequenceRng([0.1, 0.99]))).toBe(2);
  });

  it('sobe pra 3 só a partir do andar 4, com os dois rolos acertando', () => {
    expect(monsterGroupSize(4, sequenceRng([0.1, 0.1]))).toBe(3);
    expect(monsterGroupSize(3, sequenceRng([0.1, 0.1]))).toBe(2); // andar<4: segundo rolo nem é consultado
  });
});

describe('generateDungeonFloor — estrutura do andar', () => {
  it('tem exatamente uma sala start, uma stairs e uma exit', () => {
    const floor = generateDungeonFloor(7, 11, 11, { rng: seededRng(1) });
    const byType = (t: string) => floor.rooms.filter((r) => r.type === t);
    expect(byType('start')).toHaveLength(1);
    expect(byType('stairs')).toHaveLength(1);
    expect(byType('exit')).toHaveLength(1);
    expect(floor.start.type).toBe('start');
  });

  it('só tem sala de chefe em andar de chefe, e nunca mais de uma', () => {
    const chefe = generateDungeonFloor(10, 11, 11, { rng: seededRng(2) });
    const semChefe = generateDungeonFloor(7, 11, 11, { rng: seededRng(2) });
    expect(chefe.rooms.filter((r) => r.type === 'boss')).toHaveLength(1);
    expect(semChefe.rooms.filter((r) => r.type === 'boss')).toHaveLength(0);
  });

  it('sala de chefe carrega exatamente um monstro isBoss', () => {
    const floor = generateDungeonFloor(10, 11, 11, { rng: seededRng(3) });
    const bossRoom = floor.rooms.find((r) => r.type === 'boss');
    expect(bossRoom?.monsters).toHaveLength(1);
    expect(bossRoom?.monsters?.[0]?.isBoss).toBe(true);
  });

  it('salas de monstro têm entre 1 e 3 monstros, nenhum isBoss', () => {
    const floor = generateDungeonFloor(6, 11, 11, { rng: seededRng(4) });
    const monsterRooms = floor.rooms.filter((r) => r.type === 'monster');
    expect(monsterRooms.length).toBeGreaterThan(0);
    for (const room of monsterRooms) {
      expect(room.monsters?.length).toBeGreaterThanOrEqual(1);
      expect(room.monsters?.length).toBeLessThanOrEqual(3);
      for (const m of room.monsters ?? []) expect(m.isBoss).toBe(false);
    }
  });

  it('sala de tesouro sempre tem ouro OU item, nunca os dois', () => {
    const floor = generateDungeonFloor(8, 11, 11, { rng: seededRng(5) });
    const treasureRooms = floor.rooms.filter((r) => r.type === 'treasure');
    expect(treasureRooms.length).toBeGreaterThan(0);
    for (const room of treasureRooms) {
      expect(room.giveGold ? !room.item : !!room.item).toBe(true);
    }
  });

  it('sala de evento carrega um templateId conhecido, não resolvido', () => {
    const floor = generateDungeonFloor(6, 11, 11, { rng: seededRng(6) });
    const eventRooms = floor.rooms.filter((r) => r.type === 'event');
    for (const room of eventRooms) {
      expect(['ferido', 'altar', 'porta']).toContain(room.event?.templateId);
      expect(room.resolved).toBe(false);
    }
  });

  it('sala de npc carrega um npc com serviço válido', () => {
    const floor = generateDungeonFloor(5, 11, 11, { rng: seededRng(8) });
    const npcRooms = floor.rooms.filter((r) => r.type === 'npc');
    expect(npcRooms.length).toBeGreaterThan(0);
    for (const room of npcRooms) {
      expect(['reveal', 'heal']).toContain(room.npc?.service);
      expect(room.npc?.serviceUsed).toBe(false);
    }
  });

  it('é determinístico: a mesma seed produz o mesmo andar', () => {
    const a = generateDungeonFloor(9, 11, 11, { rng: seededRng(123) });
    const b = generateDungeonFloor(9, 11, 11, { rng: seededRng(123) });
    expect(JSON.stringify(a.grid)).toBe(JSON.stringify(b.grid));
  });
});

describe('iconFor / shortLabel / roomDesc / entryText', () => {
  it('sala de monstro: ícone some quando derrotada, texto muda entre 1 e vários inimigos', () => {
    const um = cellFixture({ type: 'monster', monsters: [monsterFixture()], beaten: false });
    const varios = cellFixture({ type: 'monster', monsters: [monsterFixture(), monsterFixture()], beaten: false });
    const derrotada = cellFixture({ type: 'monster', monsters: [monsterFixture()], beaten: true });

    expect(iconFor(um)).not.toBe('');
    expect(iconFor(derrotada)).toBe('');
    expect(shortLabel(um)).toBe('uma criatura hostil');
    expect(shortLabel(varios)).toBe('um grupo de criaturas');
    expect(shortLabel(derrotada)).toBe('os restos de uma batalha');
    expect(roomDesc(um)).toContain('Goblin');
    expect(entryText(varios)).toContain('Várias criaturas');
    expect(entryText(um)).toContain('Uma criatura');
  });

  it('sala de tesouro: ícone e descrição mudam depois de coletado', () => {
    const fechado = cellFixture({ type: 'treasure', collected: false });
    const vazio = cellFixture({ type: 'treasure', collected: true });
    expect(iconFor(fechado)).toBe('🧰');
    expect(iconFor(vazio)).toBe('');
    expect(shortLabel(fechado)).toBe('um baú fechado');
    expect(shortLabel(vazio)).toBe('um baú já vazio');
  });

  it('sala de chefe: nome do monstro aparece na descrição só quando vivo', () => {
    const vivo = cellFixture({ type: 'boss', monsters: [monsterFixture({ isBoss: true, bossTitle: 'o Feroz' })], beaten: false });
    const vazio = cellFixture({ type: 'boss', beaten: true });
    expect(roomDesc(vivo)).toContain('Goblin');
    expect(roomDesc(vazio)).toBe('O covil do guardião agora está silencioso e vazio.');
    expect(iconFor(vazio)).toBe('');
  });

  it('salas fixas (start/stairs/exit) têm ícone e textos estáveis', () => {
    expect(iconFor(cellFixture({ type: 'stairs' }))).toBe('⬇️');
    expect(iconFor(cellFixture({ type: 'exit' }))).toBe('🚪');
    expect(entryText(cellFixture({ type: 'stairs' }))).toContain('descer');
    expect(entryText(cellFixture({ type: 'exit' }))).toContain('cidade');
  });
});
