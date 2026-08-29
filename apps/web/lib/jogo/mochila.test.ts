import { describe, expect, it } from 'vitest';

import { equippedSlot, instantiate, RARITIES, seededRng, templateById, type Item } from '@rpg-legend/shared';

import { rolarTudo } from './criacao';
import { entrarNaCidade, type EstadoNaCidade } from './estado';
import {
  abrirMochila,
  aceitaMaoSecundaria,
  descartar,
  desequipar,
  equipar,
  gastarPonto,
  podeEquipar,
  podeUsar,
  usar,
  type Mochila,
} from './mochila';
import { montarSaveInicial } from './save-inicial';

/** Contador no lugar do relógio: uid reproduzível e sempre diferente do anterior. */
let sequencia = 0;

function item(templateId: string, rarityIndex = 0): Item {
  const template = templateById(templateId);
  if (!template) throw new Error(`template ${templateId} não existe`);
  return instantiate(template, RARITIES[rarityIndex]!, { rng: seededRng(3), now: () => ++sequencia });
}

function cidade(itens: Item[] = []): EstadoNaCidade {
  const rng = seededRng(5);
  const base = entrarNaCidade(montarSaveInicial(rolarTudo('Aria', rng), rng));
  return { ...base, inventory: itens };
}

function comItens(...itens: Item[]): Mochila {
  return abrirMochila(cidade(itens));
}

/**
 * Herói com uma arma de **uma** mão na principal, e os itens dados na mochila.
 *
 * `cidade()` sorteia a classe, e sete das doze começam com arma de duas mãos
 * (arco, cajado, machado, violão) — que agora recusam a secundária. Sem fixar
 * a arma, todo teste de mão secundária passa a depender do sorteio, e um dia
 * quebra por um motivo que não tem nada a ver com o que ele testa.
 */
function comMaoLivre(...itens: Item[]): Mochila {
  const espada = item('espada');
  return equipar(comItens(espada, ...itens), espada);
}

function guardado(mochila: Mochila, alvo: Item): Item {
  const achado = mochila.estado.inventory.find((it) => it.uid === alvo.uid);
  if (!achado) throw new Error('o item sumiu da mochila');
  return achado;
}

describe('abrirMochila', () => {
  it('deriva o `equipped` dos slots do herói, corrigindo o save', () => {
    const espada = item('espada');
    const base = cidade([{ ...espada, equipped: true }]);
    // Save mentindo: o item se diz equipado, mas nenhum slot o carrega.
    const mochila = abrirMochila(base);

    expect(mochila.estado.inventory[0]!.equipped).toBe(false);
  });

  it('marca como equipado o item que está num slot mesmo sem a flag no save', () => {
    const espada = item('espada');
    const base = cidade([espada]);
    const mochila = abrirMochila({ ...base, hero: { ...base.hero, equip: { ...base.hero.equip, arma: espada } } });

    expect(mochila.estado.inventory[0]!.equipped).toBe(true);
  });
});

describe('equipar', () => {
  it('põe a arma no slot e marca o item da mochila', () => {
    const espada = item('espada');
    const depois = equipar(comItens(espada), espada);

    expect(depois.estado.hero.equip.arma?.uid).toBe(espada.uid);
    expect(guardado(depois, espada).equipped).toBe(true);
  });

  it('trocar de arma desmarca a anterior', () => {
    const espada = item('espada');
    const machado = item('machado');
    const depois = equipar(equipar(comItens(espada, machado), espada), machado);

    expect(depois.estado.hero.equip.arma?.uid).toBe(machado.uid);
    expect(guardado(depois, espada).equipped).toBe(false);
    expect(guardado(depois, machado).equipped).toBe(true);
  });

  it('material não vai pra slot nenhum e o herói não muda', () => {
    const minerio = item('minerio');
    const antes = comItens(minerio);
    const depois = equipar(antes, minerio);

    expect(depois.estado.hero).toBe(antes.estado.hero);
    expect(depois.log[0]).toContain('não vai nesse espaço');
  });

  it('escudo vai pra mão secundária', () => {
    const escudo = item('escudo');
    const depois = equipar(comMaoLivre(escudo), escudo, 'secundaria');

    expect(depois.estado.hero.equip.secundaria?.uid).toBe(escudo.uid);
    expect(depois.log[0]).toContain('mão secundária');
  });

  it('arma de duas mãos não é aceita na secundária', () => {
    const arco = item('arco');
    const antes = comItens(arco);

    expect(equipar(antes, arco, 'secundaria').estado.hero).toBe(antes.estado.hero);
  });

  describe('arma de duas mãos', () => {
    it('equipar o violão devolve o escudo pra mochila, e avisa', () => {
      const escudo = item('escudo');
      const violao = item('violao');
      const comEscudo = equipar(comMaoLivre(escudo, violao), escudo, 'secundaria');

      const depois = equipar(comEscudo, violao);

      expect(depois.estado.hero.equip.arma?.uid).toBe(violao.uid);
      expect(depois.estado.hero.equip.secundaria).toBeNull();
      // O ponto do recolhimento: a peça não some, volta pra lista desmarcada.
      expect(guardado(depois, escudo).equipped).toBe(false);
      expect(depois.log.join(' ')).toContain('volta para a mochila');
    });

    it('com o violão na mão, o escudo é recusado dizendo qual arma ocupa', () => {
      const escudo = item('escudo');
      const violao = item('violao');
      const antes = equipar(comItens(escudo, violao), violao);

      const depois = equipar(antes, escudo);

      expect(depois.estado.hero).toBe(antes.estado.hero);
      expect(depois.log[0]).toContain('Violão');
      expect(depois.log[0]).not.toContain('não vai nesse espaço');
    });

    it('trocar de arma sem ser de duas mãos não mexe na secundária', () => {
      const escudo = item('escudo');
      const maca = item('maca');
      const comEscudo = equipar(comMaoLivre(escudo, maca), escudo, 'secundaria');

      const depois = equipar(comEscudo, maca);

      expect(depois.estado.hero.equip.secundaria?.uid).toBe(escudo.uid);
      expect(depois.log.join(' ')).not.toContain('volta para a mochila');
    });
  });
});

describe('desequipar', () => {
  it('esvazia o slot e devolve o item pra lista de guardados', () => {
    const espada = item('espada');
    const depois = desequipar(equipar(comItens(espada), espada), 'arma');

    expect(depois.estado.hero.equip.arma).toBeNull();
    expect(guardado(depois, espada).equipped).toBe(false);
  });

  // O herói já nasce com arma na mão (`buildHero`), então o slot vazio aqui é o de acessório.
  it('slot vazio não muda nada', () => {
    const antes = comItens();
    expect(desequipar(antes, 'acessorio')).toBe(antes);
  });

  it('a arma inicial, que só existia no slot, vai parar na mochila', () => {
    const antes = comItens();
    const inicial = antes.estado.hero.equip.arma as Item;
    expect(antes.estado.inventory.some((it) => it.uid === inicial.uid)).toBe(false);

    const depois = desequipar(antes, 'arma');

    expect(guardado(depois, inicial).equipped).toBe(false);
  });

  it('trocar por outra arma também recolhe a inicial em vez de apagá-la', () => {
    const antes = comItens();
    const inicial = antes.estado.hero.equip.arma as Item;
    const machado = item('machado');

    const depois = equipar({ ...antes, estado: { ...antes.estado, inventory: [machado] } }, machado);

    expect(depois.estado.hero.equip.arma?.uid).toBe(machado.uid);
    expect(guardado(depois, inicial).equipped).toBe(false);
  });
});

describe('usar', () => {
  it('poção de vida cura e some da mochila', () => {
    const pocao = item('pot_vida');
    const base = comItens(pocao);
    const ferido = { ...base, estado: { ...base.estado, hero: { ...base.estado.hero, hp: 1 } } };

    const depois = usar(ferido, pocao);

    expect(depois.estado.hero.hp).toBeGreaterThan(1);
    expect(depois.estado.inventory).toHaveLength(0);
    expect(depois.log[0]).toContain('de Vida');
  });

  it('com a vida cheia o item ainda é gasto, mas sem prometer cura', () => {
    const pocao = item('pot_vida');
    const depois = usar(comItens(pocao), pocao);

    expect(depois.estado.hero.hp).toBe(depois.estado.hero.maxHp);
    expect(depois.estado.inventory).toHaveLength(0);
    expect(depois.log[0]).not.toContain('recupera');
  });

  it('item sem cura não é gasto', () => {
    const espada = item('espada');
    const depois = usar(comItens(espada), espada);

    expect(depois.estado.inventory).toHaveLength(1);
    expect(depois.log[0]).toContain('não faz nada');
  });
});

describe('descartar', () => {
  it('tira da mochila', () => {
    const minerio = item('minerio');
    expect(descartar(comItens(minerio), minerio).estado.inventory).toHaveLength(0);
  });

  it('peça equipada sai do slot junto', () => {
    const espada = item('espada');
    const depois = descartar(equipar(comItens(espada), espada), espada);

    expect(depois.estado.inventory.some((it) => it.uid === espada.uid)).toBe(false);
    expect(depois.estado.hero.equip.arma).toBeNull();
  });
});

describe('gastarPonto', () => {
  it('sobe o atributo, consome o ponto e recalcula os derivados', () => {
    const base = comItens();
    const comPontos = { ...base, estado: { ...base.estado, hero: { ...base.estado.hero, attrPoints: 2 } } };

    const depois = gastarPonto(comPontos, 'constituicao');

    expect(depois.estado.hero.attrs.constituicao).toBe(comPontos.estado.hero.attrs.constituicao + 1);
    expect(depois.estado.hero.attrPoints).toBe(1);
    expect(depois.estado.hero.maxHp).toBeGreaterThan(comPontos.estado.hero.maxHp);
  });

  it('sem pontos avisa em vez de gastar', () => {
    const base = comItens();
    const depois = gastarPonto(base, 'forca');

    expect(depois.estado).toBe(base.estado);
    expect(depois.log[0]).toContain('não tem pontos');
  });
});

describe('rótulos de ação', () => {
  it('só equipa arma, armadura e acessório', () => {
    expect(podeEquipar(item('espada'))).toBe(true);
    expect(podeEquipar(item('couro'))).toBe(true);
    expect(podeEquipar(item('anel_som'))).toBe(true);
    expect(podeEquipar(item('pot_vida'))).toBe(false);
    expect(podeEquipar(item('minerio'))).toBe(false);
  });

  it('só usa consumível que cura de fato', () => {
    expect(podeUsar(item('pot_vida'))).toBe(true);
    expect(podeUsar(item('pot_mana'))).toBe(true);
    expect(podeUsar(item('espada'))).toBe(false);
  });

  it('mão secundária aceita escudo e arma leve, não arma de duas mãos', () => {
    expect(aceitaMaoSecundaria(item('escudo'))).toBe(true);
    expect(aceitaMaoSecundaria(item('adaga'))).toBe(true);
    expect(aceitaMaoSecundaria(item('arco'))).toBe(false);
    expect(aceitaMaoSecundaria(item('couro'))).toBe(false);
  });
});

describe('slot do item', () => {
  it('o slot do herói e o item da mochila continuam ligados pelo uid', () => {
    const espada = item('espada');
    const depois = equipar(comItens(espada), espada);

    expect(equippedSlot(depois.estado.hero, guardado(depois, espada))).toBe('arma');
  });
});
