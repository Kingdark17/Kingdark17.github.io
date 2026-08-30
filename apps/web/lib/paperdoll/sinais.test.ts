import { describe, expect, it } from 'vitest';

import { instantiate, RARITIES, seededRng, templateById, type Hero, type Item } from '@rpg-legend/shared';

import { auraDoEquipamento, corDaAura, sinaisDoHeroi } from './sinais';

function peca(templateId: string, raridade: string): Item {
  const molde = templateById(templateId);
  if (!molde) throw new Error(`template ${templateId} não existe`);
  const indice = RARITIES.findIndex((r) => r.id === raridade);
  if (indice < 0) throw new Error(`raridade ${raridade} não existe`);
  return instantiate(molde, RARITIES[indice]!, { rng: seededRng(1), now: () => 1 });
}

describe('corDaAura', () => {
  /**
   * O corte existe pra o brilho **significar** alguma coisa. Quase todo
   * mundo carrega peça comum o tempo inteiro; brilho sempre aceso vira
   * ruído de fundo e mata o efeito de quando a peça boa enfim cai.
   */
  it('só brilha de raro pra cima', () => {
    expect(corDaAura('comum')).toBeNull();
    expect(corDaAura('incomum')).toBeNull();
    expect(corDaAura('raro')).toBe('--r-raro');
    expect(corDaAura('lendario')).toBe('--r-lendario');
    expect(corDaAura('mitico')).toBe('--r-mitico');
  });

  it('sem raridade, sem brilho — e nada quebra', () => {
    expect(corDaAura(null)).toBeNull();
    expect(corDaAura(undefined)).toBeNull();
  });

  /**
   * A cor sai de `RARITIES[].colorVar`, que é o mesmo nome de variável que
   * o `globals.css` define. Inventar a string aqui faria o brilho sair
   * transparente sem erro nenhum no console.
   */
  it('devolve o nome de variável que o catálogo declara', () => {
    for (const raridade of RARITIES) {
      const cor = corDaAura(raridade.id);
      if (cor !== null) expect(cor).toBe(raridade.colorVar);
    }
  });
});

describe('auraDoEquipamento', () => {
  it('pega a peça mais rara, não a primeira', () => {
    expect(
      auraDoEquipamento({
        arma: peca('espada', 'comum'),
        armadura: peca('placas', 'lendario'),
        secundaria: peca('escudo', 'raro'),
      }),
    ).toBe('lendario');
  });

  it('nu, ou só com peça fraca, não brilha', () => {
    expect(auraDoEquipamento({})).toBeNull();
    expect(auraDoEquipamento({ arma: null, armadura: null })).toBeNull();
    expect(auraDoEquipamento({ arma: peca('espada', 'incomum') })).toBeNull();
  });
});

describe('sinaisDoHeroi', () => {
  const heroi = (extra: Partial<Hero> = {}) =>
    ({ equip: { arma: peca('espada', 'epico') }, buffs: {}, ...extra }) as unknown as Pick<Hero, 'equip' | 'buffs'>;

  it('lê a aura do equipamento e o veneno dos buffs', () => {
    expect(sinaisDoHeroi(heroi())).toEqual({ vivo: true, envenenado: false, aura: 'epico' });
    expect(sinaisDoHeroi(heroi({ buffs: { poisonTurns: 3 } } as Partial<Hero>)).envenenado).toBe(true);
    // Veneno que acabou é veneno que não tinge.
    expect(sinaisDoHeroi(heroi({ buffs: { poisonTurns: 0 } } as Partial<Hero>)).envenenado).toBe(false);
  });

  /**
   * `ferido` é acontecimento, não estado: a vida cair de 40 pra 32 não
   * deixa rastro no herói. Quem o percebe é a tela, comparando com o que
   * exibiu antes — se um dia ele passar a sair daqui, é porque alguém
   * entendeu errado de onde ele vem.
   */
  it('não tenta adivinhar `ferido` a partir do herói', () => {
    expect(sinaisDoHeroi(heroi())).not.toHaveProperty('ferido');
  });

  /** Save antigo chega sem `buffs`, e o painel não pode explodir por isso. */
  it('aguenta herói sem buffs e sem equipamento', () => {
    expect(() => sinaisDoHeroi({} as Pick<Hero, 'equip' | 'buffs'>)).not.toThrow();
    expect(sinaisDoHeroi({} as Pick<Hero, 'equip' | 'buffs'>)).toEqual({ vivo: true, envenenado: false, aura: null });
  });
});
