import { describe, expect, it } from 'vitest';

import { derivedStats } from '../hero/derived.js';
import type { Attributes } from '../hero/stats.js';
import { DEBUFFS } from '../hero/catalog.js';
import type { Hero, HeroEquipment } from '../hero/hero.js';
import type { Rng } from '../rng.js';
import { claimQuest, ensureQuestBoard, generateQuest, onFloorReached, onItemCollected, onMonsterKilled, type Quest } from './quests.js';

const SEM_DEBUFF = DEBUFFS.find((d) => !d.effect)!;
const FIXED_NOW = () => 1700000000000;

function heroFixture(opts: { hero?: Partial<Hero> } = {}): Hero {
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
    ...opts.hero,
  };
}

function sequenceRng(values: number[]): Rng {
  let i = 0;
  return () => (i < values.length ? (values[i++] as number) : (values[values.length - 1] ?? 0));
}

function questFixture(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'q_fixo',
    type: 'kill',
    target: 5,
    progress: 0,
    title: 'T',
    desc: 'D',
    rewardXp: 20,
    rewardGold: 15,
    done: false,
    claimed: false,
    ...overrides,
  };
}

describe('generateQuest', () => {
  it('tipo kill: alvo 3-6 monstros, recompensa proporcional', () => {
    // pick do tipo (3 tipos, índice 0 = kill) -> randomInt(4) pro alvo -> randomInt(9999) pro sufixo do id
    const quest = generateQuest(5, { rng: sequenceRng([0, 0.5, 0]), now: FIXED_NOW });
    expect(quest.type).toBe('kill');
    expect(quest.target).toBe(5); // 3 + floor(0.5*4)=3+2=5
    expect(quest.progress).toBe(0);
    expect(quest.rewardXp).toBe(20 + 5 * 5);
    expect(quest.rewardGold).toBe(15 + 5 * 4);
    expect(quest.done).toBe(false);
    expect(quest.claimed).toBe(false);
    expect(quest.id).toBe(`q_${FIXED_NOW()}_0`);
  });

  it('tipo floor: alvo é o andar atual + 2 a 4, progress começa no andar atual', () => {
    // índice 1 dos 3 tipos = floor -> rng 1/3 cai no segundo bucket
    const quest = generateQuest(10, { rng: sequenceRng([0.4, 0]), now: FIXED_NOW });
    expect(quest.type).toBe('floor');
    expect(quest.target).toBe(12); // 10 + 2 + floor(0*3) = 12
    expect(quest.progress).toBe(10);
  });

  it('tipo collect: alvo 2-4 itens', () => {
    // índice 2 dos 3 tipos = collect -> rng perto de 1 cai no terceiro bucket
    const quest = generateQuest(5, { rng: sequenceRng([0.99, 0.99]), now: FIXED_NOW });
    expect(quest.type).toBe('collect');
    expect(quest.target).toBe(4); // 2 + floor(0.99*3) = 2+2=4
    expect(quest.progress).toBe(0);
  });

  it('é determinístico com seed e now fixos', () => {
    const a = generateQuest(5, { rng: sequenceRng([0.1, 0.2]), now: FIXED_NOW });
    const b = generateQuest(5, { rng: sequenceRng([0.1, 0.2]), now: FIXED_NOW });
    expect(a).toEqual(b);
  });
});

describe('ensureQuestBoard', () => {
  it('preenche com 2 missões quando o quadro está vazio', () => {
    const board = ensureQuestBoard([], 5, { rng: sequenceRng([0, 0, 0.5, 0]), now: FIXED_NOW });
    expect(board).toHaveLength(2);
  });

  it('não mexe quando já tem missões (devolve cópia, não a mesma referência)', () => {
    const existing = [questFixture()];
    const board = ensureQuestBoard(existing, 5);
    expect(board).toEqual(existing);
    expect(board).not.toBe(existing);
  });
});

describe('onMonsterKilled / onFloorReached / onItemCollected', () => {
  it('avança só o tipo certo, ignora missões já concluídas', () => {
    const quests = [questFixture({ type: 'kill', progress: 1, target: 3 }), questFixture({ id: 'outra', type: 'collect', progress: 0, target: 2 })];
    const result = onMonsterKilled(quests);
    expect(result[0]?.progress).toBe(2);
    expect(result[0]?.done).toBe(false);
    expect(result[1]?.progress).toBe(0); // tipo collect não muda
  });

  it('marca done quando o progresso atinge o alvo', () => {
    const quests = [questFixture({ type: 'kill', progress: 2, target: 3 })];
    const result = onMonsterKilled(quests);
    expect(result[0]?.progress).toBe(3);
    expect(result[0]?.done).toBe(true);
  });

  it('missão já concluída não avança mais', () => {
    const quests = [questFixture({ type: 'kill', progress: 3, target: 3, done: true })];
    const result = onMonsterKilled(quests);
    expect(result[0]?.progress).toBe(3);
  });

  it('onFloorReached usa o andar atual como progresso direto, não incremento', () => {
    const quests = [questFixture({ type: 'floor', progress: 5, target: 12 })];
    const result = onFloorReached(quests, 8);
    expect(result[0]?.progress).toBe(8);
    expect(result[0]?.done).toBe(false);
    const noAlvo = onFloorReached(quests, 12);
    expect(noAlvo[0]?.done).toBe(true);
  });

  it('onItemCollected avança só missões do tipo collect', () => {
    const quests = [questFixture({ type: 'collect', progress: 1, target: 3 })];
    const result = onItemCollected(quests);
    expect(result[0]?.progress).toBe(2);
  });

  it('não muta a lista recebida', () => {
    const quests = [questFixture({ type: 'kill', progress: 0, target: 3 })];
    const snapshot = JSON.stringify(quests);
    onMonsterKilled(quests);
    expect(JSON.stringify(quests)).toBe(snapshot);
  });
});

describe('claimQuest', () => {
  it('não faz nada se a missão não existe, não está pronta, ou já foi resgatada', () => {
    const hero = heroFixture();
    const naoPronta = questFixture({ done: false });
    const jaResgatada = questFixture({ done: true, claimed: true });

    const semMissao = claimQuest(hero, [], 'inexistente', 5);
    expect(semMissao.claimed).toBe(false);
    expect(semMissao.hero).toBe(hero);

    const resultado1 = claimQuest(hero, [naoPronta], naoPronta.id, 5);
    expect(resultado1.claimed).toBe(false);

    const resultado2 = claimQuest(hero, [jaResgatada], jaResgatada.id, 5);
    expect(resultado2.claimed).toBe(false);
  });

  it('resgata: soma ouro e XP, remove a missão e sorteia uma nova no lugar', () => {
    const hero = heroFixture({ hero: { gold: 10 } });
    const pronta = questFixture({ id: 'alvo', done: true, claimed: false, rewardGold: 15, rewardXp: 20 });
    const result = claimQuest(hero, [pronta], 'alvo', 5, { rng: sequenceRng([0, 0.5]), now: FIXED_NOW });

    expect(result.claimed).toBe(true);
    expect(result.hero.gold).toBe(25);
    expect(result.hero.xp).toBe(20);
    expect(result.leveledUp).toBe(false);
    expect(result.quests).toHaveLength(1);
    expect(result.quests[0]?.id).not.toBe('alvo'); // veio uma nova no lugar
  });

  it('reporta leveledUp quando o XP da recompensa sobe de nível', () => {
    const hero = heroFixture({ hero: { xp: 35, xpNext: 40 } }); // faltam 5 pro próximo nível
    const pronta = questFixture({ id: 'alvo', done: true, rewardXp: 20, rewardGold: 0 });
    const result = claimQuest(hero, [pronta], 'alvo', 5, { rng: sequenceRng([0, 0]), now: FIXED_NOW });
    expect(result.leveledUp).toBe(true);
    expect(result.levels).toBe(1);
  });
});
