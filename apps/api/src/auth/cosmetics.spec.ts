import { cosmeticsFor, defaultCosmetics, isAdmin, PROFILE_CATALOG, safeUser, type UserRow } from './cosmetics';

const ADMIN_USERNAME = 'adm';

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 1,
    username: 'Heroi',
    email: 'heroi@example.com',
    emailVerified: true,
    avatarUrl: '',
    profileFrame: 'none',
    nameColor: '#e8d7a5',
    pet: 'none',
    cosmetics: defaultCosmetics(),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('PROFILE_CATALOG', () => {
  it('tem 28 itens', () => {
    expect(PROFILE_CATALOG).toHaveLength(28);
  });

  it('tem ids únicos', () => {
    const ids = PROFILE_CATALOG.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tem exatamente 3 itens exclusivos de admin, todos de preço 0', () => {
    const adminItems = PROFILE_CATALOG.filter((item) => item.adminOnly);
    expect(adminItems).toHaveLength(3);
    expect(adminItems.every((item) => item.price === 0)).toBe(true);
  });
});

describe('isAdmin', () => {
  it('reconhece o username configurado, ignorando maiúsculas/espaços', () => {
    expect(isAdmin({ username: '  ADM  ' }, ADMIN_USERNAME)).toBe(true);
    expect(isAdmin({ username: 'adm' }, ADMIN_USERNAME)).toBe(true);
  });

  it('rejeita qualquer outro username', () => {
    expect(isAdmin({ username: 'Heroi' }, ADMIN_USERNAME)).toBe(false);
  });

  it('rejeita quando não há usuário', () => {
    expect(isAdmin(null, ADMIN_USERNAME)).toBe(false);
    expect(isAdmin(undefined, ADMIN_USERNAME)).toBe(false);
  });
});

describe('cosmeticsFor', () => {
  it('devolve o padrão quando o usuário não tem cosméticos salvos', () => {
    const user = makeUser({ cosmetics: null });
    expect(cosmeticsFor(user, ADMIN_USERNAME)).toEqual(defaultCosmetics());
  });

  it('devolve uma cópia dos cosméticos do usuário, sem extras pra não-admin', () => {
    const user = makeUser({ cosmetics: { frames: ['none', 'gold'], colors: ['#e8d7a5'], pets: ['none'] } });
    expect(cosmeticsFor(user, ADMIN_USERNAME)).toEqual({ frames: ['none', 'gold'], colors: ['#e8d7a5'], pets: ['none'] });
  });

  it('desbloqueia rgb/rainbow/admin_dragon pro admin, sem duplicar', () => {
    const admin = makeUser({ username: 'ADM', cosmetics: defaultCosmetics() });
    const owned = cosmeticsFor(admin, ADMIN_USERNAME);
    expect(owned.frames).toEqual(['none', 'rgb']);
    expect(owned.colors).toEqual(['#e8d7a5', '#ffffff', 'rainbow']);
    expect(owned.pets).toEqual(['none', 'admin_dragon']);

    const alreadyOwned = cosmeticsFor(makeUser({ username: 'ADM', cosmetics: { frames: ['rgb'], colors: ['rainbow'], pets: ['admin_dragon'] } }), ADMIN_USERNAME);
    expect(alreadyOwned).toEqual({ frames: ['rgb'], colors: ['rainbow'], pets: ['admin_dragon'] });
  });
});

describe('safeUser', () => {
  it('expõe só os campos públicos, com os cosméticos resolvidos', () => {
    const user = makeUser();
    expect(safeUser(user, ADMIN_USERNAME)).toEqual({
      id: 1,
      username: 'Heroi',
      isAdmin: false,
      email: 'heroi@example.com',
      emailVerified: true,
      avatarUrl: '',
      frame: 'none',
      nameColor: '#e8d7a5',
      pet: 'none',
      cosmetics: defaultCosmetics(),
      createdAt: user.createdAt,
    });
  });

  it('marca isAdmin corretamente', () => {
    const admin = makeUser({ username: 'ADM' });
    expect(safeUser(admin, ADMIN_USERNAME).isAdmin).toBe(true);
  });

  it('usa null pro e-mail ausente', () => {
    const user = makeUser({ email: null });
    expect(safeUser(user, ADMIN_USERNAME).email).toBeNull();
  });
});
