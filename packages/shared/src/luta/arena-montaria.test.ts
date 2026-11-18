import { describe, expect, it } from 'vitest';

import {
  animalDomado,
  cristalDoAnimal,
  cristalizarCaidos,
  desmontar,
  guardarAnimal,
  montarAnimal,
  montariaDe,
  quantosAnimais,
  REGRAS_DA_MONTARIA,
  reviverComPocao,
  reviverNaTaverna,
  soltarAnimal,
} from '../combat/animais.js';
import type { DungeonCell } from '../dungeon/generate.js';
import { TILE_UNITS, type Walker } from '../dungeon/room-walk.js';
import { alcanceDoHeroi } from '../hero/classes-de-luta.js';
import type { Companion } from '../hero/hero.js';
import { displayName, instantiate } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import type { MonsterInstance } from '../monsters/generate.js';
import { monsterView } from '../monsters/generate.js';
import { seededRng, type Rng } from '../rng.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from '../jogo/estado.js';
import { saveSorteado } from '../jogo/heroi-sorteado.js';
import { limparSala, perderLuta } from '../jogo/fim-da-luta.js';
import { podeReviver, usar } from '../jogo/mochila.js';
import { abrirLuta, passoDaLuta, type Acontecimento, type EntradaDaLuta, type LutaEmTempoReal } from './arena.js';

// A montaria, o cristal, reviver e soltar (rodada 7d, 2026-11-18).

const T = TILE_UNITS;
const PARADO: EntradaDaLuta = { x: 0, y: 0 };
const AGORA = () => 1_700_000_000_000;
const NUNCA: Rng = () => 0.99;
const EMBAIXO: Walker = { x: 4.5 * T, y: 7.5 * T, facing: 'N' };

const lobo = (nivel = 5, o: Partial<Companion> = {}, id = 'a1'): Companion => {
  const base = animalDomado({ speciesId: 'lobo_sombras', maxHp: 1000, dmg: 50 }, id);
  return { ...base, ...o, animal: { id, nivel, batalhas: 0, vidaBase: 700, ataqueBase: 35 } };
};

function item(id: string, semente = 3) {
  return instantiate(templateById(id)!, RARITIES[0]!, { rng: seededRng(semente), now: AGORA });
}

function monstro(o: Partial<MonsterInstance> = {}): MonsterInstance {
  return { speciesId: 'goblin', enemyClassId: 'brutamontes', floor: 2, hp: 4000, maxHp: 4000, dmg: 40, speed: 5, xp: 12, gold: 7, isBoss: false, ...o };
}

function naSala(party: Companion[], monsters: MonsterInstance[], o: { montaria?: string; inventory?: ReturnType<typeof item>[]; animais?: Companion[]; aljava?: boolean } = {}): EstadoNaMasmorra {
  const save = saveSorteado('Aria', seededRng(11), seededRng(11));
  const base = retomarSave({ ...save, floor: 2, mapMode: 'dungeon' }, seededRng(11));
  if (base.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
  const celula = base.map.flat().find((c) => c.type === 'monster')!;
  const arco = { ...instantiate(templateById('arco')!, RARITIES[0]!), equipped: true };
  const aljava = o.aljava ? { ...instantiate(templateById('aljava_paralisante')!, RARITIES[0]!), equipped: true } : null;
  const posicionado: EstadoNaMasmorra = {
    ...base,
    pos: { x: celula.x, y: celula.y },
    party,
    inventory: o.inventory ?? [],
    hero: {
      ...base.hero,
      classId: 'cacador',
      className: 'Caçador',
      hp: 999,
      maxHp: 999,
      level: 1,
      buffs: {},
      equip: { ...base.hero.equip, arma: arco, secundaria: aljava },
      ...(o.montaria ? { montaria: o.montaria } : {}),
      ...(o.animais ? { animais: o.animais } : {}),
    },
  };
  return substituirCelulaAtual(posicionado, { ...celula, monsters, monsterIndex: 0, beaten: false, bonusTreasure: undefined });
}

function montar(estado: EstadoNaMasmorra, corpos: Array<[number, number]>, heroi: Walker = EMBAIXO): LutaEmTempoReal {
  const aberta = abrirLuta(estado, heroi).luta;
  return { ...aberta, arena: { ...aberta.arena, monstros: aberta.arena.monstros.map((m, i) => ({ ...m, corpoX: corpos[i]![0] * T, corpoY: corpos[i]![1] * T })) } };
}

function rodar(luta: LutaEmTempoReal, passos: number, entrada: (i: number) => EntradaDaLuta = () => PARADO): { luta: LutaEmTempoReal; acontecimentos: Acontecimento[] } {
  let atual = luta;
  const tudo: Acontecimento[] = [];
  for (let i = 0; i < passos && !atual.fim; i++) {
    const quadro = passoDaLuta(atual, entrada(i), NUNCA, AGORA);
    atual = quadro.luta;
    tudo.push(...quadro.acontecimentos);
  }
  return { luta: atual, acontecimentos: tudo };
}

describe('a montaria', () => {
  it('monta no animal de nível 5 em diante, de pé; guardar ou desmontar desce', () => {
    const estado = naSala([lobo(4, {}, 'a4'), lobo(5)], [monstro()]);
    expect(montarAnimal(estado, 'a4')).toBe(estado);
    expect(montarAnimal(naSala([lobo(5, { hp: 0 })], [monstro()]), 'a1').hero.montaria).toBeUndefined();
    const montado = montarAnimal(estado, 'a1');
    expect(montado.hero.montaria).toBe('a1');
    expect(montariaDe(montado)?.animal?.id).toBe('a1');
    expect(desmontar(montado).hero.montaria).toBeUndefined();
    expect(guardarAnimal(montado, 'a1').hero.montaria).toBeUndefined();
  });

  it('montado, o alcance vira 6 (a aljava ainda soma) e ele anda mais rápido; a montaria não luta sozinha', () => {
    const quem = { classId: 'cacador', equip: { arma: { templateId: 'arco' } } };
    expect(alcanceDoHeroi({ ...quem, montaria: 'a1' })).toBe(REGRAS_DA_MONTARIA.alcance);
    expect(alcanceDoHeroi({ ...quem, montaria: 'a1', equip: { ...quem.equip, secundaria: { templateId: 'aljava_paralisante' } } })).toBe(REGRAS_DA_MONTARIA.alcance + 1);
    const aPe = montar(naSala([lobo()], [monstro()]), [[4.5, 1.5]]);
    const montado = montar(naSala([lobo()], [monstro()], { montaria: 'a1' }), [[4.5, 1.5]]);
    expect(aPe.arena.companheiros.length).toBe(1);
    expect(montado.arena.companheiros.length).toBe(0);
    const andar = (luta: LutaEmTempoReal) => rodar(luta, 20, () => ({ x: 127, y: 0 })).luta.arena.heroi.x;
    expect(andar(montado) - EMBAIXO.x).toBeGreaterThan(andar(aPe) - EMBAIXO.x);
  });

  it('no nível 8 a montaria segura 15% do golpe; zerou, o herói desmonta', () => {
    const golpe = (nivel: number, vida = 700) => {
      const luta = montar(naSala([lobo(nivel, { hp: vida })], [monstro()], { montaria: 'a1' }), [[4.5, 6.5]]);
      return rodar(luta, 300);
    };
    const nivel5 = golpe(5);
    const nivel8 = golpe(8);
    expect(nivel5.luta.estado.party[0]?.hp).toBe(700);
    expect(nivel8.luta.estado.party[0]?.hp).toBeLessThan(700);
    expect(nivel8.luta.estado.hero.hp).toBeGreaterThan(nivel5.luta.estado.hero.hp);
    const fraca = golpe(8, 1);
    expect(fraca.luta.estado.hero.montaria).toBeUndefined();
    expect(fraca.acontecimentos.some((a) => a.texto === '🐾 Lobo das Sombras caiu: você desmonta')).toBe(true);
  });

  it('no nível 10 o herói montado bate 20% mais forte', () => {
    const primeiroGolpe = (nivel: number) => {
      const luta = montar(naSala([lobo(nivel)], [monstro({ dmg: 0 })], { montaria: 'a1' }), [[4.5, 3.5]]);
      const aberto = passoDaLuta(luta, { ...PARADO, atacar: true, cursor: { x: 4.5 * T, y: 3.5 * T } }, NUNCA, AGORA);
      const fim = rodar(aberto.luta, 100, (i) => (i === 39 ? { ...PARADO, tocar: true } : PARADO));
      return 4000 - ((celulaAtual(fim.luta.estado) as DungeonCell).monsters ?? [])[0]!.hp;
    };
    expect(primeiroGolpe(10)).toBeGreaterThan(primeiroGolpe(9));
  });
});

describe('o cristal do animal', () => {
  it('no fim da luta o caído vira o cristal com o nome dele, e continua contando entre os 4', () => {
    const caido = lobo(5, { hp: 0, name: 'Presa' });
    const estado = naSala([caido, lobo(2, {}, 'a2')], [monstro()], { montaria: 'a1' });
    const r = cristalizarCaidos(estado, seededRng(5), AGORA);
    expect(r.estado.party.map((c) => c.animal?.id)).toEqual(['a2']);
    expect(r.estado.hero.montaria).toBeUndefined();
    const cristal = r.estado.inventory.find((i) => i.templateId === 'cristal_animal')!;
    expect(displayName(cristal)).toBe('Cristal de Presa');
    expect(cristal.animal?.hp).toBe(0);
    expect(r.log).toEqual(['💠 Presa caiu e virou um cristal.']);
    expect(quantosAnimais(r.estado)).toBe(2);
    expect(podeReviver(cristal)).toBe(true);
  });

  it('a vitória e a derrota fazem o cristal', () => {
    const estado = naSala([lobo(1, { hp: 0 })], [monstro({ hp: 0 })]);
    const vitoria = limparSala(estado, monsterView(monstro({ hp: 0 })), seededRng(3), AGORA, true);
    expect(vitoria.estado.inventory.some((i) => !!i.animal)).toBe(true);
    expect(vitoria.log).toContain('💠 Lobo das Sombras caiu e virou um cristal.');
    const derrota = perderLuta(estado, seededRng(3), AGORA);
    expect(derrota.estado.inventory.some((i) => !!i.animal)).toBe(true);
    expect(derrota.estado.party.some((c) => !!c.animal)).toBe(false);
  });

  it('a Poção de Reviver traz com metade da vida; sem ela, avisa; a taverna traz todos com a vida cheia', () => {
    const cristal = cristalDoAnimal(lobo(3), seededRng(7), AGORA);
    const sem = naSala([], [monstro()], { inventory: [cristal] });
    expect(reviverComPocao(sem, cristal.uid).log).toEqual(['Falta uma Poção de Reviver pra trazer o animal de volta.']);
    const com = naSala([], [monstro()], { inventory: [cristal, item('pot_reviver', 9)] });
    const r = usar({ estado: com, log: [] }, cristal);
    expect(r.estado.party[0]).toMatchObject({ hp: 350, animal: { id: 'a1' } });
    expect(r.estado.inventory).toEqual([]);
    expect(r.log).toEqual(['Você usa a Poção de Reviver: Lobo das Sombras volta com metade da vida.']);
    const dois = naSala([lobo(1, {}, 'x'), lobo(1, {}, 'y')], [monstro()], { inventory: [cristal, cristalDoAnimal(lobo(1, {}, 'b2'), seededRng(8), AGORA)] });
    const taverna = reviverNaTaverna(dois);
    expect(taverna.voltaram).toBe(2);
    expect(taverna.estado.hero.animais?.map((c) => [c.animal?.id, c.hp])).toEqual([['a1', 700], ['b2', 700]]);
    expect(taverna.estado.inventory).toEqual([]);
  });

  it('soltar tira o animal pra sempre: da equipe, dos guardados ou o cristal', () => {
    const cristal = cristalDoAnimal(lobo(1, {}, 'c'), seededRng(7), AGORA);
    const estado = naSala([lobo(5)], [monstro()], { montaria: 'a1', animais: [lobo(1, {}, 'g')], inventory: [cristal] });
    const semMontaria = soltarAnimal(estado, 'a1');
    expect(semMontaria.party).toEqual([]);
    expect(semMontaria.hero.montaria).toBeUndefined();
    expect(soltarAnimal(estado, 'g').hero.animais).toBeUndefined();
    expect(soltarAnimal(estado, 'c').inventory).toEqual([]);
    expect(soltarAnimal(estado, 'nenhum')).toBe(estado);
  });
});
