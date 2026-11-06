import { describe, expect, it } from 'vitest';

import { OURO_DA_TAVERNA_POR_NIVEL } from '../city/city.js';
import { monsterGroupSize } from '../dungeon/generate.js';
import { instantiate } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import { ENDURECIMENTO_DO_CHEFE, generate, generateBoss } from '../monsters/generate.js';
import { seededRng } from '../rng.js';
import { buyPrice, SOBREPRECO_DA_POCAO } from '../shop/shop.js';
import { criacaoVazia } from './criacao.js';
import { entrarNaCidade, retomarSave, type EstadoNaCidade } from './estado.js';
import { saveSorteado } from './heroi-sorteado.js';
import { interagir } from './sala.js';

/** A dificuldade do personagem e o "deixar mais difícil" do doc do Breno de 2026-11-06. */

function naTaverna(ouro: number, nivel = 4): EstadoNaCidade {
  const cidade = entrarNaCidade(saveSorteado('Aria', seededRng(4)));
  const taverna = cidade.map.flat().find((c) => c.type === 'tavern')!;
  return { ...cidade, hero: { ...cidade.hero, level: nivel, gold: ouro, hp: 1, mp: 0 }, pos: { x: taverna.x, y: taverna.y } };
}

describe('a dificuldade multiplica os monstros, sem pagar mais', () => {
  it('o mesmo monstro no Pesadelo tem 60% mais vida e dano, e o mesmo ouro e XP', () => {
    const normal = generate(10, { rng: seededRng(1) });
    const pesadelo = generate(10, { rng: seededRng(1), dificuldade: 'pesadelo' });
    expect(pesadelo.speciesId).toBe(normal.speciesId);
    expect(pesadelo.hp / normal.hp).toBeCloseTo(1.6, 1);
    expect(pesadelo.dmg / normal.dmg).toBeCloseTo(1.6, 0);
    expect(pesadelo.gold).toBe(normal.gold);
    expect(pesadelo.xp).toBe(normal.xp);
  });

  it('o chefe leva mais 30% por cima do de todos', () => {
    const chefe = generateBoss(10, { rng: seededRng(2) });
    expect(ENDURECIMENTO_DO_CHEFE).toBe(1.3);
    expect(generateBoss(10, { rng: seededRng(2), dificuldade: 'dificil' }).hp / chefe.hp).toBeCloseTo(1.25, 1);
  });
});

describe('grupos maiores', () => {
  it('grupo de 4 só a partir do andar de força 30', () => {
    const sempre = () => 0;
    expect(monsterGroupSize(29, sempre)).toBe(3);
    expect(monsterGroupSize(30, sempre)).toBe(4);
  });
});

describe('menos cura', () => {
  it('a poção custa 50% a mais, e o pergaminho não', () => {
    const heroi = entrarNaCidade(saveSorteado('Aria', seededRng(4))).hero;
    const comum = RARITIES[0]!;
    const pocao = instantiate(templateById('pot_vida')!, comum, { rng: seededRng(1), now: () => 1 });
    const pergaminho = instantiate(templateById('pergaminho')!, comum, { rng: seededRng(1), now: () => 1 });
    expect(SOBREPRECO_DA_POCAO).toBe(1.5);
    expect(buyPrice(heroi, pocao)).toBe(Math.round(pocao.value * 1.5 * (1 - (heroi.derived.descontoLoja || 0) / 100)));
    expect(buyPrice(heroi, pergaminho)).toBe(Math.max(1, Math.round(pergaminho.value * (1 - (heroi.derived.descontoLoja || 0) / 100))));
  });

  it('a taverna cobra 5 de ouro por nível, e sem o ouro não dá pra dormir', () => {
    const pago = interagir(naTaverna(100, 4));
    expect(pago.estado.hero.gold).toBe(100 - OURO_DA_TAVERNA_POR_NIVEL * 4);
    expect(pago.estado.hero.hp).toBe(pago.estado.hero.maxHp);

    const semOuro = interagir(naTaverna(19, 4));
    expect(semOuro.estado.hero.hp).toBe(1);
    expect(semOuro.aviso?.texto).toContain('20 de ouro');
  });
});

describe('a dificuldade do personagem', () => {
  it('a criação começa no Normal', () => {
    expect(criacaoVazia('Aria').dificuldade).toBe('normal');
  });

  it('o save de antes dela é Normal, e a descida segue no Normal mesmo que ele estivesse num Difícil', () => {
    const save = { ...saveSorteado('Aria', seededRng(4)), dificuldade: undefined, masmorra: { dungeon: 'caverna', difficulty: 'dificil' } as const };
    const estado = retomarSave(save, seededRng(1));
    expect(estado.dificuldade).toBe('normal');
    expect(estado.masmorra).toEqual({ dungeon: 'caverna', difficulty: 'normal' });
  });

  it('quem nasceu no Pesadelo continua nele', () => {
    const estado = retomarSave({ ...saveSorteado('Aria', seededRng(4)), dificuldade: 'pesadelo' }, seededRng(1));
    expect(estado.dificuldade).toBe('pesadelo');
    expect(estado.masmorra.difficulty).toBe('pesadelo');
  });
});
