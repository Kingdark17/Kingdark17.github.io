import { describe, expect, it } from 'vitest';

import { instantiate } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import { seededRng } from '../rng.js';
import { CHANCE_DA_POCAO_DE_REVIVER, POCAO_DE_REVIVER, buyPrice, rollStock } from '../shop/shop.js';
import { randomItem } from '../items/item.js';
import { saveSorteado } from './heroi-sorteado.js';
import { retomarSave } from './estado.js';
import { podeUsar } from './mochila.js';
import { ehFantasma, forcaDaPocao, gastarPocaoDeReviver, levantarSozinho, pocaoDeReviver, reviver } from './dupla.js';

const pocao = () => instantiate(templateById(POCAO_DE_REVIVER)!, RARITIES[0]!, { rng: seededRng(1), now: () => 1 });
const estado = () => retomarSave(saveSorteado('Aria', seededRng(11), seededRng(11)), seededRng(11));

describe('a Pocao de Reviver', () => {
  it('custa 250 de ouro e devolve metade da vida', () => {
    const item = pocao();
    expect(item.value).toBe(250);
    expect(forcaDaPocao(item)).toBe(50);
    expect(buyPrice({ ...estado().hero, derived: { ...estado().hero.derived, descontoLoja: 0 } }, item)).toBe(250);
  });

  it('nao serve em quem a carrega', () => {
    expect(podeUsar(pocao())).toBe(false);
  });

  it('nunca sai num sorteio de item', () => {
    const rng = seededRng(5);
    for (let i = 0; i < 3000; i++) expect(randomItem({ category: 'consumivel', rng, now: () => 1 }).templateId).not.toBe(POCAO_DE_REVIVER);
    for (let i = 0; i < 3000; i++) expect(randomItem({ rng, now: () => 1 }).templateId).not.toBe(POCAO_DE_REVIVER);
  });

  it('so o vendedor do app a tem, e raramente', () => {
    let noApp = 0;
    const vezes = 2000;
    for (let i = 0; i < vezes; i++) {
      const doSite = rollStock('shop', 3, { rng: seededRng(i), now: () => 1 });
      expect(doSite).toHaveLength(5);
      expect(doSite.some((item) => item.templateId === POCAO_DE_REVIVER)).toBe(false);
      expect(rollStock('blacksmith', 3, { rng: seededRng(i), now: () => 1, app: true }).some((item) => item.templateId === POCAO_DE_REVIVER)).toBe(false);
      if (rollStock('shop', 3, { rng: seededRng(i), now: () => 1, app: true }).some((item) => item.templateId === POCAO_DE_REVIVER)) noApp += 1;
    }
    expect(noApp / vezes).toBeGreaterThan(CHANCE_DA_POCAO_DE_REVIVER - 0.04);
    expect(noApp / vezes).toBeLessThan(CHANCE_DA_POCAO_DE_REVIVER + 0.04);
  });
});

describe('o fantasma e quem o levanta', () => {
  it('reviver levanta o caido com a porcentagem da vida maxima', () => {
    const caido = { ...estado().hero, hp: 0, maxHp: 77 };
    expect(ehFantasma(caido)).toBe(true);
    expect(reviver(caido, 50).hp).toBe(38);
    expect(reviver(caido, 0).hp).toBe(1);
    expect(reviver(caido, 900).hp).toBe(77);
  });

  it('quem esta de pe nao muda', () => {
    const dePe = { ...estado().hero, hp: 10, maxHp: 77 };
    expect(reviver(dePe, 50)).toBe(dePe);
    expect(levantarSozinho(dePe)).toBe(dePe);
    expect(ehFantasma(dePe)).toBe(false);
  });

  it('sozinho, o fantasma se levanta com 1 de vida', () => {
    expect(levantarSozinho({ ...estado().hero, hp: 0 }).hp).toBe(1);
  });

  it('gastar tira uma pocao da mochila; sem pocao, nada', () => {
    const base = estado();
    expect(gastarPocaoDeReviver(base)).toBeNull();
    const duas = { ...base, inventory: [...base.inventory, pocao(), { ...pocao(), uid: 'outra' }] };
    expect(pocaoDeReviver(duas.inventory)?.templateId).toBe(POCAO_DE_REVIVER);
    const gasto = gastarPocaoDeReviver(duas)!;
    expect(gasto.porcento).toBe(50);
    expect(gasto.estado.inventory).toHaveLength(base.inventory.length + 1);
    expect(gasto.estado.inventory.some((item) => item.uid === 'outra')).toBe(true);
  });
});
