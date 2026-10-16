import { describe, expect, it } from 'vitest';

import type { DungeonExtra } from '../dungeon/extras.js';
import type { DungeonCell } from '../dungeon/generate.js';
import { CONTENT_TILE, DOOR_TILE } from '../dungeon/room-walk.js';
import { randomItem } from '../items/item.js';
import { seededRng } from '../rng.js';
import { ID_DO_CONTEUDO } from './andar-na-sala.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from './estado.js';
import {
  ID_DO_BAU_SECRETO,
  abrirBauSecreto,
  descricaoDosExtras,
  idDoExtra,
  indiceDoExtra,
  objetosDaSala,
  passagemSecreta,
  plantaDaSalaSecreta,
  tocarExtra,
} from './extras.js';
import { saveSorteado } from './heroi-sorteado.js';

function masmorra(): EstadoNaMasmorra {
  const estado = retomarSave({ ...saveSorteado('Aria', seededRng(3)), floor: 4, mapMode: 'dungeon' }, seededRng(11));
  if (estado.mapMode !== 'dungeon') throw new Error('esperava cair na masmorra');
  return estado;
}

/** A sala atual com estes extras (e, se pedir, de outro tipo). */
function comExtras(extras: DungeonExtra[], mudanca: Partial<DungeonCell> = {}): EstadoNaMasmorra {
  const estado = masmorra();
  const atual = celulaAtual(estado) as DungeonCell;
  return substituirCelulaAtual(estado, { ...atual, ...mudanca, extras });
}

const pocao = () => randomItem({ category: 'consumivel', rng: seededRng(1), now: () => 1 });
const espada = () => randomItem({ category: 'arma', rarity: 'raro', rng: seededRng(2), now: () => 2 });

describe('ids e objetos da sala', () => {
  it('o id do extra vai e volta; o resto não é extra', () => {
    expect(indiceDoExtra(idDoExtra(3))).toBe(3);
    expect(indiceDoExtra(ID_DO_CONTEUDO)).toBeNull();
  });

  it('o conteúdo fica no centro e os extras de pé no lugar deles; vaso quebrado e parede aberta saem', () => {
    const celula = {
      type: 'normal',
      x: 0,
      y: 0,
      doors: {},
      extras: [
        { kind: 'pot', col: 1, row: 1, used: true },
        { kind: 'chest', col: 2, row: 1, item: null, used: true },
        { kind: 'crack', col: 4, row: 0, side: 'N', used: true },
        { kind: 'sign', col: 6, row: 5 },
      ],
    } as DungeonCell;
    expect(objetosDaSala(celula, true)).toEqual([
      { id: ID_DO_CONTEUDO, ...CONTENT_TILE },
      { id: idDoExtra(1), col: 2, row: 1 },
      { id: idDoExtra(3), col: 6, row: 5 },
    ]);
    expect(passagemSecreta(celula)).toEqual({ lado: 'N', indice: 2 });
  });

  it('a sala secreta tem uma porta só, de volta, e o baú no centro', () => {
    const planta = plantaDaSalaSecreta('N');
    expect(planta.doors).toEqual(['S']);
    expect(planta.objects).toEqual([{ id: ID_DO_BAU_SECRETO, ...CONTENT_TILE }]);
  });
});

describe('tocarExtra', () => {
  it('o baú pequeno com poção põe a poção na mochila e fica aberto', () => {
    const item = pocao();
    const antes = comExtras([{ kind: 'chest', col: 1, row: 1, item, used: false }]);
    const depois = tocarExtra(antes, 0, seededRng(1));
    expect(depois.estado.inventory.length).toBe(antes.inventory.length + 1);
    expect((celulaAtual(depois.estado) as DungeonCell).extras?.[0]?.used).toBe(true);
    expect(tocarExtra(depois.estado, 0, seededRng(1)).aviso.titulo).toBe('Baú Vazio');
  });

  it('o baú pequeno sem poção dá ouro', () => {
    const antes = comExtras([{ kind: 'chest', col: 1, row: 1, item: null, used: false }]);
    const depois = tocarExtra(antes, 0, seededRng(1));
    expect(depois.estado.hero.gold).toBeGreaterThan(antes.hero.gold);
    expect(depois.som).toBe('gold');
  });

  it('o vaso quebra e dá de 1 a 5 moedas, uma vez só', () => {
    const antes = comExtras([{ kind: 'pot', col: 1, row: 1, used: false }]);
    const depois = tocarExtra(antes, 0, seededRng(4));
    const ganho = depois.estado.hero.gold - antes.hero.gold;
    expect(ganho).toBeGreaterThanOrEqual(1);
    expect(ganho).toBeLessThanOrEqual(5);
    expect(tocarExtra(depois.estado, 0, seededRng(4)).estado.hero.gold).toBe(depois.estado.hero.gold);
  });

  it('a placa lê uma dica do andar e não muda nada', () => {
    const antes = comExtras([{ kind: 'sign', col: 6, row: 1 }]);
    const depois = tocarExtra(antes, 0, seededRng(1));
    expect(depois.aviso.titulo).toBe('Placa');
    expect(depois.estado).toBe(antes);
  });

  it('a parede rachada abre e vira passagem', () => {
    const antes = comExtras([{ kind: 'crack', ...DOOR_TILE.N, side: 'N', used: false, secretItem: espada(), secretCollected: false }]);
    const depois = tocarExtra(antes, 0, seededRng(1));
    expect(passagemSecreta(celulaAtual(depois.estado))).toEqual({ lado: 'N', indice: 0 });
    expect(depois.som).toBe('door');
  });

  it('na sala de monstro, nada se pega antes de vencer; depois, sim', () => {
    const extras: DungeonExtra[] = [{ kind: 'chest', col: 1, row: 1, item: null, used: false }];
    const viva = comExtras(extras, { type: 'monster', beaten: false });
    const travado = tocarExtra(viva, 0, seededRng(1));
    expect(travado.estado).toBe(viva);
    expect(travado.aviso.titulo).toBe('Ainda não');
    const vencida = comExtras(extras, { type: 'monster', beaten: true });
    expect(tocarExtra(vencida, 0, seededRng(1)).estado.hero.gold).toBeGreaterThan(vencida.hero.gold);
  });
});

describe('abrirBauSecreto', () => {
  it('põe o equipamento na mochila e o baú fica vazio', () => {
    const item = espada();
    const antes = comExtras([{ kind: 'crack', ...DOOR_TILE.N, side: 'N', used: true, secretItem: item, secretCollected: false }]);
    const depois = abrirBauSecreto(antes, 0);
    expect(depois.estado.inventory.some((i) => i.uid === item.uid)).toBe(true);
    expect(abrirBauSecreto(depois.estado, 0).aviso.titulo).toBe('Baú Vazio');
  });
});

describe('descricaoDosExtras', () => {
  it('conta o que há de extra na sala', () => {
    const celula = {
      type: 'normal',
      x: 0,
      y: 0,
      doors: {},
      extras: [
        { kind: 'chest', col: 1, row: 1, item: null, used: false },
        { kind: 'crack', col: 4, row: 0, side: 'N', used: false },
      ],
    } as DungeonCell;
    expect(descricaoDosExtras(celula)).toBe('Num canto, um baú pequeno. Uma das paredes tem uma rachadura funda.');
  });
});
