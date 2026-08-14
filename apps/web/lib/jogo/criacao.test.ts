import { describe, expect, it } from 'vitest';

import { CLASSES, DEBUFFS, POWERS, RACES, type Rng } from '@rpg-legend/shared';

import { criacaoVazia, faltaParaComecar, rolarAtributosSePossivel, rolarTudo, sortearPoderes } from './criacao';
import { CriacaoIncompletaError, montarSaveInicial } from './save-inicial';

/** Rng determinístico: sempre o mesmo valor, pra o sorteio ser previsível. */
function rngFixo(valor: number): Rng {
  return () => valor;
}

describe('sortearPoderes', () => {
  it('devolve dois poderes distintos', () => {
    const poderes = sortearPoderes(CLASSES[0], Math.random);
    expect(poderes).toHaveLength(2);
    expect(poderes[0].name).not.toBe(poderes[1].name);
  });

  it('nunca inclui o poder de assinatura da classe, que já vem de graça', () => {
    for (const classe of CLASSES) {
      for (let tentativa = 0; tentativa < 20; tentativa += 1) {
        const nomes = sortearPoderes(classe, Math.random).map((poder) => poder.name);
        expect(nomes).not.toContain(classe.signature);
      }
    }
  });

  it('só sorteia poderes que existem no catálogo', () => {
    const catalogo = new Set(POWERS.map((poder) => poder.name));
    for (const poder of sortearPoderes(CLASSES[1], Math.random)) {
      expect(catalogo.has(poder.name)).toBe(true);
    }
  });
});

describe('rolarAtributosSePossivel', () => {
  it('não rola enquanto faltar raça, classe ou fraqueza', () => {
    const vazia = criacaoVazia('Aria');
    expect(rolarAtributosSePossivel(vazia)).toBeNull();
    expect(rolarAtributosSePossivel({ ...vazia, raca: RACES[0] })).toBeNull();
    expect(rolarAtributosSePossivel({ ...vazia, raca: RACES[0], classe: CLASSES[0] })).toBeNull();
  });

  it('rola quando os três existem', () => {
    const pronta = { ...criacaoVazia('Aria'), raca: RACES[0], classe: CLASSES[0], fraqueza: DEBUFFS[0] };
    const atributos = rolarAtributosSePossivel(pronta, rngFixo(0.5));
    expect(atributos).not.toBeNull();
    expect(Object.values(atributos!).every((valor) => Number.isInteger(valor))).toBe(true);
  });
});

describe('rolarTudo', () => {
  it('preenche tudo de uma vez e preserva o nome digitado', () => {
    const criacao = rolarTudo('Aria', Math.random);

    expect(criacao.nome).toBe('Aria');
    expect(criacao.raca).not.toBeNull();
    expect(criacao.classe).not.toBeNull();
    expect(criacao.fraqueza).not.toBeNull();
    expect(criacao.atributos).not.toBeNull();
    expect(criacao.poderes).toHaveLength(2);
    expect(faltaParaComecar(criacao)).toBeNull();
  });
});

describe('faltaParaComecar', () => {
  it('cobra na ordem em que o jogador resolve', () => {
    expect(faltaParaComecar(criacaoVazia('   '))).toBe('nome');
    expect(faltaParaComecar(criacaoVazia('Aria'))).toBe('raca');
    expect(faltaParaComecar({ ...criacaoVazia('Aria'), raca: RACES[0] })).toBe('classe');
    expect(faltaParaComecar({ ...criacaoVazia('Aria'), raca: RACES[0], classe: CLASSES[0] })).toBe('sorteio');
  });

  it('não libera com só um poder sorteado', () => {
    const quase = rolarTudo('Aria', Math.random);
    expect(faltaParaComecar({ ...quase, poderes: quase.poderes.slice(0, 1) })).toBe('sorteio');
  });
});

describe('montarSaveInicial', () => {
  it('monta um save que atende ao que a API exige de um save válido', () => {
    const save = montarSaveInicial(rolarTudo('Aria', Math.random), Math.random);

    // Mesmas condições de `validSave()` no accounts.js original.
    expect(typeof save.hero.name).toBe('string');
    expect(save.hero.attrs).toBeTruthy();
    expect(save.hero.equip).toBeTruthy();
    expect(Array.isArray(save.inventory)).toBe(true);
    expect(Array.isArray(save.party)).toBe(true);
    expect(save.floor).toBeGreaterThanOrEqual(1);
    expect(save.floor).toBeLessThanOrEqual(10000);
  });

  it('começa no nível 1, com arma da classe e um consumível', () => {
    const save = montarSaveInicial(rolarTudo('Aria', Math.random), Math.random);

    expect(save.hero.level).toBe(1);
    expect(save.hero.equip.arma).toBeTruthy();
    expect(save.inventory).toHaveLength(1);
  });

  it('o poder de assinatura da classe entra sozinho, além dos dois sorteados', () => {
    const criacao = rolarTudo('Aria', Math.random);
    const save = montarSaveInicial(criacao, Math.random);

    expect(save.hero.powerNames).toContain(criacao.classe!.signature);
    expect(save.hero.powerNames).toHaveLength(3);
  });

  it('recusa criação incompleta em vez de gravar lixo', () => {
    expect(() => montarSaveInicial(criacaoVazia('Aria'))).toThrow(CriacaoIncompletaError);
  });

  it('sobrevive a JSON.stringify — é assim que o save viaja pra API', () => {
    const save = montarSaveInicial(rolarTudo('Aria', Math.random), Math.random);
    const ida = JSON.parse(JSON.stringify(save));

    expect(ida.hero.name).toBe(save.hero.name);
    expect(ida.hero.attrs).toEqual(save.hero.attrs);
  });
});
