import { describe, expect, it } from 'vitest';

import { armadilhaSob, ARMADILHAS, chanceDeVer, colocarArmadilhas, marcasDasArmadilhas, type Armadilha } from '../dungeon/armadilhas.js';
import { generateDungeonFloor, type DungeonCell } from '../dungeon/generate.js';
import { TILE_UNITS } from '../dungeon/room-walk.js';
import {
  curarMembros,
  forcaDoBraco,
  passarDeSala,
  quebrarMembro,
  ritmoDoAndar,
  textosDosFerimentos,
} from '../hero/ferimentos.js';
import { attemptFlee } from '../combat/flee.js';
import { consumeItem } from '../inventory/inventory.js';
import { instantiate } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import { seededRng } from '../rng.js';
import { pisarNaArmadilha } from './armadilhas.js';
import { andar, celulaAtual, entrarNaCidade, retomarSave, substituirCelulaAtual, vizinhaEm, type EstadoNaMasmorra } from './estado.js';
import { saveSorteado } from './heroi-sorteado.js';
import { interagir } from './sala.js';

/** Armadilhas e ferimentos (doc do Breno de 2026-11-06). */

function naMasmorra(): EstadoNaMasmorra {
  const estado = retomarSave({ ...saveSorteado('Aria', seededRng(4)), floor: 3, mapMode: 'dungeon' }, seededRng(11));
  if (estado.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
  return estado;
}

function comArmadilha(tipo: Armadilha['tipo']): EstadoNaMasmorra {
  const estado = naMasmorra();
  const sala = celulaAtual(estado) as DungeonCell;
  return substituirCelulaAtual(estado, { ...sala, armadilhas: [{ tipo, col: 2, row: 2 }] });
}

const nasCasa = (col: number, row: number) => ({ x: col * TILE_UNITS + TILE_UNITS / 2, y: row * TILE_UNITS + TILE_UNITS / 2 });

describe('as armadilhas no andar', () => {
  it('ficam fora do início, da saída, da escada e do covil, e nunca no conteúdo nem na chegada', () => {
    for (const semente of [1, 2, 3, 4, 5, 6]) {
      const andarGerado = generateDungeonFloor(10, 6, 6, { rng: seededRng(semente), entrada: true });
      for (const sala of andarGerado.rooms) {
        if (!sala.armadilhas) continue;
        expect(['start', 'exit', 'stairs', 'boss']).not.toContain(sala.type);
        for (const a of sala.armadilhas) expect(a.col === 4 && a.row === 4).toBe(false);
      }
    }
  });

  it('quem tem mais Sabedoria vê mais armadilhas antes', () => {
    expect(chanceDeVer(8)).toBe(0);
    expect(chanceDeVer(13)).toBeCloseTo(0.3);
    expect(chanceDeVer(30)).toBe(0.6);
    const sala: DungeonCell = { type: 'normal', x: 0, y: 0, doors: { N: true } };
    colocarArmadilhas([sala], 'floresta', 30, () => 0);
    expect(sala.armadilhas?.[0]?.vista).toBe(true);
  });

  it('a casa sob o herói é a do centro da base dele', () => {
    const sala = { armadilhas: [{ tipo: 'dardo' as const, col: 2, row: 3 }] };
    expect(armadilhaSob(sala, nasCasa(2, 3))).toBe(0);
    expect(armadilhaSob(sala, nasCasa(3, 3))).toBeNull();
    expect(armadilhaSob({ armadilhas: [{ tipo: 'dardo', col: 2, row: 3, disparada: true }] }, nasCasa(2, 3))).toBeNull();
  });

  it('o chão mostra a disparada e o brilho da vista; a escondida, não', () => {
    expect(marcasDasArmadilhas({ armadilhas: [{ tipo: 'pedras', col: 1, row: 1 }] })).toEqual([]);
    expect(marcasDasArmadilhas({ armadilhas: [{ tipo: 'pedras', col: 1, row: 1, vista: true }] })[0]?.icone).toBe('✨');
    expect(marcasDasArmadilhas({ armadilhas: [{ tipo: 'pedras', col: 1, row: 1, disparada: true }] })[0]?.icone).toBe(ARMADILHAS.pedras.icone);
  });
});

describe('pisar', () => {
  it('os espinhos tiram vida, fazem sangrar e ficam à vista', () => {
    const antes = comArmadilha('espinhos');
    const pisou = pisarNaArmadilha(antes, 0, seededRng(1))!;
    expect(pisou.estado.hero.hp).toBeLessThan(antes.hero.hp);
    expect(pisou.estado.hero.ferimentos?.sangramento).toBe(2);
    expect((celulaAtual(pisou.estado) as DungeonCell).armadilhas?.[0]?.disparada).toBe(true);
    expect(pisarNaArmadilha(pisou.estado, 0, seededRng(1))).toBeNull();
  });

  it('nunca mata: para em 1 de vida', () => {
    const fraco = comArmadilha('espinhos');
    const pisou = pisarNaArmadilha({ ...fraco, hero: { ...fraco.hero, hp: 1 } }, 0, seededRng(1))!;
    expect(pisou.estado.hero.hp).toBe(1);
  });

  it('as pedras podem quebrar um membro', () => {
    const pisou = pisarNaArmadilha(comArmadilha('pedras'), 0, () => 0)!;
    expect(pisou.estado.hero.ferimentos?.braco).toBe(true);
    expect(pisou.aviso.texto).toContain('quebram um braço');
  });
});

describe('os ferimentos', () => {
  it('o veneno tira vida a cada sala e passa depois de algumas', () => {
    const estado = naMasmorra();
    const envenenado = { ...estado, hero: { ...estado.hero, ferimentos: { veneno: 2 } } };
    const direcao = (['N', 'S', 'E', 'W'] as const).find((d) => vizinhaEm(envenenado, d))!;
    const uma = andar(envenenado, direcao);
    expect(uma.hero.hp).toBeLessThan(envenenado.hero.hp);
    expect(uma.hero.ferimentos?.veneno).toBe(1);
    expect(passarDeSala(uma.hero).hero.ferimentos).toBeUndefined();
  });

  it('o braço quebrado bate 30% mais fraco, a perna anda e foge pior', () => {
    const estado = naMasmorra();
    const quebrado = { ...estado.hero, ferimentos: { braco: true as const, perna: true as const } };
    expect(forcaDoBraco(quebrado)).toBe(0.7);
    expect(ritmoDoAndar(quebrado)).toBe(0.6);
    expect(attemptFlee(quebrado, { speed: 1 }, 12).total).toBe(attemptFlee(estado.hero, { speed: 1 }, 12).total - 4);
    expect(textosDosFerimentos(quebrado)).toEqual(['🦴 Braço quebrado', '🦵 Perna quebrada']);
  });

  it('a tala conserta o braço e a perna, e a taverna sara tudo', () => {
    const estado = naMasmorra();
    const ferido = { ...quebrarMembro(estado.hero, () => 0).hero, ferimentos: { braco: true as const, veneno: 2 } };
    expect(curarMembros(ferido).ferimentos).toEqual({ veneno: 2 });

    const tala = instantiate(templateById('tala')!, RARITIES[0]!, { rng: seededRng(1), now: () => 1 });
    const usada = consumeItem(ferido, [tala], tala);
    expect(usada.outcome.kind).toBe('used');
    expect(usada.hero.ferimentos).toEqual({ veneno: 2 });
    expect(usada.inventory).toEqual([]);

    const cidade = entrarNaCidade(saveSorteado('Aria', seededRng(4)));
    const taverna = cidade.map.flat().find((c) => c.type === 'tavern')!;
    const noite = interagir({ ...cidade, hero: { ...ferido, gold: 500 }, pos: { x: taverna.x, y: taverna.y } });
    expect(noite.estado.hero.ferimentos).toBeUndefined();
  });
});
