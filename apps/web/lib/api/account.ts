/**
 * Rotas de conta da API Nest (`/api/account/*`).
 *
 * `Usuario` repete a forma de `SafeUser` em `apps/api/src/auth/cosmetics.ts`.
 * É duplicação consciente: o front não importa de `apps/api`, e mover o
 * tipo pra `packages/shared` só faz sentido quando a engine precisar dele
 * — hoje não precisa. Se os dois divergirem, quem quebra é a tela, não a
 * validação de jogada.
 */

import { chamarApi } from './client';

export interface Cosmeticos {
  frames: string[];
  colors: string[];
  pets: string[];
}

export interface Usuario {
  id: number;
  username: string;
  isAdmin: boolean;
  email: string | null;
  emailVerified: boolean;
  avatarUrl: string;
  frame: string;
  nameColor: string;
  pet: string;
  cosmetics: Cosmeticos;
}

/**
 * A API ainda devolve `token` no corpo, pro cliente antigo e pra quem não
 * é navegador. Aqui o campo é ignorado de propósito: a sessão chega pelo
 * `Set-Cookie` da mesma resposta, e guardar uma cópia legível por
 * JavaScript devolveria exatamente o risco de XSS que a troca eliminou.
 */
interface RespostaDeSessao {
  user: Usuario;
}

export async function cadastrar(dados: { username: string; email: string; password: string }): Promise<Usuario> {
  const resposta = await chamarApi<RespostaDeSessao>('/api/account/register', { method: 'POST', body: dados });
  return resposta.user;
}

export async function entrar(dados: { username: string; password: string }): Promise<Usuario> {
  const resposta = await chamarApi<RespostaDeSessao>('/api/account/login', { method: 'POST', body: dados });
  return resposta.user;
}

/**
 * Quem apaga o cookie é o servidor, no `Set-Cookie` da resposta — o
 * navegador não consegue apagar cookie `httpOnly` sozinho. Se a chamada
 * falhar, a sessão continua de pé: é o preço de não ter mais uma cópia
 * local pra descartar por conta própria.
 */
export async function sair(): Promise<void> {
  await chamarApi('/api/account/logout', { method: 'POST', autenticado: true });
}

export async function usuarioAtual(): Promise<Usuario> {
  const resposta = await chamarApi<{ user: Usuario }>('/api/account/me', { autenticado: true });
  return resposta.user;
}
