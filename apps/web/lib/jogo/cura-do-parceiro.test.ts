import { describe, expect, it } from 'vitest';

import { seededRng } from '@rpg-legend/shared';

import { curarNaTela, curarPeloParceiro, CURA_MAXIMA_DO_PARCEIRO } from './cura-do-parceiro';
import { rolarTudo } from './criacao';
import { abrirMochila } from './mochila';
import { retomarSave } from './estado';
import { montarSaveInicial } from './save-inicial';

function estadoFerido(hp = 10) {
  const save = montarSaveInicial(rolarTudo('Aria', seededRng(4)), seededRng(4));
  const estado = retomarSave(save, seededRng(4));
  return { ...estado, hero: { ...estado.hero, hp } };
}

describe('curarPeloParceiro', () => {
  it('cura até o máximo e diz quanto curou de fato', () => {
    const estado = estadoFerido(estadoFerido().hero.maxHp - 5);
    const { estado: depois, curou } = curarPeloParceiro(estado, 40);
    expect(curou).toBe(5);
    expect(depois.hero.hp).toBe(estado.hero.maxHp);
  });

  it('com a vida cheia não cura nada, e devolve o mesmo estado', () => {
    const cheio = estadoFerido(estadoFerido().hero.maxHp);
    const { estado, curou } = curarPeloParceiro(cheio, 30);
    expect(curou).toBe(0);
    expect(estado).toBe(cheio);
  });

  it('número estragado não cura nem envenena o herói', () => {
    const estado = estadoFerido();
    expect(curarPeloParceiro(estado, Number.NaN).curou).toBe(0);
    expect(curarPeloParceiro(estado, -50).curou).toBe(0);
    expect(curarPeloParceiro(estado, Number.POSITIVE_INFINITY).curou).toBe(0);
  });

  it('respeita o mesmo teto que o servidor', () => {
    const estado = { ...estadoFerido(1), hero: { ...estadoFerido(1).hero, maxHp: 5000 } };
    expect(curarPeloParceiro(estado, 9999).curou).toBe(CURA_MAXIMA_DO_PARCEIRO);
  });
});

describe('curarNaTela', () => {
  /** A mochila guarda a própria cópia e a devolve ao fechar — a cura tem que estar nela. */
  it('cura dentro da tela aberta também', () => {
    const aberta = { tipo: 'mochila' as const, mochila: abrirMochila(estadoFerido(10)) };
    const depois = curarNaTela(aberta, 7);
    if (depois.tipo !== 'mochila') throw new Error('trocou de tela');
    expect(depois.mochila.estado.hero.hp).toBe(17);
  });
});
