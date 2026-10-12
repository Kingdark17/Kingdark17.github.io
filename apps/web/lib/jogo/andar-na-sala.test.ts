import { describe, expect, it } from 'vitest';

import { CONTENT_TILE, HERO_HALF, TILE_UNITS, roomArrival } from '@rpg-legend/shared';

import {
  ID_DO_CONTEUDO,
  MAX_PASSOS_POR_QUADRO,
  MS_POR_PASSO,
  PARADO,
  andarNoQuadro,
  entradaCombinada,
  passosDoQuadro,
  plantaDaSala,
  vetorDasTeclas,
} from './andar-na-sala';

const centro = (quadrado: number) => quadrado * TILE_UNITS + TILE_UNITS / 2;

describe('passosDoQuadro', () => {
  it('roda os passos que cabem e guarda o resto pro próximo quadro', () => {
    const umQuadro = passosDoQuadro(0, MS_POR_PASSO * 2.5);
    expect(umQuadro.passos).toBe(2);
    expect(umQuadro.sobra).toBeCloseTo(MS_POR_PASSO * 0.5);
    expect(passosDoQuadro(umQuadro.sobra, MS_POR_PASSO * 0.5).passos).toBe(1);
  });

  it('a aba que volta do fundo não simula tudo de uma vez', () => {
    expect(passosDoQuadro(0, 30_000)).toEqual({ passos: MAX_PASSOS_POR_QUADRO, sobra: 0 });
  });

  it('tempo negativo (relógio que voltou) não anda', () => {
    expect(passosDoQuadro(0, -50).passos).toBe(0);
  });
});

describe('entrada', () => {
  it('duas teclas juntas são diagonal e opostas se anulam', () => {
    expect(vetorDasTeclas(['N', 'E'])).toEqual({ x: 1, y: -1 });
    expect(vetorDasTeclas(['W', 'E'])).toEqual({ x: 0, y: 0 });
    expect(vetorDasTeclas([])).toEqual({ x: 0, y: 0 });
  });

  it('o joystick em uso manda; parado, valem as teclas', () => {
    expect(entradaCombinada(['N'], { x: 0.4, y: 0.2 })).toEqual({ x: 0.4, y: 0.2 });
    expect(entradaCombinada(['N'], PARADO)).toEqual({ x: 0, y: -1 });
  });
});

describe('andarNoQuadro', () => {
  const planta = plantaDaSala({ N: true, S: true, E: true, W: true }, true);

  it('para na porta atravessada, sem simular os passos que sobram', () => {
    const quadro = andarNoQuadro(planta, { x: centro(4), y: centro(1), facing: 'N' }, { x: 0, y: -1 }, 50, null);
    expect(quadro.saida).toBe('N');
  });

  it('para no encostão com o conteúdo e avisa qual foi', () => {
    const antes = { x: CONTENT_TILE.col * TILE_UNITS - HERO_HALF - 100, y: centro(CONTENT_TILE.row), facing: 'E' as const };
    const quadro = andarNoQuadro(planta, antes, { x: 1, y: 0 }, MAX_PASSOS_POR_QUADRO, null);
    expect(quadro.encostou).toBe(ID_DO_CONTEUDO);
    expect(quadro.tocando).toBe(ID_DO_CONTEUDO);
  });

  it('quem já estava encostado não aciona de novo; só se afastar e voltar', () => {
    const colado = { x: CONTENT_TILE.col * TILE_UNITS - HERO_HALF, y: centro(CONTENT_TILE.row), facing: 'E' as const };
    expect(andarNoQuadro(planta, colado, { x: 1, y: 0 }, 3, ID_DO_CONTEUDO).encostou).toBeNull();
    const longe = andarNoQuadro(planta, colado, { x: -1, y: 0 }, 6, ID_DO_CONTEUDO);
    expect(longe.tocando).toBeNull();
    expect(andarNoQuadro(planta, longe.walker, { x: 1, y: 0 }, 6, longe.tocando).encostou).toBe(ID_DO_CONTEUDO);
  });

  it('parado não anda nem aciona nada', () => {
    const quadro = andarNoQuadro(planta, roomArrival('N'), PARADO, 6, null);
    expect(quadro).toEqual({ walker: roomArrival('N'), saida: null, encostou: null, tocando: null, andou: false });
  });

  it('sala vazia não tem conteúdo pra encostar', () => {
    expect(plantaDaSala({ N: true }, false).objects).toEqual([]);
  });
});
