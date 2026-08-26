import { describe, expect, it } from 'vitest';

import { ARMADURAS, ARMAS, CORPOS, montarCamadas } from './camadas';

/** Onde a peça aparece na pilha, ou -1. Trás para frente. */
function posicao(camadas: string[], trecho: string): number {
  return camadas.findIndex((c) => c.includes(trecho));
}

describe('montarCamadas', () => {
  it('sem raça, ou raça sem corpo, não há o que desenhar', () => {
    expect(montarCamadas({ raca: null })).toEqual([]);
    expect(montarCamadas({ raca: 'anao' })).toEqual([]);
  });

  it('a raça nua já vem vestida com o básico', () => {
    expect(montarCamadas({ raca: 'humano' })).toEqual([
      '/img/paperdoll/corpo/humano.png',
      '/img/paperdoll/base/calca.png',
      '/img/paperdoll/base/roupa.png',
      '/img/paperdoll/cabelo/masculino.png',
    ]);
  });

  it('só entra o que tem arte — o resto some sem quebrar', () => {
    const comArte = montarCamadas({ raca: 'humano', arma: 'espada', armadura: 'placas', secundaria: 'escudo' });
    expect(posicao(comArte, 'arma/espada')).toBeGreaterThan(-1);

    // `marreta` e `couro` existem como item e não têm camada.
    const semArte = montarCamadas({ raca: 'humano', arma: 'marreta', armadura: 'couro' });
    expect(posicao(semArte, 'arma/')).toBe(-1);
    expect(posicao(semArte, 'armadura/')).toBe(-1);
    expect(ARMAS.has('marreta')).toBe(false);
    expect(ARMADURAS.has('couro')).toBe(false);
  });

  it('felino e morto-vivo não levam cabelo humano por cima', () => {
    expect(posicao(montarCamadas({ raca: 'felino' }), 'cabelo/')).toBe(-1);
    expect(posicao(montarCamadas({ raca: 'morto_vivo' }), 'cabelo/')).toBe(-1);
  });

  describe('traço da raça', () => {
    it('o felino leva as orelhas; quem não tem traço não ganha camada extra', () => {
      expect(posicao(montarCamadas({ raca: 'felino' }), 'orelhas-de-gato')).toBeGreaterThan(-1);
      expect(posicao(montarCamadas({ raca: 'humano' }), 'orelhas-de-gato')).toBe(-1);
    });

    /**
     * O motivo de a camada existir.
     *
     * A armadura de placas tem capacete. Desenhada por último, ela cobre a
     * cabeça — e o felino de armadura ficaria indistinguível do humano de
     * armadura. A pessoa escolheu a raça e a perderia de vista exatamente
     * quando o personagem fica mais forte.
     */
    it('as orelhas ficam POR CIMA da armadura — é o ponto inteiro', () => {
      const camadas = montarCamadas({ raca: 'felino', armadura: 'placas' });
      expect(posicao(camadas, 'orelhas-de-gato')).toBeGreaterThan(posicao(camadas, 'armadura/placas'));
    });

    /** Escudo e arma são objetos segurados na frente do corpo. */
    it('mas por baixo do que a mão segura', () => {
      const camadas = montarCamadas({ raca: 'felino', armadura: 'placas', secundaria: 'escudo', arma: 'espada' });
      const orelhas = posicao(camadas, 'orelhas-de-gato');
      expect(orelhas).toBeLessThan(posicao(camadas, 'secundaria/escudo'));
      expect(orelhas).toBeLessThan(posicao(camadas, 'arma/espada'));
    });

    /**
     * Virão outras raças com traço. Se alguém acrescentar uma sem corpo
     * desenhado, ela não pode aparecer flutuando: a guarda de `CORPOS` vem
     * antes de tudo e este teste prende isso.
     */
    it('traço sem corpo não desenha nada', () => {
      for (const raca of ['anao', 'orc', 'draconato', 'goblin', 'fada', 'celestial']) {
        expect(CORPOS.has(raca)).toBe(false);
        expect(montarCamadas({ raca })).toEqual([]);
      }
    });
  });
});
