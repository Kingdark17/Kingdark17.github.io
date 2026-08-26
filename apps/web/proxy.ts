/**
 * O portão, na frente de tudo.
 *
 * **É `proxy.ts` e não `middleware.ts`.** O `middleware` foi deprecado
 * nesta versão do Next e renomeado — ver
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md`,
 * que existe só pra apontar pro `proxy.md`. Escrever `middleware.ts` aqui
 * criaria um arquivo que o Next ignora, e um portão que não barra ninguém
 * parece funcionar perfeitamente.
 *
 * A decisão inteira mora em `lib/auth/portao.ts`, que é função pura e tem
 * teste. Aqui só se lê o cookie e se obedece.
 *
 * Roda antes da página, então `/menu` continua estático como o comentário
 * do `app/page.tsx` diz que foi escolhido de propósito — o portão não
 * obriga ninguém a virar dinâmico.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { destinoDoPortao } from '@/lib/auth/portao';

/** Mesmo nome que a API emite em `apps/api/src/auth/session-cookie.ts`. */
const NOME_DO_COOKIE = 'rpg_sessao';

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const destino = destinoDoPortao(pathname, search, request.cookies.has(NOME_DO_COOKIE));
  if (!destino) return NextResponse.next();
  return NextResponse.redirect(new URL(destino, request.url));
}

/**
 * Sem `matcher`, o proxy roda em **toda** requisição — inclusive CSS, fonte
 * e imagem. A doc avisa disso em letras grandes, e o estrago seria o portão
 * redirecionando o próprio `icon.png` da aba e a folha de estilo da tela de
 * login, deixando o jogo sem cara nenhuma pra quem não entrou.
 *
 * O padrão exclui duas coisas: qualquer coisa sob `_next/`, e qualquer
 * caminho que termine em extensão. A segunda parte cobre de uma vez o
 * `icon.png`, o `apple-icon.png` e tudo que mora em `public/` — e continua
 * cobrindo o arquivo que alguém acrescentar amanhã sem lembrar deste
 * comentário. Rota de tela nunca tem ponto no último segmento.
 */
export const config = {
  matcher: ['/((?!_next/|.*\\.[^/]+$).*)'],
};
