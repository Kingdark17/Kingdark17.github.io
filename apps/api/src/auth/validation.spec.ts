import { isValidSave, isValidSlot, isValidTransition, MAX_SLOTS, type SaveData } from './validation';

function makeSave(overrides: Partial<SaveData> = {}, heroOverrides: Record<string, unknown> = {}): SaveData {
  return {
    hero: {
      name: 'Aria',
      attrs: { forca: 5, destreza: 5, constituicao: 5, intelecto: 5, sabedoria: 5, carisma: 5 },
      equip: {},
      level: 3,
      gold: 100,
      ...heroOverrides,
    },
    inventory: [],
    party: [],
    floor: 2,
    mapMode: 'dungeon',
    ...overrides,
  };
}

describe('isValidSlot', () => {
  it.each([1, 2, 3, 4])('aceita o slot %i', (slot) => {
    expect(isValidSlot(slot)).toBe(true);
  });

  it.each([0, 5, -1, 1.5, 'a', null, undefined])('rejeita slot inválido %p', (slot) => {
    expect(isValidSlot(slot)).toBe(false);
  });

  it('MAX_SLOTS é 4', () => {
    expect(MAX_SLOTS).toBe(4);
  });
});

describe('isValidSave', () => {
  it('aceita um save completo', () => {
    expect(isValidSave(makeSave())).toBe(true);
  });

  it('rejeita null/undefined/não-objeto', () => {
    expect(isValidSave(null)).toBe(false);
    expect(isValidSave(undefined)).toBe(false);
    expect(isValidSave('save')).toBe(false);
  });

  it('rejeita sem hero', () => {
    expect(isValidSave({ inventory: [], party: [], floor: 1 })).toBe(false);
  });

  it('rejeita hero.name que não é string', () => {
    expect(isValidSave(makeSave({}, { name: 42 }))).toBe(false);
  });

  it('rejeita sem attrs', () => {
    expect(isValidSave(makeSave({}, { attrs: undefined }))).toBe(false);
  });

  it('rejeita sem equip', () => {
    expect(isValidSave(makeSave({}, { equip: undefined }))).toBe(false);
  });

  it('rejeita inventory que não é array', () => {
    expect(isValidSave(makeSave({ inventory: undefined }))).toBe(false);
  });

  it('rejeita party que não é array', () => {
    expect(isValidSave(makeSave({ party: undefined }))).toBe(false);
  });

  it('rejeita floor fora de [1, 10000]', () => {
    expect(isValidSave(makeSave({ floor: 0 }))).toBe(false);
    expect(isValidSave(makeSave({ floor: 10001 }))).toBe(false);
  });

  it('aceita floor nos limites 1 e 10000', () => {
    expect(isValidSave(makeSave({ floor: 1 }))).toBe(true);
    expect(isValidSave(makeSave({ floor: 10000 }))).toBe(true);
  });
});

describe('isValidTransition', () => {
  it('aceita qualquer coisa quando não há save anterior', () => {
    expect(isValidTransition(null, makeSave())).toBe(true);
  });

  it('aceita nível subindo até +5', () => {
    const oldSave = makeSave({}, { level: 3 });
    expect(isValidTransition(oldSave, makeSave({}, { level: 8 }))).toBe(true);
  });

  it('rejeita nível subindo mais que +5', () => {
    const oldSave = makeSave({}, { level: 3 });
    expect(isValidTransition(oldSave, makeSave({}, { level: 9 }))).toBe(false);
  });

  it('rejeita nível caindo', () => {
    const oldSave = makeSave({}, { level: 3 });
    expect(isValidTransition(oldSave, makeSave({}, { level: 2 }))).toBe(false);
  });

  it('aceita ouro subindo até +5000', () => {
    const oldSave = makeSave({}, { gold: 100 });
    expect(isValidTransition(oldSave, makeSave({}, { gold: 5100 }))).toBe(true);
  });

  it('rejeita ouro subindo mais que +5000', () => {
    const oldSave = makeSave({}, { gold: 100 });
    expect(isValidTransition(oldSave, makeSave({}, { gold: 5101 }))).toBe(false);
  });

  it('rejeita ouro negativo', () => {
    const oldSave = makeSave({}, { gold: 100 });
    expect(isValidTransition(oldSave, makeSave({}, { gold: -1 }))).toBe(false);
  });

  it('aceita o andar avançando em 1', () => {
    const oldSave = makeSave({ floor: 2 });
    expect(isValidTransition(oldSave, makeSave({ floor: 3 }))).toBe(true);
  });

  it('rejeita o andar avançando mais que 1', () => {
    const oldSave = makeSave({ floor: 2 });
    expect(isValidTransition(oldSave, makeSave({ floor: 4 }))).toBe(false);
  });

  it('rejeita o andar caindo pra um andar que o portão não oferece', () => {
    const oldSave = makeSave({ floor: 5, mapMode: 'dungeon' });
    expect(isValidTransition(oldSave, makeSave({ floor: 3, mapMode: 'dungeon' }))).toBe(false);
  });

  it('aceita o andar caindo pro 1 quando volta pra cidade', () => {
    const oldSave = makeSave({ floor: 5, mapMode: 'dungeon' });
    expect(isValidTransition(oldSave, makeSave({ floor: 1, mapMode: 'city' }))).toBe(true);
    expect(isValidTransition(oldSave, makeSave({ floor: 1, mapMode: 'town' }))).toBe(true);
  });

  describe('portão', () => {
    const floresta = { dungeon: 'floresta', difficulty: 'normal' };
    const totens = (andares: number[]) => ({ cleared: [], totems: { 'floresta:normal': andares } });

    it('aceita entrar pelo andar 1 depois de sair de um andar mais fundo (a saída guarda o andar)', () => {
      const oldSave = makeSave({ floor: 3, mapMode: 'city', masmorra: floresta });
      expect(isValidTransition(oldSave, makeSave({ floor: 1, mapMode: 'dungeon', masmorra: floresta }))).toBe(true);
    });

    it('aceita o andar 1 de outra masmorra', () => {
      const oldSave = makeSave({ floor: 100, mapMode: 'city', masmorra: floresta });
      expect(isValidTransition(oldSave, makeSave({ floor: 1, mapMode: 'dungeon', masmorra: { dungeon: 'caverna', difficulty: 'normal' } }))).toBe(
        true,
      );
    });

    it('aceita sair e entrar de novo sem a cidade ter sido gravada no meio', () => {
      const oldSave = makeSave({ floor: 4, mapMode: 'dungeon', masmorra: floresta });
      expect(isValidTransition(oldSave, makeSave({ floor: 1, mapMode: 'dungeon', masmorra: floresta }))).toBe(true);
    });

    it('aceita entrar por um totem que o save anterior já tinha, mais raso ou mais fundo que o andar dele', () => {
      const progresso = totens([20, 40]);
      expect(isValidTransition(makeSave({ floor: 47, mapMode: 'city', progresso }), makeSave({ floor: 20, masmorra: floresta, progresso }))).toBe(
        true,
      );
      expect(isValidTransition(makeSave({ floor: 1, mapMode: 'city', progresso }), makeSave({ floor: 40, masmorra: floresta, progresso }))).toBe(
        true,
      );
    });

    it('rejeita um totem que o save anterior não tinha', () => {
      const oldSave = makeSave({ floor: 1, mapMode: 'city', progresso: totens([]) });
      expect(isValidTransition(oldSave, makeSave({ floor: 20, masmorra: floresta }))).toBe(false);
    });

    it('o totem vale só pra masmorra e a dificuldade dele', () => {
      const oldSave = makeSave({ floor: 30, mapMode: 'city', progresso: totens([20]) });
      expect(isValidTransition(oldSave, makeSave({ floor: 20, masmorra: { dungeon: 'floresta', difficulty: 'dificil' } }))).toBe(false);
    });

    it('save de antes das masmorras (sem progresso): os totens já passados contam, como a engine lê', () => {
      const oldSave = makeSave({ floor: 37, mapMode: 'city' });
      expect(isValidTransition(oldSave, makeSave({ floor: 20, masmorra: floresta }))).toBe(true);
      expect(isValidTransition(oldSave, makeSave({ floor: 40, masmorra: floresta }))).toBe(false);
    });

    it('não vale fora da masmorra: cidade num andar mais raso continua recusada', () => {
      const oldSave = makeSave({ floor: 5, mapMode: 'dungeon' });
      expect(isValidTransition(oldSave, makeSave({ floor: 3, mapMode: 'city' }))).toBe(false);
    });
  });

  describe('totens novos no save', () => {
    const totens = (andares: number[]) => ({ cleared: [], totems: { 'floresta:normal': andares } });

    it('aceita o totem do andar onde o herói está', () => {
      const oldSave = makeSave({ floor: 19, progresso: totens([]) });
      expect(isValidTransition(oldSave, makeSave({ floor: 20, progresso: totens([20]) }))).toBe(true);
    });

    it('aceita o totem do andar de onde o herói acabou de descer, ou de onde voltou pra cidade', () => {
      const oldSave = makeSave({ floor: 20, progresso: totens([]) });
      expect(isValidTransition(oldSave, makeSave({ floor: 21, progresso: totens([20]) }))).toBe(true);
      expect(isValidTransition(oldSave, makeSave({ floor: 20, mapMode: 'city', progresso: totens([20]) }))).toBe(true);
    });

    it('rejeita totem forjado longe do herói (abriria o portão pro andar 80)', () => {
      const oldSave = makeSave({ floor: 5, progresso: totens([]) });
      expect(isValidTransition(oldSave, makeSave({ floor: 5, progresso: totens([20, 40, 60, 80]) }))).toBe(false);
    });

    it('save sem progresso não é conferido (a engine deduz os totens do andar)', () => {
      const oldSave = makeSave({ floor: 44, progresso: totens([20]) });
      expect(isValidTransition(oldSave, makeSave({ floor: 45 }))).toBe(true);
    });
  });

  it('aceita o inventário pequeno crescendo até o teto mínimo de 250, mesmo passando de +30', () => {
    const oldSave = makeSave({ inventory: [] });
    expect(isValidTransition(oldSave, makeSave({ inventory: new Array(250).fill('item') }))).toBe(true);
  });

  it('rejeita o inventário pequeno passando do teto mínimo de 250', () => {
    const oldSave = makeSave({ inventory: [] });
    expect(isValidTransition(oldSave, makeSave({ inventory: new Array(251).fill('item') }))).toBe(false);
  });

  it('aceita o inventário crescendo em até +30 quando o antigo já passa de 220 (teto passa a ser antigo+30)', () => {
    const oldSave = makeSave({ inventory: new Array(220).fill('item') });
    expect(isValidTransition(oldSave, makeSave({ inventory: new Array(250).fill('item') }))).toBe(true);
  });

  it('rejeita o inventário crescendo mais que +30 quando o antigo já passa de 220', () => {
    const oldSave = makeSave({ inventory: new Array(220).fill('item') });
    expect(isValidTransition(oldSave, makeSave({ inventory: new Array(251).fill('item') }))).toBe(false);
  });

  it('usa o teto de 250 mesmo se o inventário antigo já era grande', () => {
    const oldSave = makeSave({ inventory: new Array(300).fill('item') });
    expect(isValidTransition(oldSave, makeSave({ inventory: new Array(330).fill('item') }))).toBe(true);
    expect(isValidTransition(oldSave, makeSave({ inventory: new Array(331).fill('item') }))).toBe(false);
  });

  it('aceita atributo subindo até +10', () => {
    const oldSave = makeSave({}, { attrs: { forca: 5, destreza: 5, constituicao: 5, intelecto: 5, sabedoria: 5, carisma: 5 } });
    expect(
      isValidTransition(oldSave, makeSave({}, { attrs: { forca: 15, destreza: 5, constituicao: 5, intelecto: 5, sabedoria: 5, carisma: 5 } })),
    ).toBe(true);
  });

  it('rejeita atributo subindo mais que +10', () => {
    const oldSave = makeSave({}, { attrs: { forca: 5, destreza: 5, constituicao: 5, intelecto: 5, sabedoria: 5, carisma: 5 } });
    expect(
      isValidTransition(oldSave, makeSave({}, { attrs: { forca: 16, destreza: 5, constituicao: 5, intelecto: 5, sabedoria: 5, carisma: 5 } })),
    ).toBe(false);
  });

  it('rejeita atributo abaixo de 1', () => {
    const oldSave = makeSave({}, { attrs: { forca: 1, destreza: 5, constituicao: 5, intelecto: 5, sabedoria: 5, carisma: 5 } });
    expect(
      isValidTransition(oldSave, makeSave({}, { attrs: { forca: 0, destreza: 5, constituicao: 5, intelecto: 5, sabedoria: 5, carisma: 5 } })),
    ).toBe(false);
  });

  it('rejeita atributo acima de 99 mesmo sem violar o salto de +10', () => {
    const oldSave = makeSave({}, { attrs: { forca: 95, destreza: 5, constituicao: 5, intelecto: 5, sabedoria: 5, carisma: 5 } });
    expect(
      isValidTransition(oldSave, makeSave({}, { attrs: { forca: 100, destreza: 5, constituicao: 5, intelecto: 5, sabedoria: 5, carisma: 5 } })),
    ).toBe(false);
  });
});
