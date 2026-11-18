import { describe, expect, it } from 'vitest';

import type { DungeonCell } from '../dungeon/generate.js';
import { TILE_UNITS, type Walker } from '../dungeon/room-walk.js';
import { classeRefeita, REGRAS_DO_CACADOR } from '../hero/classes-de-luta.js';
import { instantiate } from '../items/item.js';
import { chanceDoNegociante, pecasDaClasse } from '../items/pecas-secretas.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import type { CombatMonster } from '../combat/monster-state.js';
import type { MonsterInstance } from '../monsters/generate.js';
import { seededRng, type Rng } from '../rng.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from '../jogo/estado.js';
import { saveSorteado } from '../jogo/heroi-sorteado.js';
import { abrirLuta, passoDaLuta, RECARGA_DO_ATAQUE, type Acontecimento, type EntradaDaLuta, type LutaEmTempoReal } from './arena.js';

// O Caçador na luta do app (rodada 7a, 2026-11-18): todo golpe sangra, e o monstro sangrando bate mais fraco.

const T = TILE_UNITS;
const PARADO: EntradaDaLuta = { x: 0, y: 0 };
const NUNCA: Rng = () => 0.99;
const AGORA = () => 1_700_000_000_000;
const EMBAIXO: Walker = { x: 4.5 * T, y: 7.5 * T, facing: 'N' };

function monstro(overrides: Partial<MonsterInstance> & { status?: CombatMonster['status'] } = {}): MonsterInstance {
  return { speciesId: 'zumbi', enemyClassId: 'brutamontes', floor: 2, hp: 4000, maxHp: 4000, dmg: 3, speed: 5, xp: 12, gold: 7, isBoss: false, ...overrides };
}

function naSala(classId: string, className: string, monsters: MonsterInstance[]): EstadoNaMasmorra {
  const save = saveSorteado('Aria', seededRng(11), seededRng(11));
  const base = retomarSave({ ...save, floor: 2, mapMode: 'dungeon' }, seededRng(11));
  if (base.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
  const celula = base.map.flat().find((c) => c.type === 'monster')!;
  const arco = { ...instantiate(templateById('arco')!, RARITIES[0]!), equipped: true };
  const posicionado: EstadoNaMasmorra = {
    ...base,
    pos: { x: celula.x, y: celula.y },
    party: [],
    hero: { ...base.hero, className, classId, hp: 999, maxHp: 999, mp: 50, maxMp: 50, level: 1, gold: 100, buffs: {}, equip: { ...base.hero.equip, arma: arco, secundaria: null } },
  };
  return substituirCelulaAtual(posicionado, { ...celula, monsters, monsterIndex: 0, beaten: false, bonusTreasure: undefined });
}

function montar(estado: EstadoNaMasmorra, corpos: Array<[number, number]>): LutaEmTempoReal {
  const aberta = abrirLuta(estado, EMBAIXO).luta;
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

/** Uma flechada (o toque quando a bolinha bate no aro), parando logo que ela cai (antes da rodada do sangramento correr). */
function flechada(luta: LutaEmTempoReal, cursor: { x: number; y: number }) {
  const aberto = passoDaLuta(luta, { ...PARADO, atacar: true, cursor }, NUNCA, AGORA);
  const fim = rodar(aberto.luta, 84 + 1, (i) => (i === 39 ? { ...PARADO, tocar: true } : PARADO));
  return { luta: fim.luta, acontecimentos: [...aberto.acontecimentos, ...fim.acontecimentos] };
}

function monstroNaSala(luta: LutaEmTempoReal, indice = 0): CombatMonster {
  return ((celulaAtual(luta.estado) as DungeonCell).monsters ?? [])[indice] as CombatMonster;
}

describe('o Caçador', () => {
  it('é classe refeita, e o negociante traz aljava pra ele', () => {
    expect(classeRefeita({ classId: 'cacador' })).toBe(true);
    expect(pecasDaClasse({ classId: 'cacador' }).map((p) => p.id)).toEqual(['aljava_paralisante', 'aljava_flamejante', 'aljava_explosiva']);
    expect(chanceDoNegociante({ classId: 'cacador' })).toBe(5);
  });

  it('todo golpe que acerta deixa o monstro sangrando 1 turno com 20% do dano', () => {
    const r = flechada(montar(naSala('cacador', 'Caçador', [monstro()]), [[4.5, 3.5]]), { x: 4.5 * T, y: 3.5 * T });
    const m = monstroNaSala(r.luta);
    const dano = 4000 - m.hp;
    expect(dano).toBeGreaterThan(0);
    expect(m.status?.sangramento).toEqual({ turns: REGRAS_DO_CACADOR.turnos, dmg: Math.max(1, Math.trunc((dano * REGRAS_DO_CACADOR.sangramento) / 100)) });
    expect(r.acontecimentos.some((a) => a.texto === '🩸')).toBe(true);
    // O Arqueiro não sangra.
    const arqueiro = flechada(montar(naSala('arqueiro', 'Arqueiro', [monstro()]), [[4.5, 3.5]]), { x: 4.5 * T, y: 3.5 * T });
    expect(monstroNaSala(arqueiro.luta).status?.sangramento).toBeUndefined();
    expect(RECARGA_DO_ATAQUE).toBeGreaterThan(0);
  });

  it('o monstro sangrando bate 20% mais fraco no Caçador (no Arqueiro, igual)', () => {
    // A luta abre com os monstros sem estado (`prepararLuta`): o sangramento entra depois.
    const comSangue = (luta: LutaEmTempoReal): LutaEmTempoReal => {
      const cel = celulaAtual(luta.estado) as DungeonCell;
      const monsters = (cel.monsters ?? []).map((m) => ({ ...m, status: { sangramento: { turns: 99, dmg: 1 } } }));
      return { ...luta, estado: substituirCelulaAtual(luta.estado as EstadoNaMasmorra, { ...cel, monsters }) };
    };
    const forca = (classId: string, className: string) => {
      const r = rodar(comSangue(montar(naSala(classId, className, [monstro({ speciesId: 'goblin', dmg: 40 })]), [[4.5, 6.5]])), 300);
      return r.luta.arena.monstros[0]!.forca;
    };
    const noCacador = forca('cacador', 'Caçador');
    const noArqueiro = forca('arqueiro', 'Arqueiro');
    expect(noArqueiro).toBeGreaterThan(0);
    expect(noCacador).toBeCloseTo((noArqueiro * (100 - REGRAS_DO_CACADOR.fraqueza)) / 100, 9);
  });
});
