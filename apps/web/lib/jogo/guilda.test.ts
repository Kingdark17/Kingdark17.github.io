import { describe, expect, it } from 'vitest';

import { classById, hasClass, heroPowers, instantiate, raceById, RARITIES, seededRng, templateById } from '@rpg-legend/shared';

import { entrarNaCidade } from './estado';
import { abrirGuilda, treinar } from './guilda';
import { saveSorteado } from './heroi-sorteado';
import { montarSaveInicial } from './save-inicial';

const MAGO = classById('mago')!;

function guildaDoAprendiz() {
  return abrirGuilda(entrarNaCidade(montarSaveInicial({ nome: 'Novato', raca: raceById('humano')!, cabelo: null }, seededRng(7))));
}

describe('treinar', () => {
  it('o Aprendiz sai da classe escolhida, com o poder dela, e a guilda conta', () => {
    const depois = treinar(guildaDoAprendiz(), MAGO);
    const { hero } = depois.estado;

    expect(hasClass(hero)).toBe(true);
    expect(hero.className).toBe('Mago');
    expect(hero.equip.arma?.templateId).toBe('cajado');
    expect(heroPowers(hero).map((poder) => poder.id)).toEqual(['bola_de_fogo']);
    expect(depois.log[0]).toBe('Você treina como Mago e aprende Bola de Fogo.');
  });

  it('a arma inicial que não cabe na mão vai pra mochila, e a guilda avisa', () => {
    const guilda = guildaDoAprendiz();
    const adaga = { ...instantiate(templateById('adaga')!, RARITIES[0]!), equipped: true };
    const armada = { ...guilda, estado: { ...guilda.estado, hero: { ...guilda.estado.hero, equip: { ...guilda.estado.hero.equip, arma: adaga } } } };

    const depois = treinar(armada, MAGO);

    expect(depois.estado.inventory.map((item) => item.templateId)).toContain('cajado');
    expect(depois.log[1]).toContain('vai para a mochila');
  });

  it('quem já tem classe não troca', () => {
    const guilda = abrirGuilda(entrarNaCidade(saveSorteado('Aria', seededRng(1))));
    const depois = treinar(guilda, MAGO);

    expect(depois.estado).toBe(guilda.estado);
    expect(depois.log[0]).toBe(`Você já treinou como ${guilda.estado.hero.className}.`);
  });
});
