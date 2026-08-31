import { describe, expect, it } from 'vitest';

import { classById, classByName, CLASSES, DEBUFFS, powerById, powerByName, RACES, raceByName } from './catalog.js';
import {
  buildHero,
  equipItem,
  equippedSlot,
  gainXP,
  generateCompanion,
  hasDebuffEffect,
  heroPowers,
  hydrateSavedHero,
  isOffhandEligible,
  isTwoHanded,
  recomputeDerived,
  rollAttrs,
  spendAttrPoint,
  unequipItem,
  weaponAffinityPct,
  type Hero,
} from './hero.js';
import { seededRng } from '../rng.js';
import { instantiate } from '../items/item.js';
import { TEMPLATES, templateById } from '../items/templates.js';
import { RARITIES } from '../items/rarity.js';

const HUMANO = raceByName('Humano')!;
const GUERREIRO = classByName('Guerreiro')!;
const SEM_DEBUFF = DEBUFFS[0]!; // qualquer um serve para os testes que não checam o efeito

function novoHeroi(rng = seededRng(1)): Hero {
  return buildHero(
    { name: 'Testudo', race: HUMANO, cls: GUERREIRO, debuff: SEM_DEBUFF, chosenPowerIds: [] },
    rng,
  );
}

describe('catálogo', () => {
  it('mantém as 12 raças e 12 classes originais', () => {
    expect(RACES).toHaveLength(12);
    expect(CLASSES).toHaveLength(12);
  });

  it('toda classe tem afinidade 100% com a própria arma inicial', () => {
    for (const c of CLASSES) {
      expect(c.affinity[c.weaponTemplate]).toBe(100);
    }
  });

  it('busca por nome ignora acento', () => {
    expect(classByName('Barbaro')?.id).toBe('barbaro');
    expect(classByName('Bárbaro')?.id).toBe('barbaro');
    expect(classByName('cacador')?.id).toBe('cacador');
  });
});

describe('rollAttrs', () => {
  it('mantém todo atributo em [1, 20]', () => {
    for (let seed = 0; seed < 100; seed++) {
      const attrs = rollAttrs(HUMANO, GUERREIRO, SEM_DEBUFF, seededRng(seed));
      for (const value of Object.values(attrs)) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(20);
      }
    }
  });

  it('aplica o viés da classe', () => {
    // Guerreiro tem bias forca:3, constituicao:2 — em média deveria puxar pra cima
    const semClasse = rollAttrs(HUMANO, classByName('Mago')!, SEM_DEBUFF, seededRng(7));
    const guerreiro = rollAttrs(HUMANO, GUERREIRO, SEM_DEBUFF, seededRng(7));
    expect(guerreiro.forca).toBeGreaterThan(semClasse.forca);
  });
});

describe('buildHero', () => {
  it('começa com a arma inicial da classe equipada', () => {
    const hero = novoHeroi();
    expect(hero.equip.arma?.templateId).toBe('espada'); // weaponTemplate do Guerreiro
    expect(hero.equip.arma?.equipped).toBe(true);
  });

  it('hp/mp começam cheios', () => {
    const hero = novoHeroi();
    expect(hero.hp).toBe(hero.maxHp);
    expect(hero.mp).toBe(hero.maxMp);
  });

  it('poder de assinatura sempre entra, sem duplicar se escolhido de novo', () => {
    const hero = buildHero(
      { name: 'X', race: HUMANO, cls: GUERREIRO, debuff: SEM_DEBUFF, chosenPowerIds: ['golpe_poderoso', 'escudo_arcano'] },
      seededRng(1),
    );
    // A assinatura do guerreiro é `golpe_poderoso`: escolhê-la de novo não
    // pode duplicar.
    expect(hero.powerIds).toEqual(['golpe_poderoso', 'escudo_arcano']);
    expect(hero.powerNames).toEqual(['Golpe Poderoso', 'Escudo Arcano']);
  });

  it('powerNames resolve para os objetos de poder completos via heroPowers', () => {
    const hero = novoHeroi();
    const powers = heroPowers(hero);
    expect(powers[0]?.name).toBe('Golpe Poderoso');
    expect(powers[0]?.icon).toBeTruthy();
  });

  it('é determinístico com rng semeado', () => {
    const a = novoHeroi(seededRng(42));
    const b = novoHeroi(seededRng(42));
    expect(a.attrs).toEqual(b.attrs);
    expect(a.gold).toBe(b.gold);
  });
});

describe('recomputeDerived — assimetria de hp/mp', () => {
  it('um AUMENTO de maxHp cura pela diferença', () => {
    let hero = novoHeroi();
    hero = { ...hero, hp: hero.maxHp - 10 }; // tomou dano
    const antes = hero.hp;
    const comMaisAtributo = { ...hero, attrs: { ...hero.attrs, constituicao: hero.attrs.constituicao + 5 } };
    const depois = recomputeDerived(comMaisAtributo);
    expect(depois.maxHp).toBeGreaterThan(hero.maxHp);
    expect(depois.hp).toBeGreaterThan(antes); // curou pela diferença
  });

  it('uma REDUÇÃO de maxHp só limita, nunca cura', () => {
    let hero = novoHeroi();
    hero = { ...hero, hp: hero.maxHp }; // vida cheia
    const comMenosAtributo = { ...hero, attrs: { ...hero.attrs, constituicao: 1 } };
    const depois = recomputeDerived(comMenosAtributo);
    expect(depois.maxHp).toBeLessThan(hero.maxHp);
    expect(depois.hp).toBe(depois.maxHp); // clampado, não ficou negativo nem sobrou
  });

  it('não muta o herói recebido', () => {
    const hero = novoHeroi();
    const snapshot = JSON.stringify(hero);
    recomputeDerived({ ...hero, attrs: { ...hero.attrs, forca: 99 } });
    expect(JSON.stringify(hero)).toBe(snapshot);
  });
});

describe('spendAttrPoint', () => {
  it('não faz nada sem pontos disponíveis', () => {
    const hero = novoHeroi();
    expect(hero.attrPoints).toBe(0);
    const depois = spendAttrPoint(hero, 'forca');
    expect(depois).toBe(hero); // mesma referência, nada mudou
  });

  it('gasta o ponto e recalcula derivados', () => {
    const hero = { ...novoHeroi(), attrPoints: 2 };
    const depois = spendAttrPoint(hero, 'forca');
    expect(depois.attrPoints).toBe(1);
    expect(depois.attrs.forca).toBe(hero.attrs.forca + 1);
    expect(depois.derived.dmgFisico).toBeGreaterThan(hero.derived.dmgFisico);
  });

  it('nunca passa de 99', () => {
    const hero = { ...novoHeroi(), attrPoints: 5, attrs: { ...novoHeroi().attrs, forca: 99 } };
    const depois = spendAttrPoint(hero, 'forca');
    expect(depois.attrs.forca).toBe(99);
  });
});

describe('gainXP', () => {
  /**
   * O laço de subir de nível roda no navegador de quem está jogando, e as
   * entradas nem sempre vêm do jogo: save corrompido e painel ADM escrevem
   * XP na mão. `Infinity` satisfaz `xp >= xpNext` pra sempre — era uma aba
   * travada esperando o número errado.
   *
   * Cada teste aqui é um número que, sem as guardas, ou trava ou envenena
   * o save em silêncio. O `timeout` curto é de propósito: se alguém tirar
   * o teto, isto falha por tempo em vez de rodar pra sempre no CI.
   */
  describe('número insano não trava nem envenena', () => {
    /**
     * `Infinity` nem chega no laço: é recusado na entrada e vale zero.
     * Melhor que deixá-lo entrar e parar no teto — XP infinito não é um
     * ganho grande demais, é um ganho que não existe, e conceder 500
     * níveis por causa dele seria transformar um dado estragado em prêmio.
     */
    it('XP infinito não vale nada, em vez de girar pra sempre', { timeout: 3000 }, () => {
      const hero = novoHeroi();
      const { hero: depois, levels, leveledUp } = gainXP(hero, Number.POSITIVE_INFINITY);

      expect(levels).toBe(0);
      expect(leveledUp).toBe(false);
      expect(depois.xp).toBe(hero.xp);
      expect(depois.level).toBe(hero.level);
    });

    it('NaN não vira XP nem contamina o herói', () => {
      const { hero: depois, leveledUp } = gainXP(novoHeroi(), Number.NaN);

      expect(leveledUp).toBe(false);
      expect(depois.xp).toBe(0);
    });

    it('XP absurdo no save para no teto, sem varrer o número inteiro', { timeout: 3000 }, () => {
      const hero = { ...novoHeroi(), xp: 1e18 };
      const { hero: depois, levels } = gainXP(hero, 0);

      expect(levels).toBe(500);
      expect(Number.isFinite(depois.xp)).toBe(true);
    });

    /** `xpNext` zerado se cura na primeira volta, porque `xpForLevel` dá 40 no mínimo. */
    it('xpNext estragado não vira laço infinito', { timeout: 3000 }, () => {
      const hero = { ...novoHeroi(), xpNext: 0 };
      const { hero: depois } = gainXP(hero, 10);

      expect(depois.xpNext).toBeGreaterThanOrEqual(40);
    });

    it('negativo é tratado como zero, e não como XP ao contrário', () => {
      const { hero: depois } = gainXP(novoHeroi(), -5000);

      expect(depois.xp).toBe(0);
      expect(depois.level).toBe(1);
    });
  });

  it('não sobe de nível sem XP suficiente', () => {
    const hero = novoHeroi();
    const { hero: depois, leveledUp } = gainXP(hero, 1);
    expect(leveledUp).toBe(false);
    expect(depois.level).toBe(1);
  });

  it('sobe de nível e concede 2 pontos de atributo', () => {
    const hero = novoHeroi();
    const { hero: depois, leveledUp, levels } = gainXP(hero, hero.xpNext);
    expect(leveledUp).toBe(true);
    expect(levels).toBe(1);
    expect(depois.level).toBe(2);
    expect(depois.attrPoints).toBe(2);
  });

  it('sobe múltiplos níveis de uma vez com XP suficiente', () => {
    const hero = novoHeroi();
    const { hero: depois, levels } = gainXP(hero, 1000);
    expect(levels).toBeGreaterThan(1);
    expect(depois.attrPoints).toBe(levels * 2);
  });

  it('subir de nível cura pela diferença de maxHp (via recomputeDerived)', () => {
    let hero = novoHeroi();
    hero = { ...hero, hp: 1 };
    const { hero: depois } = gainXP(hero, hero.xpNext);
    expect(depois.hp).toBeGreaterThan(1);
  });
});

describe('equipamento', () => {
  function machado(): ReturnType<typeof instantiate> {
    return instantiate(templateById('machado')!, RARITIES[0]!, { rng: seededRng(1) });
  }
  function escudo(): ReturnType<typeof instantiate> {
    return instantiate(templateById('escudo')!, RARITIES[0]!, { rng: seededRng(1) });
  }

  it('isOffhandEligible aceita escudo e armas leves específicas', () => {
    expect(isOffhandEligible(escudo())).toBe(true);
    expect(isOffhandEligible(instantiate(templateById('adaga')!, RARITIES[0]!))).toBe(true);
    expect(isOffhandEligible(instantiate(templateById('arco')!, RARITIES[0]!))).toBe(false);
  });

  it('isTwoHanded aceita as pesadas e o violão, não as leves', () => {
    for (const id of ['arco', 'cajado', 'machado', 'marreta', 'violao']) {
      expect(isTwoHanded(instantiate(templateById(id)!, RARITIES[0]!))).toBe(true);
    }
    // As três leves são justamente as que cabem na secundária.
    for (const id of ['espada', 'adaga', 'maca']) {
      expect(isTwoHanded(instantiate(templateById(id)!, RARITIES[0]!))).toBe(false);
    }
  });

  /** Nenhuma arma pode ser as duas coisas — seria "cabe na secundária, mas ocupa as duas mãos". */
  it('nenhuma arma é leve e pesada ao mesmo tempo', () => {
    for (const template of TEMPLATES.filter((t) => t.category === 'arma')) {
      const arma = instantiate(template, RARITIES[0]!);
      expect(isTwoHanded(arma) && isOffhandEligible(arma)).toBe(false);
    }
  });

  /**
   * A regra das duas mãos existiu escrita e desligada: `isTwoHanded` estava
   * exportada e não era chamada por ninguém, então dava pra andar de machado
   * e escudo. Estes testes são o que prende a regra ligada.
   */
  describe('arma de duas mãos', () => {
    it('equipar a arma de duas mãos esvazia a secundária', () => {
      const comEscudo = equipItem(novoHeroi(), escudo()).hero;
      expect(comEscudo.equip.secundaria?.templateId).toBe('escudo');

      const { hero: depois, equipped } = equipItem(comEscudo, machado());
      expect(equipped).toBe(true);
      expect(depois.equip.arma?.templateId).toBe('machado');
      expect(depois.equip.secundaria).toBeNull();
    });

    it('com arma de duas mãos na principal, a secundária recusa — e diz por quê', () => {
      const comMachado = equipItem(novoHeroi(), machado()).hero;
      const { hero: depois, equipped, reason } = equipItem(comMachado, escudo());

      expect(equipped).toBe(false);
      expect(reason).toBe('two_handed_weapon');
      expect(depois).toBe(comMachado); // recusa não mexe no herói
    });

    it('a recusa é da arma, não da classe: com arma de uma mão o escudo entra', () => {
      const comEspada = equipItem(novoHeroi(), instantiate(templateById('espada')!, RARITIES[0]!)).hero;
      const { equipped } = equipItem(comEspada, escudo());

      expect(equipped).toBe(true);
    });

    it('save de antes da regra chega normalizado: arco e escudo viram só arco', () => {
      const comMachado = equipItem(novoHeroi(), machado()).hero;
      // O par ilegal só existe em save gravado antes da regra — aqui é
      // montado à mão porque `equipItem` não deixa mais chegar nesse estado.
      const comoEstavaNoSave: Hero = { ...comMachado, equip: { ...comMachado.equip, secundaria: escudo() } };

      expect(hydrateSavedHero(comoEstavaNoSave).equip.secundaria).toBeNull();
    });

    it('trocar a arma de duas mãos por uma de uma mão devolve a mão secundária', () => {
      const comMachado = equipItem(novoHeroi(), machado()).hero;
      const comEspada = equipItem(comMachado, instantiate(templateById('espada')!, RARITIES[0]!)).hero;

      expect(equipItem(comEspada, escudo()).equipped).toBe(true);
    });
  });

  it('equipa arma no slot arma e recalcula derivados', () => {
    const hero = novoHeroi();
    const { hero: depois, equipped } = equipItem(hero, machado());
    expect(equipped).toBe(true);
    expect(depois.equip.arma?.templateId).toBe('machado');
    expect(depois.derived).not.toBe(hero.derived);
  });

  it('recusa equipar arma pesada na secundária', () => {
    const hero = novoHeroi();
    const { equipped } = equipItem(hero, machado(), 'secundaria');
    expect(equipped).toBe(false);
  });

  it('equipa escudo na secundária mesmo sendo categoria armadura', () => {
    const hero = novoHeroi();
    const { hero: depois, equipped } = equipItem(hero, escudo());
    expect(equipped).toBe(true);
    expect(depois.equip.secundaria?.templateId).toBe('escudo');
  });

  it('não muta o herói nem o item recebidos', () => {
    const hero = novoHeroi();
    const item = machado();
    const heroSnapshot = JSON.stringify(hero);
    const itemSnapshot = JSON.stringify(item);
    equipItem(hero, item);
    expect(JSON.stringify(hero)).toBe(heroSnapshot);
    expect(JSON.stringify(item)).toBe(itemSnapshot);
  });

  it('desequipa e recalcula', () => {
    const hero = novoHeroi();
    const depois = unequipItem(hero, 'arma');
    expect(depois.equip.arma).toBeNull();
  });

  it('equippedSlot acha o slot por referência ou por uid', () => {
    const hero = novoHeroi();
    const arma = hero.equip.arma!;
    expect(equippedSlot(hero, arma)).toBe('arma');
    expect(equippedSlot(hero, { ...arma })).toBe('arma'); // referência diferente, mesmo uid
  });
});

describe('hasDebuffEffect', () => {
  it('reconhece o efeito direto', () => {
    const debuff = DEBUFFS.find((d) => d.effect === 'critPenalty')!;
    const hero = { debuff };
    expect(hasDebuffEffect(hero, 'critPenalty')).toBe(true);
    expect(hasDebuffEffect(hero, 'fleePenalty')).toBe(false);
  });

  it('cobre saves antigos só com o nome, sem effect', () => {
    const hero = { debuff: { id: 'x', name: 'Medo do Fogo', icon: '', desc: '', attr: null } };
    expect(hasDebuffEffect(hero, 'fireVulnerability')).toBe(true);
  });

  it('não quebra sem herói ou sem debuff', () => {
    expect(hasDebuffEffect(null, 'critPenalty')).toBe(false);
    expect(hasDebuffEffect({ debuff: undefined as never }, 'critPenalty')).toBe(false);
  });
});

describe('weaponAffinityPct', () => {
  it('100% sem arma equipada', () => {
    expect(weaponAffinityPct({ className: 'Guerreiro', equip: {} })).toBe(100);
  });

  it('usa a afinidade da classe com o template da arma', () => {
    const hero = novoHeroi(); // Guerreiro com espada
    expect(weaponAffinityPct(hero)).toBe(100);
  });

  it('afinidade baixa para arma fora do estilo da classe', () => {
    const mago = classByName('Mago')!;
    const cajado = instantiate(templateById('cajado')!, RARITIES[0]!);
    const machadoItem = instantiate(templateById('machado')!, RARITIES[0]!);
    expect(weaponAffinityPct({ className: mago.name, equip: { arma: cajado } })).toBe(100);
    expect(weaponAffinityPct({ className: mago.name, equip: { arma: machadoItem } })).toBe(20);
  });
});

describe('generateCompanion', () => {
  it('gera atributos e maxHp coerentes', () => {
    for (let seed = 0; seed < 20; seed++) {
      const c = generateCompanion(seededRng(seed));
      expect(c.maxHp).toBe(18 + c.attrs.constituicao * 3);
      expect(c.hp).toBe(c.maxHp);
      expect(c.attack).toBeGreaterThan(0);
    }
  });
});

describe('hydrateSavedHero', () => {
  it('preenche secundaria ausente e buffs vazio', () => {
    const hero = novoHeroi();
    const legado = { ...hero, equip: { arma: hero.equip.arma, armadura: null, acessorio: null } } as unknown as Hero;
    const hidratado = hydrateSavedHero(legado);
    expect(hidratado.equip.secundaria).toBeNull();
    expect(hidratado.buffs).toEqual({});
  });

  it('restaura o poder de assinatura quando powerNames está vazio', () => {
    const hero = { ...novoHeroi(), powerNames: [] };
    const hidratado = hydrateSavedHero(hero);
    expect(hidratado.powerNames).toEqual(['Golpe Poderoso']);
  });

  it('não muta a entrada', () => {
    const hero = novoHeroi();
    const snapshot = JSON.stringify(hero);
    hydrateSavedHero(hero);
    expect(JSON.stringify(hero)).toBe(snapshot);
  });
});

describe('classById/powerById integridade', () => {
  it('toda classe referenciada por id existe', () => {
    for (const c of CLASSES) {
      expect(classById(c.id)).toEqual(c);
    }
  });

  it('todo poder de assinatura de classe existe no catálogo', () => {
    for (const c of CLASSES) {
      expect(powerById(c.signatureId)).not.toBeNull();
    }
  });
});

/**
 * O motivo de `classId`/`raceId`/`powerIds` existirem: enquanto as regras
 * dependiam de `hero.className === 'Mago'`, traduzir uma palavra do
 * catálogo mudaria dano, desligaria passiva e sumiria com os poderes do
 * herói — em silêncio, porque toda busca por nome termina em `?? null`.
 */
describe('identidade separada do texto de tela', () => {
  const MAGO = classByName('Mago')!;

  function magoNovo(): Hero {
    return buildHero({ name: 'Aria', race: HUMANO, cls: MAGO, debuff: SEM_DEBUFF, chosenPowerIds: [] }, seededRng(2));
  }

  it('o herói criado hoje guarda id de classe, de raça e dos poderes', () => {
    const hero = magoNovo();

    expect(hero.classId).toBe('mago');
    expect(hero.raceId).toBe('humano');
    expect(hero.powerIds).toEqual(['bola_de_fogo']);
  });

  it('com o id no lugar, o nome pode estar em qualquer idioma', () => {
    const traduzido: Hero = { ...magoNovo(), className: 'Wizard', race: 'Human' };

    // A afinidade do mago com cajado é 100; sem o id, `classByName('Wizard')`
    // devolveria null e cairia no 100 genérico — o mesmo número por acaso.
    // Por isso o teste usa uma arma de afinidade baixa, onde os dois casos
    // se separam.
    const comEspada: Hero = { ...traduzido, equip: { ...traduzido.equip, arma: { ...traduzido.equip.arma!, templateId: 'espada' } } };

    expect(weaponAffinityPct(comEspada)).toBe(30);
    expect(heroPowers(traduzido).map((p) => p.id)).toEqual(['bola_de_fogo']);
  });

  it('save gravado antes dos ids continua funcionando e ganha os ids', () => {
    const novo = magoNovo();
    // Como um save que já está na nuvem: só nome, nenhum id.
    const { classId, raceId, powerIds, ...comoEstavaNaNuvem } = novo;
    void classId;
    void raceId;
    void powerIds;

    const carregado = hydrateSavedHero(comoEstavaNaNuvem as Hero);

    expect(carregado.classId).toBe('mago');
    expect(carregado.raceId).toBe('humano');
    expect(carregado.powerIds).toEqual(['bola_de_fogo']);
    // E as regras já funcionavam antes de gravar de novo, pelo nome.
    expect(heroPowers(comoEstavaNaNuvem as Hero).map((p) => p.id)).toEqual(['bola_de_fogo']);
  });
});
