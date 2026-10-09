import { describe, expect, it } from 'vitest';

import { seededRng } from '../rng.js';
import { CLASSES, classById, DEBUFFS, POWERS, raceById } from './catalog.js';
import { buildApprentice, buildHero, type Hero } from './hero.js';
import {
  CLASS_TEACHER_POWERS,
  learnFromTeacher,
  swappablePowers,
  swapWithTeacher,
  TEACHERS,
  teacherAppears,
  teacherFor,
  teacherMode,
  teacherOffer,
} from './teachers.js';

const SEM_DEBUFF = DEBUFFS.find((d) => !d.effect)!;

/** Guerreiro só com o poder da classe — o herói novo, saído da Guilda. */
function novo(extra: Partial<Hero> = {}): Hero {
  const pronto = buildHero({ name: 'T', race: raceById('humano')!, cls: classById('guerreiro')!, debuff: SEM_DEBUFF, chosenPowerIds: [] }, seededRng(1));
  return { ...pronto, ...extra };
}

/** Guerreiro da criação antiga: o da classe e mais dois. */
function veterano(extra: Partial<Hero> = {}): Hero {
  const pronto = buildHero(
    { name: 'V', race: raceById('humano')!, cls: classById('guerreiro')!, debuff: SEM_DEBUFF, chosenPowerIds: ['escudo_arcano', 'grito_de_guerra'] },
    seededRng(1),
  );
  return { ...pronto, ...extra };
}

describe('a lista de cada classe', () => {
  it('toda classe tem 3 poderes que existem', () => {
    for (const classe of CLASSES) {
      const lista = CLASS_TEACHER_POWERS[classe.id];
      expect(lista, classe.id).toHaveLength(3);
      for (const id of lista ?? []) expect(POWERS.some((p) => p.id === id), `${classe.id}: ${id}`).toBe(true);
    }
  });

  it('nenhuma ensina o poder que a própria classe já dá', () => {
    for (const classe of CLASSES) {
      expect(CLASS_TEACHER_POWERS[classe.id], classe.id).not.toContain(classe.signatureId);
      for (const id of CLASS_TEACHER_POWERS[classe.id] ?? []) expect(POWERS.find((p) => p.id === id)?.soDaClasse, id).toBeUndefined();
    }
  });
});

describe('quando o professor aparece', () => {
  const MAESTRIA_4 = 100;
  const MAESTRIA_8 = 360;

  it('o primeiro, nos andares 25 a 50, com maestria 4', () => {
    expect(teacherFor(novo({ masteryBattles: MAESTRIA_4 }), 24)).toBeNull();
    expect(teacherFor(novo({ masteryBattles: MAESTRIA_4 }), 25)?.number).toBe(1);
    expect(teacherFor(novo({ masteryBattles: MAESTRIA_4 }), 50)?.number).toBe(1);
    expect(teacherFor(novo({ masteryBattles: MAESTRIA_4 }), 51)).toBeNull();
    expect(teacherFor(novo({ masteryBattles: MAESTRIA_4 - 1 }), 30)).toBeNull();
  });

  it('o segundo, nos andares 75 a 80, com maestria 8 e depois do primeiro', () => {
    expect(teacherFor(novo({ masteryBattles: MAESTRIA_8, teachersMet: 0 }), 77)).toBeNull();
    expect(teacherFor(novo({ masteryBattles: MAESTRIA_8, teachersMet: 1 }), 77)?.number).toBe(2);
    expect(teacherFor(novo({ masteryBattles: MAESTRIA_8 - 1, teachersMet: 1 }), 77)).toBeNull();
    expect(teacherFor(novo({ masteryBattles: MAESTRIA_8, teachersMet: 1 }), 30)).toBeNull();
  });

  it('depois dos dois, nenhum', () => {
    expect(teacherFor(novo({ masteryBattles: 550, teachersMet: 2 }), 78)).toBeNull();
  });

  it('o Aprendiz não tem professor', () => {
    const aprendiz = buildApprentice({ name: 'A', race: raceById('humano')!, debuff: SEM_DEBUFF }, seededRng(1));
    expect(teacherFor({ ...aprendiz, masteryBattles: 550 }, 30)).toBeNull();
  });

  it('com a lista esgotada não há o que ensinar', () => {
    const cheio = novo({ masteryBattles: MAESTRIA_4, powerIds: ['golpe_poderoso', ...CLASS_TEACHER_POWERS.guerreiro!] });
    expect(teacherFor(cheio, 30)).toBeNull();
  });

  it('dentro da faixa é sorte; no último andar dela, certeza', () => {
    const [primeiro] = TEACHERS;
    expect(teacherAppears(primeiro!, 30, 0.05)).toBe(true);
    expect(teacherAppears(primeiro!, 30, 0.5)).toBe(false);
    expect(teacherAppears(primeiro!, 50, 0.99)).toBe(true);
  });
});

describe('aprender, pro herói novo', () => {
  it('o primeiro oferece os 3 da lista', () => {
    expect(teacherMode(novo())).toBe('learn');
    expect(teacherOffer(novo())).toEqual(['grito_de_guerra', 'golpe_atordoante', 'passo_veloz']);
  });

  it('aprender acrescenta o poder, com nome, e conta o professor', () => {
    const depois = learnFromTeacher(novo(), 'passo_veloz');
    expect(depois?.powerIds).toEqual(['golpe_poderoso', 'passo_veloz']);
    expect(depois?.powerNames).toEqual(['Golpe Poderoso', 'Passo Veloz']);
    expect(depois?.teachersMet).toBe(1);
  });

  it('o segundo oferece os 2 que sobraram, e o herói termina com 3', () => {
    const primeiro = learnFromTeacher(novo(), 'passo_veloz')!;
    expect(teacherMode(primeiro)).toBe('learn');
    expect(teacherOffer(primeiro)).toEqual(['grito_de_guerra', 'golpe_atordoante']);
    const segundo = learnFromTeacher(primeiro, 'grito_de_guerra');
    expect(segundo?.powerIds).toHaveLength(3);
    expect(segundo?.teachersMet).toBe(2);
  });

  it('poder de fora da lista ou já aprendido é recusado', () => {
    expect(learnFromTeacher(novo(), 'bola_de_fogo')).toBeNull();
    expect(learnFromTeacher(learnFromTeacher(novo(), 'passo_veloz')!, 'passo_veloz')).toBeNull();
  });
});

describe('trocar, pro veterano', () => {
  it('quem tem 3 poderes troca em vez de aprender', () => {
    expect(teacherMode(veterano())).toBe('swap');
    expect(learnFromTeacher(veterano(), 'passo_veloz')).toBeNull();
  });

  it('oferece o que ele não tem e deixa esquecer tudo menos o poder da classe', () => {
    expect(teacherOffer(veterano())).toEqual(['golpe_atordoante', 'passo_veloz']);
    expect(swappablePowers(veterano())).toEqual(['escudo_arcano', 'grito_de_guerra']);
  });

  it('troca no mesmo lugar e continua com 3', () => {
    const depois = swapWithTeacher(veterano(), 'escudo_arcano', 'passo_veloz');
    expect(depois?.powerIds).toEqual(['golpe_poderoso', 'passo_veloz', 'grito_de_guerra']);
    expect(depois?.teachersMet).toBe(1);
    expect(teacherMode(depois!)).toBe('swap');
  });

  it('não esquece o poder da classe nem aprende o que não está na oferta', () => {
    expect(swapWithTeacher(veterano(), 'golpe_poderoso', 'passo_veloz')).toBeNull();
    expect(swapWithTeacher(veterano(), 'escudo_arcano', 'bola_de_fogo')).toBeNull();
  });
});
