import { describe, expect, it } from 'vitest';

import { ENCANTADORA_POS, generateCityLayout, withEncantadora } from '../city/city.js';
import { landHitOnHero } from '../combat/monster-hit.js';
import { freshCombatMonster } from '../combat/monster-state.js';
import type { Hero } from '../hero/hero.js';
import { abrirEncantadora, encantar, pecasParaEncantar } from '../jogo/encantadora.js';
import { entrarNaCidade, type EstadoNaCidade } from '../jogo/estado.js';
import { saveSorteado } from '../jogo/heroi-sorteado.js';
import { abrirMochila, equipar } from '../jogo/mochila.js';
import { interagir } from '../jogo/sala.js';
import { monsterView } from '../monsters/generate.js';
import { seededRng, type Rng } from '../rng.js';
import {
  custoDoEncantamento,
  defesasDoHeroi,
  efeitoDoEncantamento,
  encantarPeca,
  escudoDoVigor,
  nomeDoEncantamento,
  podeEncantar,
} from './encantamentos.js';
import { instantiate, type EncantamentoId, type Item } from './item.js';
import { rarityById, type Rarity } from './rarity.js';
import { templateById } from './templates.js';

const agora = () => 1_700_000_000_000;
const sempre = (valor: number): Rng => () => valor;
const peca = (id: string): Item => instantiate(templateById(id)!, rarityById('comum') as Rarity, { rng: () => 0, now: agora });
const encantada = (id: string, tipo: EncantamentoId, nivel: number): Item => ({ ...peca(id), encantamento: { tipo, nivel }, equipped: true });

/** Uma cidade de herói sorteado, com as peças vestidas por cima do que ele tinha. */
function cidadeCom(pecas: Item[], ouro = 1000): EstadoNaCidade {
  let mochila = abrirMochila(entrarNaCidade(saveSorteado('Aria', seededRng(11), seededRng(11))));
  mochila = { ...mochila, estado: { ...mochila.estado, inventory: [...mochila.estado.inventory, ...pecas] } };
  for (const p of pecas) mochila = equipar(mochila, p);
  const estado = mochila.estado as EstadoNaCidade;
  return { ...estado, hero: { ...estado.hero, gold: ouro } };
}

function heroiCom(pecas: Item[]): Hero {
  const hero = cidadeCom(pecas).hero;
  // Sem esquiva, o golpe sempre pega: o teste é sobre o que vem depois.
  return { ...hero, derived: { ...hero.derived, esquiva: 0 } };
}

const bicho = (speciesId: string) =>
  monsterView(freshCombatMonster({ speciesId, enemyClassId: 'brutamontes', floor: 2, hp: 100, maxHp: 100, dmg: 30, speed: 5, xp: 12, gold: 7, isBoss: false }));

describe('a fortificação', () => {
  it('só entra em armadura (o escudo é armadura; as Botas do Vento são acessório)', () => {
    for (const id of ['escudo', 'placas', 'placas_elmo', 'robe_calca', 'botas']) expect(podeEncantar(peca(id))).toBe(true);
    for (const id of ['espada', 'cajado', 'bota_vento', 'anel_som', 'pot_vida']) expect(podeEncantar(peca(id))).toBe(false);
    expect(encantarPeca(peca('espada'), 'robustez', 1)).toBeNull();
  });

  it('tem nome, preço e efeito por nível', () => {
    expect(nomeDoEncantamento({ tipo: 'robustez', nivel: 2 })).toBe('Robustez II');
    expect(nomeDoEncantamento({ tipo: 'resistencia_magica', nivel: 9 })).toBe('Resistência Mágica III');
    expect([1, 2, 3].map(custoDoEncantamento)).toEqual([100, 300, 800]);
    expect(efeitoDoEncantamento('resistencia_magica', 1)).toBe('-15% de dano dos monstros mágicos, e 25% de chance de evitar o dreno de mana.');
    expect(efeitoDoEncantamento('vigor', 3)).toBe('No começo de cada luta, um escudo de 20% da vida máxima, que apanha primeiro.');
  });

  it('encantar de novo troca a que havia', () => {
    const uma = encantarPeca(peca('placas'), 'robustez', 1)!;
    expect(encantarPeca(uma, 'vigor', 3)!.encantamento).toEqual({ tipo: 'vigor', nivel: 3 });
  });

  it('as peças vestidas somam por tipo, até o teto', () => {
    const defesas = defesasDoHeroi(
      heroiCom([encantada('placas', 'robustez', 3), encantada('placas_elmo', 'robustez', 3), encantada('botas', 'robustez', 2), encantada('escudo', 'resistencia_magica', 3)]),
    );
    expect(defesas).toEqual({ robustez: 0.3, resistenciaMagica: 0.35, evitaDreno: 0.75, resistenciaVeneno: 0, vigor: 0 });
    expect(defesasDoHeroi(heroiCom([peca('placas')]))).toEqual({ robustez: 0, resistenciaMagica: 0, evitaDreno: 0, resistenciaVeneno: 0, vigor: 0 });
  });

  it('o vigor vira escudo: a fração da vida máxima, arredondada', () => {
    const hero = heroiCom([encantada('placas', 'vigor', 3), encantada('botas', 'vigor', 1)]);
    expect(escudoDoVigor(hero)).toBe(Math.round(hero.maxHp * 0.3));
    expect(escudoDoVigor(heroiCom([]))).toBe(0);
  });
});

describe('o golpe no herói com a armadura encantada', () => {
  it('sem fortificação, é o golpe de sempre (o mesmo dano, e nenhum sorteio a mais)', () => {
    const hero = heroiCom([peca('placas')]);
    for (const especie of ['goblin', 'aranha', 'elemental_fogo']) {
      const sem = landHitOnHero(hero, bicho(especie), 1, seededRng(5));
      const comDefesas = landHitOnHero(hero, bicho(especie), 1, seededRng(5), 0, defesasDoHeroi(hero));
      expect(comDefesas).toEqual(sem);
    }
  });

  it('a robustez desconta dos que batem de perto, e não dos mágicos', () => {
    const hero = heroiCom([encantada('placas', 'robustez', 3)]);
    const defesas = defesasDoHeroi(hero);
    const golpe = landHitOnHero(hero, bicho('goblin'), 1, sempre(0.5));
    expect(landHitOnHero(hero, bicho('goblin'), 1, sempre(0.5), 0, defesas).damage).toBe(Math.max(1, Math.round(golpe.damage * 0.85)));
    const magico = landHitOnHero(hero, bicho('elemental_fogo'), 1, sempre(0.5));
    expect(landHitOnHero(hero, bicho('elemental_fogo'), 1, sempre(0.5), 0, defesas).damage).toBe(magico.damage);
  });

  it('a resistência mágica desconta dos mágicos e pode segurar o dreno de mana', () => {
    const forte = heroiCom([encantada('placas', 'resistencia_magica', 3)]);
    const semNada = landHitOnHero(forte, bicho('elemental_fogo'), 1, sempre(0.3));
    expect(semNada.manaDrained).toBeGreaterThan(0);
    const segurou = landHitOnHero(forte, bicho('elemental_fogo'), 1, sempre(0.3), 0, defesasDoHeroi(forte));
    expect(segurou.damage).toBe(Math.max(1, Math.round(semNada.damage * 0.65)));
    expect(segurou).toMatchObject({ manaDrained: 0, drainResisted: true });

    const fraca = heroiCom([encantada('placas', 'resistencia_magica', 1)]);
    const pegou = landHitOnHero(fraca, bicho('elemental_fogo'), 1, sempre(0.3), 0, defesasDoHeroi(fraca));
    expect(pegou.manaDrained).toBeGreaterThan(0);
    expect(pegou.drainResisted).toBeUndefined();
  });

  it('a resistência a veneno pode segurar o veneno da aranha', () => {
    const forte = heroiCom([encantada('placas', 'resistencia_veneno', 3)]);
    expect(landHitOnHero(forte, bicho('aranha'), 1, sempre(0.3)).poisonApplied).toBe(true);
    expect(landHitOnHero(forte, bicho('aranha'), 1, sempre(0.3), 0, defesasDoHeroi(forte))).toMatchObject({ poisonApplied: false, poisonResisted: true });

    const fraca = heroiCom([encantada('placas', 'resistencia_veneno', 1)]);
    expect(landHitOnHero(fraca, bicho('aranha'), 1, sempre(0.3), 0, defesasDoHeroi(fraca)).poisonApplied).toBe(true);
  });
});

describe('a Encantadora', () => {
  it('fica na pracinha a leste do caminho do portão, e a cidade de antes ganha a sala', () => {
    const { grid } = generateCityLayout(6, 6);
    expect(grid[ENCANTADORA_POS.y]?.[ENCANTADORA_POS.x]?.type).toBe('encantadora');
    const antiga = grid.map((linha) => linha.map((cell) => (cell.type === 'encantadora' ? { ...cell, type: 'normal' as const } : cell)));
    expect(withEncantadora(antiga)[ENCANTADORA_POS.y]?.[ENCANTADORA_POS.x]).toEqual(grid[ENCANTADORA_POS.y]?.[ENCANTADORA_POS.x]);
    expect(withEncantadora(grid)).toBe(grid);
  });

  it('abre só no app; no site a porta fica fechada', () => {
    const naPorta = { ...cidadeCom([]), pos: { ...ENCANTADORA_POS } };
    expect(interagir(naPorta, seededRng(1), null, agora, true).tela?.tipo).toBe('encantadora');
    const fechada = interagir(naPorta, seededRng(1), null, agora, false);
    expect(fechada.tela).toBeNull();
    expect(fechada.aviso?.texto).toBe('A porta da Encantadora está fechada.');
  });

  it('lista as armaduras vestidas e depois as guardadas', () => {
    const guardada = peca('robe');
    const estado = cidadeCom([peca('placas'), peca('botas')]);
    const comGuardada = { ...estado, inventory: [...estado.inventory, guardada] };
    const ids = pecasParaEncantar(comGuardada).map((p) => p.templateId);
    expect(ids.slice(0, 2)).toEqual(['placas', 'botas']);
    expect(ids[ids.length - 1]).toBe('robe');
  });

  it('cobra o nível, troca a fortificação e avisa o que falta', () => {
    const estado = cidadeCom([peca('placas')], 1000);
    const placas = estado.hero.equip.armadura!;
    const primeira = encantar(abrirEncantadora(estado), placas, 'robustez', 2);
    expect(primeira.estado.hero.gold).toBe(700);
    expect(primeira.estado.hero.equip.armadura?.encantamento).toEqual({ tipo: 'robustez', nivel: 2 });
    expect(primeira.estado.inventory.find((i) => i.uid === placas.uid)?.encantamento).toEqual({ tipo: 'robustez', nivel: 2 });
    expect(primeira.log).toEqual(['A Encantadora fortifica Peitoral de Placas com Robustez II.']);

    const agoraComRobustez = primeira.estado.hero.equip.armadura!;
    expect(encantar(primeira, agoraComRobustez, 'robustez', 2).log).toEqual(['Peitoral de Placas já tem Robustez II.']);
    expect(encantar(primeira, agoraComRobustez, 'vigor', 3).log).toEqual(['Faltam 100 de ouro.']);
    const troca = encantar(primeira, agoraComRobustez, 'vigor', 1);
    expect(troca.estado.hero.gold).toBe(600);
    expect(troca.log).toEqual(['A Encantadora fortifica Peitoral de Placas com Vigor I (Robustez II se desfaz).']);

    const espada = estado.hero.equip.arma;
    if (espada) expect(encantar(primeira, espada, 'vigor', 1).log).toEqual(['A Encantadora só fortifica armaduras.']);
  });
});
