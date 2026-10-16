import { describe, expect, it } from 'vitest';

import { DEBUFFS, raceById } from '../hero/catalog.js';
import { APPRENTICE, BASE_ATTR, hasClass, heroPowers } from '../hero/hero.js';
import { seededRng } from '../rng.js';
import { criacaoVazia, faltaParaComecar, type Criacao } from './criacao.js';
import { CriacaoIncompletaError, montarSaveInicial } from './save-inicial.js';

const ORC = raceById('orc')!;

function pronta(extra: Partial<Criacao> = {}): Criacao {
  return { ...criacaoVazia('Aria'), raca: ORC, ...extra };
}

describe('faltaParaComecar', () => {
  it('cobra só nome e raça, nessa ordem', () => {
    expect(faltaParaComecar(criacaoVazia('   '))).toBe('nome');
    expect(faltaParaComecar(criacaoVazia('Aria'))).toBe('raca');
    expect(faltaParaComecar(pronta())).toBeNull();
  });

  it('cabelo não trava o começo: começa no padrão', () => {
    expect(faltaParaComecar(pronta({ cabelo: null }))).toBeNull();
  });
});

describe('montarSaveInicial', () => {
  it('monta um save que atende ao que a API exige de um save válido', () => {
    const save = montarSaveInicial(pronta(), Math.random);

    // Mesmas condições de `validSave()` no accounts.js original.
    expect(typeof save.hero.name).toBe('string');
    expect(save.hero.attrs).toBeTruthy();
    expect(save.hero.equip).toBeTruthy();
    expect(Array.isArray(save.inventory)).toBe(true);
    expect(Array.isArray(save.party)).toBe(true);
    expect(save.floor).toBeGreaterThanOrEqual(1);
    expect(save.floor).toBeLessThanOrEqual(10000);
  });

  it('nasce Aprendiz: nível 1, sem classe, sem arma, sem poder e com um consumível', () => {
    const { hero, inventory } = montarSaveInicial(pronta(), Math.random);

    expect(hero.level).toBe(1);
    expect(hasClass(hero)).toBe(false);
    expect(hero.className).toBe(APPRENTICE.name);
    expect(hero.equip.arma).toBeNull();
    expect(heroPowers(hero)).toEqual([]);
    expect(inventory).toHaveLength(1);
  });

  it('atributos sem sorteio: 8 em tudo, mais a raça, menos o ponto da fraqueza', () => {
    for (let semente = 0; semente < 40; semente += 1) {
      const { hero } = montarSaveInicial(pronta(), seededRng(semente));
      const esperado: Record<string, number> = {
        forca: BASE_ATTR + 3,
        destreza: BASE_ATTR,
        constituicao: BASE_ATTR,
        intelecto: BASE_ATTR - 1,
        sabedoria: BASE_ATTR,
        carisma: BASE_ATTR,
      };
      if (hero.debuff.attr) esperado[hero.debuff.attr] -= 1;
      expect(hero.attrs).toEqual(esperado);
    }
  });

  it('a fraqueza continua, sorteada do catálogo', () => {
    const ids = new Set(DEBUFFS.map((fraqueza) => fraqueza.id));
    const sorteadas = new Set<string>();
    for (let semente = 0; semente < 60; semente += 1) {
      const { hero } = montarSaveInicial(pronta(), seededRng(semente));
      expect(ids.has(hero.debuff.id)).toBe(true);
      sorteadas.add(hero.debuff.id);
    }
    expect(sorteadas.size).toBeGreaterThan(1);
  });

  it('grava o cabelo só quando a pessoa escolheu', () => {
    expect(montarSaveInicial(pronta({ cabelo: 'longo' }), Math.random).hero.hair).toBe('longo');
    expect(montarSaveInicial(pronta(), Math.random).hero).not.toHaveProperty('hair');
  });

  it('recusa criação sem raça em vez de gravar lixo', () => {
    expect(() => montarSaveInicial(criacaoVazia('Aria'))).toThrow(CriacaoIncompletaError);
  });

  it('sobrevive a JSON.stringify — é assim que o save viaja pra API', () => {
    const save = montarSaveInicial(pronta(), Math.random);
    const ida = JSON.parse(JSON.stringify(save));

    expect(ida.hero.name).toBe(save.hero.name);
    expect(ida.hero.attrs).toEqual(save.hero.attrs);
  });
});
