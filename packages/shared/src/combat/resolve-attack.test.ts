import { describe, expect, it } from 'vitest';

import { derivedStats } from '../hero/derived.js';
import type { Attributes } from '../hero/stats.js';
import { DEBUFFS } from '../hero/catalog.js';
import type { Hero, HeroEquipment } from '../hero/hero.js';
import { instantiate } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import { freshCombatMonster, type CombatMonster, type CombatMonsterView } from './monster-state.js';
import { monsterView, type MonsterInstance } from '../monsters/generate.js';
import type { Rng } from '../rng.js';
import { ataquesDisponiveis, ladosDoAtaque, resolveAttack } from './resolve-attack.js';

const SEM_DEBUFF = DEBUFFS.find((d) => !d.effect)!;
const RANGED_DEBUFF = DEBUFFS.find((d) => d.effect === 'rangedPenalty')!;

function baseAttrs(overrides: Partial<Attributes> = {}): Attributes {
  return { forca: 10, destreza: 10, constituicao: 10, intelecto: 10, sabedoria: 10, carisma: 10, ...overrides };
}

/**
 * Herói construído à mão (sem passar por buildHero) para poder calcular os
 * valores esperados manualmente.
 *
 * **Bárbaro por padrão, e não Guerreiro.** Os testes que usam o padrão
 * falam do d20 — o 20 natural, o alvo 11, o 7 que erra —, e o guerreiro
 * passou a rolar d6 no físico (`ataquePrincipal`). O bárbaro é a classe
 * que não tem ataque principal **nem** passiva que puxe o `rng`: com
 * paladino ou clérigo a cura da passiva consumiria um número da
 * `sequenceRng` e deslocaria todos os outros.
 */
function heroFixture(opts: { className?: string; weaponId?: string; attrs?: Partial<Attributes>; hero?: Partial<Hero> } = {}): Hero {
  const attrs = baseAttrs(opts.attrs);
  const weapon = opts.weaponId ? instantiate(templateById(opts.weaponId)!, RARITIES[0]!) : null;
  const equip: HeroEquipment = { arma: weapon, secundaria: null, armadura: null, acessorio: null };
  const derived = derivedStats({ level: 1, attrs, equip });
  return {
    level: 1,
    attrs,
    equip,
    name: 'T',
    race: 'Humano',
    raceIcon: '',
    className: opts.className ?? 'Bárbaro',
    classIcon: '',
    xp: 0,
    xpNext: 40,
    attrPoints: 0,
    gold: 0,
    powerNames: [],
    debuff: SEM_DEBUFF,
    killCount: 0,
    derived,
    maxHp: derived.maxHp,
    hp: derived.maxHp,
    maxMp: derived.maxMp,
    mp: derived.maxMp,
    buffs: {},
    ...opts.hero,
  };
}

/** Monstro construído à mão. Goblin: weakness magico, resistance nenhuma — neutro pra ataque físico. */
function monsterFixture(overrides: Partial<CombatMonster> = {}): CombatMonsterView {
  const instance: MonsterInstance = {
    speciesId: 'goblin',
    enemyClassId: 'brutamontes',
    floor: 5,
    hp: 100,
    maxHp: 100,
    dmg: 5,
    speed: 8,
    xp: 10,
    gold: 10,
    isBoss: false,
  };
  return monsterView({ ...freshCombatMonster(instance), ...overrides });
}

/** Devolve valores fixos em sequência — controla exatamente cada chamada de rng() dentro de resolveAttack. */
function sequenceRng(values: number[]): Rng {
  let i = 0;
  return () => (i < values.length ? (values[i++] as number) : (values[values.length - 1] ?? 0));
}

describe('resolveAttack — dano físico puro (sem crit, sem proc, sem passiva)', () => {
  it('bate o valor calculado à mão: Guerreiro com espada, 5 no d6', () => {
    const hero = heroFixture({ className: 'Guerreiro', weaponId: 'espada' });
    const monster = monsterFixture();
    // O guerreiro rola d6 no físico, e o 5 acerta (alvo 3). O dano não
    // depende da rolagem — por isso a conta à mão é a mesma do tempo do d20:
    // dmgFisico = forca*2 = 20; espada ataque:4 (100% afinidade); base = 3+0 = 3 (rng call 1 -> 0)
    // dmg = round((3 + 20 + 4 + 0) * 1) = 27; goblin neutro a fisico -> sem modificador
    // crit: critico=5+destreza*0.5=10 -> critChance=0.10; rng call 2 = 0.99 -> não crita
    // proc espada chance 0.15; rng call 3 = 0.99 -> não dispara
    const result = resolveAttack(hero, monster, 5, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });

    expect(result.outcome).toBe('hit');
    expect(result.damage).toBe(27);
    expect(result.isCrit).toBe(false);
    expect(result.magical).toBe(false);
    expect(result.affinityPct).toBe(100);
    expect(result.procTriggered).toBeNull();
    expect(result.classPassiveTriggered).toBeNull();
    expect(result.monster.hp).toBe(73);
    expect(result.monsterDefeated).toBe(false);
  });

  it('não muta hero nem monster recebidos', () => {
    const hero = heroFixture({ weaponId: 'espada' });
    const monster = monsterFixture();
    const heroSnap = JSON.stringify(hero);
    const monsterSnap = JSON.stringify(monster);
    resolveAttack(hero, monster, 15, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(JSON.stringify(hero)).toBe(heroSnap);
    expect(JSON.stringify(monster)).toBe(monsterSnap);
  });
});

describe('resolveAttack — mana', () => {
  it('recusa ataque mágico sem mana suficiente, herói fica intocado', () => {
    const hero = heroFixture({ className: 'Mago', weaponId: 'cajado', hero: { mp: 2 } });
    const monster = monsterFixture();
    const result = resolveAttack(hero, monster, 5, 'magic');
    expect(result.outcome).toBe('no_mana');
    expect(result.hero).toBe(hero); // mesma referência: nada foi tocado
  });

  it('desconta o custo de mana antes de resolver o ataque mágico', () => {
    const hero = heroFixture({ className: 'Mago', weaponId: 'cajado', hero: { mp: 20 } });
    const monster = monsterFixture();
    const result = resolveAttack(hero, monster, 5, 'magic', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(result.hero.mp).toBe(15); // 20 - 5 de custo
  });
});

describe('resolveAttack — acerto garantido', () => {
  it('critNext força acerto mesmo com rolagem baixa, e crítico', () => {
    const hero = heroFixture({ weaponId: 'espada', hero: { buffs: { critNext: true } } });
    const monster = monsterFixture();
    const result = resolveAttack(hero, monster, 1, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(result.outcome).toBe('hit');
    expect(result.isCrit).toBe(true);
  });

  it('consome critNext após o ataque', () => {
    const hero = heroFixture({ weaponId: 'espada', hero: { buffs: { critNext: true } } });
    const result = resolveAttack(hero, monsterFixture(), 1, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(result.hero.buffs?.critNext).toBe(false);
  });

  it('crítico multiplica o dano em 1.6x', () => {
    const hero = heroFixture({ weaponId: 'espada' });
    const semCrit = resolveAttack(hero, monsterFixture(), 15, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    const comCrit = resolveAttack(hero, monsterFixture(), 20, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) }); // roll 20 sempre crita
    expect(comCrit.damage).toBe(Math.round((semCrit.damage as number) * 1.6));
  });
});

describe('resolveAttack — esquiva de monstro ágil', () => {
  it('monstro ágil pode esquivar de um acerto que não seja crítico garantido nem roll 20', () => {
    const hero = heroFixture({ weaponId: 'espada' });
    const agil = monsterFixture({ speciesId: 'lobo_sombras' }); // behavior: agil
    const result = resolveAttack(hero, agil, 15, 'normal', { rng: sequenceRng([0.05]) }); // primeira chamada é o rolo de esquiva (<0.15)
    expect(result.outcome).toBe('dodged');
    expect(result.monster).toEqual(agil); // monstro não muda numa esquiva
  });

  it('crítico garantido ignora a checagem de esquiva do monstro ágil', () => {
    const hero = heroFixture({ weaponId: 'espada', hero: { buffs: { critNext: true } } });
    const agil = monsterFixture({ speciesId: 'lobo_sombras' });
    const result = resolveAttack(hero, agil, 1, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(result.outcome).toBe('hit');
  });

  it('roll 20 também ignora a esquiva', () => {
    const hero = heroFixture({ weaponId: 'espada' });
    const agil = monsterFixture({ speciesId: 'lobo_sombras' });
    const result = resolveAttack(hero, agil, 20, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(result.outcome).toBe('hit');
  });
});

describe('resolveAttack — buffs temporários', () => {
  it('precisaoTurns reduz o alvo de acerto', () => {
    const hero = heroFixture({ weaponId: 'espada', hero: { buffs: { precisaoTurns: 2, precisaoAmount: 25 } } });
    // hitTarget = max(4, 11 - floor(25/5)) = 6; roll 7 deveria acertar
    const result = resolveAttack(hero, monsterFixture(), 7, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(result.outcome).toBe('hit');
  });

  it('sem o buff, o mesmo roll 7 erraria (hitTarget=11)', () => {
    const hero = heroFixture({ weaponId: 'espada' });
    const result = resolveAttack(hero, monsterFixture(), 7, 'normal');
    expect(result.outcome).toBe('miss');
  });

  it('decrementa precisaoTurns/forcaTurns em erro e acerto', () => {
    const hero = heroFixture({ weaponId: 'espada', hero: { buffs: { precisaoTurns: 2, forcaTurns: 3, forcaAmount: 0.3 } } });
    const acerto = resolveAttack(hero, monsterFixture(), 15, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(acerto.hero.buffs?.precisaoTurns).toBe(1);
    expect(acerto.hero.buffs?.forcaTurns).toBe(2);

    const erro = resolveAttack(hero, monsterFixture(), 1, 'normal');
    expect(erro.hero.buffs?.precisaoTurns).toBe(1);
    expect(erro.hero.buffs?.forcaTurns).toBe(2);
  });

  it('debuff de visão fraca soma +2 no alvo de acerto só com arco ou cajado', () => {
    const comArco = heroFixture({ weaponId: 'arco', hero: { debuff: RANGED_DEBUFF } });
    // hitTarget vira 13; roll 12 deveria errar
    const result = resolveAttack(comArco, monsterFixture(), 12, 'normal');
    expect(result.outcome).toBe('miss');

    const comEspada = heroFixture({ weaponId: 'espada', hero: { debuff: RANGED_DEBUFF } });
    // espada não sofre a penalidade; hitTarget continua 11, roll 12 acerta
    const semPenalidade = resolveAttack(comEspada, monsterFixture(), 12, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(semPenalidade.outcome).toBe('hit');
  });
});

describe('resolveAttack — ataque mágico', () => {
  it('não aplica bônus de força mesmo com o buff ativo', () => {
    const mago = heroFixture({ className: 'Mago', weaponId: 'cajado', hero: { buffs: { forcaTurns: 3, forcaAmount: 1.0 } } });
    const comForca = resolveAttack(mago, monsterFixture(), 5, 'magic', { rng: sequenceRng([0, 0.99, 0.99]) });
    const semForca = resolveAttack({ ...mago, buffs: {} }, monsterFixture(), 5, 'magic', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(comForca.damage).toBe(semForca.damage);
  });

  it('usa dmgMagico em vez de dmgFisico na base', () => {
    // intelecto 10 -> dmgMagico = intelecto*3 = 30; forca 10 -> dmgFisico = forca*2 = 20
    const mago = heroFixture({ className: 'Mago', weaponId: 'cajado' });
    const result = resolveAttack(mago, monsterFixture(), 5, 'magic', { rng: sequenceRng([0, 0.99, 0.99]) });
    // base=3, dmgMagico=30, cajado ataque:3 (100% afinidade), otherEquipAtk=0 -> round(3+30+3+0)=36
    // o goblin da fixture tem weakness:'magico', que soma +25%: round(36*1.25)=45
    expect(result.damage).toBe(45);
  });
});

describe('resolveAttack — mago lutando fisicamente', () => {
  it('usa metade do dano físico como base quando ataca fisicamente', () => {
    const mago = heroFixture({ className: 'Mago', weaponId: 'cajado' });
    const result = resolveAttack(mago, monsterFixture(), 15, 'physical', { rng: sequenceRng([0, 0.99, 0.99]) });
    // physicalBase = round(dmgFisico*0.5) = round(20*0.5) = 10
    // dmg = round((3 + 10 + weaponAtkContribution(cajado,100%=3) + 0) * 1) = round(16) = 16
    expect(result.damage).toBe(16);
    expect(result.magical).toBe(false);
  });
});

describe('resolveAttack — Bárbaro', () => {
  it('bônus de força só se aplica abaixo de 50% de vida', () => {
    const barbaroFerido = heroFixture({ className: 'Bárbaro', weaponId: 'machado', hero: {} });
    const ferido = { ...barbaroFerido, hp: Math.floor(barbaroFerido.maxHp * 0.4) };
    const saudavel = barbaroFerido;

    const comFerido = resolveAttack(ferido, monsterFixture(), 15, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    const comSaudavel = resolveAttack(saudavel, monsterFixture(), 15, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(comFerido.damage as number).toBeGreaterThan(comSaudavel.damage as number);
  });
});

describe('resolveAttack — integração com proc e passiva', () => {
  it('dispara o proc da arma quando o rolo é favorável', () => {
    const hero = heroFixture({ weaponId: 'espada' }); // proc queimadura, chance 0.15
    const result = resolveAttack(hero, monsterFixture(), 15, 'normal', { rng: sequenceRng([0, 0.99, 0]) });
    expect(result.procTriggered?.effect).toBe('queimadura');
    expect(result.monster.status?.queimadura).toBeDefined();
  });

  it('dispara a passiva de classe quando o rolo é favorável', () => {
    const ladino = heroFixture({ className: 'Ladino', weaponId: 'adaga' }); // adaga não tem proc
    // O ladino é o "algoz" do doc: rola d6 no físico.
    const result = resolveAttack(ladino, monsterFixture(), 5, 'normal', { rng: sequenceRng([0, 0.99, 0]) });
    expect(result.classPassiveTriggered?.kind).toBe('ladino');
  });

  it('monsterDefeated fica true quando o hp zera', () => {
    const hero = heroFixture({ weaponId: 'espada' });
    const fraco = monsterFixture({ hp: 5 });
    const result = resolveAttack(hero, fraco, 15, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(result.monsterDefeated).toBe(true);
    expect(result.monster.hp).toBeLessThanOrEqual(0);
  });
});

/**
 * "Arma define dado" — doc do Breno, com a leitura fechada pelo Pedro em
 * 2026-09-26: o ataque que combina com a classe rola d6 e acerta com 3+
 * (67%); todo o resto continua no d20 com 11+ (50%). Cavaleiro é o
 * guerreiro, algoz é o ladino.
 *
 * O d20 não tem teste novo aqui de propósito: os de cima continuam sendo a
 * prova dele, e passam sem mudar um número — o herói padrão virou um
 * bárbaro, que rola d20 em tudo.
 */
describe('o dado da classe', () => {
  it('cada classe rola d6 só no ataque dela', () => {
    expect(ladosDoAtaque(heroFixture({ className: 'Guerreiro', weaponId: 'espada' }), 'normal')).toBe(6);
    expect(ladosDoAtaque(heroFixture({ className: 'Ladino', weaponId: 'adaga' }), 'normal')).toBe(6);
    expect(ladosDoAtaque(heroFixture({ className: 'Mago', weaponId: 'cajado' }), 'magic')).toBe(6);
    expect(ladosDoAtaque(heroFixture({ className: 'Mago', weaponId: 'cajado' }), 'physical')).toBe(20);
    expect(ladosDoAtaque(heroFixture({ className: 'Arqueiro', weaponId: 'arco' }), 'ranged')).toBe(6);
    expect(ladosDoAtaque(heroFixture({ className: 'Arqueiro', weaponId: 'arco' }), 'normal')).toBe(20);
    expect(ladosDoAtaque(heroFixture({ className: 'Caçador', weaponId: 'arco' }), 'ranged')).toBe(6);
    // Paladino não é o cavaleiro do doc — o Pedro disse que é o guerreiro.
    expect(ladosDoAtaque(heroFixture({ className: 'Paladino', weaponId: 'espada' }), 'normal')).toBe(20);
    expect(ladosDoAtaque(heroFixture({ className: 'Bardo', weaponId: 'violao' }), 'normal')).toBe(20);
  });

  it('o tiro só é d6 com arco na mão', () => {
    expect(ladosDoAtaque(heroFixture({ className: 'Arqueiro', weaponId: 'espada' }), 'ranged')).toBe(20);
    expect(ladosDoAtaque(heroFixture({ className: 'Arqueiro' }), 'ranged')).toBe(20);
  });

  it('a classe vem pelo id, não pelo nome — save antigo sem acento acha a mesma regra', () => {
    expect(ladosDoAtaque(heroFixture({ className: 'Cacador', weaponId: 'arco' }), 'ranged')).toBe(6);
  });

  it('os botões: o da classe primeiro, e o físico sempre existe', () => {
    const botoes = (className: string, weaponId?: string) =>
      ataquesDisponiveis(heroFixture({ className, weaponId })).map((a) => `${a.estilo}:d${a.lados}${a.custo ? `:${a.custo}MP` : ''}`);

    expect(botoes('Mago', 'cajado')).toEqual(['magic:d6:5MP', 'physical:d20']);
    expect(botoes('Arqueiro', 'arco')).toEqual(['ranged:d6', 'normal:d20']);
    expect(botoes('Arqueiro', 'espada')).toEqual(['normal:d20']);
    expect(botoes('Guerreiro', 'espada')).toEqual(['normal:d6']);
    expect(botoes('Ladino', 'adaga')).toEqual(['normal:d6']);
    expect(botoes('Clérigo', 'maca')).toEqual(['normal:d20']);
  });

  it('no d6 acerta com 3 e erra com 2', () => {
    const guerreiro = heroFixture({ className: 'Guerreiro', weaponId: 'espada' });
    expect(resolveAttack(guerreiro, monsterFixture(), 3, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) }).outcome).toBe('hit');
    expect(resolveAttack(guerreiro, monsterFixture(), 2, 'normal').outcome).toBe('miss');
  });

  /**
   * O 20 natural crita e fura a esquiva do ágil. O 6 não herda nada disso:
   * seriam 16,7% de crítico automático contra 5%, e o pedido foi acertar
   * mais, não critar mais.
   */
  it('o 6 do d6 é só um acerto — não crita nem fura a esquiva', () => {
    const guerreiro = heroFixture({ className: 'Guerreiro', weaponId: 'espada' });
    expect(resolveAttack(guerreiro, monsterFixture(), 6, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) }).isCrit).toBe(false);

    // O comportamento vem da espécie. Conferido antes, e não dentro de um
    // `if`: um `if` falso faria o teste passar sem testar nada.
    const agil = monsterFixture({ speciesId: 'lobo_sombras' });
    expect(agil.behavior).toBe('agil');
    expect(resolveAttack(guerreiro, agil, 6, 'normal', { rng: sequenceRng([0.05]) }).outcome).toBe('dodged');
  });

  it('precisão e Visão Fraca valem a mesma fatia no d6', () => {
    // Tiro Certeiro (25) tira 5 pontos do d20 = 25%; no d6 isso é face e
    // meia, que arredonda pra 2 — o alvo cai de 3 pra 2, o mínimo do d6.
    const mirando = heroFixture({ className: 'Arqueiro', weaponId: 'arco', hero: { buffs: { precisaoTurns: 2, precisaoAmount: 25 } } });
    expect(resolveAttack(mirando, monsterFixture(), 2, 'ranged', { rng: sequenceRng([0, 0.99, 0.99]) }).outcome).toBe('hit');
    expect(resolveAttack(mirando, monsterFixture(), 1, 'ranged').outcome).toBe('miss');

    // Visão Fraca: +2 no d20 = -10%; no d6, uma face. O alvo sobe de 3 pra 4.
    const miope = heroFixture({ className: 'Arqueiro', weaponId: 'arco', hero: { debuff: RANGED_DEBUFF } });
    expect(resolveAttack(miope, monsterFixture(), 3, 'ranged').outcome).toBe('miss');
    expect(resolveAttack(miope, monsterFixture(), 4, 'ranged', { rng: sequenceRng([0, 0.99, 0.99]) }).outcome).toBe('hit');
  });

  it('recusa número que não existe no dado', () => {
    const guerreiro = heroFixture({ className: 'Guerreiro', weaponId: 'espada' });
    expect(() => resolveAttack(guerreiro, monsterFixture(), 7, 'normal')).toThrow(RangeError);
    expect(() => resolveAttack(guerreiro, monsterFixture(), 0, 'normal')).toThrow(RangeError);
    expect(() => resolveAttack(guerreiro, monsterFixture(), 2.5, 'normal')).toThrow(RangeError);
    expect(() => resolveAttack(heroFixture(), monsterFixture(), 21, 'normal')).toThrow(RangeError);
  });

  it('o tiro causa o mesmo dano do golpe físico', () => {
    const arqueiro = heroFixture({ className: 'Arqueiro', weaponId: 'arco' });
    const rng = () => sequenceRng([0, 0.99, 0.99, 0.99]);
    const tiro = resolveAttack(arqueiro, monsterFixture(), 5, 'ranged', { rng: rng() });
    const golpe = resolveAttack(arqueiro, monsterFixture(), 15, 'normal', { rng: rng() });
    expect(tiro.damage).toBe(golpe.damage);
  });
});

describe('Canção de Batalha no golpe do herói', () => {
  const inspirar = (hero: Hero): Hero => ({ ...hero, buffs: { ...hero.buffs, inspiracaoTurns: 2, inspiracaoAmount: 0.25 } });

  it('vale pro golpe físico', () => {
    const bardo = heroFixture({ className: 'Bardo', weaponId: 'adaga' });
    const sem = resolveAttack(bardo, monsterFixture(), 15, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    const com = resolveAttack(inspirar(bardo), monsterFixture(), 15, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(com.damage).toBe(Math.round((sem.damage as number) * 1.25));
  });

  it('vale pro golpe mágico também — ao contrário da força', () => {
    const mago = heroFixture({ className: 'Mago', weaponId: 'cajado' });
    const sem = resolveAttack(mago, monsterFixture(), 5, 'magic', { rng: sequenceRng([0, 0.99, 0.99]) });
    const com = resolveAttack(inspirar(mago), monsterFixture(), 5, 'magic', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(com.damage).toBeGreaterThan(sem.damage as number);
  });

  it('não é descontada pelo ataque — isso é do turno da equipe', () => {
    const bardo = inspirar(heroFixture({ className: 'Bardo', weaponId: 'adaga' }));
    const depois = resolveAttack(bardo, monsterFixture(), 15, 'normal', { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(depois.hero.buffs?.inspiracaoTurns).toBe(2);
  });
});
