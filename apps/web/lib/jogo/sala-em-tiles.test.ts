import { describe, expect, it } from 'vitest';

import { ALTURA_DA_SALA, CENTRO, chegada, darPasso, LARGURA_DA_SALA, plantaDaSala, type PassoNaSala } from './sala-em-tiles';

const TODAS = { N: true, S: true, E: true, W: true };

describe('plantaDaSala', () => {
  it('parede em volta, chão dentro', () => {
    const { ladrilhos } = plantaDaSala({}, false);
    expect(ladrilhos).toHaveLength(ALTURA_DA_SALA);
    expect(ladrilhos[0]).toHaveLength(LARGURA_DA_SALA);
    expect(ladrilhos[0]!.every((l) => l === 'parede')).toBe(true);
    expect(ladrilhos[3]![0]).toBe('parede');
    expect(ladrilhos[3]![4]).toBe('chao');
  });

  it('vão de porta no meio de cada parede que tem porta, e só nelas', () => {
    const { ladrilhos } = plantaDaSala({ N: true, E: true }, false);
    expect(ladrilhos[0]![4]).toBe('porta');
    expect(ladrilhos[3]![8]).toBe('porta');
    expect(ladrilhos[6]![4]).toBe('parede');
    expect(ladrilhos[3]![0]).toBe('parede');
  });

  it('o conteúdo da sala fica no centro, e sala vazia não tem', () => {
    expect(plantaDaSala({}, true).objeto).toEqual(CENTRO);
    expect(plantaDaSala({}, false).objeto).toBeNull();
  });
});

describe('darPasso', () => {
  const planta = plantaDaSala(TODAS, true);
  const em = (x: number, y: number, olhando: PassoNaSala['olhando'] = 'S'): PassoNaSala => ({ x, y, olhando });

  it('anda um quadradinho no chão', () => {
    expect(darPasso(planta, em(2, 2), 'E')).toEqual({ kind: 'andou', passo: em(3, 2, 'E') });
  });

  it('parede só vira o herói pra aquele lado', () => {
    expect(darPasso(planta, em(1, 1), 'N')).toEqual({ kind: 'parado', passo: em(1, 1, 'N') });
  });

  it('o conteúdo da sala é sólido: se contorna', () => {
    expect(darPasso(planta, em(4, 4), 'N')).toEqual({ kind: 'parado', passo: em(4, 4, 'N') });
  });

  it('pisar no vão da porta leva pra sala vizinha', () => {
    expect(darPasso(planta, em(4, 1), 'N')).toEqual({ kind: 'porta', direcao: 'N' });
    expect(darPasso(planta, em(7, 3), 'E')).toEqual({ kind: 'porta', direcao: 'E' });
    expect(darPasso(planta, em(4, 5), 'S')).toEqual({ kind: 'porta', direcao: 'S' });
    expect(darPasso(planta, em(1, 3), 'W')).toEqual({ kind: 'porta', direcao: 'W' });
  });

  it('sem porta daquele lado, a parede segura', () => {
    expect(darPasso(plantaDaSala({ S: true }, false), em(4, 1), 'N').kind).toBe('parado');
  });
});

describe('chegada', () => {
  it('quem andou pro norte chega pela porta do sul, um passo pra dentro', () => {
    expect(chegada('N')).toEqual({ x: 4, y: 5, olhando: 'N' });
    expect(chegada('S')).toEqual({ x: 4, y: 1, olhando: 'S' });
    expect(chegada('E')).toEqual({ x: 1, y: 3, olhando: 'E' });
    expect(chegada('W')).toEqual({ x: 7, y: 3, olhando: 'W' });
  });

  it('o próximo passo na mesma direção não sai de novo pela porta', () => {
    const planta = plantaDaSala(TODAS, false);
    for (const direcao of ['N', 'S', 'E', 'W'] as const) {
      expect(darPasso(planta, chegada(direcao), direcao).kind, direcao).toBe('andou');
    }
  });

  it('sem direção, logo abaixo do conteúdo, fora dele', () => {
    const lugar = chegada(null);
    expect(lugar).toEqual({ x: 4, y: 5, olhando: 'S' });
    expect(lugar.y).not.toBe(CENTRO.y);
  });
});
