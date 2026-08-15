/**
 * Amigos e conversa (`/api/friends*` e `/api/messages/:username`).
 *
 * O histórico vem do banco por REST; o socket só serve pra avisar que
 * chegou mensagem nova enquanto a página está aberta. Enquanto o cliente
 * de tempo real não existe, recarregar a conversa é o que atualiza —
 * decisão explícita, não esquecimento (ver NOTAS-MIGRACAO.md).
 *
 * `online` vem da presença do servidor: sem socket ligado, todo mundo
 * aparece offline. É a verdade do servidor, não um bug da tela.
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
