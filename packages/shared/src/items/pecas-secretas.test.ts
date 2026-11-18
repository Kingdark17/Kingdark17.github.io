import { describe, expect, it } from 'vitest';

import type { DungeonCell } from '../dungeon/generate.js';
import { derivedStats } from '../hero/derived.js';
import { cabeNaMaoLivre } from '../hero/hero.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from '../jogo/estado.js';
import { saveSorteado } from '../jogo/heroi-sorteado.js';
import { abrirNegociante, comprarDoNegociante } from '../jogo/negociante.js';
import { interagir } from '../jogo/sala.js';
import { seededRng } from '../rng.js';
import { rollStock } from '../shop/shop.js';
import { instantiate } from './item.js';
import { chanceDoNegociante, CHAPEU_DO_ESPADACHIM, pecasDaClasse, sortearPecaSecreta, vidaComAArma } from './pecas-secretas.js';
import { RARITIES, rarityById } from './rarity.js';
import { templateById } from './templates.js';

// As peças secretas e o negociante (rodada 6a, 2026-11-17).

const peca = (id: string) => ({ ...instantiate(templateById(id)!, rarityById('raro')!, { rng: seededRng(1), now: () => 1 }), equipped: true });

describe('as peças secretas', () => {
  it('o negociante só aparece pra quem tem peça da classe; a explosiva sai 1 vez em 5', () => {
    expect(pecasDaClasse({ classId: 'arqueiro' }).map((p) => p.id)).toEqual(['aljava_paralisante', 'aljava_flamejante', 'aljava_explosiva']);
    expect(chanceDoNegociante({ classId: 'monge' })).toBe(5);
    expect(chanceDoNegociante({ classId: 'mago' })).toBe(0);
    expect(sortearPecaSecreta({ classId: 'arqueiro' }, () => 0.1)?.id).toBe('aljava_explosiva');
    expect(sortearPecaSecreta({ classId: 'arqueiro' }, () => 0.5)?.id).toBe('aljava_flamejante');
    expect(sortearPecaSecreta({ classId: 'guerreiro' }, () => 0.9)?.id).toBe('lanca');
    expect(sortearPecaSecreta({ classId: 'mago' }, () => 0.5)).toBeNull();
  });

  it('o Monge com a arma dele (numa das mãos) tem +50% de vida, em todo lugar', () => {
    expect(vidaComAArma(100, { classId: 'monge', equip: { arma: { templateId: 'bastao' } } })).toBe(150);
    expect(vidaComAArma(100, { classId: 'monge', equip: { secundaria: { templateId: 'leque' } } })).toBe(150);
    expect(vidaComAArma(100, { classId: 'guerreiro', equip: { arma: { templateId: 'bastao' } } })).toBe(100);
    expect(vidaComAArma(100, { classId: 'monge', equip: {} })).toBe(100);
    const atributos = { forca: 1, destreza: 1, constituicao: 10, intelecto: 1, sabedoria: 1, carisma: 1 };
    const semArma = derivedStats({ level: 3, attrs: atributos, equip: {}, classId: 'monge' }).maxHp;
    expect(derivedStats({ level: 3, attrs: atributos, equip: { arma: peca('kusarigama') }, classId: 'monge' }).maxHp).toBe(Math.round(((semArma + (peca('kusarigama').stats.vida ?? 0)) * 150) / 100));
  });

  it('a aljava cabe ao lado do arco; o escudo não', () => {
    expect(cabeNaMaoLivre(peca('arco'), peca('aljava_paralisante'))).toBe(true);
    expect(cabeNaMaoLivre(peca('arco'), peca('escudo'))).toBe(false);
    expect(cabeNaMaoLivre(peca('cajado'), peca('aljava_paralisante'))).toBe(false);
  });

  it('o ferreiro do app, com a Floresta zerada, às vezes tem o chapéu do espadachim; o site nunca', () => {
    let noApp = 0;
    for (let i = 0; i < 400; i++) {
      expect(rollStock('blacksmith', 3, { rng: seededRng(i), now: () => 1 }).some((item) => item.templateId === CHAPEU_DO_ESPADACHIM)).toBe(false);
      expect(rollStock('shop', 3, { rng: seededRng(i), now: () => 1, app: true, chapeu: true }).some((item) => item.templateId === CHAPEU_DO_ESPADACHIM)).toBe(false);
      if (rollStock('blacksmith', 3, { rng: seededRng(i), now: () => 1, app: true, chapeu: true }).some((item) => item.templateId === CHAPEU_DO_ESPADACHIM)) noApp += 1;
    }
    expect(noApp).toBeGreaterThan(5);
    expect(noApp).toBeLessThan(45);
  });
});

describe('o negociante secreto', () => {
  function naSalaDoNegociante(ouro: number): EstadoNaMasmorra {
    const save = saveSorteado('Aria', seededRng(11), seededRng(11));
    const base = retomarSave({ ...save, floor: 2, mapMode: 'dungeon' }, seededRng(11));
    if (base.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
    const celula = celulaAtual(base) as DungeonCell;
    const comOuro = { ...base, hero: { ...base.hero, gold: ouro } };
    return substituirCelulaAtual(comOuro, { ...celula, type: 'negociante', monsters: [], negociante: { item: peca('lanca'), preco: 800 } });
  }

  it('só o app o ouve; vende a peça pelo preço fixo e segue viagem', () => {
    const sala = naSalaDoNegociante(1000);
    expect(interagir(sala, seededRng(1)).aviso?.texto).toBe('Um negociante encapuzado passa por aqui, mas não abre a capa.');
    expect(interagir(sala, seededRng(1), null, undefined, true).tela?.tipo).toBe('negociante');
    const comprou = comprarDoNegociante(sala);
    expect(comprou.estado.hero.gold).toBe(200);
    expect(comprou.estado.inventory.some((i) => i.templateId === 'lanca')).toBe(true);
    expect((celulaAtual(comprou.estado) as DungeonCell).negociante?.vendido).toBe(true);
    expect(abrirNegociante(comprou.estado)).toBeNull();
  });

  it('sem ouro, nada muda', () => {
    const pobre = naSalaDoNegociante(300);
    expect(abrirNegociante(pobre)?.podeComprar).toBe(false);
    const tentou = comprarDoNegociante(pobre);
    expect(tentou.estado).toBe(pobre);
    expect(tentou.texto).toBe('Faltam 500 de ouro.');
  });

  it('a raridade das peças é a rara, e vendida rende a metade do preço', () => {
    const lanca = instantiate(templateById('lanca')!, RARITIES[2]!, { rng: seededRng(1), now: () => 1 });
    expect(Math.floor(lanca.value * 0.5)).toBe(400);
  });
});
