import { describe, expect, it } from 'vitest';

import { randomItem, seededRng, type CityCell, type DungeonCell, type DungeonRoomType } from '@rpg-legend/shared';

import { rolarTudo } from './criacao';
import {
  celulaAtual,
  entrarNaCidade,
  retomarSave,
  substituirCelulaAtual,
  type EstadoNaCidade,
  type EstadoNaMasmorra,
} from './estado';
import { atravessaSemInteragir, interagir, precisaConfirmar } from './sala';
import { montarSaveInicial } from './save-inicial';

function saveNovo() {
  return montarSaveInicial(rolarTudo('Aria', Math.random), Math.random);
}

function cidadeNova(): EstadoNaCidade {
  return entrarNaCidade(saveNovo());
}

function masmorraNoAndar(floor: number, seed = 11): EstadoNaMasmorra {
  const estado = retomarSave({ ...saveNovo(), floor, mapMode: 'dungeon' }, seededRng(seed));
  if (estado.mapMode !== 'dungeon') throw new Error('esperava cair na masmorra');
  return estado;
}

/** Teleporta o jogador pra primeira sala de um tipo — evita ter que andar até ela. */
function emCimaDe<E extends EstadoNaCidade | EstadoNaMasmorra>(estado: E, tipo: string): E {
  for (const linha of estado.map) {
    for (const celula of linha) {
      if (celula.type === tipo) return { ...estado, pos: { x: celula.x, y: celula.y } };
    }
  }
  throw new Error(`nenhuma sala do tipo ${tipo} neste mapa`);
}

function comSalaAtual(estado: EstadoNaMasmorra, mudanca: Partial<DungeonCell>): EstadoNaMasmorra {
  const atual = celulaAtual(estado) as DungeonCell;
  return substituirCelulaAtual(estado, { ...atual, ...mudanca });
}

function sala(tipo: DungeonRoomType, extra: Partial<DungeonCell> = {}): DungeonCell {
  return { type: tipo, x: 0, y: 0, doors: {}, ...extra };
}

describe('precisaConfirmar', () => {
  it('pergunta antes de entrar no portão, na escada e na saída', () => {
    expect(precisaConfirmar({ type: 'gate', x: 0, y: 0, doors: {} } as CityCell)).toBe(true);
    expect(precisaConfirmar(sala('stairs'))).toBe(true);
    expect(precisaConfirmar(sala('exit'))).toBe(true);
  });

  it('não pergunta em sala comum nem em sala já resolvida', () => {
    expect(precisaConfirmar(sala('normal'))).toBe(false);
    expect(precisaConfirmar(sala('treasure', { collected: true }))).toBe(false);
    expect(precisaConfirmar(sala('monster', { beaten: true }))).toBe(false);
    expect(precisaConfirmar(sala('treasure', { collected: false }))).toBe(true);
  });
});

describe('atravessaSemInteragir', () => {
  it('deixa passar pela saída, senão ela viraria um muro no caminho da escada', () => {
    expect(atravessaSemInteragir(sala('exit'))).toBe(true);
  });

  it('não deixa passar pela escada nem pelo chefe: ou entra ou recua', () => {
    expect(atravessaSemInteragir(sala('stairs'))).toBe(false);
    expect(atravessaSemInteragir(sala('boss'))).toBe(false);
  });
});

describe('interagir na cidade', () => {
  it('o portão leva pra masmorra no andar 1', () => {
    const { estado, aviso } = interagir(emCimaDe(cidadeNova(), 'gate'), seededRng(1));

    expect(estado.mapMode).toBe('dungeon');
    expect(estado.floor).toBe(1);
    expect(aviso?.titulo).toBe('Portão da Masmorra');
  });

  it('a taverna recupera vida e mana', () => {
    const cidade = cidadeNova();
    const machucado: EstadoNaCidade = { ...cidade, hero: { ...cidade.hero, hp: 1, mp: 0 } };

    const { estado } = interagir(emCimaDe(machucado, 'tavern'));

    expect(estado.hero.hp).toBe(estado.hero.maxHp);
    expect(estado.hero.mp).toBe(estado.hero.maxMp);
  });

  it('avisa que a loja ainda não foi migrada, sem mexer no estado', () => {
    const cidade = emCimaDe(cidadeNova(), 'shop');
    const { estado, aviso } = interagir(cidade);

    expect(estado).toBe(cidade);
    expect(aviso?.texto).toContain('ainda não foi migrado');
  });
});

describe('interagir na masmorra', () => {
  it('a escada desce um andar', () => {
    const { estado, aviso } = interagir(emCimaDe(masmorraNoAndar(2), 'stairs'), seededRng(3));

    expect(estado.floor).toBe(3);
    expect(aviso?.titulo).toBe('Escadas');
  });

  it('a escada fica selada com o chefe vivo', () => {
    const naEscada = emCimaDe(masmorraNoAndar(5), 'stairs');
    const { estado, aviso } = interagir(naEscada, seededRng(3));

    expect(estado).toBe(naEscada);
    expect(aviso?.titulo).toBe('Caminho Selado');
  });

  it('a saída volta pra cidade sem zerar o andar', () => {
    const { estado } = interagir(emCimaDe(masmorraNoAndar(3), 'exit'));

    expect(estado.mapMode).toBe('city');
    expect(estado.floor).toBe(3);
  });

  it('o baú de ouro paga e fica vazio', () => {
    const bau = comSalaAtual(emCimaDe(masmorraNoAndar(2), 'treasure'), { giveGold: true, isMimic: false, collected: false });
    const ouroAntes = bau.hero.gold;

    const { estado, aviso } = interagir(bau, seededRng(7));

    expect(estado.hero.gold).toBeGreaterThan(ouroAntes);
    expect((celulaAtual(estado) as DungeonCell).collected).toBe(true);
    expect(aviso?.titulo).toBe('Baú Encontrado');
  });

  it('o baú de item vai pra mochila', () => {
    const item = randomItem({ floor: 2, rng: seededRng(8) });
    const bau = comSalaAtual(emCimaDe(masmorraNoAndar(2), 'treasure'), { giveGold: false, isMimic: false, collected: false, item });

    const { estado } = interagir(bau, seededRng(7));

    expect(estado.inventory).toHaveLength(bau.inventory.length + 1);
    expect(estado.inventory.at(-1)?.uid).toBe(item.uid);
  });

  it('baú já revistado não paga de novo', () => {
    const bau = comSalaAtual(emCimaDe(masmorraNoAndar(2), 'treasure'), { collected: true });

    const { estado, aviso } = interagir(bau, seededRng(7));

    expect(estado).toBe(bau);
    expect(aviso?.titulo).toBe('Baú Vazio');
  });

  it('o mímico troca o baú por uma sala de monstro e não entrega o prêmio', () => {
    const bau = comSalaAtual(emCimaDe(masmorraNoAndar(2), 'treasure'), { isMimic: true, giveGold: true, collected: false });

    const { estado } = interagir(bau, seededRng(7));
    const depois = celulaAtual(estado) as DungeonCell;

    expect(depois.type).toBe('monster');
    expect(depois.monsters).toHaveLength(1);
    expect(depois.collected).toBeFalsy();
    expect(depois.bonusTreasure).toBeDefined();
    expect(estado.hero.gold).toBe(bau.hero.gold);
  });

  it('sala de monstro abre o encontro em vez de resolver sozinha', () => {
    const naSala = emCimaDe(masmorraNoAndar(2), 'monster');
    const { estado, combate } = interagir(naSala);

    expect(estado).toBe(naSala);
    expect(combate?.fase).toBe('encontro');
  });

  it('o mímico já entra em combate junto com a revelação', () => {
    const bau = comSalaAtual(emCimaDe(masmorraNoAndar(2), 'treasure'), { isMimic: true, giveGold: true, collected: false });

    const { combate } = interagir(bau, seededRng(7));

    expect(combate?.fase).toBe('encontro');
    expect(combate?.log[0]).toContain('aparece');
  });
});
