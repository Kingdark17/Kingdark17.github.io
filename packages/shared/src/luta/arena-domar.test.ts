import { describe, expect, it } from 'vitest';

import {
  animalDomado,
  comidaPreferida,
  domavel,
  juntarAnimal,
  nomearAnimal,
  nomeDoAnimal,
  quantosAnimais,
  recrutas,
  REGRAS_DE_DOMAR,
} from '../combat/animais.js';
import type { DungeonCell } from '../dungeon/generate.js';
import { TILE_UNITS, type Walker } from '../dungeon/room-walk.js';
import { generateCompanion, type Companion } from '../hero/hero.js';
import { instantiate } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import type { MonsterInstance } from '../monsters/generate.js';
import { resolveRecruit } from '../npc/npc-services.js';
import { seededRng, type Rng } from '../rng.js';
import { rollStock } from '../shop/shop.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from '../jogo/estado.js';
import { saveSorteado } from '../jogo/heroi-sorteado.js';
import { abrirLuta, passoDaLuta, RECARGA_DO_ATAQUE, type Acontecimento, type EntradaDaLuta, type LutaEmTempoReal, type QuadroDaLuta } from './arena.js';

// Domar (rodada 7b, 2026-11-18): o Caçador oferece a comida preferida do bicho.

const T = TILE_UNITS;
const PARADO: EntradaDaLuta = { x: 0, y: 0 };
const AGORA = () => 1_700_000_000_000;
const SEMPRE_ACEITA: Rng = () => 0.1;
const SEMPRE_RECUSA: Rng = () => 0.9;
const EMBAIXO: Walker = { x: 4.5 * T, y: 7.5 * T, facing: 'N' };

function lobo(o: Partial<MonsterInstance> = {}): MonsterInstance {
  return { speciesId: 'lobo_sombras', enemyClassId: 'brutamontes', floor: 2, hp: 100, maxHp: 1000, dmg: 50, speed: 5, xp: 12, gold: 7, isBoss: false, ...o };
}

function comida(id: string) {
  return instantiate(templateById(id)!, RARITIES[0]!, { rng: seededRng(3), now: AGORA });
}

function naSala(classId: string, monsters: MonsterInstance[], o: { comidas?: number; party?: Companion[]; animais?: Companion[] } = {}): EstadoNaMasmorra {
  const save = saveSorteado('Aria', seededRng(11), seededRng(11));
  const base = retomarSave({ ...save, floor: 2, mapMode: 'dungeon' }, seededRng(11));
  if (base.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
  const celula = base.map.flat().find((c) => c.type === 'monster')!;
  const arco = { ...instantiate(templateById('arco')!, RARITIES[0]!), equipped: true };
  const inventory = Array.from({ length: o.comidas ?? 3 }, () => comida('carne_crua'));
  const posicionado: EstadoNaMasmorra = {
    ...base,
    pos: { x: celula.x, y: celula.y },
    party: o.party ?? [],
    inventory,
    hero: { ...base.hero, classId, className: classId, hp: 999, maxHp: 999, level: 1, buffs: {}, equip: { ...base.hero.equip, arma: arco }, ...(o.animais ? { animais: o.animais } : {}) },
  };
  return substituirCelulaAtual(posicionado, { ...celula, monsters, monsterIndex: 0, beaten: false, bonusTreasure: undefined });
}

function montar(estado: EstadoNaMasmorra, corpos: Array<[number, number]>): LutaEmTempoReal {
  const aberta = abrirLuta(estado, EMBAIXO).luta;
  return { ...aberta, arena: { ...aberta.arena, monstros: aberta.arena.monstros.map((m, i) => ({ ...m, corpoX: corpos[i]![0] * T, corpoY: corpos[i]![1] * T })) } };
}

/** Oferece a comida ao monstro 0 e espera a recarga; devolve o último quadro e tudo o que aconteceu. */
function oferecer(luta: LutaEmTempoReal, rng: Rng, vezes = 1): { luta: LutaEmTempoReal; acontecimentos: Acontecimento[]; domou?: string } {
  let atual = luta;
  const tudo: Acontecimento[] = [];
  let domou: string | undefined;
  for (let v = 0; v < vezes && !atual.fim; v++) {
    for (let i = 0; i <= RECARGA_DO_ATAQUE && !atual.fim; i++) {
      const quadro: QuadroDaLuta = passoDaLuta(atual, i === 0 ? { ...PARADO, alimentar: 0 } : PARADO, rng, AGORA);
      atual = quadro.luta;
      tudo.push(...quadro.acontecimentos);
      if (quadro.domou) domou = quadro.domou;
    }
  }
  return { luta: atual, acontecimentos: tudo, ...(domou ? { domou } : {}) };
}

function avisos(r: { acontecimentos: Acontecimento[] }): string[] {
  return r.acontecimentos.filter((a) => a.tipo === 'aviso' && a.texto).map((a) => a.texto as string);
}

describe('os animais do Caçador', () => {
  it('só os bichos se domam, cada um com a comida preferida', () => {
    expect(comidaPreferida('lobo_sombras')).toBe('carne_crua');
    expect(comidaPreferida('aranha')).toBe('grilo');
    expect(comidaPreferida('morcego')).toBe('fruta_madura');
    expect(comidaPreferida('goblin')).toBeNull();
    expect(comidaPreferida('constructor')).toBeNull();
    expect(domavel({ speciesId: 'aranha' })).toBe(true);
    expect(domavel({ speciesId: 'aranha', isBoss: true })).toBe(false);
  });

  it('o domado tem 70% da vida e do dano, e os 2 primeiros seguem o herói', () => {
    const a = animalDomado({ speciesId: 'lobo_sombras', maxHp: 1000, dmg: 50 }, 'a1');
    expect(a).toMatchObject({ name: 'Lobo das Sombras', hp: 700, maxHp: 700, attack: 35, especie: 'lobo_sombras', animal: { id: 'a1', nivel: 1, batalhas: 0 } });
    const estado = naSala('cacador', [lobo()]);
    const um = juntarAnimal(estado, a);
    const dois = juntarAnimal(um, { ...a, animal: { id: 'a2', nivel: 1, batalhas: 0 } });
    const tres = juntarAnimal(dois, { ...a, animal: { id: 'a3', nivel: 1, batalhas: 0 } });
    expect(tres.party.length).toBe(2);
    expect(tres.hero.animais?.map((x) => x.animal?.id)).toEqual(['a3']);
    expect(quantosAnimais(tres)).toBe(3);
    const nomeado = nomearAnimal(tres, 'a3', '  Presa  ');
    expect(nomeado.hero.animais?.[0]?.name).toBe('Presa');
    expect(nomearAnimal(tres, 'a1', 'Uivo').party[0]?.name).toBe('Uivo');
  });

  it('o nome: sem controle nem < >, sem espaço nas pontas, até 20 letras; vazio, o da espécie', () => {
    expect(nomeDoAnimal('  Sombra\n<b>  ', 'Lobo')).toBe('Sombrab');
    expect(nomeDoAnimal('   ', 'Lobo')).toBe('Lobo');
    expect(nomeDoAnimal('a'.repeat(30), 'Lobo')).toBe('a'.repeat(REGRAS_DE_DOMAR.nome));
    expect(nomeDoAnimal('🐺'.repeat(25), 'Lobo')).toBe('🐺'.repeat(REGRAS_DE_DOMAR.nome));
  });

  it('os animais não ocupam a vaga dos recrutas', () => {
    const a = animalDomado({ speciesId: 'aranha', maxHp: 300, dmg: 20 }, 'x');
    const equipe = [a, { ...a, animal: { id: 'y', nivel: 1, batalhas: 0 } }, generateCompanion(seededRng(1)), generateCompanion(seededRng(2))];
    expect(recrutas(equipe).length).toBe(2);
    expect(resolveRecruit(equipe, seededRng(5)).outcome.kind).toBe('recruited');
  });

  it('o vendedor do app tem as comidas pro Caçador', () => {
    const comComidas = rollStock('shop', 3, { app: true, comidas: true, rng: seededRng(4), now: AGORA });
    expect(comComidas.slice(-3).map((i) => i.templateId)).toEqual(['carne_crua', 'grilo', 'fruta_madura']);
    expect(rollStock('shop', 3, { app: true, rng: seededRng(4), now: AGORA }).some((i) => i.templateId === 'grilo')).toBe(false);
    expect(rollStock('blacksmith', 3, { app: true, comidas: true, rng: seededRng(4), now: AGORA }).some((i) => i.templateId === 'grilo')).toBe(false);
  });
});

describe('domar na luta', () => {
  it('aceitou 2 vezes: o lobo vira o animal do Caçador, sai da luta, e a sala está vencida', () => {
    const r = oferecer(montar(naSala('cacador', [lobo()]), [[4.5, 5.5]]), SEMPRE_ACEITA, 2);
    expect(avisos(r)).toContain('🍖 Lobo das Sombras aceitou (1/2)');
    expect(avisos(r)).toContain('🐾 Você domou Lobo das Sombras!');
    expect(r.domou).toMatch(/^animal_/);
    expect(r.luta.fim).toBe('vitoria');
    expect(r.luta.estado.party.map((c) => c.animal?.id)).toEqual([r.domou]);
    expect(r.luta.estado.party[0]).toMatchObject({ maxHp: 700, attack: 35, especie: 'lobo_sombras' });
    expect(r.luta.estado.inventory.filter((i) => i.templateId === 'carne_crua').length).toBe(1);
    const monstro = ((celulaAtual(r.luta.estado) as DungeonCell).monsters ?? [])[0]!;
    expect(monstro).toMatchObject({ hp: 0, domado: true });
  });

  it('com outro monstro de pé, o domado só sai da luta', () => {
    const goblin = lobo({ speciesId: 'goblin', hp: 900, maxHp: 900 });
    const r = oferecer(montar(naSala('cacador', [lobo(), goblin]), [[4.5, 5.5], [1.5, 1.5]]), SEMPRE_ACEITA, 2);
    expect(r.luta.fim).toBeNull();
    expect(r.luta.arena.monstros[0]).toMatchObject({ fase: 'caido', domado: true });
    expect(r.luta.arena.alvo).toBe(1);
  });

  it('recusou: ataca na hora, e na 6ª não aceita mais', () => {
    const r = oferecer(montar(naSala('cacador', [lobo()]), [[4.5, 5.5]]), SEMPRE_RECUSA, 1);
    expect(avisos(r)).toContain('Lobo das Sombras recusou (1/6)');
    expect(r.luta.arena.monstros[0]?.recusou).toBe(1);
    const luta = montar(naSala('cacador', [lobo()]), [[4.5, 5.5]]);
    const cansado = { ...luta, arena: { ...luta.arena, monstros: luta.arena.monstros.map((m) => ({ ...m, recusou: 5 })) } };
    const ultima = oferecer(cansado, SEMPRE_RECUSA, 1);
    expect(avisos(ultima)).toContain('🚫 Lobo das Sombras recusou de vez');
    const depois = oferecer(ultima.luta, SEMPRE_ACEITA, 1);
    expect(avisos(depois)).toContain('Lobo das Sombras não aceita mais comida');
  });

  it('não dá: forte demais, longe, sem comida, outro bicho, o chefe, e quem não é Caçador', () => {
    const tenta = (estado: EstadoNaMasmorra, corpo: [number, number] = [4.5, 5.5]) => avisos(oferecer(montar(estado, [corpo]), SEMPRE_ACEITA, 1));
    expect(tenta(naSala('cacador', [lobo({ hp: 300 })]))).toContain('Lobo das Sombras ainda está forte demais');
    expect(tenta(naSala('cacador', [lobo()]), [4.5, 1.5])).toContain('Chegue mais perto');
    expect(tenta(naSala('cacador', [lobo()], { comidas: 0 }))).toContain('Falta carne crua');
    expect(tenta(naSala('cacador', [lobo({ speciesId: 'goblin' })]))).toContain('Goblin não se deixa domar');
    expect(tenta(naSala('cacador', [lobo({ isBoss: true })])).some((t) => t.endsWith('não se deixa domar'))).toBe(true);
    expect(tenta(naSala('arqueiro', [lobo()]))).toEqual([]);
    const a = animalDomado({ speciesId: 'aranha', maxHp: 300, dmg: 20 }, 'x');
    const cheio = naSala('cacador', [lobo()], { party: [a, a], animais: [a, a] });
    expect(tenta(cheio)).toContain('Você já tem 4 animais');
  });
});
