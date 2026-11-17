import { describe, expect, it } from 'vitest';

import type { DungeonCell } from '../dungeon/generate.js';
import { TILE_UNITS, type Walker } from '../dungeon/room-walk.js';
import type { Hero } from '../hero/hero.js';
import { REGRAS_DO_MAGO, REGRAS_DO_MONGE } from '../hero/classes-de-luta.js';
import { instantiate } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import type { CombatMonster } from '../combat/monster-state.js';
import type { MonsterInstance } from '../monsters/generate.js';
import { seededRng, type Rng } from '../rng.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from '../jogo/estado.js';
import { saveSorteado } from '../jogo/heroi-sorteado.js';
import {
  abrirLuta,
  danoLevadoNaJanela,
  extrasDaLuta,
  memoriaDaLuta,
  passoDaLuta,
  RECARGA_DO_ATAQUE,
  type Acontecimento,
  type ApoioDoParceiro,
  type EntradaDaLuta,
  type LutaEmTempoReal,
} from './arena.js';
import { DURACAO_DA_BARRA } from './eventos-de-arma.js';

// Segurar K, o Mago e o Monge na luta do app (rodada 4a, 2026-11-17).

function monstro(overrides: Partial<MonsterInstance> = {}): MonsterInstance {
  return { speciesId: 'zumbi', enemyClassId: 'brutamontes', floor: 2, hp: 4000, maxHp: 4000, dmg: 3, speed: 5, xp: 12, gold: 7, isBoss: false, ...overrides };
}

function arma(id: string) {
  return { ...instantiate(templateById(id)!, RARITIES[0]!), equipped: true };
}

/** Uma sala de monstro montada à mão, com um herói da classe pedida (de espada: o evento é a barra) e vida de sobra. */
function naSala(classId: string, className: string, monsters: MonsterInstance[], hero: Partial<Hero> = {}): EstadoNaMasmorra {
  const save = saveSorteado('Aria', seededRng(11), seededRng(11));
  const base = retomarSave({ ...save, floor: 2, mapMode: 'dungeon' }, seededRng(11));
  if (base.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
  const celula = base.map.flat().find((c) => c.type === 'monster')!;
  const posicionado: EstadoNaMasmorra = {
    ...base,
    pos: { x: celula.x, y: celula.y },
    party: [],
    hero: { ...base.hero, className, classId, hp: 999, maxHp: 999, mp: 50, maxMp: 50, level: 1, gold: 100, buffs: {}, equip: { ...base.hero.equip, arma: arma('espada') }, ...hero },
  };
  return substituirCelulaAtual(posicionado, { ...celula, monsters, monsterIndex: 0, beaten: false, bonusTreasure: undefined });
}

const PARADO: EntradaDaLuta = { x: 0, y: 0 };
const T = TILE_UNITS;
const NUNCA: Rng = () => 0.99;
const AGORA = () => 1_700_000_000_000;

interface Rodada {
  luta: LutaEmTempoReal;
  acontecimentos: Acontecimento[];
  apoios: ApoioDoParceiro[];
  moral?: number;
}

function rodar(luta: LutaEmTempoReal, passos: number, rng: Rng, entrada: (i: number) => EntradaDaLuta = () => PARADO): Rodada {
  let atual = luta;
  const tudo: Acontecimento[] = [];
  const apoios: ApoioDoParceiro[] = [];
  let moral: number | undefined;
  for (let i = 0; i < passos && !atual.fim; i++) {
    const quadro = passoDaLuta(atual, entrada(i), rng, AGORA);
    atual = quadro.luta;
    tudo.push(...quadro.acontecimentos);
    apoios.push(...(quadro.apoios ?? []));
    if (quadro.moral !== undefined) moral = quadro.moral;
  }
  return { luta: atual, acontecimentos: tudo, apoios, ...(moral !== undefined ? { moral } : {}) };
}

/** Um golpe com o toque no meio da barra (crita); depois espera a recarga. */
function golpeNoMeio(luta: LutaEmTempoReal, entrada: Partial<EntradaDaLuta> = {}, rng: Rng = NUNCA): Rodada {
  const aberto = passoDaLuta(luta, { ...PARADO, ...entrada, atacar: true }, rng, AGORA);
  const meio = DURACAO_DA_BARRA / 2;
  const fim = rodar(aberto.luta, meio + RECARGA_DO_ATAQUE, rng, (i) => (i === meio - 1 ? { ...PARADO, tocar: true } : PARADO));
  return {
    luta: fim.luta,
    acontecimentos: [...aberto.acontecimentos, ...fim.acontecimentos],
    apoios: [...(aberto.apoios ?? []), ...fim.apoios],
    ...(fim.moral !== undefined ? { moral: fim.moral } : {}),
  };
}

function vidaDoMonstro(luta: LutaEmTempoReal, indice = 0): number {
  return ((celulaAtual(luta.estado) as DungeonCell).monsters ?? [])[indice]!.hp;
}

function heroi(luta: LutaEmTempoReal): Hero {
  return luta.estado.hero;
}

function avisos(r: Rodada): string[] {
  return r.acontecimentos.filter((a) => a.tipo === 'aviso' && a.texto).map((a) => a.texto as string);
}

/** O herói uma casa abaixo do meio da sala (onde o monstro sozinho fica). */
const PERTO: Walker = { x: 4.5 * T, y: 5.5 * T, facing: 'N' };
/** O monstro sozinho fica no meio da sala. */
const MEIO = { x: 4.5 * T, y: 4.5 * T };
/** No canto de baixo à esquerda: longe do monstro do meio (4 blocos). */
const CANTO: Walker = { x: 1.5 * T, y: 7.5 * T, facing: 'N' };

const K: EntradaDaLuta = { x: 0, y: 0, canalizar: true };

describe('segurar K', () => {
  it('o Mago parado puxa 5 de mana por segundo; andando ou sem segurar, nada', () => {
    const luta = abrirLuta(naSala('mago', 'Mago', [monstro()], { mp: 10, maxMp: 300 }), CANTO).luta;
    expect(heroi(rodar(luta, 60, NUNCA, () => K).luta).mp).toBe(15);
    expect(heroi(rodar(luta, 60, NUNCA, () => ({ ...K, x: 100 })).luta).mp).toBe(10);
    expect(heroi(rodar(luta, 60, NUNCA).luta).mp).toBe(10);
    expect(extrasDaLuta(rodar(luta, 5, NUNCA, () => K).luta).canalizando).toBe(true);
  });

  it('o Monge junta 10 de ki por segundo até 300, e o ki volta pra memória do app', () => {
    const luta = abrirLuta(naSala('monge', 'Monge', [monstro()]), CANTO).luta;
    const juntou = rodar(luta, 60, NUNCA, () => K).luta;
    expect(juntou.arena.ki).toBe(10);
    expect(memoriaDaLuta(juntou).ki).toBe(10);
    const quase = { ...luta, arena: { ...luta.arena, ki: 299 } };
    expect(rodar(quase, 60, NUNCA, () => K).luta.arena.ki).toBe(REGRAS_DO_MONGE.tetoDoKi);
    expect(abrirLuta(naSala('monge', 'Monge', [monstro()]), CANTO, null, false, null, { ki: 120 }).luta.arena.ki).toBe(120);
  });

  it('quem não canaliza (o Guerreiro) não ganha nada', () => {
    const luta = abrirLuta(naSala('guerreiro', 'Guerreiro', [monstro()], { mp: 10, maxMp: 300 }), CANTO).luta;
    const fim = rodar(luta, 60, NUNCA, () => K).luta;
    expect(heroi(fim).mp).toBe(10);
    expect(fim.arena.ki).toBeUndefined();
  });
});

describe('o Mago', () => {
  it('o disparo custa 40 de mana na arena; sem os 40, ele bate com o golpe físico', () => {
    const comMana = abrirLuta(naSala('mago', 'Mago', [monstro({ speciesId: 'goblin' })], { mp: 50, maxMp: 300 }), PERTO).luta;
    expect(heroi(golpeNoMeio(comMana, { cursor: MEIO }).luta).mp).toBe(50 - REGRAS_DO_MAGO.custoDoDisparo);
    const pouca = abrirLuta(naSala('mago', 'Mago', [monstro({ speciesId: 'goblin' })], { mp: 30, maxMp: 300 }), PERTO).luta;
    const fim = golpeNoMeio(pouca, { cursor: MEIO }).luta;
    expect(heroi(fim).mp).toBe(30);
    expect(vidaDoMonstro(fim)).toBeLessThan(4000);
  });
});

describe('o Monge', () => {
  it('revestir pede 300 de ki; revestido, bate +40% até levar um golpe, que chega 30% mais fraco e quebra', () => {
    const sala = naSala('monge', 'Monge', [monstro({ speciesId: 'goblin', dmg: 60 })]);
    const luta = abrirLuta(sala, PERTO).luta;
    expect(rodar(luta, 1, NUNCA, () => ({ ...PARADO, revestir: true })).luta.arena.revestido).toBeUndefined();

    const cheio = { ...luta, arena: { ...luta.arena, ki: 300 } };
    const r = rodar(cheio, 1, NUNCA, () => ({ ...PARADO, revestir: true }));
    expect(r.luta.arena.revestido).toBe(true);
    expect(r.luta.arena.ki).toBeUndefined();
    expect(avisos(r)).toContain('☯️ Revestido de ki');

    const sem = 4000 - vidaDoMonstro(golpeNoMeio(luta, { cursor: MEIO }).luta);
    const com = 4000 - vidaDoMonstro(golpeNoMeio({ ...luta, arena: { ...luta.arena, revestido: true } }, { cursor: MEIO }).luta);
    expect(Math.abs(com / sem - (100 + 40) / 100)).toBeLessThan(0.05);

    const levou = (revestido: boolean) => {
      const inicio = { ...luta, arena: { ...luta.arena, ...(revestido ? { revestido: true } : {}) } };
      const fim = rodar(inicio, 400, NUNCA);
      const golpe = fim.acontecimentos.find((a) => a.tipo === 'numero' && a.onde === 'heroi' && a.tom === 'dano');
      return { dano: Number((golpe?.texto ?? '-0').slice(1)), luta: fim.luta, avisos: avisos(fim) };
    };
    const normal = levou(false);
    const protegido = levou(true);
    expect(normal.dano).toBeGreaterThan(0);
    expect(Math.abs(protegido.dano - (normal.dano - Math.floor((normal.dano * 30) / 100)))).toBeLessThanOrEqual(1);
    expect(protegido.luta.arena.revestido).toBeUndefined();
    expect(protegido.avisos).toContain('☯️ O revestimento se quebra');
  });

  it('a explosão gasta todo o ki, bate em quem está a até 2 blocos (o mesmo dano em todos) e empurra; quem está longe, nada', () => {
    const sala = naSala('monge', 'Monge', [monstro(), monstro(), monstro()]);
    const aberta = abrirLuta(sala, PERTO).luta;
    // Dois colados no herói, um longe no canto de cima.
    const montada = {
      ...aberta,
      arena: {
        ...aberta.arena,
        ki: 300,
        heroi: { x: 4.5 * T, y: 5.5 * T, facing: 'N' as const },
        monstros: aberta.arena.monstros.map((m, i) => ({ ...m, corpoX: [3.5, 5.5, 1.5][i]! * T, corpoY: [5.5, 5.5, 1.5][i]! * T })),
      },
    };
    const r = rodar(montada, 1, NUNCA, () => ({ ...PARADO, explodir: true }));
    expect(r.luta.arena.ki).toBeUndefined();
    expect(avisos(r)).toContain('💥 Explosão de ki');
    const perdeu = [0, 1, 2].map((i) => 4000 - vidaDoMonstro(r.luta, i));
    expect(perdeu[0]).toBeGreaterThan(0);
    expect(perdeu[1]).toBe(perdeu[0]);
    expect(perdeu[2]).toBe(0);
    // Empurrados 1 bloco pra longe dele (e no mesmo passo ainda andam um pouco de volta).
    expect(Math.abs(r.luta.arena.monstros[0]!.corpoX - 2.5 * T)).toBeLessThanOrEqual(40);
    expect(Math.abs(r.luta.arena.monstros[1]!.corpoX - 6.5 * T)).toBeLessThanOrEqual(40);
    expect(extrasDaLuta(montada).ki).toBe(300);
  });

  it('a explosão com metade do ki bate perto da metade', () => {
    const sala = naSala('monge', 'Monge', [monstro()]);
    const aberta = abrirLuta(sala, PERTO).luta;
    const dano = (ki: number) => 4000 - vidaDoMonstro(rodar({ ...aberta, arena: { ...aberta.arena, ki } }, 1, NUNCA, () => ({ ...PARADO, explodir: true })).luta);
    const cheio = dano(300);
    const meio = dano(150);
    expect(Math.abs(meio / cheio - 0.5)).toBeLessThan(0.08);
  });
});
