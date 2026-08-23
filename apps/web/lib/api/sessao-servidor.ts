import 'server-only';

/**
 * Quem é o jogador, respondido no servidor.
 *
 * Só passou a existir porque a sessão virou cookie: enquanto o token morava
 * no `localStorage`, nada fora do navegador conseguia lê-lo, e toda tela que
 * dependesse de sessão precisava ser Client Component e decidir depois do
 * JavaScript carregar.
 *
 * O `server-only` no topo não é enfeite — ele faz o build **quebrar** se
 * alguém importar isto de um Client Component, em vez de vazar cookie de
 * sessão pro pacote que vai pro navegador.
 */

import { cookies } from 'next/headers';

import type { Usuario } from './account';

/** Mesmo nome que a API emite em `apps/api/src/auth/session-cookie.ts`. */
const NOME_DO_COOKIE = 'rpg_sessao';

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
}

/**
 * O usuário da sessão, ou `null` — inclusive quando a API está fora do ar.
 *
 * Nunca lança: esta função é chamada no caminho de render de página, e uma
 * exceção aqui viraria erro 500 numa tela cujo pior caso legítimo é "pede
 * pra entrar de novo". API caída deve mostrar o login, não um erro.
 */
export async function usuarioDaSessao(): Promise<Usuario | null> {
  const token = (await cookies()).get(NOME_DO_COOKIE)?.value;
  if (!token) return null;

  try {
    const resposta = await fetch(`${baseUrl()}/api/account/me`, {
      headers: { Cookie: `${NOME_DO_COOKIE}=${token}` },
      // Sessão não pode vir de cache: o Next guardaria a resposta de um
      // jogador e a serviria pro seguinte.
      cache: 'no-store',
    });
    if (!resposta.ok) return null;
    const corpo: unknown = await resposta.json();
    return (corpo as { user: Usuario }).user;
  } catch {
    return null;
  }
}
