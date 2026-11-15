import { describe, expect, it } from 'vitest';

import { weaponAtkContribution } from '../combat/damage.js';
import { CLASSES, classById, RACES, DEBUFFS } from './catalog.js';
import { alcanceDoHeroi, ataqueDasMaos, classeDeLuta, CLASSES_DE_LUTA, CLASSE_PADRAO, vidaComAClasse } from './classes-de-luta.js';
import { derivedStats } from './derived.js';
import { buildHero, trainAtGuild } from './hero.js';
import { wieldsMasteryWeapon } from './mastery.js';
import { seededRng } from '../rng.js';

describe('os números das classes na luta (doc do Breno de 2026-11-15)', () => {
  it('toda classe do catálogo tem os números dela', () => {
    for (const c of CLASSES) expect(CLASSES_DE_LUTA[c.id], c.id).toBeDefined();
    expect(classeDeLuta({ className: 'Aprendiz' })).toBe(CLASSE_PADRAO);
    expect(classeDeLuta({ className: 'Paladino' })).toBe(CLASSES_DE_LUTA.paladino);
  });

  it('o alcance: o da classe, o da arma pesada no Bárbaro, o da arma sem classe', () => {
    const com = (classId: string | undefined, arma: string | null) => alcanceDoHeroi({ classId, equip: { arma: arma ? { templateId: arma } : null } });
    expect(com('arqueiro', 'adaga')).toBe(12);
    expect(com('clerigo', 'maca')).toBe(5);
    expect(com('barbaro', 'machado')).toBe(4);
    expect(com('barbaro', 'marreta')).toBe(2);
    expect(com('barbaro', 'maca')).toBe(6);
    expect(com('barbaro', null)).toBe(1);
    expect(com(undefined, 'cajado')).toBe(7);
    expect(com(undefined, 'espada')).toBe(1);
  });

  it('a vida da classe entra na vida máxima, em todo lugar', () => {
    const base = { level: 7, attrs: { forca: 10, destreza: 10, constituicao: 13, intelecto: 10, sabedoria: 10, carisma: 10 }, equip: {} };
    const semClasse = derivedStats(base).maxHp;
    expect(derivedStats({ ...base, classId: 'guerreiro' }).maxHp).toBe(semClasse);
    expect(derivedStats({ ...base, classId: 'bardo' }).maxHp).toBe(Math.round(semClasse * 0.8));
    expect(derivedStats({ ...base, className: 'Paladino' }).maxHp).toBe(Math.round(semClasse * 1.3));
    expect(vidaComAClasse(205, { classId: 'mago' })).toBe(164);
  });
});

describe('a maça do Paladino e as mãos do Monge', () => {
  const criar = (id: string) => buildHero({ name: 'T', race: RACES[0]!, cls: classById(id)!, debuff: DEBUFFS[0]!, chosenPowerIds: [] }, seededRng(1));

  it('o Paladino começa de maça, e é com ela que a maestria vale', () => {
    const paladino = criar('paladino');
    expect(paladino.equip.arma?.templateId).toBe('maca');
    expect(wieldsMasteryWeapon(paladino)).toBe(true);
  });

  it('o Monge começa de mãos vazias, bate com elas e tem a maestria assim', () => {
    const monge = criar('monge');
    expect(monge.equip.arma).toBeNull();
    expect(wieldsMasteryWeapon(monge)).toBe(true);
    expect(ataqueDasMaos(monge)).toBe(3);
    expect(ataqueDasMaos({ ...monge, level: 10 })).toBe(8);
    expect(weaponAtkContribution(monge, 100)).toBe(3);
    // Outra classe de mãos vazias não ganha nada, nem a maestria.
    const guerreiro = { ...criar('guerreiro'), equip: { ...monge.equip } };
    expect(weaponAtkContribution(guerreiro, 100)).toBe(0);
    expect(wieldsMasteryWeapon(guerreiro)).toBe(false);
  });

  it('o Aprendiz que vira Monge na Guilda não ganha arma', () => {
    const aprendiz = { ...criar('monge'), className: 'Aprendiz', classId: undefined, powerIds: [], powerNames: [] };
    const treino = trainAtGuild(aprendiz, classById('monge')!);
    expect(treino.toInventory).toBeNull();
    expect(treino.hero.equip.arma).toBeNull();
    expect(treino.hero.classId).toBe('monge');
  });
});
