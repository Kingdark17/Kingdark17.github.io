import { describe, expect, it } from 'vitest';

import { seededRng, type Rng } from '../rng.js';
import { rollStock } from '../shop/shop.js';
import { displayName, instantiate, randomItem, type Item } from './item.js';
import { chancesDoDegrau, multiplicadorDoDegrau, nomeComMaterial, sortearDegrau } from './materiais.js';
import { rarityById, type Rarity } from './rarity.js';
import { templateById, type ItemTemplate } from './templates.js';

const t = (id: string): ItemTemplate => templateById(id)!;
const raro = rarityById('raro') as Rarity;
const comum = rarityById('comum') as Rarity;

function sequencia(valores: number[]): Rng {
  let i = 0;
  return () => (i < valores.length ? (valores[i++] as number) : 0);
}

describe('a escada', () => {
  it('cada degrau acima do primeiro soma 25% na base', () => {
    expect([1, 2, 3].map(multiplicadorDoDegrau)).toEqual([1, 1.25, 1.5]);
  });

  it('a chance cresce com o andar: o 2 a partir do 5, o 3 a partir do 25', () => {
    expect(chancesDoDegrau(1)).toEqual({ dois: 0, tres: 0 });
    expect(chancesDoDegrau(5)).toEqual({ dois: 0, tres: 0 });
    expect(chancesDoDegrau(50)).toEqual({ dois: 0.4, tres: 0.075 });
    expect(chancesDoDegrau(75)).toEqual({ dois: 0.4, tres: 0.15 });
    expect(chancesDoDegrau(300)).toEqual({ dois: 0.4, tres: 0.15 });
  });

  it('o chefe dobra as duas, sem passar de 1 juntas', () => {
    const { dois, tres } = chancesDoDegrau(75, true);
    expect(tres).toBe(0.3);
    expect(dois).toBe(0.7);
  });

  it('o sorteio: primeiro o 3, depois o 2; o teto da loja vira o 3 em 2', () => {
    expect(sortearDegrau(75, false, sequencia([0.1]))).toBe(3);
    expect(sortearDegrau(75, false, sequencia([0.2]))).toBe(2);
    expect(sortearDegrau(75, false, sequencia([0.6]))).toBe(1);
    expect(sortearDegrau(75, false, sequencia([0.1]), 2)).toBe(2);
  });
});

describe('o nome', () => {
  it('o primeiro degrau é a peça de hoje; os outros ganham "de" e o material', () => {
    expect(nomeComMaterial(t('espada'), 1)).toBe('Espada');
    expect(nomeComMaterial(t('espada'), 2)).toBe('Espada de Aço');
    expect(nomeComMaterial(t('arco'), 3)).toBe('Arco Longo de Madeira Élfica');
    expect(nomeComMaterial(t('robe_chapeu'), 2)).toBe('Chapéu de Mago de Seda');
  });

  it('quem já tem o material de hoje no nome troca ele', () => {
    expect(nomeComMaterial(t('escudo'), 2)).toBe('Escudo de Ébano');
    expect(nomeComMaterial(t('couro'), 3)).toBe('Armadura de Couro de Dragão');
    expect(nomeComMaterial(t('botas'), 2)).toBe('Botas de Couro Reforçado');
  });

  it('acessório não tem material', () => {
    expect(nomeComMaterial(t('anel_som'), 3)).toBe('Anel das Sombras');
  });

  it('a raridade vem depois, concordando com a peça', () => {
    expect(displayName({ templateId: 'espada', rarity: 'raro', degrau: 2 })).toBe('Espada de Aço Rara');
    expect(displayName({ templateId: 'botas', rarity: 'raro', degrau: 3 })).toBe('Botas de Couro de Dragão Raras');
    expect(displayName({ templateId: 'espada', rarity: 'comum' })).toBe('Espada');
  });
});

describe('a peça com material', () => {
  const agora = () => 1_700_000_000_000;

  it('a base sobe antes da raridade: Espada Rara 7, 9 e 10', () => {
    const ataque = [1, 2, 3].map((degrau) => instantiate(t('espada'), raro, { rng: () => 0, now: agora, degrau }).stats.ataque);
    expect(ataque).toEqual([7, 9, 10]);
  });

  it('o primeiro degrau é a peça de sempre, sem o campo', () => {
    const sem = instantiate(t('espada'), raro, { rng: () => 0, now: agora });
    const um = instantiate(t('espada'), raro, { rng: () => 0, now: agora, degrau: 1 });
    expect(um).toEqual(sem);
    expect('degrau' in sem).toBe(false);
  });

  it('o valor sobe junto; a penalidade fica como está', () => {
    const machado = instantiate(t('machado'), comum, { rng: () => 0, now: agora, degrau: 3 });
    expect(machado.stats).toEqual({ ataque: 9, velocidade: -1 });
    expect(machado.value).toBe(39);
    expect(machado.degrau).toBe(3);
  });

  it('acessório ignora o degrau', () => {
    const anel = instantiate(t('anel_som'), comum, { rng: () => 0, now: agora, degrau: 3 });
    expect(anel).toEqual(instantiate(t('anel_som'), comum, { rng: () => 0, now: agora }));
  });
});

describe('o que cai', () => {
  const agora = () => 1_700_000_000_000;
  const varios = (n: number, opcoes: (i: number) => Parameters<typeof randomItem>[0]): Item[] => Array.from({ length: n }, (_, i) => randomItem(opcoes(i)));

  it('sem `app` (o site), nada muda e nada sobe de degrau', () => {
    for (let i = 1; i <= 40; i++) {
      const site = randomItem({ floor: 90, rng: seededRng(i), now: agora });
      const explicito = randomItem({ floor: 90, rng: seededRng(i), now: agora, app: false });
      expect(explicito).toEqual(site);
      expect(site.degrau).toBeUndefined();
    }
  });

  it('no app, no fundo da masmorra sai aço e aço mágico; no andar 1, nunca', () => {
    const fundo = varios(400, (i) => ({ category: 'arma', floor: 90, rng: seededRng(1000 + i), now: agora, app: true }));
    expect(fundo.some((item) => item.degrau === 2)).toBe(true);
    expect(fundo.some((item) => item.degrau === 3)).toBe(true);
    const raso = varios(200, (i) => ({ category: 'arma', floor: 1, rng: seededRng(2000 + i), now: agora, app: true }));
    expect(raso.every((item) => item.degrau === undefined)).toBe(true);
  });

  it('o chefe dá mais degrau alto', () => {
    const contar = (chefe: boolean) =>
      varios(600, (i) => ({ category: 'armadura', floor: 80, rng: seededRng(3000 + i), now: agora, app: true, chefe })).filter((item) => (item.degrau ?? 1) > 1).length;
    expect(contar(true)).toBeGreaterThan(contar(false));
  });

  it('a loja do app vende até o degrau 2; a do site, só o primeiro', () => {
    const doApp = Array.from({ length: 80 }, (_, i) => rollStock('blacksmith', 90, { rng: seededRng(4000 + i), now: agora, app: true })).flat();
    expect(doApp.some((item) => item.degrau === 2)).toBe(true);
    expect(doApp.some((item) => item.degrau === 3)).toBe(false);
    const doSite = Array.from({ length: 80 }, (_, i) => rollStock('blacksmith', 90, { rng: seededRng(4000 + i), now: agora })).flat();
    expect(doSite.every((item) => item.degrau === undefined)).toBe(true);
  });
});
