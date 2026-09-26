import { describe, expect, it } from 'vitest';

import {
  heroPowers,
  instantiate,
  powerById,
  RARITIES,
  seededRng,
  templateById,
  type DungeonCell,
  type Hero,
  type Item,
  type MonsterInstance,
  type Rng,
} from '@rpg-legend/shared';

import {
  atacar,
  comecarCombate,
  consumiveisDoCombate,
  esquivar,
  fugir,
  iniciarEncontro,
  monstroAtual,
  salaDeCombate,
  usarItem,
  usarPoder,
  type Combate,
} from './combate';
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
    const combate = atacar(emCombate(comSalaDeMonstro()), 20, 'normal', NUNCA);
    const criatura = salaDepois(combate).monsters?.[0];

    expect(criatura?.hp).toBeLessThan(40);
    // Com os lados: "20" num d6 não existiria, e "5" é acerto no d6 e erro no d20.
    expect(combate.dado).toEqual({ valor: 20, lados: 20 });
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

    expect(atacar(combate, 10, 'normal', NUNCA).pet).toBe('admin_dragon');
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

    // 20 no d20 é crítico; 1 erra.
    expect(atacar(combate, 20, 'normal', NUNCA).som).toBe('crit');
    expect(atacar(combate, 1, 'normal', NUNCA).som).toBe('miss');
  });

  it('vencer troca o som do golpe pelo da vitória', () => {
    // A criatura padrão tem 40 de vida e não sobrevive ao crítico.
    expect(atacar(iniciarEncontro(comSalaDeMonstro()), 20, 'normal', NUNCA).som).toBe('victory');
  });

  it('o golpe vira número na tela, e o erro não', () => {
    const combate = lutaLonga();

    const acerto = atacar(combate, 20, 'normal', NUNCA);
    const noInimigo = acerto.flutuantes.filter((numero) => numero.alvo === 'inimigo');
    expect(noInimigo).toHaveLength(1);
    expect(noInimigo[0].texto).toContain('CRÍTICO!');

    expect(atacar(combate, 1, 'normal', NUNCA).flutuantes.filter((numero) => numero.alvo === 'inimigo')).toHaveLength(0);
  });

  /**
   * O `{ ...combate }` de cada turno carregaria o som e os números do
   * turno anterior se alguma ação esquecesse de defini-los. Um golpe
   * repetiria o "crítico" do anterior sem ninguém notar no log.
   */
  it('cada ação começa do zero, sem herdar a anterior', () => {
    const critico = atacar(lutaLonga(), 20, 'normal', NUNCA);
    expect(critico.som).toBe('crit');

    const depois = comecarCombate(critico);
    expect(depois.som).toBeNull();
    expect(depois.flutuantes).toEqual([]);
  });

  it('a criatura acertando o herói também deixa número na tela', () => {
    const turno = atacar(lutaLonga(), 10, 'normal', NUNCA);

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
    const acerto = atacar(iniciarEncontro(comMonstroDuro()), 20, 'normal', NUNCA);
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
    const acerto = atacar(iniciarEncontro({ ...estado, inventory: [...estado.inventory, pocao] }), 20, 'normal', NUNCA);
    expect(acerto.flutuantes.some((f) => f.alvo === 'inimigo')).toBe(true);

    const agora = acerto.estado as EstadoNaMasmorra;
    const hero = { ...agora.hero, hp: 5, buffs: { poisonTurns: 2, poisonDmg: 99 } };
    return { combate: { ...acerto, estado: { ...agora, hero } }, item: pocao };
  }

  const acoes: [string, (combate: Combate, item: Item) => Combate][] = [
    ['atacar', (combate) => atacar(combate, 20, 'normal', NUNCA)],
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
    const depois = atacar(cantandoContraDois(), 20, 'normal', NUNCA);

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
