import { GUEST_ROLE, HOST_ROLE, RoomRegistry, normalizePlayerName, normalizeRoomCode, type RoomConnection } from './room-registry';

function fakeConnection(id: string): RoomConnection & { sent: { event: string; payload: unknown }[] } {
  const sent: { event: string; payload: unknown }[] = [];
  return {
    id,
    sent,
    emit(event: string, payload: unknown) {
      sent.push({ event, payload });
    },
  };
}

function createdRegistry(options: { isPublic?: boolean; admin?: boolean } = {}) {
  const registry = new RoomRegistry();
  const host = fakeConnection('host');
  const result = registry.create('ABC123', host, {
    admin: options.admin ?? false,
    isPublic: options.isPublic ?? false,
    hostName: 'Aria',
  });
  if (result.kind !== 'created') throw new Error('esperava sala criada');
  return { registry, host, room: result.room };
}

describe('normalizeRoomCode', () => {
  it('sobe pra maiúscula e corta em 6 caracteres', () => {
    expect(normalizeRoomCode('abcdefgh')).toBe('ABCDEF');
    expect(normalizeRoomCode(null)).toBe('');
    expect(normalizeRoomCode(undefined)).toBe('');
  });
});

describe('normalizePlayerName', () => {
  it('corta em 20 caracteres e cai pro padrão quando vazio', () => {
    expect(normalizePlayerName('x'.repeat(30))).toHaveLength(20);
    expect(normalizePlayerName('')).toBe('Aventureiro');
  });
});

describe('RoomRegistry — ciclo de vida', () => {
  it('cria sala com o criador no papel 1', () => {
    const { registry, room } = createdRegistry();
    expect(room.members).toHaveLength(1);
    expect(room.members[0].role).toBe(HOST_ROLE);
    expect(registry.membershipOf('host')).toEqual({ code: 'ABC123', role: HOST_ROLE });
    expect(registry.size).toBe(1);
  });

  it('recusa criar sobre um código que já tem gente', () => {
    const { registry } = createdRegistry();
    const outro = fakeConnection('outro');
    expect(registry.create('ABC123', outro, { admin: false, isPublic: false, hostName: 'Bree' })).toEqual({
      kind: 'already-exists',
    });
  });

  it('entra como papel 2 e devolve o criador como peer', () => {
    const { registry, host } = createdRegistry();
    const guest = fakeConnection('guest');
    const result = registry.join('ABC123', guest, { admin: false });

    expect(result.kind).toBe('joined');
    if (result.kind !== 'joined') return;
    expect(result.role).toBe(GUEST_ROLE);
    expect(result.peers).toEqual([host]);
    expect(registry.membershipOf('guest')).toEqual({ code: 'ABC123', role: GUEST_ROLE });
  });

  it('recusa entrar em sala inexistente ou cheia', () => {
    const { registry } = createdRegistry();
    expect(registry.join('ZZZZZZ', fakeConnection('a'), { admin: false })).toEqual({ kind: 'not-found' });

    registry.join('ABC123', fakeConnection('guest'), { admin: false });
    expect(registry.join('ABC123', fakeConnection('terceiro'), { admin: false })).toEqual({ kind: 'full' });
  });

  it('saída do convidado avisa quem sobrou; saída do último descarta a sala', () => {
    const { registry, host } = createdRegistry();
    const guest = fakeConnection('guest');
    registry.join('ABC123', guest, { admin: false });

    expect(registry.leave('guest')).toEqual({ code: 'ABC123', role: GUEST_ROLE, remaining: [host] });
    expect(registry.size).toBe(1);

    expect(registry.leave('host')).toEqual({ code: 'ABC123', role: HOST_ROLE, remaining: [] });
    expect(registry.size).toBe(0);
    expect(registry.membershipOf('host')).toBeUndefined();
  });

  it('anfitrião que cai promove quem ficou a papel 1', () => {
    const { registry } = createdRegistry();
    const guest = fakeConnection('guest');
    registry.join('ABC123', guest, { admin: false });

    const saida = registry.leave('host');

    expect(saida?.promoted).toEqual({ connection: guest, from: GUEST_ROLE, to: HOST_ROLE });
    expect(registry.membershipOf('guest')).toEqual({ code: 'ABC123', role: HOST_ROLE });
  });

  it('a promoção leva perfil e flag de admin junto, sem deixar cópia no papel antigo', () => {
    const { registry, room } = createdRegistry();
    const guest = fakeConnection('guest');
    registry.join('ABC123', guest, { admin: true });
    registry.applyProfile(room, GUEST_ROLE, { name: 'Bree' });

    registry.leave('host');

    expect(room.profiles[HOST_ROLE]?.name).toBe('Bree');
    expect(room.profiles[GUEST_ROLE]).toBeUndefined();
    expect(registry.isAdmin(room, HOST_ROLE)).toBe(true);
    expect(registry.isAdmin(room, GUEST_ROLE)).toBe(false);
  });

  it('promovido conduz posição e andar, que era o que travava antes', () => {
    const { registry, room } = createdRegistry();
    const guest = fakeConnection('guest');
    registry.join('ABC123', guest, { admin: false });
    registry.applyState(room, HOST_ROLE, { pos: { x: 1, y: 1 }, floor: 3, mapMode: 'dungeon' });

    registry.leave('host');
    const depois = registry.applyState(room, HOST_ROLE, { pos: { x: 4, y: 2 }, floor: 5, mapMode: 'dungeon' });

    expect(depois.pos).toEqual({ x: 4, y: 2 });
    expect(depois.floor).toBe(5);
  });

  it('saída do convidado não promove ninguém', () => {
    const { registry } = createdRegistry();
    registry.join('ABC123', fakeConnection('guest'), { admin: false });

    expect(registry.leave('guest')?.promoted).toBeUndefined();
  });

  it('saída de quem nunca entrou em sala nenhuma não faz nada', () => {
    const { registry } = createdRegistry();
    expect(registry.leave('desconhecido')).toBeNull();
    expect(registry.size).toBe(1);
  });

  it('criar uma segunda sala tira a conexão da primeira', () => {
    const { registry, host } = createdRegistry();
    registry.create('XYZ789', host, { admin: false, isPublic: false, hostName: 'Aria' });

    expect(registry.size).toBe(1);
    expect(registry.get('ABC123')).toBeUndefined();
    expect(registry.membershipOf('host')).toEqual({ code: 'XYZ789', role: HOST_ROLE });
  });

  it('lista só salas públicas que ainda esperam o segundo jogador', () => {
    const registry = new RoomRegistry();
    registry.create('PUB111', fakeConnection('a'), { admin: false, isPublic: true, hostName: 'Aria' });
    registry.create('PRI222', fakeConnection('b'), { admin: false, isPublic: false, hostName: 'Bree' });
    registry.create('PUB333', fakeConnection('c'), { admin: false, isPublic: true, hostName: 'Caio' });
    registry.join('PUB333', fakeConnection('d'), { admin: false });

    expect(registry.listPublic()).toEqual([{ code: 'PUB111', hostName: 'Aria' }]);
  });
});

describe('RoomRegistry — perfis', () => {
  it('guarda o perfil saneado e devolve a visão pública sem baseAttrs', () => {
    const { registry, room } = createdRegistry();
    const publicProfile = registry.applyProfile(room, HOST_ROLE, {
      name: 'Aria',
      hero: { level: 99, gold: 99999, attrs: { forca: 99 } },
      inventory: [],
    });

    expect(publicProfile).not.toHaveProperty('baseAttrs');
    expect(publicProfile.hero.level).toBe(1);
    expect(publicProfile.hero.gold).toBe(100);
    expect(room.profiles[HOST_ROLE]?.baseAttrs).toBeGreaterThan(0);
  });

  it('perfil de conta admin passa pelo modo GOD', () => {
    const { registry, room } = createdRegistry({ admin: true });
    const publicProfile = registry.applyProfile(room, HOST_ROLE, { name: 'ADM', hero: { level: 40 } });

    expect(registry.isAdmin(room, HOST_ROLE)).toBe(true);
    expect(publicProfile.hero.maxHp).toBe(999999);
    expect(publicProfile.hero.gold).toBe(999999999);
  });

  it('publicProfiles devolve um perfil por papel presente', () => {
    const { registry, room } = createdRegistry();
    registry.join('ABC123', fakeConnection('guest'), { admin: false });
    registry.applyProfile(room, HOST_ROLE, { name: 'Aria' });
    registry.applyProfile(room, GUEST_ROLE, { name: 'Bree' });

    expect(Object.keys(registry.publicProfiles(room)).sort()).toEqual(['1', '2']);
    expect(registry.publicProfiles(room)['2'].name).toBe('Bree');
  });
});

describe('RoomRegistry — estado autoritativo', () => {
  it('clampa andar e dimensões do mapa e recorta o mapa em 12x12', () => {
    const { registry, room } = createdRegistry();
    const state = registry.applyState(room, HOST_ROLE, {
      floor: 99999,
      mapRows: 50,
      mapCols: 50,
      map: Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => ({ type: 'normal' }))),
    });

    expect(state.floor).toBe(10000);
    expect(state.mapRows).toBe(12);
    expect(state.mapCols).toBe(12);
    expect(state.map).toHaveLength(12);
    expect((state.map as unknown[][])[0]).toHaveLength(12);
    expect(room.state).toBe(state);
  });

  it('linha de mapa que não é array vira linha vazia', () => {
    const { registry, room } = createdRegistry();
    const state = registry.applyState(room, HOST_ROLE, { map: ['nao é array', [{ type: 'normal' }]] });
    expect(state.map).toEqual([[], [{ type: 'normal' }]]);
  });

  it('convidado não conduz posição/andar/mapa: recebe de volta o estado do criador', () => {
    const { registry, room } = createdRegistry();
    registry.applyState(room, HOST_ROLE, { pos: { x: 3, y: 4 }, floor: 2, mapMode: 'explore', mapRows: 5, mapCols: 6 });

    const guestState = registry.applyState(room, GUEST_ROLE, {
      pos: { x: 9, y: 9 },
      floor: 7,
      mapMode: 'hack',
      mapRows: 12,
      mapCols: 12,
    });

    expect(guestState.pos).toEqual({ x: 3, y: 4 });
    expect(guestState.floor).toBe(2);
    expect(guestState.mapMode).toBe('explore');
    expect(guestState.mapRows).toBe(5);
    expect(guestState.mapCols).toBe(6);
  });

  it('convidado que fala antes de existir estado autoritativo mantém o que mandou', () => {
    const { registry, room } = createdRegistry();
    const state = registry.applyState(room, GUEST_ROLE, { pos: { x: 1, y: 1 }, floor: 3 });

    expect(state.pos).toEqual({ x: 1, y: 1 });
    expect(state.floor).toBe(3);
  });

  it('não estoura quando o estado autoritativo ainda não tem posição', () => {
    const { registry, room } = createdRegistry();
    registry.applyState(room, HOST_ROLE, { floor: 1 });

    expect(() => registry.applyState(room, GUEST_ROLE, { pos: { x: 5, y: 5 } })).not.toThrow();
    expect(registry.applyState(room, GUEST_ROLE, { pos: { x: 5, y: 5 } }).pos).toBeUndefined();
  });

  it('sanea o perfil embutido no estado e republica os perfis da sala', () => {
    const { registry, room } = createdRegistry();
    const state = registry.applyState(room, HOST_ROLE, {
      profiles: { 1: { name: 'Aria', hero: { level: 99, gold: 99999 } } },
      floor: 1,
    });

    const profiles = state.profiles as Record<string, { name: string; hero: Record<string, unknown> }>;
    expect(profiles['1'].name).toBe('Aria');
    expect(profiles['1'].hero.level).toBe(1);
    expect(profiles['1']).not.toHaveProperty('baseAttrs');
    expect(room.profiles[HOST_ROLE]?.name).toBe('Aria');
  });

  it('ignora perfil de outro papel embutido no estado', () => {
    const { registry, room } = createdRegistry();
    registry.applyState(room, HOST_ROLE, { profiles: { 2: { name: 'Impostor' } } });

    expect(room.profiles[GUEST_ROLE]).toBeUndefined();
  });
});
