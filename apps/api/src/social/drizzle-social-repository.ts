/**
 * Implementação de `SocialRepository` sobre `users`/`friend_requests`/
 * `friendships`/`chat_messages` (`db/schema.ts`). Mesma regra dos outros
 * repositórios Drizzle: `getDb()` só roda dentro dos métodos, nunca no
 * construtor.
 */

import { and, desc, eq, lt, notInArray, or, sql } from 'drizzle-orm';

import { isUniqueViolation } from '../db/is-unique-violation';
import { getDb } from '../db/client';
import { chatMessages, friendRequests, friendships, users } from '../db/schema';
import type { InternalFriendRow, RecentMessage, RelationRows, SocialRepository, StoredMessage, UserLookup } from './social-repository';

const CHAT_HISTORY_LIMIT = 200;

function pairFilter(fromId: number, toId: number) {
  return or(
    and(eq(chatMessages.senderId, fromId), eq(chatMessages.recipientId, toId)),
    and(eq(chatMessages.senderId, toId), eq(chatMessages.recipientId, fromId)),
  );
}

export class DrizzleSocialRepository implements SocialRepository {
  async findUserByUsername(username: string): Promise<UserLookup | null> {
    const rows = await getDb()
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username.trim()})`)
      .limit(1);
    return rows[0] ?? null;
  }

  async findAvatarByUsername(username: string): Promise<string | null> {
    const rows = await getDb()
      .select({ avatarUrl: users.avatarUrl })
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username.trim()})`)
      .limit(1);
    return rows[0]?.avatarUrl ?? null;
  }

  async areFriends(userId: number, otherId: number): Promise<boolean> {
    const rows = await getDb()
      .select({ userId: friendships.userId })
      .from(friendships)
      .where(and(eq(friendships.userId, userId), eq(friendships.friendId, otherId)))
      .limit(1);
    return rows.length > 0;
  }

  async hasPendingRequest(fromId: number, toId: number): Promise<boolean> {
    const rows = await getDb()
      .select({ id: friendRequests.id })
      .from(friendRequests)
      .where(and(eq(friendRequests.fromId, fromId), eq(friendRequests.toId, toId)))
      .limit(1);
    return rows.length > 0;
  }

  async createFriendRequest(fromId: number, toId: number): Promise<'created' | 'duplicate'> {
    try {
      await getDb().insert(friendRequests).values({ fromId, toId });
      return 'created';
    } catch (err) {
      if (isUniqueViolation(err)) return 'duplicate';
      throw err;
    }
  }

  async acceptFriendRequest(fromId: number, toId: number): Promise<void> {
    await getDb().transaction(async (tx) => {
      await tx.delete(friendRequests).where(and(eq(friendRequests.fromId, fromId), eq(friendRequests.toId, toId)));
      await tx
        .insert(friendships)
        .values([
          { userId: fromId, friendId: toId },
          { userId: toId, friendId: fromId },
        ])
        .onConflictDoNothing();
    });
  }

  async deleteFriendRequestBetween(userId: number, otherId: number): Promise<void> {
    await getDb()
      .delete(friendRequests)
      .where(
        or(
          and(eq(friendRequests.fromId, userId), eq(friendRequests.toId, otherId)),
          and(eq(friendRequests.fromId, otherId), eq(friendRequests.toId, userId)),
        ),
      );
  }

  async deleteFriendship(userId: number, otherId: number): Promise<void> {
    await getDb()
      .delete(friendships)
      .where(
        or(
          and(eq(friendships.userId, userId), eq(friendships.friendId, otherId)),
          and(eq(friendships.userId, otherId), eq(friendships.friendId, userId)),
        ),
      );
  }

  async listRelations(userId: number): Promise<RelationRows> {
    const db = getDb();
    const columns = {
      id: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
      frame: users.profileFrame,
      nameColor: users.nameColor,
      pet: users.pet,
    };

    const friendRows = await db
      .select(columns)
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.friendId))
      .where(eq(friendships.userId, userId))
      .orderBy(users.username);

    const incomingRows = await db
      .select(columns)
      .from(friendRequests)
      .innerJoin(users, eq(users.id, friendRequests.fromId))
      .where(eq(friendRequests.toId, userId))
      .orderBy(friendRequests.createdAt);

    const outgoingRows = await db
      .select(columns)
      .from(friendRequests)
      .innerJoin(users, eq(users.id, friendRequests.toId))
      .where(eq(friendRequests.fromId, userId))
      .orderBy(friendRequests.createdAt);

    const toRow = (row: (typeof friendRows)[number]): InternalFriendRow => row;
    return { friends: friendRows.map(toRow), incoming: incomingRows.map(toRow), outgoing: outgoingRows.map(toRow) };
  }

  async recordMessage(fromId: number, toId: number, text: string): Promise<StoredMessage> {
    return getDb().transaction(async (tx) => {
      const [inserted] = await tx
        .insert(chatMessages)
        .values({ senderId: fromId, recipientId: toId, body: text })
        .returning({ id: chatMessages.id, createdAt: chatMessages.createdAt });

      const keepRows = await tx
        .select({ id: chatMessages.id })
        .from(chatMessages)
        .where(pairFilter(fromId, toId))
        .orderBy(desc(chatMessages.id))
        .limit(CHAT_HISTORY_LIMIT);
      const keepIds = keepRows.map((row) => row.id);
      if (keepIds.length > 0) {
        await tx.delete(chatMessages).where(and(pairFilter(fromId, toId), notInArray(chatMessages.id, keepIds)));
      }

      return { id: String(inserted.id), body: text, createdAt: inserted.createdAt };
    });
  }

  async recentMessages(userId: number, otherId: number, beforeId: string | undefined, limit: number): Promise<RecentMessage[]> {
    const whereClause = beforeId ? and(pairFilter(userId, otherId), lt(chatMessages.id, Number(beforeId))) : pairFilter(userId, otherId);

    const rows = await getDb()
      .select({ id: chatMessages.id, senderId: chatMessages.senderId, body: chatMessages.body, createdAt: chatMessages.createdAt })
      .from(chatMessages)
      .where(whereClause)
      .orderBy(desc(chatMessages.id))
      .limit(limit);

    return rows.reverse().map((row) => ({ id: String(row.id), fromMe: row.senderId === userId, body: row.body, createdAt: row.createdAt }));
  }
}
