import { describe, expect, it } from 'vitest';

import { derivedStats } from '../hero/derived.js';
import type { Attributes } from '../hero/stats.js';
import { DEBUFFS } from '../hero/catalog.js';
import type { Hero, HeroEquipment } from '../hero/hero.js';
import { seededRng } from '../rng.js';
import { EVENT_TEMPLATES, eventTemplateById, randomEventTemplate, resolveEvent, type EventChoiceId, type EventTemplateId } from './events.js';

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
    gold: 20,
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

describe('catálogo de eventos', () => {
  it('tem os três templates do original, com id resolvível', () => {
    expect(EVENT_TEMPLATES.map((t) => t.id).sort()).toEqual(['altar', 'ferido', 'porta']);
    expect(eventTemplateById('altar')?.title).toBe('Altar Antigo');
    expect(eventTemplateById('inexistente' as EventTemplateId)).toBeNull();
  });

  it('randomEventTemplate é determinístico com seed', () => {
    expect(randomEventTemplate(seededRng(1))).toEqual(randomEventTemplate(seededRng(1)));
  });
});

describe('resolveEvent — ignorar/desistir', () => {
  it('não muda o herói e sempre resolve', () => {
    const hero = heroFixture();
    const a = resolveEvent(hero, 5, 'ignorar');
    const b = resolveEvent(hero, 5, 'desistir');
    expect(a.outcome).toEqual({ kind: 'declined' });
    expect(a.resolved).toBe(true);
    expect(a.hero).toBe(hero);
    expect(b.outcome).toEqual({ kind: 'declined' });
  });
});

describe('resolveEvent — ferido: ajudar', () => {
  it('recusa sem 15 de ouro, sem tocar no herói', () => {
    const hero = heroFixture({ hero: { gold: 10 } });
    const result = resolveEvent(hero, 5, 'ajudar');
    expect(result.resolved).toBe(false);
    expect(result.outcome).toEqual({ kind: 'insufficient_gold', required: 15 });
    expect(result.hero).toBe(hero);
  });

  it('gasta 15 de ouro, cura 20 de vida (sem passar do teto) e dá 8 de XP', () => {
    const hero = heroFixture({ hero: { gold: 20, hp: 50, maxHp: 100 } });
    const result = resolveEvent(hero, 5, 'ajudar');
    expect(result.resolved).toBe(true);
    expect(result.hero.gold).toBe(5);
    expect(result.hero.hp).toBe(70);
    expect(result.outcome).toEqual({ kind: 'helped_wounded', xpGained: 8, leveledUp: false, levels: 0 });
  });

  it('a cura nunca passa do maxHp', () => {
    const hero = heroFixture({ hero: { gold: 20, hp: 95, maxHp: 100 } });
    const result = resolveEvent(hero, 5, 'ajudar');
    expect(result.hero.hp).toBe(100);
  });
});

describe('resolveEvent — ferido: curar', () => {
  it('com Sabedoria >= 12, ganha 30 de ouro', () => {
    const hero = heroFixture({ attrs: { sabedoria: 12 }, hero: { gold: 0 } });
    const result = resolveEvent(hero, 5, 'curar');
    expect(result.outcome).toEqual({ kind: 'healed_wounded', success: true, goldGained: 30 });
    expect(result.hero.gold).toBe(30);
  });

  it('com Sabedoria < 12, nada muda além de resolver', () => {
    const hero = heroFixture({ attrs: { sabedoria: 11 }, hero: { gold: 0 } });
    const result = resolveEvent(hero, 5, 'curar');
    expect(result.outcome).toEqual({ kind: 'healed_wounded', success: false, goldGained: 0 });
    expect(result.hero.gold).toBe(0);
    expect(result.resolved).toBe(true);
  });
});

describe('resolveEvent — altar: estudar / porta: examinar (mesma fórmula)', () => {
  const CHOICES: EventChoiceId[] = ['estudar', 'examinar'];

  for (const choice of CHOICES) {
    it(`${choice}: com Intelecto >= 13, ganha um item e o herói fica intocado`, () => {
      const hero = heroFixture({ attrs: { intelecto: 13 } });
      const result = resolveEvent(hero, 5, choice, { rng: seededRng(1) });
      expect(result.outcome.kind).toBe('studied');
      expect(result.outcome.kind === 'studied' && result.outcome.success).toBe(true);
      expect(result.outcome.kind === 'studied' && result.outcome.item).not.toBeNull();
      expect(result.hero).toBe(hero);
    });

    it(`${choice}: com Intelecto < 13, perde 8 de Mana (sem negativo)`, () => {
      const hero = heroFixture({ attrs: { intelecto: 12 }, hero: { mp: 5 } });
      const result = resolveEvent(hero, 5, choice);
      expect(result.outcome).toEqual({ kind: 'studied', success: false, item: null });
      expect(result.hero.mp).toBe(0); // max(0, 5-8)
    });
  }
});

describe('resolveEvent — altar: rezar', () => {
  it('com Sabedoria >= 13, restaura Vida e Mana ao máximo', () => {
    const hero = heroFixture({ attrs: { sabedoria: 13 }, hero: { hp: 1, mp: 1 } });
    const result = resolveEvent(hero, 5, 'rezar');
    expect(result.outcome).toEqual({ kind: 'prayed', success: true });
    expect(result.hero.hp).toBe(hero.maxHp);
    expect(result.hero.mp).toBe(hero.maxMp);
  });

  it('com Sabedoria < 13, nada muda', () => {
    const hero = heroFixture({ attrs: { sabedoria: 12 }, hero: { hp: 1, mp: 1 } });
    const result = resolveEvent(hero, 5, 'rezar');
    expect(result.outcome).toEqual({ kind: 'prayed', success: false });
    expect(result.hero).toBe(hero);
  });
});

describe('resolveEvent — altar: sacrificar', () => {
  it('recusa quando a vida não é suficiente para o sacrifício', () => {
    const hero = heroFixture({ hero: { hp: 15, maxHp: 100 } }); // amount = max(10, floor(100*0.2)) = 20
    const result = resolveEvent(hero, 5, 'sacrificar');
    expect(result.resolved).toBe(false);
    expect(result.outcome).toEqual({ kind: 'too_wounded', required: 20 });
    expect(result.hero).toBe(hero);
  });

  it('perde vida proporcional ao maxHp e ganha 1 ponto de atributo', () => {
    const hero = heroFixture({ hero: { hp: 50, maxHp: 100, attrPoints: 2 } });
    const result = resolveEvent(hero, 5, 'sacrificar');
    expect(result.outcome).toEqual({ kind: 'sacrificed', hpLost: 20 });
    expect(result.hero.hp).toBe(30);
    expect(result.hero.attrPoints).toBe(3);
  });

  it('o mínimo de vida sacrificada é 10, mesmo com maxHp baixo', () => {
    const hero = heroFixture({ hero: { hp: 40, maxHp: 30 } }); // floor(30*0.2)=6 -> max(10,6)=10
    const result = resolveEvent(hero, 5, 'sacrificar');
    expect(result.outcome).toEqual({ kind: 'sacrificed', hpLost: 10 });
  });
});

describe('resolveEvent — porta: forçar', () => {
  it('com Força >= 13, ganha ouro proporcional ao andar', () => {
    const hero = heroFixture({ attrs: { forca: 13 }, hero: { gold: 0 } });
    const result = resolveEvent(hero, 5, 'forcar');
    expect(result.outcome).toEqual({ kind: 'forced_door', success: true, goldGained: 33, hpLost: 0 }); // 18+5*3
    expect(result.hero.gold).toBe(33);
  });

  it('com Força < 13, sofre 10 de dano sem nunca zerar a vida', () => {
    const hero = heroFixture({ attrs: { forca: 12 }, hero: { hp: 5 } });
    const result = resolveEvent(hero, 5, 'forcar');
    expect(result.outcome).toEqual({ kind: 'forced_door', success: false, goldGained: 0, hpLost: 10 });
    expect(result.hero.hp).toBe(1); // max(1, 5-10)
  });
});

describe('resolveEvent — escolha desconhecida', () => {
  it('não resolve e não muda o herói', () => {
    const hero = heroFixture();
    const result = resolveEvent(hero, 5, 'bogus' as EventChoiceId);
    expect(result.resolved).toBe(false);
    expect(result.outcome).toEqual({ kind: 'invalid_choice' });
    expect(result.hero).toBe(hero);
  });
});

describe('resolveEvent — não muta o herói recebido', () => {
  it('nas ramificações que alteram estado, a entrada permanece intacta', () => {
    const hero = heroFixture({ attrs: { forca: 13 }, hero: { gold: 5 } });
    const snapshot = JSON.stringify(hero);
    resolveEvent(hero, 5, 'forcar');
    expect(JSON.stringify(hero)).toBe(snapshot);
  });
});
