/**
 * Onde o token de sessão mora — de propósito num arquivo só.
 *
 * Hoje é `localStorage` com token Bearer, igual ao cliente antigo em
 * `rpg-legend/js/account.js`, porque é o que a API já emite e o que o
 * gateway socket.io já aceita no evento `auth`.
 *
 * O custo é conhecido: token em `localStorage` é alcançável por XSS.
 * Trocar por cookie httpOnly exigiria `Set-Cookie` no Nest, `SameSite=None`,
 * credenciais no CORS e um handshake diferente no socket. Quando essa
 * troca acontecer, é este arquivo que muda — nada mais lê o token direto.
 */

const CHAVE = 'rpg-legend:token';

export function lerToken(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(CHAVE) ?? '';
}

export function guardarToken(token: string): void {
  window.localStorage.setItem(CHAVE, token);
}

export function apagarToken(): void {
  window.localStorage.removeItem(CHAVE);
}
