import { describe, expect, it } from 'vitest';

import { seededRng, type DungeonCell, type Hero, type MonsterInstance, type Rng } from '@rpg-legend/shared';

import { atacar, comecarCombate, fugir, iniciarEncontro, monstroAtual, salaDeCombate, type Combate } from './combate';
import { rolarTudo } from './criacao';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from './estado';
import { montarSaveInicial } from './save-inicial';

/** rng constante: 0 dispara tudo que é chance, 0.99 não dispara nada. */
const SEMPRE: Rng = () => 0;
const NUNCA: Rng = () => 0.99;

function monstro(overrides: Partial<MonsterInstance> = {}): MonsterInstance {
  return {
    speciesId: 'goblin',
    enemyClassId: 'brutamontes',
    floor: 2,
    hp: 40,
    maxHp: 40,
    dmg: 3,
    speed: 5,
    xp: 12,
    gold: 7,
    isBoss: false,
    ...overrides,
  };
}

function masmorraNoAndar(floor: number, seed = 11): EstadoNaMasmorra {
  const save = montarSaveInicial(rolarTudo('Aria', seededRng(seed)), seededRng(seed));
  const estado = retomarSave({ ...save, floor, mapMode: 'dungeon' }, seededRng(seed));
  if (estado.mapMode !== 'dungeon') throw new Error('esperava cair na masmorra');
  return estado;
}

/**
 * Põe o jogador numa sala de monstro montada à mão. Um herói robusto por
 * padrão, pra ele não morrer no meio de um teste que não é sobre morrer.
 */
function comSalaDeMonstro(sala: Partial<DungeonCell> = {}, hero: Partial<Hero> = {}): EstadoNaMasmorra {
  const base = masmorraNoAndar(2);

  for (const linha of base.map) {
    for (const celula of linha) {
      if (celula.type !== 'monster') continue;

      const posicionado: EstadoNaMasmorra = {
        ...base,
        pos: { x: celula.x, y: celula.y },
        hero: { ...base.hero, hp: 999, maxHp: 999, level: 1, gold: 100, ...hero },
      };
      return substituirCelulaAtual(posicionado, {
        ...celula,
        monsters: [monstro()],
        monsterIndex: 0,
        beaten: false,
        bonusTreasure: undefined,
        ...sala,
      });
    }
  }
  throw new Error('andar sem sala de monstro');
}

function salaDepois(combate: Combate): DungeonCell {
  const estado = combate.estado;
  if (estado.mapMode !== 'dungeon') throw new Error('esperava masmorra');
  return celulaAtual(estado) as DungeonCell;
}

function emCombate(estado: EstadoNaMasmorra): Combate {
  return comecarCombate(iniciarEncontro(estado));
}

describe('iniciarEncontro', () => {
  it('anuncia a criatura pelo nome quando é uma só', () => {
    const combate = iniciarEncontro(comSalaDeMonstro());

    expect(combate.fase).toBe('encontro');
    expect(combate.log[0]).toContain('aparece! O que você faz?');
  });

  it('anuncia o tamanho do grupo quando é mais de uma', () => {
    const combate = iniciarEncontro(comSalaDeMonstro({ monsters: [monstro(), monstro()] }));

    expect(combate.log[0]).toContain('grupo de 2 criaturas');
  });
});

describe('comecarCombate', () => {
  it('zera os buffs herdados do combate anterior', () => {
    const combate = emCombate(comSalaDeMonstro({}, { buffs: { critNext: true, forcaTurns: 3 } }));

    expect(combate.fase).toBe('combate');
    expect(combate.estado.hero.buffs).toEqual({});
  });

  it('consome a bênção de NPC e a transforma em esquiva do combate', () => {
    const combate = emCombate(comSalaDeMonstro({}, { npcBlessing: { combats: 1, dodge: 20 } }));

    expect(combate.estado.hero.buffs?.esquivaAmount).toBe(20);
    expect(combate.estado.hero.npcBlessing).toBeUndefined();
    expect(combate.log[0]).toContain('bênção');
  });

  it('bênção de vários combates só perde uma carga', () => {
    const combate = emCombate(comSalaDeMonstro({}, { npcBlessing: { combats: 3, dodge: 10 } }));

    expect(combate.estado.hero.npcBlessing?.combats).toBe(2);
  });
});

describe('atacar', () => {
  it('grava o dano na criatura dentro da própria sala', () => {
    const combate = atacar(emCombate(comSalaDeMonstro()), 20, 'normal', NUNCA);
    const criatura = salaDepois(combate).monsters?.[0];

    expect(criatura?.hp).toBeLessThan(40);
    expect(combate.dado).toBe(20);
  });

  it('não guarda no save os campos derivados da espécie', () => {
    const combate = atacar(emCombate(comSalaDeMonstro()), 20, 'normal', NUNCA);
    const criatura = salaDepois(combate).monsters?.[0];

    expect(criatura).not.toHaveProperty('species');
    expect(criatura).not.toHaveProperty('name');
    expect(criatura).not.toHaveProperty('enemyClass');
    expect(criatura?.speciesId).toBe('goblin');
  });

  it('derruba a criatura, paga XP e ouro e marca a sala', () => {
    const inicio = comSalaDeMonstro({ monsters: [monstro({ hp: 1 })] });
    const ouroAntes = inicio.hero.gold;

    const combate = atacar(emCombate(inicio), 20, 'normal', NUNCA);

    expect(combate.fase).toBe('vitoria');
    expect(salaDepois(combate).beaten).toBe(true);
    expect(combate.estado.hero.gold).toBe(ouroAntes + 7);
    expect(combate.estado.hero.killCount).toBe(1);
    expect(combate.log.some((linha) => linha.includes('Você derrotou'))).toBe(true);
  });

  it('chama o próximo da fila em vez de encerrar quando ainda há inimigo', () => {
    const inicio = comSalaDeMonstro({ monsters: [monstro({ hp: 1 }), monstro()] });

    const combate = atacar(emCombate(inicio), 20, 'normal', NUNCA);

    expect(combate.fase).toBe('combate');
    expect(salaDepois(combate).monsterIndex).toBe(1);
    expect(salaDepois(combate).beaten).toBeFalsy();
    expect(monstroAtual(combate.estado)?.hp).toBe(40);
  });

  it('entrega o tesouro extra da sala junto com a vitória', () => {
    const inicio = comSalaDeMonstro({ monsters: [monstro({ hp: 1 })], bonusTreasure: { gold: 50 } });
    const ouroAntes = inicio.hero.gold;

    const combate = atacar(emCombate(inicio), 20, 'normal', NUNCA);

    expect(combate.estado.hero.gold).toBe(ouroAntes + 7 + 50);
    expect(salaDepois(combate).bonusTreasure).toBeUndefined();
  });

  it('com sorte alta o inimigo derruba um item', () => {
    const inicio = comSalaDeMonstro({ monsters: [monstro({ hp: 1 })] });
    const combate = atacar(emCombate(inicio), 20, 'normal', SEMPRE);

    expect(combate.loot).not.toBeNull();
    expect(combate.estado.inventory).toHaveLength(inicio.inventory.length + 1);
  });

  it('vencer o chefe abre o próximo andar sozinho', () => {
    const inicio = comSalaDeMonstro({ type: 'boss', monsters: [monstro({ hp: 1, isBoss: true })] });

    const combate = atacar(emCombate(inicio), 20, 'normal', NUNCA);

    expect(combate.fase).toBe('vitoria');
    expect(combate.estado.floor).toBe(3);
    expect(celulaAtual(combate.estado)?.type).toBe('start');
  });

  it('não muta o estado anterior', () => {
    const inicio = emCombate(comSalaDeMonstro());
    const vidaAntes = monstroAtual(inicio.estado)?.hp;

    atacar(inicio, 20, 'normal', NUNCA);

    expect(monstroAtual(inicio.estado)?.hp).toBe(vidaAntes);
  });
});

describe('fugir', () => {
  it('escapa com rolagem alta e deixa a sala como estava', () => {
    const inicio = emCombate(comSalaDeMonstro());
    const combate = fugir(inicio, 20, NUNCA);

    expect(combate.fase).toBe('fuga');
    expect(salaDepois(combate).beaten).toBeFalsy();
    expect(monstroAtual(combate.estado)?.hp).toBe(40);
  });

  it('falhar antes do primeiro golpe joga o jogador direto na luta', () => {
    const combate = fugir(iniciarEncontro(comSalaDeMonstro({ monsters: [monstro({ speed: 99 })] })), 1, NUNCA);

    expect(combate.fase).toBe('combate');
    expect(combate.log.some((linha) => linha.includes('A fuga falha'))).toBe(true);
  });
});

describe('derrota', () => {
  /**
   * O veneno tem que entrar DEPOIS de `comecarCombate`, que zera os buffs
   * — é o próprio comportamento do original. Com `poisonDmg` alto o herói
   * cai no `tickHeroStatus` do começo do turno, sem depender de rolagem.
   */
  function prestesAMorrer(hero: Partial<Hero> = {}): Combate {
    const combate = emCombate(comSalaDeMonstro());
    const estado = combate.estado as EstadoNaMasmorra;
    return {
      ...combate,
      estado: { ...estado, hero: { ...estado.hero, hp: 5, buffs: { poisonTurns: 2, poisonDmg: 99 }, ...hero } },
    };
  }

  it('leva o grupo de volta pra cidade com 30% da vida', () => {
    const combate = atacar(prestesAMorrer(), 20, 'normal', NUNCA);

    expect(combate.fase).toBe('derrota');
    expect(combate.estado.mapMode).toBe('city');
    expect(combate.estado.hero.hp).toBe(Math.max(1, Math.floor(combate.estado.hero.maxHp * 0.3)));
  });

  it('até o nível 5 não cobra nada', () => {
    const combate = atacar(prestesAMorrer({ level: 5, gold: 1000 }), 20, 'normal', NUNCA);

    expect(combate.estado.hero.gold).toBe(1000);
    expect(combate.log.some((linha) => linha.includes('proteção de iniciante'))).toBe(true);
  });

  it('acima do nível 5 leva 10% do ouro', () => {
    const combate = atacar(prestesAMorrer({ level: 6, gold: 1000 }), 20, 'normal', NUNCA);

    expect(combate.estado.hero.gold).toBe(900);
  });

  it('a perda de ouro tem teto de 500', () => {
    const combate = atacar(prestesAMorrer({ level: 20, gold: 100000 }), 20, 'normal', NUNCA);

    expect(combate.estado.hero.gold).toBe(99500);
  });
});

describe('salaDeCombate', () => {
  it('não enxerga sala de combate na cidade', () => {
    const cidade = retomarSave(montarSaveInicial(rolarTudo('Aria', seededRng(1)), seededRng(1)));
    expect(salaDeCombate(cidade)).toBeNull();
  });

  it('não enxerga sala de monstro sem monstro', () => {
    const estado = comSalaDeMonstro({ monsters: [] });
    expect(salaDeCombate(estado)).toBeNull();
  });
});
