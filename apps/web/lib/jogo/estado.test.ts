import { describe, expect, it } from 'vitest';

import { DIR_OPP, DIR_VECTORS, type Direction } from '@rpg-legend/shared';

import { rolarTudo } from './criacao';
import { andar, celulaAtual, entrarNaCidade, podeAndar, type EstadoDoJogo } from './estado';
import { montarSaveInicial } from './save-inicial';

function estadoNovo(): EstadoDoJogo {
  return entrarNaCidade(montarSaveInicial(rolarTudo('Aria', Math.random), Math.random));
}

/** Alguma direção com porta aberta a partir de onde o jogador está. */
function direcaoLivre(estado: EstadoDoJogo): Direction {
  const atual = celulaAtual(estado);
  const direcao = (Object.keys(atual?.doors ?? {}) as Direction[]).find((d) => podeAndar(estado, d));
  if (!direcao) throw new Error('a sala inicial da cidade deveria ter pelo menos uma porta');
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
    const save = montarSaveInicial(rolarTudo('Aria', Math.random), Math.random);
    expect(save).not.toHaveProperty('pos');

    const estado = entrarNaCidade(save);
    expect(estado.pos).toEqual(estado.cityStart);
  });

  it('carrega herói, inventário e andar do save sem alterar', () => {
    const save = montarSaveInicial(rolarTudo('Aria', Math.random), Math.random);
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
});
