/**
 * Chamada HTTP à API Nest.
 *
 * A API responde erro sempre como `{ error: "mensagem em português" }`
 * com status fora do 2xx — mensagens escritas pra aparecer na tela, então
 * o cliente as repassa em vez de inventar texto próprio.
 */

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

/**
 * Endereço absoluto de um caminho da API. Serve pro que o navegador
 * busca sozinho, fora do `fetch` — hoje só o `<img src>` da foto de
 * perfil, que a API devolve como caminho relativo a ela mesma.
 */
export function urlDaApi(caminho: string): string {
  return `${baseUrl()}${caminho}`;
}

interface Opcoes {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  /**
   * Marca que a rota exige sessão. Não muda mais o que é enviado — o
   * cookie vai em toda chamada, decidido pelo navegador — mas continua
   * declarando a intenção no ponto de uso, e é o que permite traduzir um
   * 401 em "entre na sua conta" em vez de "erro inesperado".
   */
  autenticado?: boolean;
}

export const SEM_SESSAO = 'Entre na sua conta para continuar.';

export async function chamarApi<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opcoes.body !== undefined) headers['Content-Type'] = 'application/json';

  let resposta: Response;
  try {
    resposta = await fetch(`${baseUrl()}${caminho}`, {
      method: opcoes.method ?? 'GET',
      headers,
      body: opcoes.body === undefined ? undefined : JSON.stringify(opcoes.body),
      // O token virou cookie httpOnly: o JavaScript não o enxerga mais, e
      // sem `include` o navegador não anexa cookie em chamada de outra
      // origem. Sem esta linha, toda rota protegida responde 401.
      credentials: 'include',
    });
  } catch {
    throw new ErroDaApi('Não foi possível falar com o servidor.', 0);
  }

  const texto = await resposta.text();
  const corpo = texto ? (JSON.parse(texto) as unknown) : {};

  if (!resposta.ok) {
    const mensagem = (corpo as { error?: unknown }).error;
    if (typeof mensagem === 'string') throw new ErroDaApi(mensagem, resposta.status);
    // 401 sem corpo é sessão ausente ou vencida — dizer isso vale mais que
    // "erro inesperado", que manda o jogador procurar defeito onde não tem.
    const generico = opcoes.autenticado && resposta.status === 401 ? SEM_SESSAO : 'Erro inesperado no servidor.';
    throw new ErroDaApi(generico, resposta.status);
  }
  return corpo as T;
}
