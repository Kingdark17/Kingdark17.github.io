import { describe, expect, it } from 'vitest';

import { modifyDamageByAffinity } from '../combat/damage.js';
import { freshCombatMonster, type CombatMonster } from '../combat/monster-state.js';
import type { DungeonId } from '../dungeon/dungeons.js';
import type { DungeonCell } from '../dungeon/generate.js';
import { generateBoss, monsterView } from '../monsters/generate.js';
import { escudoDoChefe, marcasDoChefe, sortearMecanicas, type MecanicaDoChefe } from '../monsters/mecanicas-do-chefe.js';
import { seededRng } from '../rng.js';
import { escuroNaLuta, ferirMonstro, poderDaVez } from './chefe-final.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from './estado.js';
import { saveSorteado } from './heroi-sorteado.js';

/** As mecânicas dos chefes de andar 5 (doc do Breno de 2026-11-06). */

function noChefe(masmorra: DungeonId, mecanicas: MecanicaDoChefe[] = [], extra: Partial<CombatMonster> = {}): EstadoNaMasmorra {
  const base = retomarSave({ ...saveSorteado('Aria', seededRng(4)), floor: 5, mapMode: 'dungeon' }, seededRng(11));
  if (base.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
  const estado: EstadoNaMasmorra = { ...base, masmorra: { dungeon: masmorra, difficulty: 'normal' } };
  const chefe: CombatMonster = { ...freshCombatMonster({ ...generateBoss(5, { rng: seededRng(2) }), mecanicas }), hp: 100, maxHp: 100, ...extra };
  const sala = celulaAtual(estado) as DungeonCell;
  return substituirCelulaAtual(estado, { ...sala, type: 'boss', monsters: [chefe], monsterIndex: 0, beaten: false });
}

function golpear(estado: EstadoNaMasmorra, vida: number) {
  const chefe = (celulaAtual(estado) as DungeonCell).monsters![0] as CombatMonster;
  return ferirMonstro(estado, 0, { ...chefe, hp: vida }, seededRng(9));
}

describe('o sorteio', () => {
  it('uma ou duas, sem repetir, e na Floresta nunca o invocar', () => {
    for (let semente = 1; semente < 40; semente++) {
      const m = sortearMecanicas('floresta', seededRng(semente));
      expect(m.length === 1 || m.length === 2).toBe(true);
      expect(new Set(m).size).toBe(m.length);
      expect(m).not.toContain('invocar');
    }
  });

  it('o chefe de andar 5 nasce com elas, e com a barreira quando ela sai; o chefe final, não', () => {
    const chefe = generateBoss(5, { rng: seededRng(3), masmorra: 'torre' });
    expect(chefe.mecanicas?.length).toBeGreaterThan(0);
    if (chefe.mecanicas?.includes('barreira')) expect(chefe.barreira).toBe(Math.round(chefe.maxHp * 0.2));
    expect(generateBoss(100, { rng: seededRng(3), final: true }).mecanicas).toBeUndefined();
  });
});

describe('a segunda fase, na metade da vida', () => {
  it('na Floresta ele chama dois lobos', () => {
    const ferida = golpear(noChefe('floresta'), 40);
    expect(ferida.monstro.fase2).toBe(true);
    expect(ferida.lacaios).toHaveLength(2);
    const sala = celulaAtual(ferida.estado) as DungeonCell;
    expect(sala.monsters?.slice(1).every((m) => m.speciesId === 'lobo_sombras' && m.gold === 0)).toBe(true);
    expect(ferida.textos.join(' ')).toContain('lobos');
  });

  it('na Caverna a luz se apaga', () => {
    const ferida = golpear(noChefe('caverna'), 40);
    expect(ferida.monstro.escuro).toBe(true);
    expect(escuroNaLuta(celulaAtual(ferida.estado) as DungeonCell)).toBe(true);
    expect(marcasDoChefe(ferida.monstro)).toContain('🌑 escuridão: a mira some');
  });

  it('na Torre o escudo elemental reveza a cada dois golpes e segura o dano do tipo dele', () => {
    const ferida = golpear(noChefe('torre'), 40);
    expect(ferida.monstro.escudoElemental).toBe(true);
    expect(escudoDoChefe({ escudoElemental: true, attackCount: 0 })).toBe('fisico');
    expect(escudoDoChefe({ escudoElemental: true, attackCount: 2 })).toBe('magico');
    const monstro = ferida.monstro;
    expect(modifyDamageByAffinity(monstro, monsterView(monstro).species.weakness, monsterView(monstro).species.resistance, 100, 'fisico', false).dmg).toBeLessThan(40);
  });

  it('o golpe que o derrubaria de cima da metade para nela', () => {
    const ferida = golpear(noChefe('caverna'), -50);
    expect(ferida.caiu).toBe(false);
    expect(ferida.monstro.hp).toBe(50);
  });
});

describe('as sorteadas', () => {
  it('a barreira segura o golpe até quebrar', () => {
    const primeira = golpear(noChefe('caverna', ['barreira'], { barreira: 15 }), 90);
    expect(primeira.monstro.hp).toBe(100);
    expect(primeira.monstro.barreira).toBe(5);
    const segunda = golpear(primeira.estado, 90);
    expect(segunda.monstro.hp).toBe(95);
    expect(segunda.monstro.barreira).toBeUndefined();
  });

  it('a cura vem uma vez com 30% da vida, e a fúria deixa ele mais forte', () => {
    const ferida = golpear(noChefe('caverna', ['cura', 'furia'], { fase2: true }), 20);
    expect(ferida.monstro.hp).toBe(45);
    expect(ferida.monstro.curou).toBe(true);
    expect(ferida.monstro.furia).toBe(true);
    expect(golpear(ferida.estado, 10).monstro.hp).toBe(10);
  });

  it('o golpe carregado: o Devastador a cada quatro golpes', () => {
    const chefe = { ...generateBoss(5, { rng: seededRng(2) }), mecanicas: ['carregado'] as MecanicaDoChefe[] };
    expect(poderDaVez({ ...chefe, attackCount: 2 })).toBeNull();
    expect(poderDaVez({ ...chefe, attackCount: 3 })).toBe('devastador');
  });
});
