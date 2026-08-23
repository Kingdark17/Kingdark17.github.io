/**
 * A sessão passando a morar num cookie `httpOnly`, em vez do `localStorage`
 * do navegador.
 *
 * O motivo não é estético. Token em `localStorage` é alcançável por
 * qualquer XSS — o próprio `apps/web/lib/api/session.ts` admite isso — e,
 * mais prático, o servidor do Next não consegue lê-lo. Sem o servidor saber
 * quem é o jogador, toda tela que dependa de sessão precisa virar Client
 * Component e decidir depois que o JavaScript carrega.
 *
 * O `Bearer` continua aceito de propósito: enquanto o cliente antigo
 * (`rpg-legend/js/account.js`) e o evento `auth` do socket mandarem token no
 * corpo, cortar o header quebraria os dois de uma vez. Cookie tem
 * precedência; o header é o resto da transição.
 *
 * ATENÇÃO ao publicar: cookie de sessão só atravessa se front e API forem
 * do mesmo site registrável. Front em `rpglegend.com.br` com API em
 * `api.rpglegend.com.br` funciona com `SameSite=Lax`. Em domínios
 * diferentes (Vercel + Render, por exemplo) o cookie vira de terceiros, e
 * Safari e Firefox o descartam por padrão — o login falha sem erro visível.
 */

import type { CookieOptions, Request } from 'express';

import { extractBearerToken } from './bearer-token';
import { FORMATO_DO_TOKEN, SESSION_TTL_MS } from './tokens';

export const NOME_DO_COOKIE = 'rpg_sessao';

/**
 * Lê o token do cabeçalho `Cookie`. Escrito à mão em vez de trazer o
 * `cookie-parser`: o valor aqui é fechado (64 hex), então validar o formato
 * é mais seguro que aceitar o que um parser genérico devolveria. Valor fora
 * do formato é tratado como ausente, não repassado adiante.
 */
export function lerTokenDoCookie(cabecalho: string | undefined): string {
  for (const parte of String(cabecalho || '').split(';')) {
    const corte = parte.indexOf('=');
    if (corte < 0) continue;
    if (parte.slice(0, corte).trim() !== NOME_DO_COOKIE) continue;
    const valor = parte.slice(corte + 1).trim();
    return FORMATO_DO_TOKEN.test(valor) ? valor : '';
  }
  return '';
}

/** Cookie primeiro, `Authorization: Bearer` como resto da transição. */
export function extrairTokenDaSessao(request: Request): string {
  return lerTokenDoCookie(request.headers.cookie) || extractBearerToken(request.headers.authorization);
}

/**
 * Como o cookie é emitido. Tudo que varia por ambiente sai de variável, e
 * os padrões são os de desenvolvimento — em `localhost` o navegador recusa
 * `Secure` sobre http, então ligar isso por padrão quebraria o login na
 * máquina de quem desenvolve.
 *
 * Em produção: `COOKIE_SECURE=true` e `COOKIE_DOMAIN=.rpglegend.com.br`.
 */
export function opcoesDoCookie(): CookieOptions {
  const dominio = process.env.COOKIE_DOMAIN?.trim();
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE?.trim() === 'true',
    path: '/',
    maxAge: SESSION_TTL_MS,
    ...(dominio ? { domain: dominio } : {}),
  };
}

/**
 * Pra apagar, o navegador exige os **mesmos** atributos de quando o cookie
 * foi posto — menos os de tempo. Domínio ou caminho diferente e o cookie
 * antigo continua lá, com o jogador achando que saiu.
 */
export function opcoesDeRemocao(): CookieOptions {
  const opcoes = opcoesDoCookie();
  delete opcoes.maxAge;
  return opcoes;
}
