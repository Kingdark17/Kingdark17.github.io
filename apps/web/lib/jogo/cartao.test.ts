import { describe, expect, it } from 'vitest';

import { buildHero, classById, debuffById, raceById, seededRng, type Hero } from '@rpg-legend/shared';

import { fraquezaNoCartao, poderesNoCartao } from './cartao';
import { montarSaveInicial } from './save-inicial';

const MANA_INSTAVEL = debuffById('mana_instavel')!;

function mago(debuff = MANA_INSTAVEL): Hero {
  return buildHero({ name: 'Aria', race: raceById('humano')!, cls: classById('mago')!, debuff, chosenPowerIds: [] }, seededRng(1));
}

describe('fraquezaNoCartao', () => {
  it('lê o efeito do catálogo, não a cópia que o save gravou', () => {
    const fraqueza = fraquezaNoCartao({ debuff: { ...MANA_INSTAVEL, desc: 'texto de um save antigo' } });

    expect(fraqueza).toEqual({ icone: '💢', nome: 'Mana Instável', efeito: MANA_INSTAVEL.desc });
  });

  it('save do cliente antigo, só com o nome, acha a fraqueza pelo nome', () => {
    const antiga = { name: 'Azarado', icon: '', desc: '' } as Hero['debuff'];

    expect(fraquezaNoCartao({ debuff: antiga })).toEqual({
      icone: '🍂',
      nome: 'Azarado',
      efeito: debuffById('azarado')!.desc,
    });
  });

  it('fraqueza que o catálogo não conhece aparece como o save gravou', () => {
    const estranha = { id: 'sumiu', name: 'Maldição Antiga', icon: '💀', desc: 'Algo que não existe mais.', attr: null };

    expect(fraquezaNoCartao({ debuff: estranha })).toEqual({ icone: '💀', nome: 'Maldição Antiga', efeito: 'Algo que não existe mais.' });
  });

  it('sem fraqueza no save, o cartão não inventa uma', () => {
    expect(fraquezaNoCartao({ debuff: undefined as never })).toBeNull();
  });
});

describe('poderesNoCartao', () => {
  it('o Aprendiz ainda não tem poder', () => {
    const { hero } = montarSaveInicial({ nome: 'Novato', raca: raceById('humano')!, cabelo: null }, seededRng(3));

    expect(poderesNoCartao(hero)).toEqual([]);
  });

  it('o custo é o do botão do combate, com os 20% da Mana Instável', () => {
    const [bolaDeFogo] = poderesNoCartao(mago());

    // 14 de Mana, mais 20%, arredondado pra cima — o que o combate cobra.
    expect(bolaDeFogo).toEqual({ id: 'bola_de_fogo', icone: '🔥', nome: 'Bola de Fogo', custo: 17 });
  });

  it('sem a Mana Instável, o custo é o do catálogo', () => {
    const [bolaDeFogo] = poderesNoCartao(mago(debuffById('azarado')!));

    expect(bolaDeFogo?.custo).toBe(14);
  });
});
