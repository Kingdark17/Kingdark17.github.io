import { sanitizeHero, sanitizeParty, sanitizeProfile, toPublicProfile, type SanitizedHeroRecord } from './sanitize';

describe('sanitizeHero', () => {
  it('primeira submissão (sem estado anterior): força nível 1, ouro até 100, killCount zerado', () => {
    const candidate = {
      attrs: { forca: 10, destreza: 10, constituicao: 10, intelecto: 10, sabedoria: 10, carisma: 10 },
      level: 5,
      gold: 50,
      hp: 999,
      mp: 999,
      xp: 999,
      attrPoints: 999,
      killCount: 999,
      equip: {},
    };
    const result = sanitizeHero(candidate, null, false);
    expect(result.hero.level).toBe(1);
    expect(result.hero.maxHp).toBe(125);
    expect(result.hero.maxMp).toBe(62);
    expect(result.hero.hp).toBe(125);
    expect(result.hero.mp).toBe(62);
    expect(result.hero.xpNext).toBe(40);
    expect(result.hero.xp).toBe(39);
    expect(result.hero.attrPoints).toBe(0);
    expect(result.hero.gold).toBe(50);
    expect(result.hero.killCount).toBe(0);
    expect(result.baseAttrs).toBe(60);
  });

  it('submissão subsequente: nível/ouro/killCount ficam presos ao teto de crescimento, atributos redistribuídos quando excedem o total permitido', () => {
    const previousRecord: SanitizedHeroRecord = {
      hero: { level: 1, gold: 50, killCount: 0 },
      baseAttrs: 60,
    };
    const candidate = {
      attrs: { forca: 50, destreza: 10, constituicao: 10, intelecto: 10, sabedoria: 10, carisma: 10 },
      level: 10,
      gold: 99999,
      hp: 5000,
      mp: 5000,
      xp: 9999,
      attrPoints: 9999,
      killCount: 9999,
      equip: {},
    };
    const result = sanitizeHero(candidate, previousRecord, false);
    expect(result.hero.level).toBe(6); // 1 + 5, o máximo permitido por submissão
    expect(result.hero.attrs).toEqual({ forca: 50, destreza: 10, constituicao: 7, intelecto: 1, sabedoria: 1, carisma: 1 });
    expect(result.hero.maxHp).toBe(120);
    expect(result.hero.maxMp).toBe(27);
    expect(result.hero.hp).toBe(120);
    expect(result.hero.mp).toBe(27);
    expect(result.hero.gold).toBe(5050); // 50 + 5000 de teto
    expect(result.hero.killCount).toBe(20); // 0 + 20 de teto
    expect(result.baseAttrs).toBe(60);
  });

  it('soma vida/mana de equipamento, capado por equipmentCap(nível)', () => {
    const candidate = {
      attrs: { forca: 1, destreza: 1, constituicao: 1, intelecto: 1, sabedoria: 1, carisma: 1 },
      level: 1,
      equip: { arma: { stats: { vida: 40 } }, armadura: { stats: { vida: 30, mana: 20 } } },
    };
    const result = sanitizeHero(candidate, null, false);
    expect(result.hero.maxHp).toBe(20 + 1 * 5 + 1 * 10 + 70);
    expect(result.hero.maxMp).toBe(10 + 1 * 2 + 1 * 5 + 20);
  });

  it('modo admin: atributos/vida/mana/ouro no teto, ignora o que o candidato mandou', () => {
    const result = sanitizeHero({ level: 3, gold: 1, hp: 1, mp: 1 }, null, true);
    expect(result.hero.attrs).toEqual({ forca: 999, destreza: 999, constituicao: 999, intelecto: 999, sabedoria: 999, carisma: 999 });
    expect(result.hero.maxHp).toBe(999999);
    expect(result.hero.maxMp).toBe(999999);
    expect(result.hero.hp).toBe(999999);
    expect(result.hero.mp).toBe(999999);
    expect(result.hero.gold).toBe(999999999);
    expect(result.hero.level).toBe(3);
    expect(result.baseAttrs).toBe(6 * 999);
  });
});

describe('sanitizeParty', () => {
  it('limita a 2 membros e clampa hp/maxHp/attack', () => {
    const party = [
      { maxHp: 5000, hp: 5000, attack: 999 },
      { maxHp: 5000, hp: 5000, attack: 999 },
      { maxHp: 5000, hp: 5000, attack: 999 },
    ];
    const result = sanitizeParty(party);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ maxHp: 1000, hp: 1000, attack: 250 });
  });

  it('hp nunca passa de maxHp mesmo se maxHp foi clampado', () => {
    const result = sanitizeParty([{ maxHp: 5000, hp: 5000, attack: 1 }]);
    expect(result[0].hp).toBeLessThanOrEqual(result[0].maxHp as number);
  });

  it('combatsLeft só é clampado pra companheiros temporários', () => {
    const result = sanitizeParty([
      { temporary: true, combatsLeft: 999, maxHp: 10, hp: 10, attack: 1 },
      { temporary: false, combatsLeft: 999, maxHp: 10, hp: 10, attack: 1 },
    ]);
    expect(result[0].combatsLeft).toBe(10);
    expect(result[1].combatsLeft).toBe(999);
  });

  it('devolve array vazio pra entrada que não é array', () => {
    expect(sanitizeParty(null)).toEqual([]);
    expect(sanitizeParty('nao é array')).toEqual([]);
  });
});

describe('sanitizeProfile', () => {
  it('trunca o nome em 20 caracteres e usa "Aventureiro" como padrão', () => {
    const result = sanitizeProfile({ name: 'x'.repeat(30) }, null, false);
    expect(result.name).toHaveLength(20);

    const fallback = sanitizeProfile({}, null, false);
    expect(fallback.name).toBe('Aventureiro');
  });

  it('limita o inventário a 120 itens', () => {
    const result = sanitizeProfile({ inventory: new Array(200).fill('item') }, null, false);
    expect(result.inventory).toHaveLength(120);
  });

  it('devolve inventário vazio quando não é array', () => {
    const result = sanitizeProfile({ inventory: 'nao é array' }, null, false);
    expect(result.inventory).toEqual([]);
  });
});

describe('toPublicProfile', () => {
  it('remove baseAttrs da view pública', () => {
    const profile = sanitizeProfile({ name: 'Aria' }, null, false);
    const pub = toPublicProfile(profile);
    expect(pub).toEqual({ name: 'Aria', hero: profile.hero, inventory: [], party: [] });
    expect(pub).not.toHaveProperty('baseAttrs');
  });
});
