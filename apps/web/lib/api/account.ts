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
import { apagarToken, guardarToken } from './session';

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

interface RespostaComToken {
  token: string;
  user: Usuario;
}

export async function cadastrar(dados: { username: string; email: string; password: string }): Promise<Usuario> {
  const resposta = await chamarApi<RespostaComToken>('/api/account/register', { method: 'POST', body: dados });
  guardarToken(resposta.token);
  return resposta.user;
}

export async function entrar(dados: { username: string; password: string }): Promise<Usuario> {
  const resposta = await chamarApi<RespostaComToken>('/api/account/login', { method: 'POST', body: dados });
  guardarToken(resposta.token);
  return resposta.user;
}

export async function sair(): Promise<void> {
  try {
    await chamarApi('/api/account/logout', { method: 'POST', autenticado: true });
  } finally {
    // Sessão local sempre cai, mesmo se a chamada falhar — senão o jogador
    // fica preso numa sessão que ele já mandou encerrar.
    apagarToken();
  }
}

export async function usuarioAtual(): Promise<Usuario> {
  const resposta = await chamarApi<{ user: Usuario }>('/api/account/me', { autenticado: true });
  return resposta.user;
}
