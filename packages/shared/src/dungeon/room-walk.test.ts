import { describe, expect, it } from 'vitest';

import {
  CONTENT_TILE,
  HERO_HALF,
  HERO_SPEED,
  ROOM_COLS,
  ROOM_ROWS,
  STICK_MAX,
  TILE_UNITS,
  roomArrival,
  roomLayout,
  stickInput,
  walkTick,
  type RoomLayout,
  type Walker,
  type WalkInput,
} from './room-walk.js';

const TODAS = { N: true, S: true, E: true, W: true };
const CONTEUDO = [{ id: 'content', ...CONTENT_TILE }];

/** Centro de um quadrado, em unidades. */
const c = (quadrado: number) => quadrado * TILE_UNITS + TILE_UNITS / 2;

function andar(layout: RoomLayout, walker: Walker, input: WalkInput, passos: number) {
  let atual = walker;
  let ultimo = walkTick(layout, atual, input);
  for (let i = 0; i < passos; i++) {
    ultimo = walkTick(layout, atual, input);
    atual = ultimo.walker;
    if (ultimo.exit) break;
  }
  return ultimo;
}

describe('roomLayout', () => {
  it('fecha a borda, abre só os vãos das portas que existem e marca o objeto como sólido', () => {
    const planta = roomLayout({ N: true, E: true }, CONTEUDO);
    expect(planta.doors).toEqual(['N', 'E']);
    expect(planta.solid[0]?.[4]).toBe(false);
    expect(planta.solid[ROOM_ROWS - 1]?.[4]).toBe(true);
    expect(planta.solid[CONTENT_TILE.row]?.[ROOM_COLS - 1]).toBe(false);
    expect(planta.solid[CONTENT_TILE.row]?.[0]).toBe(true);
    expect(planta.solid[CONTENT_TILE.row]?.[4]).toBe(true);
    expect(planta.solid[1]?.[1]).toBe(false);
  });
});

describe('stickInput', () => {
  it('leva -1..1 pra inteiro e encosta no limite fora da faixa', () => {
    expect(stickInput(1, -1)).toEqual({ x: STICK_MAX, y: -STICK_MAX });
    expect(stickInput(0.5, 0)).toEqual({ x: 63, y: 0 });
    expect(stickInput(3, -7)).toEqual({ x: STICK_MAX, y: -STICK_MAX });
  });
});

describe('walkTick', () => {
  const planta = roomLayout(TODAS, CONTEUDO);
  const meio: Walker = { x: c(2), y: c(2), facing: 'S' };

  it('anda HERO_SPEED por passo com o joystick no fim e vira pra onde anda', () => {
    const passo = walkTick(planta, meio, { x: STICK_MAX, y: 0 });
    expect(passo.walker).toEqual({ x: c(2) + HERO_SPEED, y: c(2), facing: 'E' });
    expect(passo.exit).toBeNull();
  });

  it('na diagonal não anda mais rápido que reto', () => {
    const passo = walkTick(planta, meio, { x: STICK_MAX, y: STICK_MAX });
    const dx = passo.walker.x - meio.x;
    const dy = passo.walker.y - meio.y;
    expect(dx).toBe(dy);
    expect(dx * dx + dy * dy).toBeLessThanOrEqual(HERO_SPEED * HERO_SPEED);
  });

  it('parado não muda nada, nem pra onde olha', () => {
    expect(walkTick(planta, meio, { x: 0, y: 0 }).walker).toEqual(meio);
  });

  it('para encostado na parede e escorrega ao longo dela', () => {
    // Sem porta a oeste: com ela, escorregar pela parede leva pra dentro do vão (o certo).
    const semOeste = roomLayout({ N: true, S: true, E: true }, CONTEUDO);
    const encostado = andar(semOeste, { x: c(1), y: c(2), facing: 'W' }, { x: -STICK_MAX, y: STICK_MAX }, 30);
    // Encostou na parede da esquerda (x mínimo) e continuou descendo.
    expect(encostado.walker.x).toBe(TILE_UNITS + HERO_HALF);
    expect(encostado.walker.y).toBeGreaterThan(c(2));
  });

  it('contorna o conteúdo da sala, que é sólido, e diz que encostou nele', () => {
    const passo = andar(planta, { x: c(2), y: c(CONTENT_TILE.row), facing: 'E' }, { x: STICK_MAX, y: 0 }, 60);
    expect(passo.walker.x).toBe(CONTENT_TILE.col * TILE_UNITS - HERO_HALF);
    expect(passo.touching).toBe('content');
  });

  it('atravessa o vão alinhado e devolve a porta', () => {
    const passo = andar(planta, { x: c(4), y: c(2), facing: 'N' }, { x: 0, y: -STICK_MAX }, 60);
    expect(passo.exit).toBe('N');
  });

  it('sem porta daquele lado, a parede segura', () => {
    const fechada = roomLayout({ S: true }, []);
    const passo = andar(fechada, { x: c(4), y: c(2), facing: 'N' }, { x: 0, y: -STICK_MAX }, 60);
    expect(passo.exit).toBeNull();
    expect(passo.walker.y).toBe(TILE_UNITS + HERO_HALF);
  });

  it('empurrando a parede perto do vão, é levado pra dentro dele', () => {
    // Meio quadrado fora do alinhamento: sem a ajuda, bateria na quina.
    const passo = andar(planta, { x: c(4) + TILE_UNITS / 2 - 60, y: c(2), facing: 'N' }, { x: 0, y: -STICK_MAX }, 90);
    expect(passo.exit).toBe('N');
  });

  it('longe do vão, empurrar a parede não puxa ninguém', () => {
    const passo = andar(planta, { x: c(2), y: c(2), facing: 'N' }, { x: 0, y: -STICK_MAX }, 60);
    expect(passo.exit).toBeNull();
    expect(passo.walker.x).toBe(c(2));
  });

  it('sai pelas quatro portas', () => {
    for (const [porta, inicio, input] of [
      ['S', { x: c(4), y: c(ROOM_ROWS - 2) }, { x: 0, y: STICK_MAX }],
      ['W', { x: c(1), y: c(CONTENT_TILE.row) }, { x: -STICK_MAX, y: 0 }],
      ['E', { x: c(7), y: c(CONTENT_TILE.row) }, { x: STICK_MAX, y: 0 }],
    ] as const) {
      expect(andar(planta, { ...inicio, facing: 'S' }, input, 60).exit).toBe(porta);
    }
  });
});

describe('roomArrival', () => {
  it('quem andou pro norte chega pelo vão do sul, um quadrado pra dentro', () => {
    expect(roomArrival('N')).toEqual({ x: c(4), y: c(ROOM_ROWS - 2), facing: 'N' });
    expect(roomArrival('E')).toEqual({ x: c(1), y: c(CONTENT_TILE.row), facing: 'E' });
  });

  it('sem direção, logo abaixo do conteúdo, olhando pra baixo', () => {
    expect(roomArrival(null)).toEqual({ x: c(4), y: c(CONTENT_TILE.row + 2), facing: 'S' });
  });

  it('quem chega não sai de novo no mesmo passo nem começa encostado no conteúdo', () => {
    const planta = roomLayout(TODAS, CONTEUDO);
    for (const d of ['N', 'S', 'E', 'W'] as const) {
      const passo = walkTick(planta, roomArrival(d), { x: 0, y: 0 });
      expect(passo.exit).toBeNull();
      expect(passo.touching).toBeNull();
    }
  });
});
