import { describe, expect, it } from 'vitest';

import { instantiate, RARITIES, seededRng, templateById, type CityCell, type Item, type Rng } from '@rpg-legend/shared';

import { rolarTudo } from './criacao';
import { celulaAtual, entrarNaCidade, substituirCelulaAtual, type EstadoNaCidade } from './estado';
import {
  abrirLoja,
  comprar,
  estoque,
  pechinchar,
  precoDaRenovacao,
  precoDeCompra,
  precoDeVenda,
  reforjar,
  renovarEstoque,
  vendaveis,
  vender,
  type Loja,
} from './loja';
import { montarSaveInicial } from './save-inicial';

const NUNCA: Rng = () => 0.99;

function cidade(ouro = 1000): EstadoNaCidade {
  const rng = seededRng(5);
  const base = entrarNaCidade(montarSaveInicial(rolarTudo('Aria', rng), rng));
  return { ...base, hero: { ...base.hero, gold: ouro } };
}

/** Põe o jogador em cima da loja ou do ferreiro. */
function emCimaDe(estado: EstadoNaCidade, tipo: string): EstadoNaCidade {
  for (const linha of estado.map) {
    for (const celula of linha) {
      if (celula.type === tipo) return { ...estado, pos: { x: celula.x, y: celula.y } };
    }
  }
  throw new Error(`a cidade não tem sala ${tipo}`);
}

function item(templateId: string, rarityIndex = 0): Item {
  const template = templateById(templateId);
  if (!template) throw new Error(`template ${templateId} não existe`);
  return instantiate(template, RARITIES[rarityIndex]!, { rng: seededRng(3), now: () => 1 });
}

function comInventario(estado: EstadoNaCidade, itens: Item[]): EstadoNaCidade {
  return { ...estado, inventory: itens };
}

function lojaAberta(ouro = 1000, tipo = 'shop'): Loja {
  return abrirLoja(emCimaDe(cidade(ouro), tipo), tipo === 'blacksmith' ? 'blacksmith' : 'shop', seededRng(9));
}

describe('abrirLoja', () => {
  it('sorteia 5 itens na primeira visita e guarda na própria sala', () => {
    const loja = lojaAberta();

    expect(estoque(loja)).toHaveLength(5);
    expect((celulaAtual(loja.estado) as CityCell).forSale).toHaveLength(5);
  });

  it('não sorteia estoque novo ao reabrir — senão o botão de renovar não teria razão', () => {
    const primeira = lojaAberta();
    const segunda = abrirLoja(primeira.estado, 'shop', seededRng(77));

    expect(estoque(segunda).map((i) => i.uid)).toEqual(estoque(primeira).map((i) => i.uid));
  });

  it('o vendedor vende consumível; o ferreiro, equipamento', () => {
    const vendedor = lojaAberta(1000, 'shop');
    const ferreiro = lojaAberta(1000, 'blacksmith');

    expect(estoque(vendedor).every((i) => templateById(i.templateId)?.category === 'consumivel')).toBe(true);
    expect(estoque(ferreiro).every((i) => ['arma', 'armadura', 'acessorio'].includes(templateById(i.templateId)?.category ?? ''))).toBe(true);
  });

  it('a sessão começa sem desconto e sem renovação', () => {
    const loja = lojaAberta();

    expect(loja.desconto).toBe(0);
    expect(loja.descontoRolado).toBe(false);
    expect(loja.renovacoes).toBe(0);
  });
});

describe('pechinchar', () => {
  it('20 no dado dá 30% e barateia a compra', () => {
    const loja = lojaAberta();
    const alvo = estoque(loja)[0]!;
    const cheio = precoDeCompra(loja, alvo);

    const negociada = pechinchar(loja, 20);

    expect(negociada.desconto).toBe(0.3);
    expect(precoDeCompra(negociada, alvo)).toBeLessThan(cheio);
  });

  it('rolagem baixa não dá desconto', () => {
    const loja = pechinchar(lojaAberta(), 3);

    expect(loja.desconto).toBe(0);
    expect(loja.log[0]).toContain('não concedeu desconto');
  });

  it('só dá pra rolar uma vez por visita', () => {
    const primeira = pechinchar(lojaAberta(), 1);
    const segunda = pechinchar(primeira, 20);

    expect(segunda).toBe(primeira);
  });
});

describe('comprar', () => {
  it('tira o ouro, põe na mochila e some do estoque', () => {
    const loja = lojaAberta();
    const alvo = estoque(loja)[0]!;
    const preco = precoDeCompra(loja, alvo);

    const depois = comprar(loja, alvo);

    expect(depois.estado.hero.gold).toBe(loja.estado.hero.gold - preco);
    expect(depois.estado.inventory.some((i) => i.uid === alvo.uid)).toBe(true);
    expect(estoque(depois).some((i) => i.uid === alvo.uid)).toBe(false);
  });

  it('sem ouro não compra nada', () => {
    const loja = lojaAberta(0);
    const alvo = estoque(loja)[0]!;

    const depois = comprar(loja, alvo);

    expect(depois.estado).toBe(loja.estado);
    expect(depois.log[0]).toContain('Ouro insuficiente');
  });
});

describe('vender', () => {
  it('paga metade do valor e tira da mochila', () => {
    const espada = item('espada');
    const loja = { ...lojaAberta(), estado: comInventario(lojaAberta().estado, [espada]) };

    const depois = vender(loja, espada);

    expect(depois.estado.hero.gold).toBe(loja.estado.hero.gold + precoDeVenda(espada));
    expect(depois.estado.inventory).toHaveLength(0);
  });

  it('item equipado não aparece na lista de venda', () => {
    const equipada = { ...item('espada'), equipped: true };
    const solta = item('adaga');
    const loja = { ...lojaAberta(), estado: comInventario(lojaAberta().estado, [equipada, solta]) };

    expect(vendaveis(loja).map((i) => i.uid)).toEqual([solta.uid]);
  });
});

describe('renovarEstoque', () => {
  it('troca o estoque, cobra o preço e encarece a próxima renovação', () => {
    const loja = lojaAberta();
    const antes = estoque(loja).map((i) => i.uid);
    const preco = precoDaRenovacao(loja);

    const depois = renovarEstoque(loja, seededRng(31));

    expect(estoque(depois).map((i) => i.uid)).not.toEqual(antes);
    expect(depois.estado.hero.gold).toBe(loja.estado.hero.gold - preco);
    expect(precoDaRenovacao(depois)).toBe(preco + 10);
  });

  it('sem ouro não renova', () => {
    const loja = lojaAberta(0);
    const antes = estoque(loja).map((i) => i.uid);

    const depois = renovarEstoque(loja, seededRng(31));

    expect(estoque(depois).map((i) => i.uid)).toEqual(antes);
    expect(depois.log[0]).toContain('custa');
  });
});

describe('reforjar', () => {
  function ferreiroCom(itens: Item[], ouro = 1000): Loja {
    const base = lojaAberta(ouro, 'blacksmith');
    return { ...base, estado: comInventario(base.estado, itens) };
  }

  it('gasta ouro, consome o material e devolve o item com tier novo', () => {
    const espada = item('espada', 2);
    const minerio = item('minerio');
    const loja = ferreiroCom([espada, minerio]);

    const depois = reforjar(loja, espada, 'minerio', seededRng(2));

    expect(depois.estado.hero.gold).toBe(loja.estado.hero.gold - 20);
    expect(depois.estado.inventory.some((i) => i.uid === minerio.uid)).toBe(false);
    expect(depois.log[0]).toContain('Reforja de');
  });

  it('sem o material não acontece nada', () => {
    const espada = item('espada', 2);
    const loja = ferreiroCom([espada]);

    const depois = reforjar(loja, espada, 'minerio', seededRng(2));

    expect(depois.estado).toBe(loja.estado);
    expect(depois.log[0]).toContain('material');
  });

  it('sem ouro não acontece nada', () => {
    const espada = item('espada', 2);
    const loja = ferreiroCom([espada, item('minerio')], 5);

    const depois = reforjar(loja, espada, 'minerio', NUNCA);

    expect(depois.estado).toBe(loja.estado);
    expect(depois.log[0]).toContain('custa');
  });
});

describe('a sala guarda o estoque', () => {
  it('o mapa da cidade acompanha a mudança, não só o mapa em uso', () => {
    const loja = lojaAberta();
    const sala = celulaAtual(loja.estado) as CityCell;
    const doCache = loja.estado.cityMap?.[sala.y]?.[sala.x];

    expect(doCache?.forSale).toHaveLength(5);
  });

  it('substituirCelulaAtual na cidade mantém map e cityMap juntos', () => {
    const estado = emCimaDe(cidade(), 'shop');
    const sala = celulaAtual(estado) as CityCell;

    const depois = substituirCelulaAtual(estado, { ...sala, forSale: [] });

    expect(depois.cityMap).toBe(depois.map);
  });
});
