import { describe, expect, it } from 'vitest';

import { seededRng, xpForLevel } from '@rpg-legend/shared';

import { abrirAdm, aplicar, fichaDe, modoInfinito } from './adm';
import { rolarTudo } from './criacao';
import { entrarNaCidade, type EstadoNaCidade } from './estado';
import { montarSaveInicial } from './save-inicial';

function cidade(): EstadoNaCidade {
  const rng = seededRng(7);
  return entrarNaCidade(montarSaveInicial(rolarTudo('Aria', rng), rng));
}

const RNG = seededRng(3);

describe('fichaDe', () => {
  it('leva o herói pra ficha sem inventar campo', () => {
    const estado = cidade();
    const ficha = fichaDe(estado.hero);

    expect(ficha.hp).toBe(estado.hero.hp);
    expect(ficha.forca).toBe(estado.hero.attrs.forca);
    expect(ficha.attrPoints).toBe(estado.hero.attrPoints ?? 0);
  });
});

describe('aplicar', () => {
  it('grava atributo, ouro e nível, e refaz o XP do próximo nível', () => {
    const adm = abrirAdm(cidade());
    const depois = aplicar(adm, { ...fichaDe(adm.estado.hero), forca: 30, gold: 777, level: 9 });

    expect(depois.estado.hero.attrs.forca).toBe(30);
    expect(depois.estado.hero.gold).toBe(777);
    expect(depois.estado.hero.level).toBe(9);
    expect(depois.estado.hero.xpNext).toBe(xpForLevel(9));
  });

  it('a vida máxima digitada manda por cima do cálculo automático', () => {
    const adm = abrirAdm(cidade());
    const depois = aplicar(adm, { ...fichaDe(adm.estado.hero), constituicao: 40, maxHp: 12, hp: 12 });

    expect(depois.estado.hero.maxHp).toBe(12);
    expect(depois.estado.hero.derived.maxHp).toBe(12);
  });

  it('vida atual não passa da máxima', () => {
    const adm = abrirAdm(cidade());
    const depois = aplicar(adm, { ...fichaDe(adm.estado.hero), maxHp: 50, hp: 9999 });

    expect(depois.estado.hero.hp).toBe(50);
  });

  it('número negativo ou vazio cai no piso em vez de quebrar o herói', () => {
    const adm = abrirAdm(cidade());
    const depois = aplicar(adm, { ...fichaDe(adm.estado.hero), forca: -5, gold: -100, level: 0, xp: Number.NaN });

    expect(depois.estado.hero.attrs.forca).toBe(1);
    expect(depois.estado.hero.gold).toBe(0);
    expect(depois.estado.hero.level).toBe(1);
    expect(depois.estado.hero.xp).toBe(0);
  });

  it('mexe só no herói: mapa, posição e missões ficam onde estavam', () => {
    const adm = abrirAdm(cidade());
    const depois = aplicar(adm, { ...fichaDe(adm.estado.hero), gold: 1 });

    expect(depois.estado.map).toBe(adm.estado.map);
    expect(depois.estado.pos).toBe(adm.estado.pos);
    expect(depois.estado.quests).toBe(adm.estado.quests);
  });
});

describe('modoInfinito', () => {
  it('põe atributo, vida e ouro no talo', () => {
    const depois = modoInfinito(abrirAdm(cidade()), RNG);

    expect(depois.estado.hero.attrs.forca).toBe(999);
    expect(depois.estado.hero.hp).toBe(999_999);
    expect(depois.estado.hero.gold).toBe(999_999_999);
  });

  it('dá uma cópia mítica de cada equipamento e 20 de cada consumível', () => {
    const depois = modoInfinito(abrirAdm(cidade()), RNG);
    const miticos = depois.estado.inventory.filter((item) => item.rarity === 'mitico');
    const pocoes = depois.estado.inventory.filter((item) => item.templateId === 'pot_vida');

    expect(miticos.length).toBeGreaterThan(0);
    expect(pocoes).toHaveLength(20);
  });

  it('clicar de novo não duplica a mochila', () => {
    const uma = modoInfinito(abrirAdm(cidade()), RNG);
    const duas = modoInfinito(uma, RNG);

    expect(duas.estado.inventory).toHaveLength(uma.estado.inventory.length);
  });
});
