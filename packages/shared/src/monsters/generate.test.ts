import { describe, expect, it } from 'vitest';

import { seededRng } from '../rng.js';
import { generate, generateBoss, generateMimic, monsterView } from './generate.js';
import { ENEMY_CLASSES, SPECIES, tierLabelFor } from './species.js';

describe('catálogo', () => {
  it('mantém as 10 espécies e 5 classes de inimigo originais', () => {
    expect(SPECIES).toHaveLength(10);
    expect(ENEMY_CLASSES).toHaveLength(5);
  });

  it('não tem id duplicado em espécie nem em classe', () => {
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(SPECIES.length);
    expect(new Set(ENEMY_CLASSES.map((c) => c.id)).size).toBe(ENEMY_CLASSES.length);
  });
});

describe('tierLabelFor', () => {
  it('segue as faixas do jogo original', () => {
    expect(tierLabelFor(1)).toBe('');
    expect(tierLabelFor(3)).toBe('');
    expect(tierLabelFor(4)).toBe('Corrompido');
    expect(tierLabelFor(8)).toBe('Ancestral');
    expect(tierLabelFor(13)).toBe('Amaldiçoado');
    expect(tierLabelFor(19)).toBe('Lendário');
    expect(tierLabelFor(99)).toBe('Lendário');
  });

  it('não tem faixa acima do andar 99 — comportamento herdado do original', () => {
    // A tabela original não tem fallback: nenhuma faixa cobre floor > 99, então
    // o loop cai no `return ''` final e o monstro perde o adjetivo de tier.
    // O save permite floor até 10000 (accounts.js), então isso é alcançável —
    // registrado aqui como comportamento existente, não corrigido em silêncio.
    expect(tierLabelFor(100)).toBe('');
    expect(tierLabelFor(500)).toBe('');
  });
});

describe('generate', () => {
  it('sempre fixa maxHp = hp na criação', () => {
    // No jogo original isso era responsabilidade de quem chamava generate()
    // (dungeon.js fazia `m.maxHp = m.hp` na mão) — se alguém esquecesse,
    // `monster.hp <= monster.maxHp/2` (usado no enrage de chefe) comparava
    // com undefined e nunca disparava. Aqui não tem como esquecer.
    for (let seed = 0; seed < 20; seed++) {
      const m = generate(5, { rng: seededRng(seed) });
      expect(m.maxHp).toBe(m.hp);
    }
  });

  it('escala dano e vida com o andar', () => {
    const raso = generate(1, { rng: seededRng(1) });
    const fundo = generate(20, { rng: seededRng(1) });
    expect(fundo.dmg).toBeGreaterThan(raso.dmg);
    expect(fundo.hp).toBeGreaterThan(raso.hp);
  });

  it('nunca gera dano ou velocidade menor que 1', () => {
    for (let seed = 0; seed < 50; seed++) {
      const m = generate(1, { rng: seededRng(seed) });
      expect(m.dmg).toBeGreaterThanOrEqual(1);
      expect(m.speed).toBeGreaterThanOrEqual(1);
    }
  });

  it('é determinística com rng semeado', () => {
    const a = generate(7, { rng: seededRng(99) });
    const b = generate(7, { rng: seededRng(99) });
    expect(a).toEqual(b);
  });
});

describe('generateBoss', () => {
  it('marca chefe principal só em andar múltiplo de 10', () => {
    expect(generateBoss(10, { rng: seededRng(1) }).isMainBoss).toBe(true);
    expect(generateBoss(5, { rng: seededRng(1) }).isMainBoss).toBe(false);
    expect(generateBoss(20, { rng: seededRng(1) }).isMainBoss).toBe(true);
  });

  it('chefe principal é mais forte que mini-chefe no mesmo andar equivalente', () => {
    const mini = generateBoss(5, { rng: seededRng(3) });
    const principal = generateBoss(10, { rng: seededRng(3) });
    // ambos usam o mesmo seed, então a espécie/classe sorteada é igual
    expect(principal.hp).toBeGreaterThan(mini.hp);
  });

  it('guarda o título sorteado em vez de resortear a cada view', () => {
    const boss = generateBoss(10, { rng: seededRng(5) });
    const viewA = monsterView(boss);
    const viewB = monsterView(boss);
    expect(viewA.name).toBe(viewB.name);
    expect(boss.bossTitle).toBeTruthy();
  });
});

describe('generateMimic', () => {
  it('troca fachada mas mantém fraqueza/resistência/classe do sorteio interno', () => {
    const mimic = generateMimic(3, { rng: seededRng(11) });
    const view = monsterView(mimic);

    expect(view.name).toBe('Mímico Faminto');
    expect(view.icon).toBe('🧰');
    expect(view.behavior).toBe('agressivo');
    expect(view.ability).toBe('Mordida Surpresa');
    // fraqueza/resistência vêm da espécie sorteada internamente, não fixas
    expect(['fisico', 'magico', 'nenhuma']).toContain(view.species.weakness);
  });

  it('usa o rótulo "Ancestral" a partir do andar 8', () => {
    expect(monsterView(generateMimic(8, { rng: seededRng(1) })).name).toBe('Mímico Ancestral');
    expect(monsterView(generateMimic(7, { rng: seededRng(1) })).name).toBe('Mímico Faminto');
  });

  it('é mais forte que o monstro base do mesmo andar', () => {
    const base = generate(4, { rng: seededRng(20) });
    const mimic = generateMimic(3, { rng: seededRng(20) }); // gera internamente no andar 4
    expect(mimic.hp).toBeGreaterThan(base.hp);
    expect(mimic.dmg).toBeGreaterThanOrEqual(base.dmg);
  });
});

describe('monsterView', () => {
  it('resolve nome com o adjetivo de profundidade quando não é chefe nem override', () => {
    // Precisamos de um monstro em andar >= 4 para ter adjetivo; forçamos a instância.
    const m = generate(1, { rng: seededRng(1) });
    const funda = { ...m, floor: 8 };
    expect(monsterView(funda).name).toContain('Ancestral');
  });

  it('resolve o rótulo de classe com prefixo "Chefe" só para chefe', () => {
    const comum = generate(5, { rng: seededRng(2) });
    const chefe = generateBoss(5, { rng: seededRng(2) });
    expect(monsterView(comum).enemyClassLabel).not.toMatch(/^Chefe /);
    expect(monsterView(chefe).enemyClassLabel).toMatch(/^Chefe /);
  });

  it('lança em vez de devolver monstro quebrado quando a espécie sumiu', () => {
    const m = generate(1, { rng: seededRng(1) });
    expect(() => monsterView({ ...m, speciesId: 'nao_existe' })).toThrow();
  });
});
