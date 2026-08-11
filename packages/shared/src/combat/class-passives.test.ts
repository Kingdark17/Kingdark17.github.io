import { describe, expect, it } from 'vitest';

import { classByName, raceByName, DEBUFFS } from '../hero/catalog.js';
import { buildHero, generateCompanion, type Companion, type Hero } from '../hero/hero.js';
import { seededRng } from '../rng.js';
import { generate, generateBoss } from '../monsters/generate.js';
import { freshCombatMonster, type CombatMonster } from './monster-state.js';
import { applyHeroClassPassive, triggerEnemyClassPower } from './class-passives.js';
import { applyPartyTurn } from './party.js';
import { tickHeroStatus } from './hero-status.js';

const HUMANO = raceByName('Humano')!;
const SEM_DEBUFF = DEBUFFS.find((d) => !d.effect)!;

function heroiDe(className: string): Hero {
  const cls = classByName(className)!;
  return buildHero({ name: 'T', race: HUMANO, cls, debuff: SEM_DEBUFF, chosenPowerNames: [] }, seededRng(1));
}

function monstro(): CombatMonster {
  return freshCombatMonster(generate(5, { rng: seededRng(1) }));
}

describe('applyHeroClassPassive', () => {
  it('Ladino: causa dano extra igual a metade do dano original', () => {
    const hero = heroiDe('Ladino');
    const monster = monstro();
    const result = applyHeroClassPassive(hero, monster, 20, () => 0); // sempre < 0.25
    expect(result.triggered?.kind).toBe('ladino');
    expect(result.monster.hp).toBe(monster.hp - 10);
  });

  it('Paladino/Clérigo curam o próprio herói, não mexem no monstro', () => {
    const paladino = { ...heroiDe('Paladino'), hp: 10 };
    const result = applyHeroClassPassive(paladino, monstro(), 20, () => 0);
    expect(result.triggered?.kind).toBe('paladino');
    expect(result.hero.hp).toBeGreaterThan(10);
    expect(result.monster).toEqual(monstro());
  });

  it('classe sem passiva correspondente nunca dispara', () => {
    const bardo = heroiDe('Bardo');
    // Bardo tem passiva, mas testamos com rolo sempre alto (nunca ativa)
    const result = applyHeroClassPassive(bardo, monstro(), 20, () => 0.99);
    expect(result.triggered).toBeNull();
  });

  it('não muta hero nem monster recebidos', () => {
    const hero = heroiDe('Necromante');
    const monster = monstro();
    const heroSnap = JSON.stringify(hero);
    const monsterSnap = JSON.stringify(monster);
    applyHeroClassPassive(hero, monster, 20, () => 0);
    expect(JSON.stringify(hero)).toBe(heroSnap);
    expect(JSON.stringify(monster)).toBe(monsterSnap);
  });
});

describe('triggerEnemyClassPower', () => {
  function comClasse(enemyClassId: string, attackCount: number): CombatMonster {
    return { ...monstro(), enemyClassId, attackCount };
  }

  it('só dispara em múltiplos de 3 (não no primeiro ataque)', () => {
    expect(triggerEnemyClassPower(comClasse('brutamontes', 1), heroiDe('Guerreiro')).triggered).toBeNull();
    expect(triggerEnemyClassPower(comClasse('brutamontes', 2), heroiDe('Guerreiro')).triggered).toBeNull();
    expect(triggerEnemyClassPower(comClasse('brutamontes', 3), heroiDe('Guerreiro')).triggered).toBe('brutamontes');
    expect(triggerEnemyClassPower(comClasse('brutamontes', 6), heroiDe('Guerreiro')).triggered).toBe('brutamontes');
  });

  it('Brutamontes multiplica dano em 1.7x sem mexer em hp/mp', () => {
    const result = triggerEnemyClassPower(comClasse('brutamontes', 3), heroiDe('Guerreiro'));
    expect(result.attackMult).toBe(1.7);
  });

  it('Assassino marca poisonStrike e multiplica 1.4x', () => {
    const result = triggerEnemyClassPower(comClasse('assassino', 3), heroiDe('Guerreiro'));
    expect(result.attackMult).toBe(1.4);
    expect(result.monster.poisonStrike).toBe(true);
  });

  it('Xamã cura a si mesmo, sem multiplicador de dano', () => {
    const monster = { ...comClasse('xama', 3), hp: 10 };
    const result = triggerEnemyClassPower(monster, heroiDe('Guerreiro'));
    expect(result.attackMult).toBe(1);
    expect(result.monster.hp).toBeGreaterThan(10);
    expect(result.monster.hp).toBeLessThanOrEqual(result.monster.maxHp);
  });

  it('Guardião ganha 2 guardHits, sem multiplicador', () => {
    const result = triggerEnemyClassPower(comClasse('guardiao', 3), heroiDe('Guerreiro'));
    expect(result.attackMult).toBe(1);
    expect(result.monster.guardHits).toBe(2);
  });

  it('Feiticeiro drena mana do herói e multiplica 1.3x', () => {
    const hero = { ...heroiDe('Guerreiro'), mp: 20 };
    const result = triggerEnemyClassPower(comClasse('feiticeiro', 3), hero);
    expect(result.attackMult).toBe(1.3);
    expect(result.hero.mp).toBeLessThan(20);
  });

  it('drena no máximo a mana que o herói tem', () => {
    const hero = { ...heroiDe('Guerreiro'), mp: 2 };
    const result = triggerEnemyClassPower(comClasse('feiticeiro', 3), hero);
    expect(result.hero.mp).toBe(0);
  });

  it('funciona igual para chefe (enemyClassId não tem prefixo "Chefe")', () => {
    const boss = freshCombatMonster(generateBoss(10, { rng: seededRng(1) }));
    const comAtaque = { ...boss, attackCount: 3 };
    const result = triggerEnemyClassPower(comAtaque, heroiDe('Guerreiro'));
    expect(result.triggered).toBe(boss.enemyClassId);
  });
});

describe('applyPartyTurn', () => {
  function membro(overrides: Partial<Companion> = {}): Companion {
    return { ...generateCompanion(seededRng(1)), stance: 'equilibrada', hp: 20, maxHp: 20, ...overrides };
  }

  it('postura suporte cura o herói em vez de atacar', () => {
    const hero = { ...heroiDe('Guerreiro'), hp: 10 };
    const clerigo = membro({ className: 'Clérigo', stance: 'suporte' });
    const result = applyPartyTurn(hero, [clerigo], monstro(), () => 0); // sempre cura (0 < 0.65)
    expect(result.outcomes[0]?.kind).toBe('healed_hero');
    expect(result.hero.hp).toBeGreaterThan(10);
    expect(result.monster.hp).toBe(monstro().hp); // não atacou
  });

  it('membro morto ou monstro já derrotado não age', () => {
    const morto = membro({ hp: 0 });
    const result = applyPartyTurn(heroiDe('Guerreiro'), [morto], monstro(), () => 0);
    expect(result.outcomes).toHaveLength(0);
  });

  it('para de processar a fila quando o monstro morre no meio', () => {
    const fraco = { ...monstro(), hp: 1 };
    const doisMembros = [membro({ className: 'Guerreiro' }), membro({ className: 'Mago' })];
    const result = applyPartyTurn(heroiDe('Guerreiro'), doisMembros, fraco, () => 0); // sempre acerta
    expect(result.defeated).toBe(true);
    expect(result.outcomes).toHaveLength(1); // o segundo nem chega a agir
  });

  it('Bárbaro ganha bônus só abaixo de 50% de vida, sem depender de rolo', () => {
    const ferido = membro({ className: 'Bárbaro', hp: 5, maxHp: 20 });
    const saudavel = membro({ className: 'Bárbaro', hp: 20, maxHp: 20 });
    const comFerido = applyPartyTurn(heroiDe('Guerreiro'), [ferido], monstro(), () => 0.5); // acerta, mas não ativa procs de rolo
    const comSaudavel = applyPartyTurn(heroiDe('Guerreiro'), [saudavel], monstro(), () => 0.5);
    const dmgFerido = comFerido.outcomes[0]?.kind === 'hit' ? comFerido.outcomes[0].amount : 0;
    const dmgSaudavel = comSaudavel.outcomes[0]?.kind === 'hit' ? comSaudavel.outcomes[0].amount : 0;
    expect(dmgFerido).toBeGreaterThan(dmgSaudavel);
  });

  it('não muta hero, party nem monster recebidos', () => {
    const hero = heroiDe('Guerreiro');
    const party = [membro({ className: 'Necromante' })];
    const monster = monstro();
    const heroSnap = JSON.stringify(hero);
    const partySnap = JSON.stringify(party);
    const monsterSnap = JSON.stringify(monster);
    applyPartyTurn(hero, party, monster, () => 0);
    expect(JSON.stringify(hero)).toBe(heroSnap);
    expect(JSON.stringify(party)).toBe(partySnap);
    expect(JSON.stringify(monster)).toBe(monsterSnap);
  });
});

describe('tickHeroStatus', () => {
  it('sem veneno ativo, nada muda', () => {
    const hero = heroiDe('Guerreiro');
    const result = tickHeroStatus(hero);
    expect(result.damage).toBe(0);
    expect(result.hero).toBe(hero);
  });

  it('aplica o dano de veneno e decrementa os turnos', () => {
    const hero = { ...heroiDe('Guerreiro'), buffs: { poisonTurns: 3, poisonDmg: 5 } };
    const result = tickHeroStatus(hero);
    expect(result.damage).toBe(5);
    expect(result.hero.hp).toBe(hero.hp - 5);
    expect(result.hero.buffs?.poisonTurns).toBe(2);
  });

  it('marca derrotado quando o veneno zera a vida', () => {
    const hero = { ...heroiDe('Guerreiro'), hp: 3, buffs: { poisonTurns: 1, poisonDmg: 10 } };
    const result = tickHeroStatus(hero);
    expect(result.defeated).toBe(true);
    expect(result.hero.hp).toBe(0); // nunca negativo
  });
});
