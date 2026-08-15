/**
 * Chamada HTTP à API Nest.
 *
 * A API responde erro sempre como `{ error: "mensagem em português" }`
 * com status fora do 2xx — mensagens escritas pra aparecer na tela, então
 * o cliente as repassa em vez de inventar texto próprio.
 */

import { lerToken } from './session';

export class ErroDaApi extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ErroDaApi';
  }
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
}

interface Opcoes {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  /** Manda o token da sessão. Rota pública não precisa. */
  autenticado?: boolean;
}

export const SEM_SESSAO = 'Entre na sua conta para continuar.';

export async function chamarApi<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opcoes.body !== undefined) headers['Content-Type'] = 'application/json';

  // Sem token a chamada já falha aqui, como rejeição da promessa. Evita
  // mandar `Bearer ` vazio pro servidor e, do lado da tela, deixa o
  // "você não está logado" cair no mesmo `.catch` de qualquer outro erro —
  // sem `setState` síncrono dentro de `useEffect`.
  if (opcoes.autenticado) {
    const token = lerToken();
    if (!token) throw new ErroDaApi(SEM_SESSAO, 401);
    headers.Authorization = `Bearer ${token}`;
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${baseUrl()}${caminho}`, {
      method: opcoes.method ?? 'GET',
      headers,
      body: opcoes.body === undefined ? undefined : JSON.stringify(opcoes.body),
    });
  } catch {
    throw new ErroDaApi('Não foi possível falar com o servidor.', 0);
  }

  const texto = await resposta.text();
  const corpo = texto ? (JSON.parse(texto) as unknown) : {};

  if (!resposta.ok) {
    const mensagem = (corpo as { error?: unknown }).error;
    throw new ErroDaApi(typeof mensagem === 'string' ? mensagem : 'Erro inesperado no servidor.', resposta.status);
  }
  return corpo as T;
}
