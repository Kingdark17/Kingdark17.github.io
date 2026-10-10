import { describe, expect, it } from 'vitest';

import { lerMira } from '@rpg-legend/shared';

import { DURACAO_DA_BARRA_MS, miraNoInstante, rotuloDaLeitura, trechosDaBarra } from './barra-de-mira';

describe('o relógio da barra', () => {
  it('o cursor sai do começo e chega ao meio na metade do tempo', () => {
    expect(miraNoInstante(0)).toBe(0);
    expect(miraNoInstante(DURACAO_DA_BARRA_MS / 2)).toBe(0.5);
  });

  it('passou do fim sem toque: não há mira, e a engine lê como erro', () => {
    expect(miraNoInstante(DURACAO_DA_BARRA_MS)).toBeNull();
    expect(lerMira(0.5, miraNoInstante(DURACAO_DA_BARRA_MS + 50)).acerto).toBe(false);
  });

  /** O quadro do `requestAnimationFrame` pode carimbar um instante anterior ao começo medido. */
  it('tempo negativo fica no começo da barra', () => {
    expect(miraNoInstante(-8)).toBe(0);
  });
});

describe('o desenho da barra', () => {
  it('a zona fica no meio: metade da barra vai de 25% a 75%', () => {
    expect(trechosDaBarra(0.5).zona).toEqual({ inicio: 25, largura: 50 });
  });

  it('a faixa do crítico tem 5% e também fica no meio', () => {
    const { critica } = trechosDaBarra(0.5);
    expect(critica.inicio).toBeCloseTo(47.5);
    expect(critica.largura).toBeCloseTo(5);
  });
});

describe('o que a barra diz ao parar', () => {
  it('força com vírgula, crítico com destaque, e o erro', () => {
    expect(rotuloDaLeitura({ acerto: true, forca: 1.35, critico: false })).toBe('1,35×');
    expect(rotuloDaLeitura({ acerto: true, forca: 1.5, critico: true })).toBe('Crítico! 1,5×');
    expect(rotuloDaLeitura({ acerto: true, forca: 1, critico: false })).toBe('1×');
    expect(rotuloDaLeitura({ acerto: false, forca: 0, critico: false })).toBe('Errou');
  });
});
