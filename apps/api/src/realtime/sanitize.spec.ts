import { sanitizeCosmetics, sanitizeHero, sanitizeParty, sanitizeProfile, toPublicProfile, type SanitizedHeroRecord } from './sanitize';

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

  it('devolve inventário vazio quando não é array e não há anterior', () => {
    const result = sanitizeProfile({ inventory: 'nao é array' }, null, false);
    expect(result.inventory).toEqual([]);
  });

  // O cliente omite a mochila quando ela não mudou — ela é o pedaço grande
  // do pacote (10,5 KB de 14 KB num save com 76 itens) e andar ou lutar não
  // mexem nela. Ausência tem que significar "continua a mesma": entendê-la
  // como "esvaziou" devolveria vazio no eco e apagaria a mochila do jogador.
  it('mantém a mochila já aceita quando o pacote não traz uma', () => {
    const antes = sanitizeProfile({ inventory: [{ uid: 'espada' }] }, null, false);
    const depois = sanitizeProfile({ name: 'Aria' }, antes, false);

    expect(depois.inventory).toEqual([{ uid: 'espada' }]);
  });

  // Vazia é diferente de ausente: `[]` é um array, e esvaziar a mochila é
  // uma jogada legítima — vender tudo, por exemplo.
  it('aceita esvaziar de verdade quando vem um array vazio', () => {
    const antes = sanitizeProfile({ inventory: [{ uid: 'espada' }] }, null, false);
    const depois = sanitizeProfile({ inventory: [] }, antes, false);

    expect(depois.inventory).toEqual([]);
  });
});

describe('toPublicProfile', () => {
  it('remove baseAttrs da view pública', () => {
    const profile = sanitizeProfile({ name: 'Aria' }, null, false);
    const pub = toPublicProfile(profile);
    expect(pub).toEqual({ name: 'Aria', hero: profile.hero, inventory: [], party: [], publicProfile: null });
    expect(pub).not.toHaveProperty('baseAttrs');
  });
});

describe('sanitizeCosmetics', () => {
  const cheio = {
    username: 'Aria',
    avatarUrl: 'https://exemplo.com/foto.png',
    frame: 'gold',
    nameColor: '#6ee7ff',
    pet: 'owl',
  };

  it('deixa passar o que existe no catálogo', () => {
    expect(sanitizeCosmetics(cheio)).toEqual(cheio);
  });

  it('moldura, cor e pet fora do catálogo caem no padrão', () => {
    const sujo = sanitizeCosmetics({ ...cheio, frame: 'url(javascript:alert(1))', nameColor: 'red; background:url()', pet: 'dragao_pirata' });

    expect(sujo).toEqual({ ...cheio, frame: 'none', nameColor: '#e8d7a5', pet: 'none' });
  });

  it('avatar só passa como https ou data:image conhecido', () => {
    expect(sanitizeCosmetics({ ...cheio, avatarUrl: 'javascript:alert(1)' })?.avatarUrl).toBe('');
    expect(sanitizeCosmetics({ ...cheio, avatarUrl: 'http://exemplo.com/f.png' })?.avatarUrl).toBe('');
    expect(sanitizeCosmetics({ ...cheio, avatarUrl: 'data:image/svg+xml;base64,AAAA' })?.avatarUrl).toBe('');
  });

  it('a foto enviada vira endereço em vez de trafegar em base64 a cada ação', () => {
    const virou = sanitizeCosmetics({ ...cheio, avatarUrl: 'data:image/png;base64,AAAA' })?.avatarUrl;

    expect(virou).toMatch(/^\/api\/users\/Aria\/avatar\?v=[0-9a-f]{12}$/);
    expect(virou).not.toContain('base64');
  });

  it('avatar gigante é descartado em vez de trafegar', () => {
    const enorme = `data:image/png;base64,${'A'.repeat(400_001)}`;

    expect(sanitizeCosmetics({ ...cheio, avatarUrl: enorme })?.avatarUrl).toBe('');
  });

  it('sem cosmético novo, o já aceito continua valendo', () => {
    const antes = sanitizeProfile({ name: 'Aria', publicProfile: cheio }, null, false);
    const depois = sanitizeProfile({ name: 'Aria' }, antes, false);

    expect(depois.publicProfile).toEqual(cheio);
  });
});
