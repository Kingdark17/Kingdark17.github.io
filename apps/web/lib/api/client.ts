/**
 * Chamada HTTP à API Nest.
 *
 * A API responde erro sempre como `{ error: "mensagem em português" }`
 * com status fora do 2xx — mensagens escritas pra aparecer na tela, então
 * o cliente as repassa em vez de inventar texto próprio.
 */

import { PARAMETRO_DE_VOLTA } from '@/lib/auth/portao';

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

/**
 * A decisão, separada do efeito pra poder ser testada.
 *
 * Só 401 **em rota que declarou precisar de sessão**. As rotas de e-mail
 * não declaram, de propósito (ver `email.ts`): um 401 lá é link vencido,
 * e mandar pro login quem acabou de perder o acesso à conta seria pedir
 * exatamente o que a pessoa não consegue fazer.
 */
export function sessaoExpirou(status: number, autenticado: boolean | undefined): boolean {
  return status === 401 && autenticado === true;
}

/**
 * Devolve a pessoa pro portão quando a sessão morreu no meio do caminho.
 *
 * Existe porque o `proxy.ts` não consegue fazer isso sozinho: da borda, um
 * cookie vencido é idêntico a um válido, e distinguir custaria uma chamada
 * à API a cada navegação — numa API que hiberna até 50 segundos. Então o
 * portão deixa passar, e o primeiro 401 real corrige.
 *
 * `replace` e não `assign`: a tela que já não funciona não merece uma
 * entrada no histórico, senão o "voltar" do navegador cai nela de novo.
 */
function voltarProPortao(): void {
  if (typeof window === 'undefined') return;

  const { pathname, search } = window.location;
  // Já estar no portão e receber 401 é possível — e redirecionar pra ele
  // seria laço.
  if (pathname === '/') return;

  window.location.replace(`/?${PARAMETRO_DE_VOLTA}=${encodeURIComponent(pathname + search)}`);
}

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
    // Antes de montar a mensagem: se a sessão morreu, a tela certa é o
    // portão, não um recado vermelho numa tela que não funciona mais. O
    // `throw` continua acontecendo — a navegação não é instantânea, e quem
    // chamou não pode seguir como se tivesse dado certo.
    if (sessaoExpirou(resposta.status, opcoes.autenticado)) voltarProPortao();

    const mensagem = (corpo as { error?: unknown }).error;
    if (typeof mensagem === 'string') throw new ErroDaApi(mensagem, resposta.status);
    // 401 sem corpo é sessão ausente ou vencida — dizer isso vale mais que
    // "erro inesperado", que manda o jogador procurar defeito onde não tem.
    const generico = opcoes.autenticado && resposta.status === 401 ? SEM_SESSAO : 'Erro inesperado no servidor.';
    throw new ErroDaApi(generico, resposta.status);
  }
  return corpo as T;
}
