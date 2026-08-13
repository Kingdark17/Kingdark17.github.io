import type { users } from '../db/schema';
import type { AccountRecord } from './users-repository';

export function toAccountRecord(row: typeof users.$inferSelect): AccountRecord {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    emailVerified: row.emailVerified,
    avatarUrl: row.avatarUrl,
    profileFrame: row.profileFrame,
    nameColor: row.nameColor,
    pet: row.pet,
    cosmetics: row.cosmetics,
    createdAt: row.createdAt,
    passwordHash: row.passwordHash,
    passwordSalt: row.passwordSalt,
  };
}
