/**
 * Amigos e conversa (`/api/friends*` e `/api/messages/:username`).
 *
 * O histórico vem do banco por REST; o socket só avisa que chegou
 * mensagem nova (ver `lib/rede/sala.ts`). Mandar continua sendo REST: a
 * mesma `SocialService` do servidor empurra o aviso pro outro lado, então
 * mandar por socket não mudaria nada e perderia a resposta de erro.
 *
 * `online` vem da presença do servidor, que só conhece quem está com
 * socket ligado — ou seja, quem tem alguma tela do jogo aberta.
 */

import { chamarApi } from './client';

export interface AmigoPublico {
  username: string;
  avatarUrl: string;
  frame: string;
  nameColor: string;
  pet: string;
  online: boolean;
}

export interface Relacoes {
  friends: AmigoPublico[];
  incoming: AmigoPublico[];
  outgoing: AmigoPublico[];
}

export interface Mensagem {
  id: string;
  fromMe: boolean;
  body: string;
  createdAt: string;
}

export function listarAmigos(): Promise<Relacoes> {
  return chamarApi<Relacoes>('/api/friends', { autenticado: true });
}

/** Pedir pra alguém que já tinha pedido pra você aceita na hora (`accepted: true`). */
export function pedirAmizade(username: string): Promise<{ ok: true; accepted: boolean }> {
  return chamarApi('/api/friends/request', { method: 'POST', body: { username }, autenticado: true });
}

export function aceitarAmizade(username: string): Promise<{ ok: true }> {
  return chamarApi('/api/friends/accept', { method: 'POST', body: { username }, autenticado: true });
}

export function recusarAmizade(username: string): Promise<{ ok: true }> {
  return chamarApi('/api/friends/decline', { method: 'POST', body: { username }, autenticado: true });
}

export function desfazerAmizade(username: string): Promise<{ ok: true }> {
  return chamarApi('/api/friends/remove', { method: 'POST', body: { username }, autenticado: true });
}

export async function conversaCom(username: string): Promise<Mensagem[]> {
  const resposta = await chamarApi<{ messages: Mensagem[] }>(`/api/messages/${encodeURIComponent(username)}`, { autenticado: true });
  return resposta.messages;
}

export async function enviarMensagem(username: string, texto: string): Promise<void> {
  await chamarApi(`/api/messages/${encodeURIComponent(username)}`, { method: 'POST', body: { body: texto }, autenticado: true });
}
