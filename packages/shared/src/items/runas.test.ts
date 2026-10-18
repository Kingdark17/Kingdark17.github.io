import { describe, expect, it } from 'vitest';

import { freshCombatMonster } from '../combat/monster-state.js';
import { abrirMochila, engastarRuna, tirarRuna } from '../jogo/mochila.js';
import { retomarSave, type EstadoNaMasmorra } from '../jogo/estado.js';
import { saveSorteado } from '../jogo/heroi-sorteado.js';
import { monsterView } from '../monsters/generate.js';
import { seededRng, type Rng } from '../rng.js';
import { resolveForge } from '../shop/shop.js';
import { displayName, instantiate, itemView, randomItem, type Item } from './item.js';
import {
  aplicarRunas,
  aposMudarDeTier,
  criarRuna,
  efeitosDaArma,
  engastar,
  espacosDeRuna,
  sortearRuna,
  tierMaximoNoAndar,
  tirar,
} from './runas.js';
import { rarityById, type Rarity } from './rarity.js';
import { templateById } from './templates.js';
import { tierFor } from './tiers.js';

const agora = () => 1_700_000_000_000;
const sempre = (valor: number): Rng => () => valor;
function sequencia(valores: number[]): Rng {
  let i = 0;
  return () => (i < valores.length ? (valores[i++] as number) : 0);
}
const arma = (id: string, raridade = 'comum', degrau = 1): Item => instantiate(templateById(id)!, rarityById(raridade) as Rarity, { rng: () => 0, now: agora, degrau });
const runa = (tipo: Parameters<typeof criarRuna>[0], tier = 1) => criarRuna(tipo, tier, { rng: () => 0, now: agora });

describe('a runa como item', () => {
  it('leva o tier no nome e no valor', () => {
    expect(displayName(runa('fogo', 2))).toBe('Runa de Fogo II');
    expect(displayName(runa('eletrica', 3))).toBe('Runa Elétrica III');
    expect([1, 2, 3].map((t) => runa('gelo', t).value)).toEqual([40, 80, 160]);
  });

  it('não mostra raridade: o que conta nela é o tier, que já vai no nome', () => {
    expect(itemView(runa('fogo', 2)).rarityLabel).toBe('');
    expect(itemView(arma('espada')).rarityLabel).toBe('Comum');
  });

  it('o sorteio comum de item nunca dá runa', () => {
    for (let i = 1; i <= 300; i++) expect(templateById(randomItem({ floor: 90, rng: seededRng(i), now: agora }).templateId)!.category).not.toBe('runa');
  });

  it('o tier que cai: o I em qualquer andar, o II no 30, o III no 60; o chefe um acima', () => {
    expect([1, 29, 30, 59, 60, 100].map(tierMaximoNoAndar)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(sortearRuna(10, false, sequencia([0, 0.99, 0])).tierDaRuna).toBe(1);
    expect(sortearRuna(10, true, sequencia([0, 0, 0])).tierDaRuna).toBe(2);
    expect(sortearRuna(90, true, sequencia([0, 0.99, 0])).tierDaRuna).toBe(3);
  });
});

describe('os espaços da arma', () => {
  it('um em toda arma; nenhum fora delas', () => {
    expect(espacosDeRuna(arma('espada'))).toBe(1);
    expect(espacosDeRuna(arma('placas'))).toBe(0);
    expect(espacosDeRuna(runa('fogo'))).toBe(0);
  });

  it('mais um se for mítica, um se for do último degrau, um se for tier A ou acima: quatro no máximo', () => {
    const mitica = arma('espada', 'mitico');
    expect(tierFor(mitica)).not.toBe('E');
    const esperado = 1 + 1 + (['A', 'S', 'SS', 'SSS', 'SSS+', 'MAX'].includes(tierFor(mitica)!) ? 1 : 0);
    expect(espacosDeRuna(mitica)).toBe(esperado);
    expect(espacosDeRuna(arma('arco', 'comum', 3))).toBe(2);
    expect(espacosDeRuna(arma('marreta', 'mitico', 3))).toBe(4);
  });
});

describe('engastar e tirar', () => {
  it('engasta no primeiro espaço livre; cheia, só trocando, e a antiga se desfaz', () => {
    const espada = arma('espada');
    const primeira = engastar(espada, runa('fogo', 1));
    expect(primeira.kind).toBe('engastou');
    const cheia = (primeira as { arma: Item }).arma;
    expect(engastar(cheia, runa('gelo')).kind).toBe('cheia');
    const troca = engastar(cheia, runa('gelo', 2), 0);
    expect(troca).toMatchObject({ kind: 'substituiu', destruida: { runa: 'fogo', tier: 1 }, arma: { runas: [{ runa: 'gelo', tier: 2 }] } });
  });

  it('não engasta em quem não é arma, nem o que não é runa', () => {
    expect(engastar(arma('placas'), runa('fogo')).kind).toBe('nao_e_arma');
    expect(engastar(arma('espada'), arma('adaga')).kind).toBe('nao_e_runa');
  });

  it('tirar quebra pelo tier: 40% no I, 25% no II, 10% no III', () => {
    const com = (tier: number) => ({ ...arma('espada'), runas: [{ runa: 'fogo' as const, tier }] });
    expect(tirar(com(1), 0, sempre(0.39)).kind).toBe('quebrou');
    expect(tirar(com(1), 0, sempre(0.4)).kind).toBe('voltou');
    expect(tirar(com(2), 0, sempre(0.24)).kind).toBe('quebrou');
    expect(tirar(com(3), 0, sempre(0.1)).kind).toBe('voltou');
    const voltou = tirar(com(2), 0, sempre(0.5), agora);
    expect(voltou).toMatchObject({ kind: 'voltou', runa: { templateId: 'runa_fogo', tierDaRuna: 2 } });
    expect('runas' in (voltou as { arma: Item }).arma).toBe(false);
  });

  it('a arma que perde espaço devolve inteira a runa que sobrou', () => {
    const espada = { ...arma('espada'), runas: [{ runa: 'fogo' as const, tier: 1 }, { runa: 'gelo' as const, tier: 3 }] };
    const ajuste = aposMudarDeTier(espada, () => 0, agora);
    expect(ajuste.arma.runas).toEqual([{ runa: 'fogo', tier: 1 }]);
    expect(ajuste.devolvidas.map(displayName)).toEqual(['Runa de Gelo III']);
  });

  it('a reforja que derruba o tier devolve a runa na mochila', () => {
    const mitica = { ...arma('espada', 'mitico'), runas: [{ runa: 'fogo' as const, tier: 1 }, { runa: 'gelo' as const, tier: 1 }, { runa: 'eletrica' as const, tier: 1 }] };
    const espacos = espacosDeRuna(mitica);
    const minerio = instantiate(templateById('minerio')!, rarityById('comum') as Rarity, { rng: () => 0, now: agora });
    const hero = { ...saveSorteado('Aria', seededRng(1), seededRng(1)).hero, gold: 9999 };
    // 0 no sorteio da forja: o tier cai um.
    const forja = resolveForge(hero, [mitica, minerio], mitica, 'minerio', { rng: () => 0, now: agora });
    const reforjada = forja.inventory.find((i) => i.uid === mitica.uid)!;
    const devolvidas = forja.inventory.filter((i) => i.templateId.startsWith('runa_'));
    expect((reforjada.runas ?? []).length + devolvidas.length).toBe(3);
    expect((reforjada.runas ?? []).length).toBe(Math.min(3, espacosDeRuna(reforjada)));
    expect(espacos).toBeGreaterThanOrEqual(espacosDeRuna(reforjada));
  });
});

describe('na mochila', () => {
  function naMochila(inventario: Item[]): EstadoNaMasmorra {
    const save = saveSorteado('Aria', seededRng(11), seededRng(11));
    const estado = retomarSave({ ...save, floor: 2, mapMode: 'dungeon' }, seededRng(11));
    if (estado.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
    return { ...estado, inventory: inventario };
  }

  it('engastar na arma equipada muda o slot e a mochila, e a runa sai da mochila', () => {
    const espada = { ...arma('espada'), equipped: true };
    const fogo = runa('fogo', 2);
    const estado = naMochila([espada, fogo]);
    const vestida = { ...estado, hero: { ...estado.hero, equip: { ...estado.hero.equip, arma: espada } } };
    const depois = engastarRuna(abrirMochila(vestida), espada, fogo).estado;
    expect(depois.hero.equip.arma?.runas).toEqual([{ runa: 'fogo', tier: 2 }]);
    expect(depois.inventory.find((i) => i.uid === espada.uid)?.runas).toEqual([{ runa: 'fogo', tier: 2 }]);
    expect(depois.inventory.some((i) => i.uid === fogo.uid)).toBe(false);
  });

  it('tirar devolve a runa à mochila, ou ela quebra', () => {
    const espada = { ...arma('espada'), runas: [{ runa: 'vampirica' as const, tier: 3 }] };
    const estado = naMochila([espada]);
    const voltou = tirarRuna(abrirMochila(estado), espada, 0, sempre(0.5), agora);
    expect(voltou.estado.inventory.map(displayName)).toEqual(['Espada', 'Runa Vampírica III']);
    const quebrou = tirarRuna(abrirMochila(estado), espada, 0, sempre(0.05), agora);
    expect(quebrou.estado.inventory.map(displayName)).toEqual(['Espada']);
    expect(quebrou.log[0]).toContain('quebra');
  });

  it('runa que não está na mochila não engasta (e não se duplica)', () => {
    const espada = arma('espada');
    const estado = naMochila([espada]);
    expect(engastarRuna(abrirMochila(estado), espada, runa('fogo')).estado).toBe(abrirMochila(estado).estado);
  });
});

describe('no golpe (a arena)', () => {
  const zumbi = () => monsterView(freshCombatMonster({ speciesId: 'zumbi', enemyClassId: 'brutamontes', floor: 2, hp: 100, maxHp: 100, dmg: 3, speed: 5, xp: 12, gold: 7, isBoss: false }));
  const comArma = (runas: Item['runas']) => {
    const save = saveSorteado('Aria', seededRng(11), seededRng(11));
    const hero = save.hero;
    return { ...hero, hp: 50, maxHp: 100, equip: { ...hero.equip, arma: { ...arma('espada'), runas, equipped: true } } };
  };

  it('as iguais somam a chance e a força', () => {
    const efeitos = efeitosDaArma({ ...arma('espada'), runas: [{ runa: 'fogo', tier: 1 }, { runa: 'fogo', tier: 3 }, { runa: 'gelo', tier: 2 }] });
    expect(efeitos).toEqual([
      { runa: 'fogo', chance: 0.1 + 0.2, forca: 0.2 + 0.4 },
      { runa: 'gelo', chance: 0.15, forca: 0.35 },
    ]);
  });

  it('cada runa que dispara: choque com atordoar, queima, lento e cura', () => {
    const hero = comArma([{ runa: 'eletrica', tier: 3 }, { runa: 'fogo', tier: 2 }, { runa: 'gelo', tier: 1 }, { runa: 'vampirica', tier: 2 }]);
    const r = aplicarRunas(hero, zumbi(), 20, sempre(0));
    expect(r.disparos).toEqual([
      { runa: 'eletrica', valor: 10 },
      { runa: 'fogo', valor: 6 },
      { runa: 'gelo', valor: 0.25 },
      { runa: 'vampirica', valor: 7 },
    ]);
    expect(r.monster.hp).toBe(90);
    expect(r.monster.status).toMatchObject({ atordoado: 1, queimadura: { turns: 3, dmg: 6 }, lento: { turns: 3, amount: 0.25 } });
    expect(r.hero.hp).toBe(57);
  });

  it('sem disparar, nada muda', () => {
    const hero = comArma([{ runa: 'eletrica', tier: 1 }]);
    const r = aplicarRunas(hero, zumbi(), 20, sempre(0.99));
    expect(r.disparos).toEqual([]);
    expect(r.monster.hp).toBe(100);
  });

  it('a cura não passa da vida cheia', () => {
    const hero = { ...comArma([{ runa: 'vampirica', tier: 3 }]), hp: 99 };
    expect(aplicarRunas(hero, zumbi(), 40, sempre(0)).hero.hp).toBe(100);
  });
});
