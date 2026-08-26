import { describe, expect, it } from 'vitest';

import {
  buildHero,
  CLASSES,
  DEBUFFS,
  equipItem,
  instantiate,
  RACES,
  RARITIES,
  seededRng,
  templateById,
  unequipItem,
  type ClassDef,
  type Hero,
  type Item,
} from '@rpg-legend/shared';

import { impactoDaPeca } from './impacto';

function classe(id: string): ClassDef {
  const achada = CLASSES.find((c) => c.id === id);
  if (!achada) throw new Error(`classe desconhecida: ${id}`);
  return achada;
}

function heroi(idDaClasse: string): Hero {
  return buildHero(
    { name: 'Aria', race: RACES[0], cls: classe(idDaClasse), debuff: DEBUFFS[0], chosenPowerIds: [] },
    seededRng(7),
  );
}

function peca(templateId: string): Item {
  const molde = templateById(templateId);
  if (!molde) throw new Error(`template desconhecido: ${templateId}`);
  return instantiate(molde, RARITIES[0], { rng: seededRng(3), now: () => 1 });
}

function linha(impacto: ReturnType<typeof impactoDaPeca>, rotulo: string) {
  return impacto?.linhas.find((l) => l.rotulo === rotulo);
}

describe('impactoDaPeca', () => {
  it('peça que não vai em slot nenhum não tem impacto', () => {
    const hero = heroi('guerreiro');

    expect(impactoDaPeca(hero, peca('pot_vida'))).toBeNull();
    expect(impactoDaPeca(hero, peca('pergaminho'))).toBeNull();
  });

  /**
   * `placas` é `{ defesa: 7, esquiva: -2 }` — a peça sobe uma coisa e baixa
   * outra. É o caso que o painel existe pra resolver: sem ele, o jogador
   * veste a armadura e só descobre a perda de esquiva no combate seguinte,
   * sem ligar uma coisa à outra.
   */
  it('mostra o que melhora e o que piora na mesma peça', () => {
    const impacto = impactoDaPeca(heroi('guerreiro'), peca('placas'));

    expect(impacto?.acao).toBe('equipar');

    const defesa = linha(impacto, 'Defesa');
    expect(defesa).toEqual({ rotulo: 'Defesa', antes: 0, depois: 7 });

    const esquiva = linha(impacto, 'Esquiva');
    expect(esquiva).toBeDefined();
    expect(esquiva!.depois).toBeLessThan(esquiva!.antes);
  });

  /**
   * A armadilha 2 do cabeçalho, presa por teste.
   *
   * A mesma espada, o mesmo nível, os dois de mãos vazias: o guerreiro tem
   * afinidade 100 com espada e o mago tem 30. Se o cálculo lesse
   * `stats.ataque` cru em vez de passar por `weaponAtkContribution`, os dois
   * veriam o mesmo número — e o do mago seria mentira, porque o combate dele
   * não entrega isso.
   *
   * As mãos são esvaziadas de propósito: `buildHero` já entrega a arma da
   * classe, e comparar espada-nova-contra-espada-velha esconderia a
   * afinidade atrás da diferença entre as duas armas.
   */
  it('o ataque respeita a afinidade da classe com a arma', () => {
    const espada: Item = { ...peca('espada'), stats: { ataque: 20 } };
    const guerreiro = unequipItem(heroi('guerreiro'), 'arma');
    const mago = unequipItem(heroi('mago'), 'arma');

    const doGuerreiro = linha(impactoDaPeca(guerreiro, espada), 'Ataque');
    const doMago = linha(impactoDaPeca(mago, espada), 'Ataque');

    // Guerreiro: afinidade 100 com espada. Mago: 30.
    expect(doGuerreiro).toEqual({ rotulo: 'Ataque', antes: 0, depois: 20 });
    expect(doMago).toEqual({ rotulo: 'Ataque', antes: 0, depois: 6 });
  });

  /**
   * A armadilha 1. `derivedStats().critico` ignora o equipamento; quem soma
   * é `resolve-attack`. O Anel das Sombras é `{ critico: 5, esquiva: 2 }` —
   * se a ficha lesse só o derivado, ele apareceria como se não fizesse nada.
   */
  it('crítico vindo de equipamento aparece, mesmo derivedStats não o somando', () => {
    const critico = linha(impactoDaPeca(heroi('ladino'), peca('anel_som')), 'Crítico');

    expect(critico).toBeDefined();
    expect(critico!.depois - critico!.antes).toBeCloseTo(5, 5);
  });

  it('peça já equipada mostra o impacto de guardá-la, ao contrário', () => {
    const hero = heroi('guerreiro');
    const placas = peca('placas');
    const vestido = equipItem(hero, placas).hero;

    const aoVestir = linha(impactoDaPeca(hero, placas), 'Defesa');
    const impactoDeGuardar = impactoDaPeca(vestido, placas);
    const aoGuardar = linha(impactoDeGuardar, 'Defesa');

    expect(impactoDeGuardar?.acao).toBe('guardar');
    expect(aoGuardar!.antes).toBe(aoVestir!.depois);
    expect(aoGuardar!.depois).toBe(aoVestir!.antes);
  });

  /**
   * A lista só traz o que muda. Sem isso a ficha mostraria sete linhas, cinco
   * delas iguais dos dois lados, e a que importa se perderia no meio.
   */
  it('não inventa linha pra número que não mudou', () => {
    const impacto = impactoDaPeca(heroi('guerreiro'), peca('placas'));

    expect(impacto!.linhas.length).toBeGreaterThan(0);
    for (const l of impacto!.linhas) expect(l.antes).not.toBe(l.depois);
    // `dmgFisico` sai só de FOR e nenhuma peça o move: nunca pode virar linha.
    expect(impacto!.linhas.map((l) => l.rotulo)).not.toContain('Dano físico');
  });

  /** Trocar de arma compara com a que já está na mão, não com mão vazia. */
  it('trocar de arma mede contra a arma que está equipada', () => {
    const hero = heroi('guerreiro');
    const fraca: Item = { ...peca('espada'), uid: 'fraca', stats: { ataque: 2 } };
    const forte: Item = { ...peca('espada'), uid: 'forte', stats: { ataque: 40 } };

    const comFraca = equipItem(hero, fraca).hero;
    const subida = linha(impactoDaPeca(comFraca, forte), 'Ataque');

    expect(subida).toBeDefined();
    expect(subida!.antes).toBeCloseTo(2, 5);
    expect(subida!.depois).toBeCloseTo(40, 5);
  });
});
