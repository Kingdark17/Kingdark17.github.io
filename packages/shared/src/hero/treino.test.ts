import { describe, expect, it } from 'vitest';

import { powerManaCost, castPower } from '../combat/use-power.js';
import { freshCombatMonster } from '../combat/monster-state.js';
import { monsterView, type MonsterInstance } from '../monsters/generate.js';
import { seededRng } from '../rng.js';
import { classByName, DEBUFFS, powerById, raceByName } from './catalog.js';
import { xpForLevel } from './derived.js';
import { buildHero, gainXP, type Hero } from './hero.js';
import {
  anotarUso,
  atributoDoGolpe,
  atributoDoPoder,
  converterPontosGuardados,
  custoDoPonto,
  descontoDaHabilidade,
  efeitoDaHabilidade,
  nivelDaHabilidade,
  PONTOS_CONVERTIDOS_POR_ABATE,
  progressoDoTreino,
  treinarComXp,
  treinarPoder,
  usarHabilidade,
  usosAteOProximoNivel,
} from './treino.js';

function heroi(extra: Partial<Hero> = {}): Hero {
  return { ...buildHero({ name: 'Teste', race: raceByName('Humano')!, cls: classByName('Guerreiro')!, debuff: DEBUFFS[0]!, chosenPowerIds: [] }, seededRng(1)), ...extra };
}

describe('atributos pelo uso', () => {
  it('o uso só fica anotado; a Constituição não é de uso', () => {
    const h = anotarUso(anotarUso(heroi(), 'forca'), 'forca');
    expect(h.usosDeAtributo).toEqual({ forca: 2 });
    expect(h.attrs.forca).toBe(heroi().attrs.forca);
    expect(anotarUso(heroi(), 'constituicao').usosDeAtributo).toBeUndefined();
  });

  it('o XP do abate se reparte pelos usos e zera a anotação', () => {
    const h = anotarUso(anotarUso(anotarUso(heroi(), 'forca'), 'forca', 2), 'destreza');
    const { hero, log } = treinarComXp(h, 8);
    expect(hero.treino).toEqual({ forca: 6, destreza: 2 });
    expect(hero.usosDeAtributo).toEqual({});
    expect(log).toEqual([]);
  });

  it('o ponto custa uma fração do XP do nível, e subir recalcula o herói', () => {
    const h = anotarUso(heroi(), 'forca');
    const custo = custoDoPonto(h.level);
    expect(custo).toBe(Math.round(xpForLevel(h.level) / 1.5));
    const { hero, log } = treinarComXp(h, custo * 2 + 3);
    expect(hero.attrs.forca).toBe(h.attrs.forca + 2);
    expect(hero.treino?.forca).toBe(3);
    expect(hero.derived.dmgFisico).toBeGreaterThan(h.derived.dmgFisico);
    expect(log).toEqual([`💪 Força subiu para ${h.attrs.forca + 2}!`]);
    expect(progressoDoTreino(hero, 'forca')).toBeCloseTo(3 / custo);
  });

  it('no teto não sobe nem guarda progresso; sem uso, o XP não treina nada', () => {
    const noTeto = anotarUso(heroi({ attrs: { ...heroi().attrs, forca: 99 } }), 'forca');
    const { hero } = treinarComXp(noTeto, 100000);
    expect(hero.attrs.forca).toBe(99);
    expect(hero.treino?.forca).toBeUndefined();
    expect(progressoDoTreino(hero, 'forca')).toBe(0);
    const parado = heroi();
    expect(treinarComXp(parado, 500).hero).toBe(parado);
  });

  it('cada golpe e cada poder treinam o atributo deles', () => {
    const h = heroi();
    expect(atributoDoGolpe(h, 'normal')).toBe('forca');
    expect(atributoDoGolpe(h, 'magic')).toBe('intelecto');
    expect(atributoDoGolpe(h, 'ranged')).toBe('destreza');
    expect(atributoDoGolpe({ equip: { ...h.equip, arma: { templateId: 'arco' } as never } }, 'normal')).toBe('destreza');
    expect(atributoDoPoder('dano_fisico')).toBe('forca');
    expect(atributoDoPoder('dano_magico')).toBe('intelecto');
    expect(atributoDoPoder('invocar')).toBe('intelecto');
    expect(atributoDoPoder('cura')).toBe('sabedoria');
    expect(atributoDoPoder('buff_forca')).toBe('sabedoria');
  });

  it('o nível do personagem dá 1 de Constituição, até o teto', () => {
    const h = heroi();
    expect(gainXP(h, h.xpNext).hero.attrs.constituicao).toBe(h.attrs.constituicao + 1);
    const cheio = heroi({ attrs: { ...h.attrs, constituicao: 99 } });
    expect(gainXP(cheio, cheio.xpNext).hero.attrs.constituicao).toBe(99);
  });
});

describe('pontos guardados', () => {
  it('viram XP do personagem, alguns por abate', () => {
    const h = heroi({ attrPoints: 5 });
    const { hero, log } = converterPontosGuardados(h);
    const xp = Math.round(xpForLevel(h.level) * 0.25) * PONTOS_CONVERTIDOS_POR_ABATE;
    expect(hero.attrPoints).toBe(3);
    expect(hero.xp).toBe(h.xp + xp);
    expect(log[0]).toBe(`🎓 2 pontos guardados viraram ${xp} de XP.`);
    const ultimo = converterPontosGuardados(heroi({ attrPoints: 1 }));
    expect(ultimo.hero.attrPoints).toBe(0);
    expect(ultimo.log[0]).toMatch(/^🎓 1 ponto guardado virou /);
  });

  it('sem ponto guardado, o herói volta igual', () => {
    const h = heroi();
    expect(converterPontosGuardados(h).hero).toBe(h);
  });
});

describe('nível de habilidade', () => {
  it('sobe com 5, 15, 30… usos, até o 10', () => {
    expect(nivelDaHabilidade(heroi(), 'golpe_poderoso')).toBe(1);
    expect(nivelDaHabilidade({ usosDePoder: { golpe_poderoso: 4 } }, 'golpe_poderoso')).toBe(1);
    expect(nivelDaHabilidade({ usosDePoder: { golpe_poderoso: 5 } }, 'golpe_poderoso')).toBe(2);
    expect(nivelDaHabilidade({ usosDePoder: { golpe_poderoso: 15 } }, 'golpe_poderoso')).toBe(3);
    expect(nivelDaHabilidade({ usosDePoder: { golpe_poderoso: 9999 } }, 'golpe_poderoso')).toBe(10);
    expect(usosAteOProximoNivel({ usosDePoder: { golpe_poderoso: 12 } }, 'golpe_poderoso')).toBe(3);
    expect(usosAteOProximoNivel({ usosDePoder: { golpe_poderoso: 9999 } }, 'golpe_poderoso')).toBe(0);
  });

  it('cada nível dá 4% de efeito e tira 2% da mana', () => {
    const nivel10 = { usosDePoder: { bola_de_fogo: 225 } };
    expect(efeitoDaHabilidade(nivel10, 'bola_de_fogo')).toBeCloseTo(1.36);
    expect(descontoDaHabilidade(nivel10, 'bola_de_fogo')).toBeCloseTo(0.18);
    expect(efeitoDaHabilidade(nivel10, 'cura_menor')).toBe(1);
    const bola = powerById('bola_de_fogo')!;
    expect(powerManaCost(heroi(), bola)).toBe(14);
    expect(powerManaCost(heroi(nivel10), bola)).toBe(Math.ceil(14 * 0.82));
  });

  it('o uso conta, avisa quando passa de nível e treina o atributo do poder', () => {
    const quase = heroi({ usosDePoder: { golpe_poderoso: 4 } });
    const { hero, subiu } = usarHabilidade(quase, 'golpe_poderoso');
    expect(hero.usosDePoder).toEqual({ golpe_poderoso: 5 });
    expect(subiu).toBe(2);
    expect(usarHabilidade(hero, 'golpe_poderoso').subiu).toBeUndefined();
    const treinado = treinarPoder(heroi(), { id: 'cura_menor', type: 'cura' });
    expect(treinado.hero.usosDeAtributo).toEqual({ sabedoria: 1 });
    expect(treinado.hero.usosDePoder).toEqual({ cura_menor: 1 });
  });

  it('o poder de nível alto bate mais forte', () => {
    const golpe = powerById('golpe_poderoso')!;
    const alvo = () => monsterView(freshCombatMonster({ speciesId: 'zumbi', enemyClassId: 'brutamontes', floor: 2, hp: 100000, maxHp: 100000, dmg: 3, speed: 5, xp: 12, gold: 7, isBoss: false } as MonsterInstance));
    const base = heroi({ mp: 999 });
    const fraco = castPower(base, [], alvo(), golpe, { rng: seededRng(5) });
    const forte = castPower({ ...base, usosDePoder: { golpe_poderoso: 225 } }, [], alvo(), golpe, { rng: seededRng(5) });
    expect(forte.damage!).toBeGreaterThan(fraco.damage!);
    expect(forte.manaCost).toBeLessThan(fraco.manaCost);
  });
});
