import { describe, expect, it } from 'vitest';

import { classById, DEBUFFS, raceById } from '../hero/catalog.js';
import { buildApprentice, buildHero, type Hero } from '../hero/hero.js';
import { instantiate } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import { seededRng } from '../rng.js';
import { armasDaMaestria, maestriaNoCartao, maestriaSubiu } from './maestria.js';

const SEM_DEBUFF = DEBUFFS.find((d) => !d.effect)!;
const HUMANO = raceById('humano')!;

function heroi(classe: string, masteryBattles: number, arma?: string): Hero {
  const pronto = buildHero({ name: 'Aria', race: HUMANO, cls: classById(classe)!, debuff: SEM_DEBUFF, chosenPowerIds: [] }, seededRng(1));
  const equip = arma === undefined ? pronto.equip : { ...pronto.equip, arma: { ...instantiate(templateById(arma)!, RARITIES[0]!), equipped: true } };
  return { ...pronto, equip, masteryBattles };
}

describe('armasDaMaestria', () => {
  it('diz a arma pela primeira palavra do nome, em minúscula', () => {
    expect(armasDaMaestria(heroi('guerreiro', 0))).toBe('espada');
    expect(armasDaMaestria(heroi('clerigo', 0))).toBe('maça');
  });

  it('junta as duas de quem domina duas', () => {
    expect(armasDaMaestria(heroi('barbaro', 0))).toBe('machado ou marreta');
    expect(armasDaMaestria(heroi('bardo', 0))).toBe('adaga ou violão');
  });

  it('o Aprendiz não tem', () => {
    expect(armasDaMaestria(buildApprentice({ name: 'A', race: HUMANO, debuff: SEM_DEBUFF }, seededRng(1)))).toBe('');
  });
});

describe('maestriaNoCartao', () => {
  it('o Aprendiz não tem medidor de maestria', () => {
    expect(maestriaNoCartao(buildApprentice({ name: 'A', race: HUMANO, debuff: SEM_DEBUFF }, seededRng(1)))).toBeNull();
  });

  it('no nível 0 diz quanto cada nível vai dar', () => {
    expect(maestriaNoCartao(heroi('guerreiro', 4))).toEqual({
      nivel: 0,
      atual: 4,
      maximo: 10,
      contagem: '4/10',
      bonus: '+2% de dano por nível, com espada',
    });
  });

  it('com a arma da classe na mão, o bônus vale', () => {
    // A espada é a arma inicial do guerreiro, então ele já começa com ela.
    expect(maestriaNoCartao(heroi('guerreiro', 35))).toMatchObject({ nivel: 2, contagem: '5/30', bonus: '+4% de dano com espada' });
  });

  it('com outra arma, avisa que o bônus depende da arma da classe', () => {
    expect(maestriaNoCartao(heroi('guerreiro', 35, 'machado'))?.bonus).toBe('+4% de dano só com espada');
  });

  it('no teto a barra sai cheia e diz "máx."', () => {
    expect(maestriaNoCartao(heroi('guerreiro', 700))).toMatchObject({ nivel: 10, atual: 1, maximo: 1, contagem: 'máx.', bonus: '+20% de dano com espada' });
  });
});

describe('maestriaSubiu', () => {
  it('diz a classe, o nível e o bônus', () => {
    expect(maestriaSubiu(heroi('barbaro', 30), 2)).toBe('Sua maestria de Bárbaro chegou ao nível 2: +4% de dano com machado ou marreta.');
  });
});
