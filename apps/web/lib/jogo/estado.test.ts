import { describe, expect, it } from 'vitest';

import { DIR_OPP, DIR_VECTORS, seededRng, type Direction } from '@rpg-legend/shared';

import { rolarTudo } from './criacao';
import {
  andar,
  celulaAtual,
  descerEscada,
  entrarNaCidade,
  entrarNaMasmorra,
  podeAndar,
  retomarSave,
  revelar,
  voltarParaCidade,
  type EstadoDoJogo,
  type EstadoNaCidade,
  type EstadoNaMasmorra,
} from './estado';
import { montarSaveInicial } from './save-inicial';

function saveNovo() {
  return montarSaveInicial(rolarTudo('Aria', Math.random), Math.random);
}

function estadoNovo(): EstadoNaCidade {
  return entrarNaCidade(saveNovo());
}

/** Andar de masmorra gerado com seed, pra o teste poder olhar sala por sala. */
function masmorraNoAndar(floor: number, seed = 11): EstadoNaMasmorra {
  const estado = retomarSave({ ...saveNovo(), floor, mapMode: 'dungeon' }, seededRng(seed));
  if (estado.mapMode !== 'dungeon') throw new Error('esperava cair na masmorra');
  return estado;
}

/** Alguma direção com porta aberta a partir de onde o jogador está. */
function direcaoLivre(estado: EstadoDoJogo): Direction {
  const atual = celulaAtual(estado);
  const direcao = (Object.keys(atual?.doors ?? {}) as Direction[]).find((d) => podeAndar(estado, d));
  if (!direcao) throw new Error('a sala inicial deveria ter pelo menos uma porta');
  return direcao;
}

describe('entrarNaCidade', () => {
  it('gera a cidade quando o save ainda não tem mapa', () => {
    const estado = estadoNovo();

    expect(estado.mapMode).toBe('city');
    expect(estado.map).toHaveLength(estado.mapRows);
    expect(estado.map[0]).toHaveLength(estado.mapCols);
    expect(estado.cityStart).toEqual(estado.pos);
  });

  it('marca a sala inicial como visitada', () => {
    expect(celulaAtual(estadoNovo())?.visited).toBe(true);
  });

  it('não regenera a cidade quando já existe uma guardada', () => {
    const primeiro = estadoNovo();
    const andado = andar(primeiro, direcaoLivre(primeiro));

    const devolta = entrarNaCidade(andado);

    expect(devolta.pos).toEqual(andado.pos);
    // As salas já visitadas continuam visitadas.
    expect(devolta.map.flat().filter((celula) => celula.visited)).toHaveLength(2);
  });

  it('save de personagem novo entra na cidade sem posição prévia', () => {
    const save = saveNovo();
    expect(save).not.toHaveProperty('pos');

    const estado = entrarNaCidade(save);
    expect(estado.pos).toEqual(estado.cityStart);
  });

  it('carrega herói, inventário e andar do save sem alterar', () => {
    const save = saveNovo();
    const estado = entrarNaCidade(save);

    expect(estado.hero).toEqual(save.hero);
    expect(estado.inventory).toEqual(save.inventory);
    expect(estado.floor).toBe(1);
  });
});

describe('andar', () => {
  it('anda pra onde tem porta e marca a sala como visitada', () => {
    const estado = estadoNovo();
    const direcao = direcaoLivre(estado);
    const vetor = DIR_VECTORS[direcao];
    const esperado = { x: estado.pos.x + vetor.x, y: estado.pos.y + vetor.y };

    const depois = andar(estado, direcao);

    expect(depois.pos).toEqual(esperado);
    expect(celulaAtual(depois)?.visited).toBe(true);
  });

  it('não anda pra onde não tem porta, e devolve o mesmo estado', () => {
    const estado = estadoNovo();
    const atual = celulaAtual(estado);
    const bloqueada = (['N', 'S', 'E', 'W'] as Direction[]).find((direcao) => !atual?.doors?.[direcao]);

    if (!bloqueada) return; // sala com as quatro portas: nada a testar aqui
    expect(podeAndar(estado, bloqueada)).toBe(false);
    expect(andar(estado, bloqueada)).toBe(estado);
  });

  it('dá pra voltar por onde veio', () => {
    const estado = estadoNovo();
    const direcao = direcaoLivre(estado);

    const ida = andar(estado, direcao);
    const volta = andar(ida, DIR_OPP[direcao]);

    expect(volta.pos).toEqual(estado.pos);
  });

  it('não muta o estado anterior', () => {
    const estado = estadoNovo();
    const posicaoAntes = { ...estado.pos };
    const visitadasAntes = estado.map.flat().filter((celula) => celula.visited).length;

    andar(estado, direcaoLivre(estado));

    expect(estado.pos).toEqual(posicaoAntes);
    expect(estado.map.flat().filter((celula) => celula.visited)).toHaveLength(visitadasAntes);
  });

  it('mantém map e cityMap apontando pra mesma cidade', () => {
    const estado = estadoNovo();
    const depois = andar(estado, direcaoLivre(estado));
    expect(depois.cityMap).toBe(depois.map);
  });

  it('andar na masmorra não mexe no mapa guardado da cidade', () => {
    const cidade = estadoNovo();
    const masmorra = entrarNaMasmorra(cidade, seededRng(3));

    const depois = andar(masmorra, direcaoLivre(masmorra));

    expect(depois.cityMap).toBe(cidade.map);
  });
});

describe('revelar', () => {
  it('marca a sala como conhecida sem marcá-la como visitada', () => {
    const estado = estadoNovo();
    const direcao = direcaoLivre(estado);
    const vetor = DIR_VECTORS[direcao];
    const alvo = { x: estado.pos.x + vetor.x, y: estado.pos.y + vetor.y };

    const depois = revelar(estado, alvo);
    const celula = depois.map[alvo.y]?.[alvo.x];

    expect(celula?.revealed).toBe(true);
    expect(celula?.visited).toBeFalsy();
    expect(depois.pos).toEqual(estado.pos);
  });
});

describe('entrarNaMasmorra', () => {
  it('entra sempre pelo andar 1, na sala de início', () => {
    const masmorra = entrarNaMasmorra(estadoNovo(), seededRng(1));

    expect(masmorra.mapMode).toBe('dungeon');
    expect(masmorra.floor).toBe(1);
    expect(celulaAtual(masmorra)?.type).toBe('start');
    expect(celulaAtual(masmorra)?.visited).toBe(true);
  });

  it('guarda a cidade pra volta em vez de descartá-la', () => {
    const cidade = estadoNovo();
    const masmorra = entrarNaMasmorra(cidade, seededRng(1));

    expect(masmorra.cityMap).toBe(cidade.map);
    expect(masmorra.cityStart).toEqual(cidade.cityStart);
  });

  it('todo andar tem escada e saída', () => {
    const tipos = entrarNaMasmorra(estadoNovo(), seededRng(9))
      .map.flat()
      .map((celula) => celula.type);

    expect(tipos).toContain('stairs');
    expect(tipos).toContain('exit');
  });
});

describe('voltarParaCidade', () => {
  it('devolve o jogador ao ponto de partida da cidade que ele deixou', () => {
    const cidade = estadoNovo();
    const andado = andar(cidade, direcaoLivre(cidade));
    const masmorra = entrarNaMasmorra(andado, seededRng(2));

    const volta = voltarParaCidade(masmorra);

    expect(volta.mapMode).toBe('city');
    expect(volta.pos).toEqual(cidade.cityStart);
    // As salas andadas antes de descer continuam visitadas.
    expect(volta.map.flat().filter((celula) => celula.visited)).toHaveLength(2);
  });

  it('não zera o andar — só o portão faz isso', () => {
    const masmorra = masmorraNoAndar(4);
    expect(voltarParaCidade(masmorra).floor).toBe(4);
  });
});

describe('descerEscada', () => {
  it('desce um andar e gera um mapa novo', () => {
    const masmorra = masmorraNoAndar(2);
    const resultado = descerEscada(masmorra, seededRng(5));

    expect(resultado.kind).toBe('desceu');
    if (resultado.kind !== 'desceu') return;
    expect(resultado.estado.floor).toBe(3);
    expect(resultado.estado.map).not.toBe(masmorra.map);
    expect(celulaAtual(resultado.estado)?.type).toBe('start');
  });

  it('sela o caminho em andar de chefe com o chefe vivo', () => {
    const masmorra = masmorraNoAndar(5);
    expect(masmorra.map.flat().some((celula) => celula.type === 'boss')).toBe(true);

    expect(descerEscada(masmorra, seededRng(5)).kind).toBe('selado');
  });

  it('libera o caminho quando o chefe do andar já foi derrotado', () => {
    const masmorra = masmorraNoAndar(5);
    const semChefe: EstadoNaMasmorra = {
      ...masmorra,
      map: masmorra.map.map((linha) => linha.map((celula) => (celula.type === 'boss' ? { ...celula, beaten: true } : celula))),
    };

    expect(descerEscada(semChefe, seededRng(5)).kind).toBe('desceu');
  });
});

describe('retomarSave', () => {
  it('volta pra masmorra quando o save foi gravado lá', () => {
    const masmorra = entrarNaMasmorra(estadoNovo(), seededRng(4));
    const andado = andar(masmorra, direcaoLivre(masmorra));

    const retomado = retomarSave(andado);

    expect(retomado.mapMode).toBe('dungeon');
    expect(retomado.pos).toEqual(andado.pos);
    expect(retomado.map).toEqual(andado.map);
  });

  it('gera um andar novo quando o save diz masmorra mas não tem mapa', () => {
    const retomado = masmorraNoAndar(3);

    expect(retomado.floor).toBe(3);
    expect(celulaAtual(retomado)?.type).toBe('start');
  });

  it('cai na cidade quando o save é de cidade', () => {
    expect(retomarSave(saveNovo()).mapMode).toBe('city');
  });
});
