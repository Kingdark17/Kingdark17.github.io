import { describe, expect, it } from 'vitest';

import { powerManaCost } from '../combat/use-power.js';
import type { DungeonCell } from '../dungeon/generate.js';
import { roomArrival } from '../dungeon/room-walk.js';
import { heroPowers, type Hero } from '../hero/hero.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from '../jogo/estado.js';
import { limparSala } from '../jogo/fim-da-luta.js';
import { saveSorteado } from '../jogo/heroi-sorteado.js';
import { abrirLuta, passoDaLuta, RODADA, type EntradaDaLuta, type LutaEmTempoReal } from '../luta/arena.js';
import { DURACAO_DA_BARRA } from '../luta/eventos-de-arma.js';
import { freshCombatMonster } from '../combat/monster-state.js';
import { monsterView, type MonsterInstance } from '../monsters/generate.js';
import { seededRng } from '../rng.js';
import { ACESSORIOS_UNICOS, acessorioUnico, descontoDeMana, efeitoDoUnico } from './acessorios-unicos.js';
import { displayName, instantiate, itemTemplate, itemView, randomItem } from './item.js';
import { RARITIES } from './rarity.js';
import { templateById } from './templates.js';

const NUNCA = () => 0.99;
const PARADO: EntradaDaLuta = { x: 0, y: 0 };

function monstro(overrides: Partial<MonsterInstance> = {}): MonsterInstance {
  return { speciesId: 'zumbi', enemyClassId: 'brutamontes', floor: 2, hp: 400, maxHp: 400, dmg: 1, speed: 5, xp: 12, gold: 7, isBoss: false, ...overrides };
}

/** Uma sala de monstro montada à mão, com o herói usando `acessorio` (ou nada). */
function naSala(acessorio: ReturnType<typeof acessorioUnico> | null, hero: Partial<Hero> = {}): EstadoNaMasmorra {
  const save = saveSorteado('Aria', seededRng(11), seededRng(11));
  const base = retomarSave({ ...save, floor: 2, mapMode: 'dungeon' }, seededRng(11));
  if (base.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
  const celula = base.map.flat().find((c) => c.type === 'monster')!;
  const equip = { ...base.hero.equip, arma: { ...instantiate(templateById('espada')!, RARITIES[0]!), equipped: true }, acessorio: acessorio ? { ...acessorio, equipped: true } : null };
  const posicionado: EstadoNaMasmorra = { ...base, pos: { x: celula.x, y: celula.y }, party: [], hero: { ...base.hero, hp: 500, maxHp: 999, mp: 200, maxMp: 200, buffs: {}, equip, ...hero } };
  return substituirCelulaAtual(posicionado, { ...celula, monsters: [monstro()], monsterIndex: 0, beaten: false, bonusTreasure: undefined });
}

function rodar(luta: LutaEmTempoReal, passos: number, entrada: (i: number) => EntradaDaLuta = () => PARADO) {
  let atual = luta;
  const tudo: ReturnType<typeof passoDaLuta>['acontecimentos'] = [];
  for (let i = 0; i < passos && !atual.fim; i++) {
    const quadro = passoDaLuta(atual, entrada(i), NUNCA, () => 1_700_000_000_000);
    atual = quadro.luta;
    tudo.push(...quadro.acontecimentos);
  }
  return { luta: atual, acontecimentos: tudo };
}

const vida = (luta: LutaEmTempoReal) => (luta.estado as EstadoNaMasmorra).hero.hp;

describe('o acessório único', () => {
  it('um por masmorra, lendário, com a versão da dificuldade no nome e o efeito na descrição', () => {
    const normal = acessorioUnico({ dungeon: 'caverna', difficulty: 'normal' }, seededRng(1), () => 1);
    const dificil = acessorioUnico({ dungeon: 'caverna', difficulty: 'dificil' }, seededRng(1), () => 1);
    expect(normal.templateId).toBe(ACESSORIOS_UNICOS.caverna);
    expect(normal.rarity).toBe('lendario');
    expect(normal.nivelDoUnico).toBeUndefined();
    expect(dificil.nivelDoUnico).toBe(2);
    expect(displayName(dificil)).toBe('Presa do Morcego · Difícil');
    expect(itemView(dificil).desc).toContain('No app: cada golpe seu devolve em vida 9% do dano.');
    expect(itemView(acessorioUnico({ dungeon: 'torre', difficulty: 'pesadelo' }, seededRng(1), () => 1)).desc).toContain('20% menos mana');
  });

  it('não sai em sorteio nenhum: loja, baú e loot só sorteiam os de sempre', () => {
    for (let semente = 1; semente <= 300; semente++) {
      const peca = randomItem({ category: 'acessorio', rng: seededRng(semente), now: () => 1 });
      expect(itemTemplate(peca).unico).toBeUndefined();
      expect(itemTemplate(randomItem({ rng: seededRng(semente), now: () => 1 })).unico).toBeUndefined();
    }
  });

  it('o efeito é o da peça no acessório, na versão dela; sem a peça, nenhum', () => {
    const coroa = acessorioUnico({ dungeon: 'torre', difficulty: 'dificil' }, seededRng(1), () => 1);
    const hero = naSala(coroa).hero;
    expect(efeitoDoUnico(hero)).toEqual({ efeito: 'desconto_de_mana', valor: 0.15 });
    expect(descontoDeMana(hero)).toBe(0.15);
    expect(efeitoDoUnico(naSala(null).hero)).toBeNull();
    expect(powerManaCost(hero, { cost: 10 }, 0.15)).toBe(9);
    expect(powerManaCost(hero, { cost: 10 })).toBe(10);
  });
});

describe('cai na primeira vez de cada dificuldade', () => {
  function noFundo(cleared: string[]): EstadoNaMasmorra {
    const estado = naSala(null);
    const sala = celulaAtual(estado) as DungeonCell;
    const caido = { ...freshCombatMonster(monstro({ isBoss: true })), hp: 0 };
    return {
      ...substituirCelulaAtual(estado, { ...sala, type: 'boss', monsters: [caido] }),
      floor: 100,
      masmorra: { dungeon: 'floresta', difficulty: 'dificil' },
      progresso: { cleared, totems: {} },
      mapRows: 6,
      mapCols: 6,
    };
  }
  const abatido = monsterView({ ...freshCombatMonster(monstro({ isBoss: true })), hp: 0 });

  it('a primeira vez dá o acessório da versão Difícil, e ele vai pra mochila', () => {
    const limpa = limparSala(noFundo(['floresta:normal']), abatido, seededRng(5), () => 1);
    expect(limpa.conquista?.acessorio?.templateId).toBe('amuleto_floresta');
    expect(limpa.conquista?.acessorio?.nivelDoUnico).toBe(2);
    expect(limpa.estado.inventory.some((item) => item.uid === limpa.conquista?.acessorio?.uid)).toBe(true);
    expect(limpa.log.some((linha) => linha.includes('acessório único'))).toBe(true);
  });

  it('zerar de novo a mesma dificuldade dá só o baú e o ouro', () => {
    const limpa = limparSala(noFundo(['floresta:normal', 'floresta:dificil']), abatido, seededRng(5), () => 1);
    expect(limpa.conquista).toBeDefined();
    expect(limpa.conquista?.acessorio).toBeUndefined();
  });
});

describe('o efeito, só na arena do app', () => {
  it('o Amuleto da Floresta Antiga devolve vida a cada rodada', () => {
    const amuleto = acessorioUnico({ dungeon: 'floresta', difficulty: 'pesadelo' }, seededRng(1), () => 1);
    const { luta } = abrirLuta(naSala(amuleto), roomArrival('S'));
    const fim = rodar({ ...luta, arena: { ...luta.arena, intervalo: 9999 } }, RODADA);
    expect(vida(fim.luta)).toBe(500 + Math.floor(999 * 0.04));
    expect(fim.acontecimentos.some((a) => a.texto === `🌲+${Math.floor(999 * 0.04)}`)).toBe(true);
    const sem = rodar({ ...abrirLuta(naSala(null), roomArrival('S')).luta, arena: { ...luta.arena, intervalo: 9999 } }, RODADA);
    expect(vida(sem.luta)).toBe(500);
  });

  it('a Presa do Morcego devolve em vida parte do dano do golpe', () => {
    const presa = acessorioUnico({ dungeon: 'caverna', difficulty: 'pesadelo' }, seededRng(1), () => 1);
    const { luta } = abrirLuta(naSala(presa), roomArrival('S'));
    const quieta = { ...luta, arena: { ...luta.arena, intervalo: 9999 } };
    const aberto = passoDaLuta(quieta, { ...PARADO, atacar: true }, NUNCA).luta;
    const meio = DURACAO_DA_BARRA / 2;
    const fim = rodar(aberto, meio, (i) => (i === meio - 1 ? { ...PARADO, tocar: true } : PARADO));
    const cura = fim.acontecimentos.find((a) => a.texto?.startsWith('🦇+'));
    expect(cura).toBeDefined();
    expect(vida(fim.luta)).toBe(500 + Number(cura!.texto!.slice('🦇+'.length)));
  });

  it('a Coroa do Arquimago faz o poder custar menos mana', () => {
    const coroa = acessorioUnico({ dungeon: 'torre', difficulty: 'pesadelo' }, seededRng(1), () => 1);
    const estado = naSala(coroa);
    const poder = heroPowers(estado.hero).find((p) => p.cost > 0)!;
    const { luta } = abrirLuta(estado, roomArrival('S'));
    const depois = passoDaLuta({ ...luta, arena: { ...luta.arena, intervalo: 9999 } }, { ...PARADO, poder: poder.id }, NUNCA).luta;
    const gasto = 200 - (depois.estado as EstadoNaMasmorra).hero.mp;
    expect(gasto).toBe(powerManaCost(estado.hero, poder, 0.2));
    expect(gasto).toBeLessThan(powerManaCost(estado.hero, poder));
  });
});
