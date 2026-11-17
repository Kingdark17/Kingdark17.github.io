import { describe, expect, it } from 'vitest';

import { weaponAtkContribution } from '../combat/damage.js';
import { CLASSES, classById, RACES, DEBUFFS } from './catalog.js';
import {
  alcanceDoHeroi,
  apoiaAliado,
  ataqueDasMaos,
  bonusDoAtaque,
  classeDeLuta,
  classeRefeita,
  CLASSES_DE_LUTA,
  CLASSE_PADRAO,
  contarAcerto,
  contarCriticoNoAliado,
  contarGolpeLevado,
  contarParado,
  criticoDaClasse,
  curaDoApoio,
  custoDaMagia,
  danoDaDistancia,
  devolucaoDaClasse,
  duracaoDaFe,
  efeitosDaMoral,
  forcaDaExplosao,
  manaComAClasse,
  oQueCanaliza,
  passosPorPonto,
  esfriar,
  esquivaDaClasse,
  miraDaClasse,
  mortoVivo,
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

  it('as refeitas (as quatro da 3a e as quatro da 3b) perdem a passiva antiga; o crítico 2,25× é do Ladino', () => {
    expect(['guerreiro', 'ladino', 'barbaro', 'paladino', 'arqueiro', 'bardo', 'clerigo', 'druida'].every((classId) => classeRefeita({ classId }))).toBe(true);
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

describe('as classes de longe e de apoio na luta do app (rodada 3b)', () => {
  it('o Arqueiro: −30% até 2 blocos, sempre; mais longe, parado há 3 s, +12% por bloco até +120%', () => {
    expect(danoDaDistancia(1, 999)).toBe(-30);
    expect(danoDaDistancia(2, 0)).toBe(-30);
    expect(danoDaDistancia(3, 179)).toBe(0);
    expect(danoDaDistancia(3, 180)).toBe(36);
    expect(danoDaDistancia(10, 180)).toBe(120);
    expect(danoDaDistancia(12, 180)).toBe(120);
    expect(bonusDoAtaque({ classId: 'arqueiro' }, { parado: 180 }, { colado: false, chefe: false, blocos: 5 })).toBe(60);
    expect(miraDaClasse({ classId: 'arqueiro' })).toBe(230);
    expect(miraDaClasse({ classId: 'bardo' })).toBe(100);
  });

  it('o tempo parado do Arqueiro: conta até 3 s e zera andando; as outras classes não contam', () => {
    expect(contarParado({ classId: 'arqueiro' }, {}, false)).toEqual({ parado: 1 });
    expect(contarParado({ classId: 'arqueiro' }, { parado: 180 }, false)).toBeNull();
    expect(contarParado({ classId: 'arqueiro' }, { parado: 90 }, true)).toEqual({ parado: 0 });
    expect(contarParado({ classId: 'guerreiro' }, {}, false)).toBeNull();
  });

  it('quem mira no aliado, e quem é morto-vivo', () => {
    expect(['bardo', 'clerigo', 'druida'].every((classId) => apoiaAliado({ classId }))).toBe(true);
    expect(apoiaAliado({ classId: 'arqueiro' })).toBe(false);
    expect(['esqueleto', 'zumbi', 'espectro_gelado'].every(mortoVivo)).toBe(true);
    expect(mortoVivo('slime')).toBe(false);
  });

  it('a moral do grupo soma os degraus (1, 3, 5, 8 e 12)', () => {
    expect(efeitosDaMoral(0)).toEqual({ velocidade: 0, dano: 0, resistencia: 0, semQuebrar: false, critico: 0, faixaCritica: 0 });
    expect(efeitosDaMoral(2)).toEqual({ velocidade: 30, dano: 10, resistencia: 0, semQuebrar: false, critico: 0, faixaCritica: 0 });
    expect(efeitosDaMoral(5)).toEqual({ velocidade: 30, dano: 20, resistencia: 30, semQuebrar: true, critico: 0, faixaCritica: 0 });
    expect(efeitosDaMoral(12)).toEqual({ velocidade: 30, dano: 25, resistencia: 30, semQuebrar: true, critico: 50, faixaCritica: 50 });
  });

  it('5 críticos num aliado sobem a moral, até 12', () => {
    expect(contarCriticoNoAliado({})).toEqual({ moral: { criticos: 1 } });
    expect(contarCriticoNoAliado({ nivel: 2, criticos: 4 })).toEqual({ moral: { nivel: 3, criticos: 0 }, subiu: 3 });
    expect(contarCriticoNoAliado({ nivel: 12, criticos: 0 })).toEqual({ moral: { nivel: 12, criticos: 0 } });
  });

  it('a cura do apoio: o Bardo pela vida que falta, o Clérigo, a Purificação e a fé pela máxima; nunca passa do máximo', () => {
    expect(curaDoApoio('bardo', { hp: 50, maxHp: 150 })).toBe(30);
    expect(curaDoApoio('clerigo', { hp: 50, maxHp: 150 })).toBe(22);
    expect(curaDoApoio('purificar', { hp: 50, maxHp: 150 })).toBe(15);
    expect(curaDoApoio('comunhao', { hp: 50, maxHp: 150 })).toBe(60);
    expect(curaDoApoio('comunhao', { hp: 140, maxHp: 150 })).toBe(10);
    expect(curaDoApoio('bardo', { hp: 149, maxHp: 150 })).toBe(1);
    expect(curaDoApoio('clerigo', { hp: 150, maxHp: 150 })).toBe(0);
  });

  it('a duração do Poder da fé pelo dano dos últimos 30 s: a Comunhão até 50 s, o Santo Egoísta até 40 s', () => {
    expect(duracaoDaFe(true, 120, 2)).toBe(30 * 60);
    expect(duracaoDaFe(true, 9999, 2)).toBe(50 * 60);
    expect(duracaoDaFe(false, 30, 1)).toBe(10 * 60);
    expect(duracaoDaFe(false, 9999, 1)).toBe(40 * 60);
    expect(duracaoDaFe(false, 0, 1)).toBe(0);
  });

  it('a linha embaixo das barras: a mira firme, a fé, a espera do Druida e a moral de quem tiver', () => {
    const vida = { hp: 1, maxHp: 1 };
    expect(textosDaClasse({ classId: 'arqueiro', ...vida }, { parado: 10 })).toEqual(['🏹 Fique parado pra mirar']);
    expect(textosDaClasse({ classId: 'arqueiro', ...vida }, { parado: 180 })).toEqual(['🏹 Mira firme']);
    expect(textosDaClasse({ classId: 'clerigo', ...vida }, {})).toEqual(['✝️ Fé pronta']);
    expect(textosDaClasse({ classId: 'clerigo', ...vida }, {}, { recargaDaFe: 25200 })).toEqual(['✝️ Fé em 7:00']);
    expect(textosDaClasse({ classId: 'clerigo', ...vida }, {}, { fe: 59 })).toEqual(['✝️ Fé 1 s']);
    expect(textosDaClasse({ classId: 'druida', ...vida }, {}, { semAtacar: 1800 })).toEqual(['🌿 Ataque em 30 s']);
    expect(textosDaClasse({ classId: 'druida', ...vida }, {})).toEqual([]);
    expect(textosDaClasse({ classId: 'mago', ...vida }, {}, { moral: 3 })).toEqual(['🎵 Moral 3']);
  });
});

describe('segurar K, o Mago e o Monge (rodada 4a)', () => {
  it('quem canaliza o quê, e o ritmo', () => {
    expect(oQueCanaliza({ classId: 'mago' })).toBe('mana');
    expect(oQueCanaliza({ classId: 'necromante' })).toBe('mana');
    expect(oQueCanaliza({ classId: 'monge' })).toBe('ki');
    expect(oQueCanaliza({ classId: 'guerreiro' })).toBeNull();
    expect(passosPorPonto('mana')).toBe(12);
    expect(passosPorPonto('ki')).toBe(6);
  });

  it('o disparo do Mago na arena custa 40; a mana dele +20% vale em todo lugar', () => {
    expect(custoDaMagia({ classId: 'mago' })).toBe(40);
    expect(custoDaMagia({ classId: 'clerigo' })).toBeUndefined();
    expect(manaComAClasse(100, { classId: 'mago' })).toBe(120);
    expect(manaComAClasse(77, { classId: 'mago' })).toBe(92);
    expect(manaComAClasse(100, { classId: 'clerigo' })).toBe(100);
    const base = { level: 5, attrs: { forca: 5, destreza: 5, constituicao: 5, intelecto: 10, sabedoria: 5, carisma: 5 }, equip: {} };
    expect(derivedStats({ ...base, classId: 'mago' } as never).maxMp).toBe(Math.round(derivedStats(base as never).maxMp * 1.2));
  });

  it('a força da explosão pelo ki: 300 = 1,5; metade, 0,75', () => {
    expect(forcaDaExplosao(300)).toBe(1.5);
    expect(forcaDaExplosao(150)).toBe(0.75);
    expect(forcaDaExplosao(999)).toBe(1.5);
    expect(forcaDaExplosao(0)).toBe(0);
  });

  it('a linha embaixo das barras: o ki do Monge, o revestido e o segurar K', () => {
    const vida = { hp: 1, maxHp: 1 };
    expect(textosDaClasse({ classId: 'monge', ...vida }, {}, { ki: 120 })).toEqual(['☯️ Ki 120/300']);
    expect(textosDaClasse({ classId: 'monge', ...vida }, {}, { revestido: true, canalizando: true })).toEqual(['☯️ Ki 0/300 · Revestido', '🌀 Juntando ki']);
    expect(textosDaClasse({ classId: 'mago', ...vida }, {}, { canalizando: true })).toEqual(['🌀 Puxando mana']);
  });
});
