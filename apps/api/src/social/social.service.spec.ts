import { resumoDoAvatar } from './avatar';
import type { PresenceChecker } from './presence-checker';
import type { SocialEventType, SocialNotifier } from './social-notifier';
import type { InternalFriendRow, RecentMessage, RelationRows, SocialRepository, StoredMessage, UserLookup } from './social-repository';
import { SocialService } from './social.service';

interface FakeUser {
  id: number;
  username: string;
  avatarUrl: string;
  frame: string;
  nameColor: string;
  pet: string;
}

class FakeSocialRepository implements SocialRepository {
  users = new Map<number, FakeUser>();
  private friendships = new Set<string>();
  private requests = new Set<string>();
  private messages: { id: number; senderId: number; recipientId: number; body: string; createdAt: Date }[] = [];
  private nextMessageId = 1;

  addUser(user: FakeUser): void {
    this.users.set(user.id, user);
  }

  private pairKey(a: number, b: number): string {
    return `${a}:${b}`;
  }

  private acharPorNome(username: string): FakeUser | null {
    const needle = username.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.username.toLowerCase() === needle) return user;
    }
    return null;
  }

  findUserByUsername(username: string): Promise<UserLookup | null> {
    const user = this.acharPorNome(username);
    return Promise.resolve(user ? { id: user.id, username: user.username } : null);
  }

  findAvatarByUsername(username: string): Promise<string | null> {
    return Promise.resolve(this.acharPorNome(username)?.avatarUrl ?? null);
  }

  areFriends(userId: number, otherId: number): Promise<boolean> {
    return Promise.resolve(this.friendships.has(this.pairKey(userId, otherId)));
  }

  hasPendingRequest(fromId: number, toId: number): Promise<boolean> {
    return Promise.resolve(this.requests.has(this.pairKey(fromId, toId)));
  }

  createFriendRequest(fromId: number, toId: number): Promise<'created' | 'duplicate'> {
    const key = this.pairKey(fromId, toId);
    if (this.requests.has(key)) return Promise.resolve('duplicate');
    this.requests.add(key);
    return Promise.resolve('created');
  }

  acceptFriendRequest(fromId: number, toId: number): Promise<void> {
    this.requests.delete(this.pairKey(fromId, toId));
    this.friendships.add(this.pairKey(fromId, toId));
    this.friendships.add(this.pairKey(toId, fromId));
    return Promise.resolve();
  }

  deleteFriendRequestBetween(userId: number, otherId: number): Promise<void> {
    this.requests.delete(this.pairKey(userId, otherId));
    this.requests.delete(this.pairKey(otherId, userId));
    return Promise.resolve();
  }

  deleteFriendship(userId: number, otherId: number): Promise<void> {
    this.friendships.delete(this.pairKey(userId, otherId));
    this.friendships.delete(this.pairKey(otherId, userId));
    return Promise.resolve();
  }

  listRelations(userId: number): Promise<RelationRows> {
    const toRow = (id: number): InternalFriendRow => {
      const user = this.users.get(id);
      if (!user) throw new Error('usuário inexistente no fake');
      // O repositório de verdade calcula isto em SQL; aqui, o mesmo
      // contrato pela função pura. Ver `avatar.ts`.
      return {
        id: user.id,
        username: user.username,
        avatar: resumoDoAvatar(user.avatarUrl),
        frame: user.frame,
        nameColor: user.nameColor,
        pet: user.pet,
      };
    };
    const friends: InternalFriendRow[] = [];
    for (const key of this.friendships) {
      const [a, b] = key.split(':').map(Number);
      if (a === userId) friends.push(toRow(b));
    }
    const incoming: InternalFriendRow[] = [];
    const outgoing: InternalFriendRow[] = [];
    for (const key of this.requests) {
      const [from, to] = key.split(':').map(Number);
      if (to === userId) incoming.push(toRow(from));
      if (from === userId) outgoing.push(toRow(to));
    }
    return Promise.resolve({ friends, incoming, outgoing });
  }

  recordMessage(fromId: number, toId: number, text: string): Promise<StoredMessage> {
    const message = { id: this.nextMessageId++, senderId: fromId, recipientId: toId, body: text, createdAt: new Date() };
    this.messages.push(message);
    return Promise.resolve({ id: String(message.id), body: message.body, createdAt: message.createdAt });
  }

  recentMessages(userId: number, otherId: number, beforeId: string | undefined, limit: number): Promise<RecentMessage[]> {
    let pairMessages = this.messages.filter(
      (message) =>
        (message.senderId === userId && message.recipientId === otherId) || (message.senderId === otherId && message.recipientId === userId),
    );
    if (beforeId) pairMessages = pairMessages.filter((message) => message.id < Number(beforeId));
    pairMessages = [...pairMessages]
      .sort((a, b) => b.id - a.id)
      .slice(0, limit)
      .reverse();
    return Promise.resolve(
      pairMessages.map((message) => ({
        id: String(message.id),
        fromMe: message.senderId === userId,
        body: message.body,
        createdAt: message.createdAt,
      })),
    );
  }
}

class SpySocialNotifier implements SocialNotifier {
  events: { type: SocialEventType; targetUserId: number; payload: unknown }[] = [];
  notify(type: SocialEventType, targetUserId: number, payload: unknown): void {
    this.events.push({ type, targetUserId, payload });
  }
}

class FakePresenceChecker implements PresenceChecker {
  online = new Set<number>();
  /** Quantas vezes foi consultado — a lista tem que perguntar uma vez só. */
  consultas = 0;

  onlineAmong(userIds: number[]): Promise<Set<number>> {
    this.consultas += 1;
    return Promise.resolve(new Set(userIds.filter((id) => this.online.has(id))));
  }
}

const USER = { id: 1, username: 'Aria' };
const OTHER = { id: 2, username: 'Bram' };

/** PNGs de 1×1 — só precisam ser `data:` válidos e diferentes entre si. */
const FOTO_ENVIADA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const OUTRA_FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function makeUser(id: number, username: string): FakeUser {
  return { id, username, avatarUrl: '', frame: 'none', nameColor: '#e8d7a5', pet: 'none' };
}

function makeService() {
  const repo = new FakeSocialRepository();
  const notifier = new SpySocialNotifier();
  const presence = new FakePresenceChecker();
  repo.addUser(makeUser(USER.id, USER.username));
  repo.addUser(makeUser(OTHER.id, OTHER.username));
  const service = new SocialService(repo, notifier, presence);
  return { service, repo, notifier, presence };
}

describe('SocialService.sendFriendRequest', () => {
  it('rejeita alvo inexistente', async () => {
    const { service } = makeService();
    expect(await service.sendFriendRequest(USER, 'ninguem')).toEqual({ kind: 'target-not-found' });
  });

  it('rejeita adicionar a si mesmo', async () => {
    const { service } = makeService();
    expect(await service.sendFriendRequest(USER, USER.username)).toEqual({ kind: 'cannot-add-self' });
  });

  it('rejeita quando já são amigos', async () => {
    const { service, repo } = makeService();
    await repo.acceptFriendRequest(USER.id, OTHER.id);
    expect(await service.sendFriendRequest(USER, OTHER.username)).toEqual({ kind: 'already-friends' });
  });

  it('aceita automaticamente quando já existe um pedido no sentido contrário, e notifica friend-accept', async () => {
    const { service, repo, notifier } = makeService();
    await repo.createFriendRequest(OTHER.id, USER.id);
    const result = await service.sendFriendRequest(USER, OTHER.username);
    expect(result).toEqual({ kind: 'accepted' });
    expect(await repo.areFriends(USER.id, OTHER.id)).toBe(true);
    expect(notifier.events).toEqual([{ type: 'friend-accept', targetUserId: OTHER.id, payload: { username: USER.username } }]);
  });

  it('rejeita pedido duplicado', async () => {
    const { service, repo } = makeService();
    await repo.createFriendRequest(USER.id, OTHER.id);
    expect(await service.sendFriendRequest(USER, OTHER.username)).toEqual({ kind: 'already-requested' });
  });

  it('envia o pedido e notifica friend-request', async () => {
    const { service, notifier } = makeService();
    const result = await service.sendFriendRequest(USER, OTHER.username);
    expect(result).toEqual({ kind: 'sent' });
    expect(notifier.events).toEqual([{ type: 'friend-request', targetUserId: OTHER.id, payload: { username: USER.username } }]);
  });
});

describe('SocialService.acceptFriendRequest', () => {
  it('rejeita alvo inexistente', async () => {
    const { service } = makeService();
    expect(await service.acceptFriendRequest(USER, 'ninguem')).toEqual({ kind: 'target-not-found' });
  });

  it('rejeita quando não há pedido pendente', async () => {
    const { service } = makeService();
    expect(await service.acceptFriendRequest(USER, OTHER.username)).toEqual({ kind: 'no-pending-request' });
  });

  it('aceita e notifica friend-accept', async () => {
    const { service, repo, notifier } = makeService();
    await repo.createFriendRequest(OTHER.id, USER.id);
    expect(await service.acceptFriendRequest(USER, OTHER.username)).toEqual({ kind: 'ok' });
    expect(await repo.areFriends(USER.id, OTHER.id)).toBe(true);
    expect(notifier.events).toEqual([{ type: 'friend-accept', targetUserId: OTHER.id, payload: { username: USER.username } }]);
  });
});

describe('SocialService.declineFriendRequest / removeFriend', () => {
  it('declineFriendRequest rejeita alvo inexistente e remove o pedido pendente quando existe', async () => {
    const { service, repo } = makeService();
    expect(await service.declineFriendRequest(USER.id, 'ninguem')).toEqual({ kind: 'target-not-found' });

    await repo.createFriendRequest(OTHER.id, USER.id);
    expect(await service.declineFriendRequest(USER.id, OTHER.username)).toEqual({ kind: 'ok' });
    expect(await repo.hasPendingRequest(OTHER.id, USER.id)).toBe(false);
  });

  it('removeFriend rejeita alvo inexistente e desfaz a amizade quando existe', async () => {
    const { service, repo } = makeService();
    expect(await service.removeFriend(USER.id, 'ninguem')).toEqual({ kind: 'target-not-found' });

    await repo.acceptFriendRequest(USER.id, OTHER.id);
    expect(await service.removeFriend(USER.id, OTHER.username)).toEqual({ kind: 'ok' });
    expect(await repo.areFriends(USER.id, OTHER.id)).toBe(false);
  });
});

describe('SocialService.listRelations', () => {
  it('resolve amigos/pedidos com presença online', async () => {
    const { service, repo, presence } = makeService();
    await repo.acceptFriendRequest(USER.id, OTHER.id);
    presence.online.add(OTHER.id);

    const relations = await service.listRelations(USER.id);
    expect(relations.friends).toEqual([{ username: 'Bram', avatarUrl: '', frame: 'none', nameColor: '#e8d7a5', pet: 'none', online: true }]);
    expect(relations.incoming).toEqual([]);
    expect(relations.outgoing).toEqual([]);
  });

  it('pergunta a presença uma vez só, pra lista inteira', async () => {
    const { service, repo, presence } = makeService();
    await repo.acceptFriendRequest(USER.id, OTHER.id);
    await repo.createFriendRequest(3, USER.id);
    repo.addUser(makeUser(3, 'Cadu'));

    await service.listRelations(USER.id);

    // Com Redis, uma pergunta por amigo seria uma ida e volta por amigo.
    expect(presence.consultas).toBe(1);
  });

  it('troca a foto enviada por um endereço, e deixa link externo passar', async () => {
    const { service, repo } = makeService();
    await repo.acceptFriendRequest(USER.id, OTHER.id);
    repo.addUser({ ...makeUser(OTHER.id, OTHER.username), avatarUrl: FOTO_ENVIADA });

    const [amigo] = (await service.listRelations(USER.id)).friends;
    expect(amigo.avatarUrl).toMatch(/^\/api\/users\/Bram\/avatar\?v=[0-9a-f]{12}$/);
    expect(amigo.avatarUrl).not.toContain('base64');

    repo.addUser({ ...makeUser(OTHER.id, OTHER.username), avatarUrl: 'https://exemplo.com/foto.png' });
    expect((await service.listRelations(USER.id)).friends[0].avatarUrl).toBe('https://exemplo.com/foto.png');
  });

  it('o endereço muda quando a foto muda — é o que permite o cache longo', async () => {
    const { service, repo } = makeService();
    await repo.acceptFriendRequest(USER.id, OTHER.id);

    repo.addUser({ ...makeUser(OTHER.id, OTHER.username), avatarUrl: FOTO_ENVIADA });
    const antes = (await service.listRelations(USER.id)).friends[0].avatarUrl;

    repo.addUser({ ...makeUser(OTHER.id, OTHER.username), avatarUrl: OUTRA_FOTO });
    expect((await service.listRelations(USER.id)).friends[0].avatarUrl).not.toBe(antes);
  });
});

describe('SocialService.findAvatar', () => {
  it('devolve os bytes e o tipo da foto enviada', async () => {
    const { service, repo } = makeService();
    repo.addUser({ ...makeUser(OTHER.id, OTHER.username), avatarUrl: FOTO_ENVIADA });

    const foto = await service.findAvatar(OTHER.username);
    expect(foto?.mime).toBe('image/png');
    expect(foto?.bytes.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it('devolve null pra quem não existe, pra quem não tem foto e pra link externo', async () => {
    const { service, repo } = makeService();
    expect(await service.findAvatar('ninguem')).toBeNull();
    expect(await service.findAvatar(OTHER.username)).toBeNull();

    repo.addUser({ ...makeUser(OTHER.id, OTHER.username), avatarUrl: 'https://exemplo.com/foto.png' });
    expect(await service.findAvatar(OTHER.username)).toBeNull();
  });

  it('acha o jogador sem diferenciar maiúscula', async () => {
    const { service, repo } = makeService();
    repo.addUser({ ...makeUser(OTHER.id, OTHER.username), avatarUrl: FOTO_ENVIADA });
    expect(await service.findAvatar('bram')).not.toBeNull();
  });
});

describe('SocialService.sendChatMessage', () => {
  it('rejeita alvo inexistente', async () => {
    const { service } = makeService();
    expect(await service.sendChatMessage(USER, 'ninguem', 'oi')).toEqual({ kind: 'target-not-found' });
  });

  it('rejeita quando não são amigos', async () => {
    const { service } = makeService();
    expect(await service.sendChatMessage(USER, OTHER.username, 'oi')).toEqual({ kind: 'not-friends' });
  });

  it('rejeita mensagem vazia depois do trim', async () => {
    const { service, repo } = makeService();
    await repo.acceptFriendRequest(USER.id, OTHER.id);
    expect(await service.sendChatMessage(USER, OTHER.username, '   ')).toEqual({ kind: 'empty-message' });
  });

  it('envia e notifica chat', async () => {
    const { service, repo, notifier } = makeService();
    await repo.acceptFriendRequest(USER.id, OTHER.id);
    const result = await service.sendChatMessage(USER, OTHER.username, '  Oi Bram!  ');
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.message.body).toBe('Oi Bram!');
    expect(notifier.events).toEqual([
      {
        type: 'chat',
        targetUserId: OTHER.id,
        payload: { from: USER.username, id: result.message.id, body: 'Oi Bram!', createdAt: result.message.createdAt },
      },
    ]);
  });
});

describe('SocialService.recentMessages', () => {
  it('rejeita alvo inexistente', async () => {
    const { service } = makeService();
    expect(await service.recentMessages(USER.id, 'ninguem', undefined, undefined)).toEqual({ kind: 'target-not-found' });
  });

  it('rejeita quando não são amigos', async () => {
    const { service } = makeService();
    expect(await service.recentMessages(USER.id, OTHER.username, undefined, undefined)).toEqual({ kind: 'not-friends' });
  });

  it('devolve mensagens em ordem cronológica com fromMe correto', async () => {
    const { service, repo } = makeService();
    await repo.acceptFriendRequest(USER.id, OTHER.id);
    await service.sendChatMessage(USER, OTHER.username, 'primeira');
    await service.sendChatMessage({ id: OTHER.id, username: OTHER.username }, USER.username, 'segunda');

    const result = await service.recentMessages(USER.id, OTHER.username, undefined, undefined);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.messages.map((m) => ({ body: m.body, fromMe: m.fromMe }))).toEqual([
      { body: 'primeira', fromMe: true },
      { body: 'segunda', fromMe: false },
    ]);
  });

  it('aplica o teto de 80 mesmo se um limite maior for pedido', async () => {
    const { service, repo } = makeService();
    await repo.acceptFriendRequest(USER.id, OTHER.id);
    for (let i = 0; i < 90; i += 1) {
      await repo.recordMessage(USER.id, OTHER.id, `msg-${i}`);
    }
    const result = await service.recentMessages(USER.id, OTHER.username, undefined, 500);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.messages).toHaveLength(80);
  });
});
