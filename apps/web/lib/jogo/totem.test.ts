import { describe, expect, it } from 'vitest';

import { entryFloors, seededRng, type DungeonRun } from '@rpg-legend/shared';

import { celulaAtual, retomarSave, type EstadoNaMasmorra } from './estado';
import { saveSorteado } from './heroi-sorteado';
import { interagir } from './sala';
import { tocarTotem, voltarPeloTotem } from './totem';

function noAndar(floor: number, masmorra: DungeonRun = { dungeon: 'floresta', difficulty: 'normal' }): EstadoNaMasmorra {
  const estado = retomarSave({ ...saveSorteado('Aria', seededRng(6)), floor, mapMode: 'dungeon', masmorra, progresso: { cleared: [], totems: {} } }, seededRng(6));
  if (estado.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
  return estado;
}

function noTotem(estado: EstadoNaMasmorra): EstadoNaMasmorra {
  const sala = estado.map.flat().find((celula) => celula.type === 'totem');
  if (!sala) throw new Error('andar sem totem');
  return { ...estado, pos: { x: sala.x, y: sala.y } };
}

describe('totem', () => {
  it('tocar marca o andar no portão, pra esta masmorra e dificuldade', () => {
    const { estado, texto } = tocarTotem(noAndar(20));

    expect(entryFloors(estado.progresso, estado.masmorra)).toEqual([1, 20]);
    expect(texto).toContain('o andar 20 de Floresta · Normal');
  });

  it('tocar de novo não marca outra vez e avisa', () => {
    const uma = tocarTotem(noAndar(40, { dungeon: 'floresta', difficulty: 'dificil' }));
    const duas = tocarTotem(uma.estado);

    expect(duas.estado.progresso).toBe(uma.estado.progresso);
    expect(duas.texto).toContain('já conhece você');
  });

  it('voltar pelo totem leva pra cidade levando o andar marcado', () => {
    const cidade = voltarPeloTotem(tocarTotem(noAndar(20)));

    expect(cidade.mapMode).toBe('city');
    expect(entryFloors(cidade.progresso, cidade.masmorra)).toEqual([1, 20]);
  });

  it('entrar na sala do totem já marca, antes de qualquer botão', () => {
    const { estado, tela } = interagir(noTotem(noAndar(20)), seededRng(1));

    expect(tela?.tipo).toBe('totem');
    expect(entryFloors(estado.progresso, estado.masmorra)).toEqual([1, 20]);
    expect(celulaAtual(estado)?.type).toBe('totem');
  });
});
