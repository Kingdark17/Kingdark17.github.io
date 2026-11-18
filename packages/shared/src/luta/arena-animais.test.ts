import { describe, expect, it } from 'vitest';

import {
  animalDomado,
  contarBatalha,
  estadoDoAnimal,
  guardarAnimal,
  levarAnimal,
  mudarEstadoDoAnimal,
  REGRAS_DOS_ANIMAIS,
  statusNoNivel,
} from '../combat/animais.js';
import type { DungeonCell } from '../dungeon/generate.js';
import { TILE_UNITS, type Walker } from '../dungeon/room-walk.js';
import { generateCompanion, type Companion } from '../hero/hero.js';
import { instantiate } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import type { MonsterInstance } from '../monsters/generate.js';
import { seededRng, type Rng } from '../rng.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from '../jogo/estado.js';
import { saveSorteado } from '../jogo/heroi-sorteado.js';
import { limparSala } from '../jogo/fim-da-luta.js';
import { monsterView } from '../monsters/generate.js';
import { abrirLuta, passoDaLuta, type Acontecimento, type EntradaDaLuta, type LutaEmTempoReal } from './arena.js';

// O animal do Caçador na luta e os níveis (rodada 7c, 2026-11-18).

const T = TILE_UNITS;
const PARADO: EntradaDaLuta = { x: 0, y: 0 };
const AGORA = () => 1_700_000_000_000;
const NUNCA: Rng = () => 0.99;
const EMBAIXO: Walker = { x: 4.5 * T, y: 7.5 * T, facing: 'N' };

const lobo = (o: Partial<Companion> = {}, id = 'a1'): Companion => ({ ...animalDomado({ speciesId: 'lobo_sombras', maxHp: 1000, dmg: 50 }, id), ...o });

function monstro(o: Partial<MonsterInstance> = {}): MonsterInstance {
  return { speciesId: 'zumbi', enemyClassId: 'brutamontes', floor: 2, hp: 4000, maxHp: 4000, dmg: 3, speed: 5, xp: 12, gold: 7, isBoss: false, ...o };
}

function naSala(party: Companion[], monsters: MonsterInstance[], animais?: Companion[]): EstadoNaMasmorra {
  const save = saveSorteado('Aria', seededRng(11), seededRng(11));
  const base = retomarSave({ ...save, floor: 2, mapMode: 'dungeon' }, seededRng(11));
  if (base.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
  const celula = base.map.flat().find((c) => c.type === 'monster')!;
  const arco = { ...instantiate(templateById('arco')!, RARITIES[0]!), equipped: true };
  const posicionado: EstadoNaMasmorra = {
    ...base,
    pos: { x: celula.x, y: celula.y },
    party,
    hero: { ...base.hero, classId: 'cacador', className: 'Caçador', hp: 999, maxHp: 999, level: 1, buffs: {}, equip: { ...base.hero.equip, arma: arco }, ...(animais ? { animais } : {}) },
  };
  return substituirCelulaAtual(posicionado, { ...celula, monsters, monsterIndex: 0, beaten: false, bonusTreasure: undefined });
}

function montar(estado: EstadoNaMasmorra, corpos: Array<[number, number]>): LutaEmTempoReal {
  const aberta = abrirLuta(estado, EMBAIXO).luta;
  return { ...aberta, arena: { ...aberta.arena, monstros: aberta.arena.monstros.map((m, i) => ({ ...m, corpoX: corpos[i]![0] * T, corpoY: corpos[i]![1] * T })) } };
}

function rodar(luta: LutaEmTempoReal, passos: number, rng: Rng = NUNCA): { luta: LutaEmTempoReal; acontecimentos: Acontecimento[] } {
  let atual = luta;
  const tudo: Acontecimento[] = [];
  for (let i = 0; i < passos && !atual.fim; i++) {
    const quadro = passoDaLuta(atual, PARADO, rng, AGORA);
    atual = quadro.luta;
    tudo.push(...quadro.acontecimentos);
  }
  return { luta: atual, acontecimentos: tudo };
}

function vida(luta: LutaEmTempoReal, indice: number): number {
  return ((celulaAtual(luta.estado) as DungeonCell).monsters ?? [])[indice]!.hp;
}

describe('os níveis do animal', () => {
  it('cada nível soma 20% da vida e do dano de quando foi domado', () => {
    expect(statusNoNivel(700, 1)).toBe(700);
    expect(statusNoNivel(700, 2)).toBe(840);
    expect(statusNoNivel(700, REGRAS_DOS_ANIMAIS.nivelMaximo)).toBe(1960);
    expect(statusNoNivel(1, 1)).toBe(1);
  });

  it('a luta vencida conta uma batalha; a cada 30, um nível (até o 10), com a vida que falta continuando a faltar', () => {
    const recruta = generateCompanion(seededRng(1));
    const quase = lobo({ hp: 500, animal: { id: 'a1', nivel: 1, batalhas: 29, vidaBase: 700, ataqueBase: 35 } });
    const caido = lobo({ hp: 0, animal: { id: 'a2', nivel: 1, batalhas: 29, vidaBase: 700, ataqueBase: 35 } }, 'a2');
    const noTeto = lobo({ animal: { id: 'a3', nivel: 10, batalhas: 299, vidaBase: 700, ataqueBase: 35 } }, 'a3');
    const r = contarBatalha([recruta, quase, caido, noTeto]);
    expect(r.party[0]).toBe(recruta);
    expect(r.party[1]).toMatchObject({ hp: 640, maxHp: 840, attack: 42, animal: { nivel: 2, batalhas: 30 } });
    expect(r.party[2]).toMatchObject({ hp: 0, maxHp: 840, animal: { nivel: 2, batalhas: 30 } });
    expect(r.party[3]).toMatchObject({ animal: { nivel: 10, batalhas: 300 } });
    expect(r.subiram.map((a) => a.animal?.id)).toEqual(['a1', 'a2']);
    // Sem a base guardada (domado na 7b), a de agora vale como a do nível 1.
    const antigo = { ...lobo(), animal: { id: 'v', nivel: 1, batalhas: 3 } };
    expect(contarBatalha([antigo]).party[0]?.animal).toEqual({ id: 'v', nivel: 1, batalhas: 4, vidaBase: 700, ataqueBase: 35 });
  });

  it('a vitória da sala conta a batalha e avisa quem subiu', () => {
    const estado = naSala([lobo({ animal: { id: 'a1', nivel: 1, batalhas: 29, vidaBase: 700, ataqueBase: 35 } })], [monstro({ hp: 0 })]);
    const limpa = limparSala(estado, monsterView(monstro({ hp: 0 })), seededRng(3), AGORA, true);
    expect(limpa.estado.party[0]?.animal).toMatchObject({ nivel: 2, batalhas: 30 });
    expect(limpa.log).toContain('🐾 Lobo das Sombras subiu pro nível 2!');
  });
});

describe('a janela do K', () => {
  it('troca o estado, guarda e leva de volta (2 seguem o herói)', () => {
    const estado = naSala([lobo(), lobo({}, 'a2')], [monstro()], [lobo({}, 'a3')]);
    expect(estadoDoAnimal(estado.party[0]!)).toBe('retaguarda');
    const estrategico = mudarEstadoDoAnimal(estado, 'a3', 'estrategico');
    expect(estrategico.hero.animais?.[0]?.estadoDoLacaio).toBe('estrategico');
    expect(levarAnimal(estado, 'a3')).toBe(estado);
    const guardou = guardarAnimal(estado, 'a1');
    expect(guardou.party.map((c) => c.animal?.id)).toEqual(['a2']);
    expect(guardou.hero.animais?.map((c) => c.animal?.id)).toEqual(['a3', 'a1']);
    const levou = levarAnimal(guardou, 'a3');
    expect(levou.party.map((c) => c.animal?.id)).toEqual(['a2', 'a3']);
    expect(levou.hero.animais?.map((c) => c.animal?.id)).toEqual(['a1']);
    const tudo = levarAnimal(guardarAnimal(guardarAnimal(levou, 'a2'), 'a3'), 'a1');
    expect(tudo.party.map((c) => c.animal?.id)).toEqual(['a1']);
  });
});

describe('o animal na luta', () => {
  it('entra com corpo ao lado do herói, como o lacaio', () => {
    const luta = montar(naSala([lobo()], [monstro()]), [[4.5, 1.5]]);
    expect(luta.arena.companheiros[0]?.x).toBeDefined();
  });

  it('a área de guarda só se marca com um animal no estratégico', () => {
    const sem = montar(naSala([lobo()], [monstro()]), [[4.5, 1.5]]);
    expect(passoDaLuta(sem, { ...PARADO, guardar: { x: 6 * T, y: 3 * T } }, NUNCA, AGORA).luta.arena.guarda).toBeUndefined();
    const com = montar(naSala([lobo({ estadoDoLacaio: 'estrategico' })], [monstro()]), [[4.5, 1.5]]);
    const marcou = passoDaLuta(com, { ...PARADO, guardar: { x: 6 * T, y: 3 * T } }, NUNCA, AGORA);
    expect(marcou.luta.arena.guarda).toEqual({ x: 6 * T, y: 3 * T });
    expect(marcou.acontecimentos.some((a) => a.texto === '🐾 Área de guarda marcada')).toBe(true);
  });

  it('no estratégico ele guarda a área e o golpe pega todos dentro dela; sem área, fica de retaguarda', () => {
    const dois = [monstro({ dmg: 1 }), monstro({ dmg: 1 })];
    const corpos: Array<[number, number]> = [[6.5, 1.5], [7.5, 1.5]];
    const comArea = montar(naSala([lobo({ estadoDoLacaio: 'estrategico', attack: 200 })], dois), corpos);
    const marcado = { ...comArea, arena: { ...comArea.arena, guarda: { x: 7 * T, y: 1.5 * T } } };
    // O companheiro erra com o sorteio alto: aqui ele acerta.
    const ACERTA: Rng = () => 0.3;
    const r = rodar(marcado, 600, ACERTA);
    expect(vida(r.luta, 0)).toBeLessThan(4000);
    expect(vida(r.luta, 1)).toBeLessThan(4000);
    // Sem área marcada, os dois estão longe do dono (mais de 3 blocos): ele não sai de perto.
    // (os monstros presos no lugar: andando, eles chegariam perto do dono e entrariam na retaguarda)
    const longe = montar(naSala([lobo({ estadoDoLacaio: 'estrategico', attack: 200 })], dois), corpos);
    const presos = { ...longe, arena: { ...longe.arena, monstros: longe.arena.monstros.map((m) => ({ ...m, preso: 9999 })) } };
    const semArea = rodar(presos, 200, ACERTA);
    expect(vida(semArea.luta, 0)).toBe(4000);
    expect(vida(semArea.luta, 1)).toBe(4000);
  });
});
