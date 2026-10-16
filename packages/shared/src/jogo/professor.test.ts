import { describe, expect, it } from 'vitest';

import type { DungeonCell } from '../dungeon/generate.js';
import { classById, powerById } from '../hero/catalog.js';
import type { Hero } from '../hero/hero.js';
import { seededRng } from '../rng.js';
import { celulaAtual, retomarSave, type EstadoNaMasmorra } from './estado.js';
import { saveSorteado } from './heroi-sorteado.js';
import { abrirProfessor, aprender, ofertas, trocar, trocaveis } from './professor.js';
import { confirmaAoTocar, interagir, lutaAoEntrar } from './sala.js';

/** O herói sorteado, com maestria 4 e os poderes que o teste quiser. */
function heroi(powerIds: string[] | null, extra: Partial<Hero> = {}): Hero {
  const { hero } = saveSorteado('Aria', seededRng(8));
  const ids = powerIds ?? hero.powerIds ?? [];
  return {
    ...hero,
    masteryBattles: 100,
    teachersMet: 0,
    powerIds: ids,
    powerNames: ids.map((id) => powerById(id)?.name ?? id),
    ...extra,
  };
}

/** Andar 50: o último da faixa do primeiro professor, onde ele sempre aparece. */
function noAndar(hero: Hero, floor = 50): EstadoNaMasmorra {
  const estado = retomarSave({ ...saveSorteado('Aria', seededRng(8)), hero, floor, mapMode: 'dungeon', progresso: { cleared: [], totems: {} } }, seededRng(3));
  if (estado.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
  return estado;
}

function naSalaDoMestre(estado: EstadoNaMasmorra): EstadoNaMasmorra {
  const sala = estado.map.flat().find((celula) => celula.type === 'teacher');
  if (!sala) throw new Error('andar sem professor');
  return { ...estado, pos: { x: sala.x, y: sala.y } };
}

function assinaturaDe(hero: Hero): string {
  return classById(hero.classId ?? '')!.signatureId;
}

describe('o professor aparece', () => {
  it('no andar 50, pra quem tem maestria 4', () => {
    const hero = heroi(null);
    expect(noAndar(heroi([assinaturaDe(hero)])).map.flat().some((c) => c.type === 'teacher')).toBe(true);
  });

  it('sem a maestria, não', () => {
    const hero = heroi(null);
    expect(noAndar(heroi([assinaturaDe(hero)], { masteryBattles: 99 })).map.flat().some((c) => c.type === 'teacher')).toBe(false);
  });

  it('o mestre fala no encostão, sem pergunta antes nem luta ao entrar', () => {
    const sala = { type: 'teacher', x: 0, y: 0, doors: {}, teacher: { classId: 'mago', number: 1 } } as DungeonCell;
    expect(confirmaAoTocar(sala)).toBe(false);
    expect(lutaAoEntrar(sala)).toBe(false);
  });
});

describe('aprender', () => {
  function comMestre() {
    const base = heroi(null);
    const estado = naSalaDoMestre(noAndar(heroi([assinaturaDe(base)])));
    const { tela } = interagir(estado, seededRng(1));
    if (tela?.tipo !== 'professor') throw new Error('esperava o professor');
    return tela.professor;
  }

  it('herói novo aprende: o mestre oferece os 3 da lista', () => {
    const professor = comMestre();
    expect(professor.modo).toBe('learn');
    expect(ofertas(professor)).toHaveLength(3);
  });

  it('aprender dá o poder, conta o mestre e esvazia a sala', () => {
    const professor = comMestre();
    const escolhido = ofertas(professor)[0]!;
    const depois = aprender(professor, escolhido.id);

    expect(depois.concluido).toBe(true);
    expect(depois.estado.hero.powerIds).toContain(escolhido.id);
    expect(depois.estado.hero.teachersMet).toBe(1);
    expect((celulaAtual(depois.estado) as DungeonCell).teacher?.taught).toBe(true);
    expect(depois.log[0]).toContain(escolhido.name);
  });

  it('voltar à sala depois só mostra que ele seguiu caminho', () => {
    const professor = comMestre();
    const depois = aprender(professor, ofertas(professor)[0]!.id);
    const { aviso, tela } = interagir(depois.estado, seededRng(1));

    expect(tela).toBeNull();
    expect(aviso?.titulo).toBe('Sala do Mestre');
  });

  it('"Agora não" não marca nada: a sala continua com o mestre', () => {
    const professor = comMestre();
    expect((celulaAtual(professor.estado) as DungeonCell).teacher?.taught).toBeFalsy();
    expect(professor.estado.hero.teachersMet).toBe(0);
  });
});

describe('trocar, pro veterano', () => {
  it('quem tem 3 poderes troca um extra por um da lista', () => {
    const veterano = heroi(null);
    expect(veterano.powerIds).toHaveLength(3);
    const { tela } = interagir(naSalaDoMestre(noAndar(veterano)), seededRng(1));
    if (tela?.tipo !== 'professor') throw new Error('esperava o professor');
    const professor = tela.professor;

    expect(professor.modo).toBe('swap');
    expect(trocaveis(professor).map((p) => p.id)).not.toContain(assinaturaDe(veterano));

    const esquecer = trocaveis(professor)[0]!;
    const aprenderPoder = ofertas(professor)[0]!;
    const depois = trocar(professor, esquecer.id, aprenderPoder.id);

    expect(depois.estado.hero.powerIds).toHaveLength(3);
    expect(depois.estado.hero.powerIds).toContain(aprenderPoder.id);
    expect(depois.estado.hero.powerIds).not.toContain(esquecer.id);
    expect(depois.log[0]).toBe(`Você troca ${esquecer.name} por ${aprenderPoder.name}. O mestre segue caminho.`);
  });
});

describe('quem não pode aprender', () => {
  it('o mestre de outra classe não ensina — o co-op traz o mestre de quem conduz', () => {
    const base = heroi(null);
    const estado = naSalaDoMestre(noAndar(heroi([assinaturaDe(base)])));
    const outraClasse = base.classId === 'mago' ? 'guerreiro' : 'mago';
    const professor = abrirProfessor({ ...estado, hero: { ...estado.hero, classId: outraClasse, className: classById(outraClasse)!.name } });

    expect(professor?.modo).toBeNull();
    expect(professor?.concluido).toBe(true);
  });
});
