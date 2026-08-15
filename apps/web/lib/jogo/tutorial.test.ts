import { describe, expect, it } from 'vitest';

import { seededRng } from '@rpg-legend/shared';

import { entrarNaCidade, type EstadoDoJogo } from './estado';
import { rolarTudo } from './criacao';
import { montarSaveInicial } from './save-inicial';
import { concluidos, marcar, PASSOS, tutorialDe, type PassoDoTutorial } from './tutorial';

const RNG = seededRng(4);

function cidade(): EstadoDoJogo {
  const rng = seededRng(2);
  return entrarNaCidade(montarSaveInicial(rolarTudo('Aria', rng), rng));
}

/** Fecha todas as etapas menos a última, que fica pro teste da recompensa. */
function quaseTudo(estado: EstadoDoJogo): { estado: EstadoDoJogo; ultima: PassoDoTutorial } {
  let atual = estado;
  for (const passo of PASSOS.slice(0, -1)) atual = marcar(atual, passo.id, RNG).estado;
  return { estado: atual, ultima: PASSOS[PASSOS.length - 1]!.id };
}

describe('tutorialDe', () => {
  it('save sem tutorial começa ligado e zerado', () => {
    const tutorial = tutorialDe(cidade());

    expect(tutorial.enabled).toBe(true);
    expect(concluidos(tutorial)).toBe(0);
    expect(tutorial.rewarded).toBe(false);
  });
});

describe('marcar', () => {
  it('marca a etapa e devolve o recado com a dica dela', () => {
    const depois = marcar(cidade(), 'move', RNG);

    expect(tutorialDe(depois.estado).completed.move).toBe(true);
    expect(depois.recado?.titulo).toContain('Etapa concluída');
    expect(depois.recado?.texto).toBe(PASSOS[0]!.dica);
  });

  it('repetir a mesma etapa não mexe no estado nem avisa de novo', () => {
    const uma = marcar(cidade(), 'move', RNG);
    const outra = marcar(uma.estado, 'move', RNG);

    expect(outra.estado).toBe(uma.estado);
    expect(outra.recado).toBeNull();
  });

  it('tutorial desligado não marca nada', () => {
    const base = cidade();
    const desligado: EstadoDoJogo = { ...base, tutorial: { enabled: false, completed: {}, rewarded: false } };

    expect(marcar(desligado, 'move', RNG).estado).toBe(desligado);
  });

  it('a última etapa paga 40 de ouro e uma poção', () => {
    const { estado, ultima } = quaseTudo(cidade());
    const antes = { ouro: estado.hero.gold, itens: estado.inventory.length };

    const fim = marcar(estado, ultima, RNG);

    expect(fim.estado.hero.gold).toBe(antes.ouro + 40);
    expect(fim.estado.inventory).toHaveLength(antes.itens + 1);
    expect(fim.estado.inventory[fim.estado.inventory.length - 1]!.templateId).toMatch(/^(pot_|pergaminho)/);
    expect(fim.recado?.titulo).toContain('Tutorial concluído');
    expect(tutorialDe(fim.estado).rewarded).toBe(true);
  });

  it('a recompensa sai uma vez só', () => {
    const { estado, ultima } = quaseTudo(cidade());
    const fim = marcar(estado, ultima, RNG);
    const denovo = marcar(fim.estado, ultima, RNG);

    expect(denovo.estado).toBe(fim.estado);
    expect(denovo.estado.hero.gold).toBe(fim.estado.hero.gold);
  });
});
