import { describe, expect, it } from 'vitest';

import type { JogadaDeAtaque } from '../combat/resolve-attack.js';
import type { DungeonRun } from '../dungeon/dungeons.js';
import type { DungeonCell } from '../dungeon/generate.js';
import { powerById } from '../hero/catalog.js';
import { heroPowers, type Hero } from '../hero/hero.js';
import { instantiate, type Item } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import type { MonsterInstance } from '../monsters/generate.js';
import { seededRng, type Rng } from '../rng.js';
import {
  atacar,
  comecarCombate,
  consumiveisDoCombate,
  escolherAlvo,
  esquivar,
  fugir,
  inimigosDaLuta,
  inimigosRestantes,
  iniciarEncontro,
  monstroAtual,
  salaDeCombate,
  usarItem,
  usarPoder,
  vezDoMonstro,
  type Combate,
} from './combate.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from './estado.js';
import { saveSorteado } from './heroi-sorteado.js';

/** rng constante: 0 dispara tudo que é chance, 0.99 não dispara nada. */
const SEMPRE: Rng = () => 0;
const NUNCA: Rng = () => 0.99;

/** 20 no d20 de dano e a barra no centro: acerta sempre, e crita (é a faixa do crítico). */
const EM_CHEIO: JogadaDeAtaque = { dado: 20, mira: 0.5 };
/** O cursor passou do fim sem toque: erra sempre. */
const NO_VAZIO: JogadaDeAtaque = { dado: 1, mira: null };

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
  const save = saveSorteado('Aria', seededRng(seed), seededRng(seed));
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
  return iniciarEncontro(estado);
}

describe('iniciarEncontro', () => {
  /**
   * Entrar na sala já é entrar na luta. A tela "Fulano aparece! O que você
   * faz? [Lutar] [Fugir]" foi tirada porque não decidia nada: a pergunta de
   * entrar já é feita na porta, e Fugir continua dentro do combate.
   */
  it('a sala já abre em combate, sem tela de confirmação', () => {
    expect(iniciarEncontro(comSalaDeMonstro()).fase).toBe('combate');
  });

  it('anuncia a criatura pelo nome quando é uma só', () => {
    const combate = iniciarEncontro(comSalaDeMonstro());

    expect(combate.log[0]).toContain('aparece!');
  });

  /** Sem botões na tela, texto que pergunta "o que você faz?" vira mentira. */
  it('a abertura não pergunta mais nada', () => {
    expect(iniciarEncontro(comSalaDeMonstro()).log.join(' ')).not.toContain('O que você faz');
  });

  it('anuncia o tamanho do grupo quando é mais de uma', () => {
    const combate = iniciarEncontro(comSalaDeMonstro({ monsters: [monstro(), monstro()] }));

    expect(combate.log[0]).toContain('grupo de 2 criaturas');
  });

  /**
   * `comecarCombate` declara vitória quando não há criatura. Passar por ele
   * aqui faria a sala vazia abrir com "Continuar", como se algo tivesse
   * sido ganho — a tela tem a própria frase pra isso.
   */
  it('sala sem criatura não conta como vitória', () => {
    const vazia = iniciarEncontro(comSalaDeMonstro({ monsters: [] }));

    expect(vazia.fase).toBe('combate');
    expect(vazia.log[0]).toContain('vazia');
  });
});

describe('o preparo da luta', () => {
  it('zera os buffs herdados do combate anterior', () => {
    const combate = emCombate(comSalaDeMonstro({}, { buffs: { critNext: true, forcaTurns: 3 } }));

    expect(combate.fase).toBe('combate');
    expect(combate.estado.hero.buffs).toEqual({});
  });

  it('consome a bênção de NPC e a transforma em esquiva do combate', () => {
    const combate = emCombate(comSalaDeMonstro({}, { npcBlessing: { combats: 1, dodge: 20 } }));

    expect(combate.estado.hero.buffs?.esquivaAmount).toBe(20);
    expect(combate.estado.hero.npcBlessing).toBeUndefined();
    // `join`, e não `log[0]`: a abertura da sala agora vem antes da bênção.
    expect(combate.log.join(' ')).toContain('bênção');
  });

  it('bênção de vários combates só perde uma carga', () => {
    const combate = emCombate(comSalaDeMonstro({}, { npcBlessing: { combats: 3, dodge: 10 } }));

    expect(combate.estado.hero.npcBlessing?.combats).toBe(2);
  });
});

describe('atacar', () => {
  it('grava o dano na criatura dentro da própria sala', () => {
    const combate = atacar(emCombate(comSalaDeMonstro()), EM_CHEIO, 'normal', NUNCA);
    const criatura = salaDepois(combate).monsters?.[0];

    expect(criatura?.hp).toBeLessThan(40);
    // O dado que a tela mostra depois do golpe é o d20 de dano.
    expect(combate.dado).toEqual({ valor: 20, lados: 20 });
  });

  it('não guarda no save os campos derivados da espécie', () => {
    const combate = atacar(emCombate(comSalaDeMonstro()), EM_CHEIO, 'normal', NUNCA);
    const criatura = salaDepois(combate).monsters?.[0];

    expect(criatura).not.toHaveProperty('species');
    expect(criatura).not.toHaveProperty('name');
    expect(criatura).not.toHaveProperty('enemyClass');
    expect(criatura?.speciesId).toBe('goblin');
  });

  it('derruba a criatura, paga XP e ouro e marca a sala', () => {
    const inicio = comSalaDeMonstro({ monsters: [monstro({ hp: 1 })] });
    const ouroAntes = inicio.hero.gold;

    const combate = atacar(emCombate(inicio), EM_CHEIO, 'normal', NUNCA);

    expect(combate.fase).toBe('vitoria');
    expect(salaDepois(combate).beaten).toBe(true);
    expect(combate.estado.hero.gold).toBe(ouroAntes + 7);
    expect(combate.estado.hero.killCount).toBe(1);
    expect(combate.log.some((linha) => linha.includes('Você derrotou'))).toBe(true);
  });

  it('com mais gente de pé, derrubar um não encerra a luta', () => {
    const inicio = comSalaDeMonstro({ monsters: [monstro({ hp: 1 }), monstro()] });

    const combate = atacar(emCombate(inicio), EM_CHEIO, 'normal', NUNCA);

    expect(combate.fase).toBe('combate');
    expect(salaDepois(combate).monsterIndex).toBe(1);
    expect(salaDepois(combate).beaten).toBeFalsy();
    expect(monstroAtual(combate.estado)?.hp).toBe(40);
  });

  it('entrega o tesouro extra da sala junto com a vitória', () => {
    const inicio = comSalaDeMonstro({ monsters: [monstro({ hp: 1 })], bonusTreasure: { gold: 50 } });
    const ouroAntes = inicio.hero.gold;

    const combate = atacar(emCombate(inicio), EM_CHEIO, 'normal', NUNCA);

    expect(combate.estado.hero.gold).toBe(ouroAntes + 7 + 50);
    expect(salaDepois(combate).bonusTreasure).toBeUndefined();
  });

  it('com sorte alta o inimigo derruba um item', () => {
    const inicio = comSalaDeMonstro({ monsters: [monstro({ hp: 1 })] });
    const combate = atacar(emCombate(inicio), EM_CHEIO, 'normal', SEMPRE);

    expect(combate.loot).not.toBeNull();
    expect(combate.estado.inventory).toHaveLength(inicio.inventory.length + 1);
  });

  it('vencer o chefe abre o próximo andar sozinho', () => {
    const inicio = comSalaDeMonstro({ type: 'boss', monsters: [monstro({ hp: 1, isBoss: true })] });

    const combate = atacar(emCombate(inicio), EM_CHEIO, 'normal', NUNCA);

    expect(combate.fase).toBe('vitoria');
    expect(combate.estado.floor).toBe(3);
    expect(celulaAtual(combate.estado)?.type).toBe('start');
  });

  it('não muta o estado anterior', () => {
    const inicio = emCombate(comSalaDeMonstro());
    const vidaAntes = monstroAtual(inicio.estado)?.hp;

    atacar(inicio, EM_CHEIO, 'normal', NUNCA);

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

  /**
   * A regra virou uma só. Com a tela de encontro havia uma exceção: falhar
   * antes do primeiro golpe só começava a luta, sem a criatura revidar —
   * uma tentativa de graça. Sem a tela, falhar custa o turno sempre.
   */
  it('falhar custa o turno, mesmo na primeira tentativa', () => {
    const inicio = iniciarEncontro(comSalaDeMonstro({ monsters: [monstro({ speed: 99 })] }));
    const combate = fugir(inicio, 1, NUNCA);

    expect(combate.fase).toBe('combate');
    expect(combate.log.some((linha) => linha.includes('não conseguiu fugir'))).toBe(true);
    // O turno foi gasto: `turnoDosOutros` escreve o que a criatura fez.
    expect(combate.log.length).toBeGreaterThan(1);
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
    const combate = atacar(prestesAMorrer(), EM_CHEIO, 'normal', NUNCA);

    expect(combate.fase).toBe('derrota');
    expect(combate.estado.mapMode).toBe('city');
    expect(combate.estado.hero.hp).toBe(Math.max(1, Math.floor(combate.estado.hero.maxHp * 0.3)));
  });

  it('até o nível 5 não cobra nada', () => {
    const combate = atacar(prestesAMorrer({ level: 5, gold: 1000 }), EM_CHEIO, 'normal', NUNCA);

    expect(combate.estado.hero.gold).toBe(1000);
    expect(combate.log.some((linha) => linha.includes('proteção de iniciante'))).toBe(true);
  });

  it('acima do nível 5 leva 10% do ouro', () => {
    const combate = atacar(prestesAMorrer({ level: 6, gold: 1000 }), EM_CHEIO, 'normal', NUNCA);

    expect(combate.estado.hero.gold).toBe(900);
  });

  it('a perda de ouro tem teto de 500', () => {
    const combate = atacar(prestesAMorrer({ level: 20, gold: 100000 }), EM_CHEIO, 'normal', NUNCA);

    expect(combate.estado.hero.gold).toBe(99500);
  });

  it('perder não conta pra maestria', () => {
    const combate = atacar(prestesAMorrer({ masteryBattles: 4 }), EM_CHEIO, 'normal', NUNCA);

    expect(combate.fase).toBe('derrota');
    expect(combate.estado.hero.masteryBattles).toBe(4);
  });
});

describe('o fim da masmorra', () => {
  function noChefeDoAndar(floor: number, masmorra: DungeonRun = { dungeon: 'floresta', difficulty: 'normal' }, nivel = 1): EstadoNaMasmorra {
    const save = saveSorteado('Aria', seededRng(11), seededRng(11));
    const estado = retomarSave({ ...save, floor, mapMode: 'dungeon', masmorra, progresso: { cleared: [], totems: {} } }, seededRng(11));
    if (estado.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
    const chefe = estado.map.flat().find((celula) => celula.type === 'boss');
    if (!chefe) throw new Error('andar sem chefe');
    const posicionado: EstadoNaMasmorra = { ...estado, pos: { x: chefe.x, y: chefe.y }, hero: { ...estado.hero, hp: 999, maxHp: 999, level: nivel } };
    return substituirCelulaAtual(posicionado, { ...chefe, monsters: [monstro({ hp: 1, isBoss: true })], monsterIndex: 0, beaten: false });
  }

  it('vencer o chefe do andar 100 zera a masmorra e leva o grupo pra cidade', () => {
    const combate = atacar(emCombate(noChefeDoAndar(100)), EM_CHEIO, 'normal', NUNCA);

    expect(combate.fase).toBe('vitoria');
    expect(combate.estado.mapMode).toBe('city');
    expect(combate.estado.progresso.cleared).toEqual(['floresta:normal']);
    expect(combate.log.some((linha) => linha.includes('zerou Floresta · Normal'))).toBe(true);
  });

  it('o diário diz o que abriu: a dificuldade seguinte e, no Normal, a próxima masmorra', () => {
    const fraco = atacar(emCombate(noChefeDoAndar(100)), EM_CHEIO, 'normal', NUNCA).log;
    expect(fraco).toContain('Floresta no Difícil está aberta no portão.');
    expect(fraco).toContain('A Caverna abre a partir do nível 70.');

    const forte = atacar(emCombate(noChefeDoAndar(100, undefined, 80)), EM_CHEIO, 'normal', NUNCA).log;
    expect(forte).toContain('A Caverna está aberta no portão.');
  });

  it('zerar o Pesadelo não abre dificuldade nem masmorra nova', () => {
    const log = atacar(emCombate(noChefeDoAndar(100, { dungeon: 'floresta', difficulty: 'pesadelo' })), EM_CHEIO, 'normal', NUNCA).log;
    expect(log.some((linha) => linha.includes('aberta no portão') || linha.includes('abre a partir'))).toBe(false);
  });

  it('o chefe do andar 95 continua levando pro 96', () => {
    const combate = atacar(emCombate(noChefeDoAndar(95)), EM_CHEIO, 'normal', NUNCA);

    expect(combate.estado.mapMode).toBe('dungeon');
    expect(combate.estado.floor).toBe(96);
    expect(combate.estado.progresso.cleared).toEqual([]);
  });
});

describe('maestria', () => {
  it('a sala inteira é uma vitória, mesmo com dois na fila', () => {
    const inicio = comSalaDeMonstro({ monsters: [monstro({ hp: 1 }), monstro({ hp: 1 })] }, { masteryBattles: 0 });

    const primeiro = atacar(emCombate(inicio), EM_CHEIO, 'normal', NUNCA);
    expect(primeiro.fase).toBe('combate');
    expect(primeiro.estado.hero.masteryBattles).toBe(0);

    const segundo = atacar(primeiro, EM_CHEIO, 'normal', NUNCA);
    expect(segundo.fase).toBe('vitoria');
    expect(segundo.estado.hero.masteryBattles).toBe(1);
  });

  it('o chefe conta como qualquer sala', () => {
    const inicio = comSalaDeMonstro({ type: 'boss', monsters: [monstro({ hp: 1, isBoss: true })] }, { masteryBattles: 3 });

    expect(atacar(emCombate(inicio), EM_CHEIO, 'normal', NUNCA).estado.hero.masteryBattles).toBe(4);
  });

  it('a vitória que completa o nível vai pro diário', () => {
    const inicio = comSalaDeMonstro({ monsters: [monstro({ hp: 1 })] }, { masteryBattles: 9 });

    const combate = atacar(emCombate(inicio), EM_CHEIO, 'normal', NUNCA);

    expect(combate.estado.hero.masteryBattles).toBe(10);
    expect(combate.log.some((linha) => linha.startsWith('Sua maestria de') && linha.includes('nível 1: +2% de dano'))).toBe(true);
  });

  it('vitória que não completa nível não escreve nada sobre maestria', () => {
    const inicio = comSalaDeMonstro({ monsters: [monstro({ hp: 1 })] }, { masteryBattles: 3 });

    expect(atacar(emCombate(inicio), EM_CHEIO, 'normal', NUNCA).log.some((linha) => linha.includes('maestria'))).toBe(false);
  });

  it('fugir não conta', () => {
    const combate = fugir(emCombate(comSalaDeMonstro({}, { masteryBattles: 4 })), 20, NUNCA);

    expect(combate.fase).toBe('fuga');
    expect(combate.estado.hero.masteryBattles).toBe(4);
  });
});

describe('salaDeCombate', () => {
  it('não enxerga sala de combate na cidade', () => {
    const cidade = retomarSave(saveSorteado('Aria', seededRng(1), seededRng(1)));
    expect(salaDeCombate(cidade)).toBeNull();
  });

  it('não enxerga sala de monstro sem monstro', () => {
    const estado = comSalaDeMonstro({ monsters: [] });
    expect(salaDeCombate(estado)).toBeNull();
  });
});

describe('bônus de pet', () => {
  /** O poder de dano da classe inicial, pra ter um custo de mana pra poupar. */
  function poderDeDano(estado: EstadoNaMasmorra) {
    const poder = heroPowers(estado.hero).find((atual) => atual.type === 'dano_fisico' || atual.type === 'dano_magico');
    if (!poder) throw new Error('o herói de teste não tem poder de dano');
    return poder;
  }

  it('a coruja poupa a mana do poder; sem pet, o poder cobra', () => {
    const estado = comSalaDeMonstro();
    const poder = poderDeDano(estado);

    // `SEMPRE` faz o sorteio de 5% da coruja cair sempre dentro da chance.
    const comCoruja = usarPoder(iniciarEncontro(estado, 'owl'), poder, SEMPRE).combate;
    const semPet = usarPoder(iniciarEncontro(estado), poder, SEMPRE).combate;

    expect(comCoruja.estado.hero.mp).toBe(estado.hero.mp);
    expect(semPet.estado.hero.mp).toBeLessThan(estado.hero.mp);
  });

  it('o pet acompanha o combate inteiro, não só o primeiro golpe', () => {
    const combate = iniciarEncontro(comSalaDeMonstro(), 'admin_dragon');

    expect(atacar(combate, { dado: 10, mira: null }, 'normal', NUNCA).pet).toBe('admin_dragon');
  });

  it('sem pet a luta acontece igual', () => {
    expect(iniciarEncontro(comSalaDeMonstro()).pet).toBeNull();
  });
});

describe('som e números flutuantes', () => {
  /** Criatura resistente: o teste é sobre o som do golpe, não sobre matá-la. */
  function lutaLonga() {
    return iniciarEncontro(comSalaDeMonstro({ monsters: [monstro({ hp: 900, maxHp: 900 })] }));
  }

  it('acerto, crítico e erro têm som próprio', () => {
    const combate = lutaLonga();

    // A barra no centro crita; sem toque, erra.
    expect(atacar(combate, EM_CHEIO, 'normal', NUNCA).som).toBe('crit');
    expect(atacar(combate, NO_VAZIO, 'normal', NUNCA).som).toBe('miss');
  });

  it('vencer troca o som do golpe pelo da vitória', () => {
    // A criatura padrão tem 40 de vida e não sobrevive ao crítico.
    expect(atacar(iniciarEncontro(comSalaDeMonstro()), EM_CHEIO, 'normal', NUNCA).som).toBe('victory');
  });

  it('o golpe vira número na tela, e o erro não', () => {
    const combate = lutaLonga();

    const acerto = atacar(combate, EM_CHEIO, 'normal', NUNCA);
    const noInimigo = acerto.flutuantes.filter((numero) => numero.alvo === 'inimigo');
    expect(noInimigo).toHaveLength(1);
    expect(noInimigo[0].texto).toContain('CRÍTICO!');

    expect(atacar(combate, NO_VAZIO, 'normal', NUNCA).flutuantes.filter((numero) => numero.alvo === 'inimigo')).toHaveLength(0);
  });

  /**
   * O `{ ...combate }` de cada turno carregaria o som e os números do
   * turno anterior se alguma ação esquecesse de defini-los. Um golpe
   * repetiria o "crítico" do anterior sem ninguém notar no log.
   */
  it('cada ação começa do zero, sem herdar a anterior', () => {
    const critico = atacar(lutaLonga(), EM_CHEIO, 'normal', NUNCA);
    expect(critico.som).toBe('crit');

    const depois = comecarCombate(critico);
    expect(depois.som).toBeNull();
    expect(depois.flutuantes).toEqual([]);
  });

  it('a criatura acertando o herói também deixa número na tela', () => {
    const turno = atacar(lutaLonga(), { dado: 10, mira: null }, 'normal', NUNCA);

    expect(turno.flutuantes.some((numero) => numero.alvo === 'heroi')).toBe(true);
  });
});

/** Criatura que não morre no primeiro golpe — os testes abaixo falam do turno seguinte. */
function comMonstroDuro(hero: Partial<Hero> = {}) {
  return comSalaDeMonstro({ monsters: [monstro({ hp: 999, maxHp: 999 })] }, hero);
}

describe('fugir depois de acertar', () => {
  /**
   * Falhar a fuga herdava o som e o número do golpe anterior: repetia o
   * "crit", mostrava de novo o dano no inimigo e girava a arma do boneco —
   * um ataque que não houve.
   */
  it('não repete o som nem o número do golpe anterior', () => {
    const acerto = atacar(iniciarEncontro(comMonstroDuro()), EM_CHEIO, 'normal', NUNCA);
    expect(acerto.som).toBe('crit');
    expect(acerto.flutuantes.some((f) => f.alvo === 'inimigo')).toBe(true);

    const fuga = fugir(acerto, 1, NUNCA);
    expect(fuga.fase).toBe('combate');
    expect(fuga.som).not.toBe('crit');
    expect(fuga.flutuantes.some((f) => f.alvo === 'inimigo')).toBe(false);
    expect(fuga.dado).toEqual({ valor: 1, lados: 20 });
  });
});

describe('esquivar', () => {
  it('rolou bem: o golpe desta rodada erra, mesmo com a sorte que acertaria', () => {
    const combate = iniciarEncontro(comMonstroDuro());
    const depois = esquivar(combate, 20, NUNCA);

    expect(depois.estado.hero.hp).toBe(combate.estado.hero.hp);
    // "Você desvia do ataque", e não só "desvia": a linha da rolagem diz
    // "se prepara para desviar" e passaria por qualquer coisa mais frouxa.
    expect(depois.log.join(' ')).toContain('Você desvia do ataque');
    expect(depois.dado).toEqual({ valor: 20, lados: 20 });
  });

  it('rolou mal: perdeu o turno, e o golpe vem', () => {
    const combate = iniciarEncontro(comMonstroDuro());
    const depois = esquivar(combate, 1, NUNCA);

    expect(depois.estado.hero.hp).toBeLessThan(combate.estado.hero.hp);
  });

  it('não ataca: a criatura sai com a mesma vida', () => {
    const combate = iniciarEncontro(comMonstroDuro());
    const depois = esquivar(combate, 20, NUNCA);
    expect(monstroAtual(depois.estado)?.hp).toBe(monstroAtual(combate.estado)?.hp);
  });
});

describe('usar item na luta', () => {
  const pocao = () => instantiate(templateById('pot_vida')!, RARITIES[0]!);

  function comPocao(item = pocao()) {
    const estado = comMonstroDuro({ hp: 500, maxHp: 999 });
    return { combate: iniciarEncontro({ ...estado, inventory: [...estado.inventory, item] }), item };
  }

  it('só oferece o que faz alguma coisa', () => {
    const { combate, item } = comPocao();
    expect(consumiveisDoCombate(combate).map((i) => i.uid)).toContain(item.uid);
    expect(consumiveisDoCombate(combate).every((i) => i.stats.cura || i.stats.curaMana)).toBe(true);
  });

  it('cura, some da mochila e gasta o turno — a criatura revida', () => {
    const { combate, item } = comPocao();
    const depois = usarItem(combate, item, NUNCA);

    expect(depois.estado.inventory.some((i) => i.uid === item.uid)).toBe(false);
    expect(depois.log.join(' ')).toContain('Você usa');
    expect(depois.log.join(' ')).toContain('acerta você');
  });

  it('item que não está na mochila é recusado sem gastar o turno', () => {
    const { combate } = comPocao();
    const fantasma = pocao();
    const depois = usarItem(combate, fantasma, NUNCA);

    expect(depois.estado).toBe(combate.estado);
    expect(depois.log).toEqual([expect.stringContaining('não faz nada agora')]);
  });
});

describe('morrer de veneno', () => {
  /**
   * O veneno mata antes da ação, então ela não acontece. Herdar o que a ação
   * anterior deixou repetia o número no inimigo, a tremida e o giro de arma
   * — o mesmo ataque fantasma que a fuga tinha, nas outras quatro portas.
   */
  function envenenadoDepoisDeAcertar(): { combate: Combate; item: Item } {
    const pocao = instantiate(templateById('pot_vida')!, RARITIES[0]!);
    const estado = comMonstroDuro({ mp: 50, maxMp: 50 });
    const acerto = atacar(iniciarEncontro({ ...estado, inventory: [...estado.inventory, pocao] }), EM_CHEIO, 'normal', NUNCA);
    expect(acerto.flutuantes.some((f) => f.alvo === 'inimigo')).toBe(true);

    const agora = acerto.estado as EstadoNaMasmorra;
    const hero = { ...agora.hero, hp: 5, buffs: { poisonTurns: 2, poisonDmg: 99 } };
    return { combate: { ...acerto, estado: { ...agora, hero } }, item: pocao };
  }

  const acoes: [string, (combate: Combate, item: Item) => Combate][] = [
    ['atacar', (combate) => atacar(combate, EM_CHEIO, 'normal', NUNCA)],
    ['usar poder', (combate) => usarPoder(combate, powerById('cura_menor')!, NUNCA).combate],
    ['esquivar', (combate) => esquivar(combate, 20, NUNCA)],
    ['usar item', (combate, item) => usarItem(combate, item, NUNCA)],
  ];

  it.each(acoes)('%s: não herda número, dado nem golpe da ação anterior', (_nome, agir) => {
    const { combate, item } = envenenadoDepoisDeAcertar();
    const fim = agir(combate, item);

    expect(fim.fase).toBe('derrota');
    expect(fim.flutuantes).toEqual([]);
    expect(fim.dado).toBeNull();
    expect(fim.som).toBe('defeat');
  });
});

describe('Canção de Batalha numa sala de vários monstros', () => {
  /**
   * A canção desconta no turno da equipe, e a rodada em que o herói mata não
   * tem turno da equipe. Sem o desconto ali, cada morte no meio da fila era
   * uma rodada de canção de graça.
   */
  function cantandoContraDois(hero: Partial<Hero> = {}): Combate {
    const inicio = iniciarEncontro(comSalaDeMonstro({ monsters: [monstro({ hp: 1 }), monstro()] }, hero));
    const estado = inicio.estado as EstadoNaMasmorra;
    return { ...inicio, estado: { ...estado, hero: { ...estado.hero, buffs: { inspiracaoTurns: 2, inspiracaoAmount: 0.25 } } } };
  }

  it('matar com o golpe conta a rodada', () => {
    const depois = atacar(cantandoContraDois(), EM_CHEIO, 'normal', NUNCA);

    expect(salaDepois(depois).monsterIndex).toBe(1);
    expect(depois.estado.hero.buffs?.inspiracaoTurns).toBe(1);
  });

  it('matar com poder conta a rodada', () => {
    const { combate: depois } = usarPoder(cantandoContraDois({ mp: 50, maxMp: 50 }), powerById('bola_de_fogo')!, NUNCA);

    expect(salaDepois(depois).monsterIndex).toBe(1);
    expect(depois.estado.hero.buffs?.inspiracaoTurns).toBe(1);
  });
});

describe('cura que vai pro parceiro', () => {
  it('poder de cura manda a parte da equipe; poder de dano não manda nada', () => {
    const combate = iniciarEncontro(comMonstroDuro({ mp: 50, maxMp: 50 }));

    const cura = usarPoder(combate, powerById('cura_menor')!, NUNCA);
    expect(cura.curaDoParceiro).toBeGreaterThan(0);

    const dano = usarPoder(combate, powerById('bola_de_fogo')!, NUNCA);
    expect(dano.curaDoParceiro).toBe(0);
  });

  it('a quantia não fica guardada no combate', () => {
    const combate = iniciarEncontro(comMonstroDuro({ mp: 50, maxMp: 50 }));
    const { combate: depois } = usarPoder(combate, powerById('cura_menor')!, NUNCA);
    expect('curaDoParceiro' in depois).toBe(false);
  });
});

describe('luta em grupo', () => {
  /** Três de espécies diferentes, pra saber pelo log quem fez o quê. */
  function trio(sobre: Partial<MonsterInstance>[] = []): Combate {
    const especies = ['goblin', 'aranha', 'slime'];
    const monsters = especies.map((speciesId, i) => monstro({ speciesId, ...sobre[i] }));
    return iniciarEncontro(comSalaDeMonstro({ monsters }));
  }

  /** Quem atacou o herói nesta rodada, pelo nome no log. */
  function quemAtacou(combate: Combate): string | undefined {
    const nomes = inimigosDaLuta(combate.estado).map((inimigo) => inimigo.monstro.name);
    return nomes.find((nome) => combate.log.some((linha) => linha.startsWith(nome) && linha.includes('acerta você')));
  }

  it('o grupo inteiro está na luta, na ordem da sala', () => {
    const combate = trio();
    const grupo = inimigosDaLuta(combate.estado);

    expect(grupo.map((inimigo) => inimigo.indice)).toEqual([0, 1, 2]);
    expect(grupo.every((inimigo) => inimigo.vivo)).toBe(true);
    expect(inimigosRestantes(combate.estado)).toBe(3);
    expect(combate.alvo).toBe(0);
  });

  it('o golpe vai no alvo escolhido', () => {
    const combate = atacar(escolherAlvo(trio(), 2), EM_CHEIO, 'normal', NUNCA);
    const [primeiro, , terceiro] = inimigosDaLuta(combate.estado);

    expect(terceiro?.monstro.hp).toBeLessThan(40);
    expect(primeiro?.monstro.hp).toBe(40);
    expect(combate.flutuantes.find((numero) => numero.alvo === 'inimigo')?.indice).toBe(2);
  });

  it('monstro caído ou que não existe não vira alvo', () => {
    const combate = trio([{ hp: 0 }]);

    expect(escolherAlvo(combate, 0)).toBe(combate);
    expect(escolherAlvo(combate, 7)).toBe(combate);
  });

  it('um monstro ataca por rodada, revezando entre os de pé', () => {
    let combate = trio();
    const atacantes: (string | undefined)[] = [];
    for (let rodada = 0; rodada < 4; rodada++) {
      combate = atacar(combate, NO_VAZIO, 'normal', NUNCA);
      atacantes.push(quemAtacou(combate));
    }
    const [goblin, aranha, slime] = inimigosDaLuta(combate.estado).map((inimigo) => inimigo.monstro.name);

    expect(atacantes).toEqual([goblin, aranha, slime, goblin]);
  });

  it('derrubar um do grupo não dá rodada sem troco: o da vez ataca', () => {
    const vidaAntes = trio().estado.hero.hp;
    const combate = atacar(trio([{ hp: 1 }]), EM_CHEIO, 'normal', NUNCA);

    expect(combate.log.some((linha) => linha.includes('Você derrotou'))).toBe(true);
    expect(combate.fase).toBe('combate');
    expect(quemAtacou(combate)).toBeDefined();
    expect(combate.estado.hero.hp).toBeLessThan(vidaAntes);
  });

  it('o alvo que cai passa pro primeiro de pé, e a vez pula quem caiu', () => {
    const combate = atacar(trio([{ hp: 1 }]), EM_CHEIO, 'normal', NUNCA);

    expect(combate.alvo).toBe(1);
    expect(vezDoMonstro(combate.estado)).toBe(2);
    expect(inimigosDaLuta(combate.estado)[0]?.vivo).toBe(false);
  });

  it('atordoado na vez dele perde o ataque: ninguém bate na rodada, e a vez passa', () => {
    const inicio = trio();
    const sala = salaDepois(inicio);
    const tonto = substituirCelulaAtual(inicio.estado as EstadoNaMasmorra, {
      ...sala,
      monsters: (sala.monsters ?? []).map((m, i) => (i === 0 ? { ...m, status: { atordoado: 1 } } : m)),
    });
    const vidaAntes = tonto.hero.hp;

    const combate = atacar({ ...inicio, estado: tonto }, NO_VAZIO, 'normal', NUNCA);

    expect(combate.log.some((linha) => linha.includes('atordoado e perde o turno'))).toBe(true);
    expect(combate.estado.hero.hp).toBe(vidaAntes);
    expect(vezDoMonstro(combate.estado)).toBe(1);
  });

  it('fugir mede a velocidade contra o mais rápido de pé', () => {
    // 11 no dado: contra quem é bem mais lento que o herói, o bônus de +2 basta pra escapar.
    expect(fugir(iniciarEncontro(comSalaDeMonstro({ monsters: [monstro({ speed: 0 }), monstro({ speed: 0 })] })), 11, NUNCA).fase).toBe('fuga');
    expect(fugir(iniciarEncontro(comSalaDeMonstro({ monsters: [monstro({ speed: 0 }), monstro({ speed: 99 })] })), 11, NUNCA).fase).toBe('combate');
  });

  it('o dano contínuo corre em todos de pé que o tiverem', () => {
    const inicio = trio();
    const sala = salaDepois(inicio);
    const queimando = { queimadura: { turns: 2, dmg: 5 } };
    const estado = substituirCelulaAtual(inicio.estado as EstadoNaMasmorra, {
      ...sala,
      monsters: (sala.monsters ?? []).map((m, i) => (i === 2 ? m : { ...m, status: queimando })),
    });

    const combate = esquivar({ ...inicio, estado }, 1, NUNCA);
    const vidas = inimigosDaLuta(combate.estado).map((inimigo) => inimigo.monstro.hp);

    expect(vidas).toEqual([35, 35, 40]);
  });

  it('cair o último limpa a sala, e a vitória conta uma vez só', () => {
    const inicio = trio([{ hp: 1 }, { hp: 0 }, { hp: 0 }]);
    const combate = atacar(inicio, EM_CHEIO, 'normal', NUNCA);

    expect(combate.fase).toBe('vitoria');
    expect(salaDepois(combate).beaten).toBe(true);
    expect(combate.estado.hero.masteryBattles).toBe((inicio.estado.hero.masteryBattles ?? 0) + 1);
  });

  it('save do tempo da fila segue de onde parou: quem já caiu não volta', () => {
    const estado = comSalaDeMonstro({ monsters: [monstro({ hp: 0 }), monstro()], monsterIndex: 1 });
    const combate = iniciarEncontro(estado);

    expect(combate.alvo).toBe(1);
    expect(inimigosRestantes(combate.estado)).toBe(1);
    expect(inimigosDaLuta(combate.estado).map((inimigo) => inimigo.vivo)).toEqual([false, true]);
  });
});
