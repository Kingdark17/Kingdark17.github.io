import { describe, expect, it } from 'vitest';

import { seededRng, type Quest } from '@rpg-legend/shared';

import { rolarTudo } from './criacao';
import { entrarNaCidade, type EstadoNaCidade } from './estado';
import { abrirQuadro, missoes, resgatar } from './missoes';
import { montarSaveInicial } from './save-inicial';

function cidade(): EstadoNaCidade {
  const rng = seededRng(4);
  return entrarNaCidade(montarSaveInicial(rolarTudo('Aria', rng), rng));
}

/** Marca a primeira missão como pronta pra resgate, sem depender de jogar. */
function comMissaoPronta(estado: EstadoNaCidade, quests: Quest[]): EstadoNaCidade {
  const primeira = quests[0]!;
  return { ...estado, quests: [{ ...primeira, progress: primeira.target, done: true }, ...quests.slice(1)] };
}

describe('abrirQuadro', () => {
  it('preenche o quadro na primeira visita', () => {
    const quadro = abrirQuadro(cidade(), seededRng(7));

    expect(missoes(quadro).length).toBeGreaterThan(0);
    expect(quadro.estado.quests).toBe(missoes(quadro));
  });

  it('não troca o estado quando o quadro já está cheio', () => {
    const primeira = abrirQuadro(cidade(), seededRng(7));
    const segunda = abrirQuadro(primeira.estado, seededRng(99));

    expect(segunda.estado.quests).toEqual(primeira.estado.quests);
  });
});

describe('resgatar', () => {
  it('missão não concluída não paga nada', () => {
    const quadro = abrirQuadro(cidade(), seededRng(7));
    const alvo = missoes(quadro)[0]!;

    const depois = resgatar(quadro, alvo.id, seededRng(8));

    expect(depois.estado.hero.gold).toBe(quadro.estado.hero.gold);
    expect(depois.log[0]).toContain('ainda não pode');
  });

  it('missão concluída paga ouro e XP', () => {
    const inicial = abrirQuadro(cidade(), seededRng(7));
    const quadro = { ...inicial, estado: comMissaoPronta(inicial.estado, missoes(inicial)) };
    const alvo = missoes(quadro)[0]!;
    const ouroAntes = quadro.estado.hero.gold;

    const depois = resgatar(quadro, alvo.id, seededRng(8));

    expect(depois.estado.hero.gold).toBe(ouroAntes + alvo.rewardGold);
    expect(depois.log[0]).toContain('Missão concluída');
  });

  it('o quadro não encolhe: sai uma, entra outra', () => {
    const inicial = abrirQuadro(cidade(), seededRng(7));
    const quadro = { ...inicial, estado: comMissaoPronta(inicial.estado, missoes(inicial)) };
    const antes = missoes(quadro).length;
    const alvo = missoes(quadro)[0]!;

    const depois = resgatar(quadro, alvo.id, seededRng(8));

    expect(missoes(depois)).toHaveLength(antes);
    expect(missoes(depois).some((q) => q.id === alvo.id)).toBe(false);
  });
});
