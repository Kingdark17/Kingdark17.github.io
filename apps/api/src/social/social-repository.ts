/**
 * Porta de acesso a amigos/pedidos/mensagens que `SocialService` depende
 * — implementada por cima do Drizzle depois. Interface primeiro pra
 * manter o service testável com um fake em memória, sem banco.
 */

export interface UserLookup {
  id: number;
  username: string;
}

/** Linha "crua" de amigo/pedido — inclui `id` pra `SocialService` resolver presença; a view pública final não expõe `id`. */
export interface InternalFriendRow {
  id: number;
  username: string;
  avatarUrl: string;
  frame: string;
  nameColor: string;
  pet: string;
}

export interface RelationRows {
  friends: InternalFriendRow[];
  incoming: InternalFriendRow[];
  outgoing: InternalFriendRow[];
}

export interface StoredMessage {
  id: string;
  body: string;
  createdAt: Date;
}

export interface RecentMessage {
  id: string;
  fromMe: boolean;
  body: string;
  createdAt: Date;
}

export interface SocialRepository {
  findUserByUsername(username: string): Promise<UserLookup | null>;
  areFriends(userId: number, otherId: number): Promise<boolean>;
  hasPendingRequest(fromId: number, toId: number): Promise<boolean>;
  /** Devolve 'duplicate' em vez de lançar quando já existe o mesmo par (from,to) — equivalente ao 23505 do original. */
  createFriendRequest(fromId: number, toId: number): Promise<'created' | 'duplicate'>;
  /** Transação: apaga o pedido pendente e insere a amizade nos dois sentidos. */
  acceptFriendRequest(fromId: number, toId: number): Promise<void>;
  deleteFriendRequestBetween(userId: number, otherId: number): Promise<void>;
  deleteFriendship(userId: number, otherId: number): Promise<void>;
  listRelations(userId: number): Promise<RelationRows>;
  /** `text` já deve chegar limpo (ver `cleanMessageText`) e não-vazio. Também arquiva mantendo só as últimas 200 mensagens da conversa. */
  recordMessage(fromId: number, toId: number, text: string): Promise<StoredMessage>;
  recentMessages(userId: number, otherId: number, beforeId: string | undefined, limit: number): Promise<RecentMessage[]>;
}
