import { describe, expect, it } from 'vitest';

import { weaponAtkContribution } from '../combat/damage.js';
import { CLASSES, classById, RACES, DEBUFFS } from './catalog.js';
import {
  alcanceDoHeroi,
  ataqueDasMaos,
  bonusDoAtaque,
  classeDeLuta,
  classeRefeita,
  CLASSES_DE_LUTA,
  CLASSE_PADRAO,
  contarAcerto,
  contarGolpeLevado,
  criticoDaClasse,
  devolucaoDaClasse,
  esfriar,
  esquivaDaClasse,
  puxaOsMonstros,
  REGRAS_DO_BARBARO,
  resistenciaDaClasse,
  textosDaClasse,
  vidaComAClasse,
} from './classes-de-luta.js';
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

describe('as classes refeitas na luta do app (rodada 3a)', () => {
  const GUERREIRO = { classId: 'guerreiro' };
  const LADINO = { classId: 'ladino' };
  const BARBARO = { classId: 'barbaro' };
  const PALADINO = { classId: 'paladino' };
  const longe = { colado: false, chefe: false };

  it('só as quatro da rodada perdem a passiva antiga; o crítico 2,25× é do Ladino', () => {
    expect(['guerreiro', 'ladino', 'barbaro', 'paladino'].every((classId) => classeRefeita({ classId }))).toBe(true);
    expect(classeRefeita({ classId: 'mago' })).toBe(false);
    expect(classeRefeita({ className: 'Aprendiz' })).toBe(false);
    expect(criticoDaClasse(LADINO)).toBe(2.25);
    expect(criticoDaClasse(GUERREIRO)).toBeUndefined();
  });

  it('o Guerreiro: +25% colado no alvo, o combo soma, e a vida que falta vira resistência', () => {
    expect(bonusDoAtaque(GUERREIRO, {}, longe)).toBe(0);
    expect(bonusDoAtaque(GUERREIRO, { combo: 40 }, { colado: true, chefe: false })).toBe(65);
    expect(resistenciaDaClasse({ ...GUERREIRO, hp: 100, maxHp: 100 }, {})).toBe(0);
    expect(resistenciaDaClasse({ ...GUERREIRO, hp: 91, maxHp: 100 }, {})).toBe(0);
    expect(resistenciaDaClasse({ ...GUERREIRO, hp: 90, maxHp: 100 }, {})).toBe(5);
    expect(resistenciaDaClasse({ ...GUERREIRO, hp: 45, maxHp: 100 }, {})).toBe(25);
  });

  it('o combo do Guerreiro: 3 críticos seguidos somam 20%; um acerto sem crítico zera a contagem e guarda o combo', () => {
    let c = contarAcerto(GUERREIRO, {}, true)!.contadores;
    c = contarAcerto(GUERREIRO, c, true)!.contadores;
    const terceiro = contarAcerto(GUERREIRO, c, true)!;
    expect(terceiro.combo).toBe(20);
    expect(terceiro.contadores).toEqual({ seguidos: 0, combo: 20 });
    const meio = contarAcerto(GUERREIRO, { ...terceiro.contadores, seguidos: 2 }, false)!;
    expect(meio.contadores).toEqual({ seguidos: 0, combo: 20 });
    expect(meio.combo).toBeUndefined();
    // Sem teto.
    expect(contarAcerto(GUERREIRO, { seguidos: 2, combo: 200 }, true)!.combo).toBe(220);
  });

  it('a furtividade do Ladino: a cada 5 críticos; 20% de esquiva até 60%, e depois só o ataque menor; metade contra o chefe', () => {
    let c = {};
    for (let i = 0; i < 4; i++) c = contarAcerto(LADINO, c, true)!.contadores;
    expect(contarAcerto(LADINO, c, false)).toBeNull();
    const quinto = contarAcerto(LADINO, c, true)!;
    expect(quinto.furtividade).toBe(1);
    expect(quinto.contadores).toEqual({ criticos: 0, furtividade: 1 });
    expect(esquivaDaClasse(LADINO, { furtividade: 2 }, false)).toBe(40);
    expect(esquivaDaClasse(LADINO, { furtividade: 5 }, false)).toBe(60);
    expect(bonusDoAtaque(LADINO, { furtividade: 2 }, longe)).toBe(20);
    expect(bonusDoAtaque(LADINO, { furtividade: 5 }, longe)).toBe(40);
    expect(bonusDoAtaque(LADINO, { furtividade: 5 }, { colado: false, chefe: true })).toBe(20);
    expect(esquivaDaClasse(LADINO, { furtividade: 1 }, true)).toBe(10);
    expect(esquivaDaClasse(GUERREIRO, { furtividade: 3 }, false)).toBe(0);
  });

  it('a fúria do Bárbaro: +1 por golpe levado até 15, +13% de dano e +3% de resistência cada, e esfria sem apanhar', () => {
    let c = {};
    for (let i = 0; i < 20; i++) c = contarGolpeLevado(BARBARO, c)!;
    expect(c).toEqual({ furia: REGRAS_DO_BARBARO.tetoDaFuria, calmo: 0 });
    expect(bonusDoAtaque(BARBARO, { furia: 2 }, longe)).toBe(26);
    expect(bonusDoAtaque({ ...BARBARO, equip: { arma: { templateId: 'marreta' } } }, { furia: 2 }, longe)).toBe(46);
    expect(resistenciaDaClasse({ ...BARBARO, hp: 1, maxHp: 100 }, { furia: 4 })).toBe(12);
    expect(esfriar(BARBARO, {})).toBeNull();
    expect(esfriar(BARBARO, { furia: 3, calmo: 10 })).toEqual({ furia: 3, calmo: 11 });
    expect(esfriar(BARBARO, { furia: 3, calmo: REGRAS_DO_BARBARO.calma - 1 })).toEqual({ furia: 1, calmo: 0 });
    expect(esfriar(BARBARO, { furia: 1, calmo: REGRAS_DO_BARBARO.calma - 1 })).toEqual({ furia: 0, calmo: 0 });
    expect(esfriar(GUERREIRO, { furia: 3 })).toBeNull();
  });

  it('o Paladino: a absorção junta 10 por golpe até 300, resiste 20% a partir de 100 e devolve 150% no teto', () => {
    let c = {};
    for (let i = 0; i < 35; i++) c = contarGolpeLevado(PALADINO, c)!;
    expect(c).toEqual({ absorcao: 300 });
    expect(resistenciaDaClasse({ ...PALADINO, hp: 10, maxHp: 10 }, { absorcao: 90 })).toBe(0);
    expect(resistenciaDaClasse({ ...PALADINO, hp: 10, maxHp: 10 }, { absorcao: 100 })).toBe(20);
    expect(devolucaoDaClasse(PALADINO, { absorcao: 290 })).toBe(20);
    expect(devolucaoDaClasse(PALADINO, { absorcao: 300 })).toBe(150);
    expect(devolucaoDaClasse(BARBARO, {})).toBe(0);
    expect(puxaOsMonstros(PALADINO)).toBe(true);
    expect(puxaOsMonstros(GUERREIRO)).toBe(false);
    expect(contarGolpeLevado(LADINO, {})).toBeNull();
  });

  it('a linha embaixo das barras', () => {
    expect(textosDaClasse({ ...GUERREIRO, hp: 100, maxHp: 100 }, { seguidos: 1, combo: 20 })).toEqual(['⚔️ Combo +20% · 1/3']);
    expect(textosDaClasse({ ...GUERREIRO, hp: 50, maxHp: 100 }, {})).toEqual(['⚔️ Combo +0% · 0/3', '🛡️ Resistência 25%']);
    expect(textosDaClasse({ ...LADINO, hp: 1, maxHp: 1 }, { furtividade: 2, criticos: 3 })).toEqual(['🗡️ Furtividade 2 · 3/5']);
    expect(textosDaClasse({ ...BARBARO, hp: 1, maxHp: 1 }, { furia: 7 })).toEqual(['🔥 Fúria 7/15']);
    expect(textosDaClasse({ ...PALADINO, hp: 1, maxHp: 1 }, {})).toEqual(['🛡️ Absorção 0/300']);
    expect(textosDaClasse({ classId: 'mago', hp: 1, maxHp: 1 }, {})).toEqual([]);
  });
});
