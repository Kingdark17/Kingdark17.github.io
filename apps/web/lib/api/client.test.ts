import { describe, expect, it } from 'vitest';

import { sessaoExpirou } from './client';

/**
 * A decisão de devolver a pessoa pro portão quando a sessão morreu.
 *
 * O efeito em si (`window.location.replace`) não é testado aqui: este
 * pacote roda o vitest em ambiente `node`, sem DOM. O que dá pra prender —
 * e o que erraria feio — é **quando** ele deve acontecer.
 */
describe('sessaoExpirou', () => {
  it('401 em rota autenticada é sessão morta', () => {
    expect(sessaoExpirou(401, true)).toBe(true);
  });

  /**
   * O caso que dói: as rotas de e-mail não declaram `autenticado`, de
   * propósito (ver o cabeçalho de `email.ts`). Um 401 lá é **link
   * vencido** — quem está redefinindo senha acabou de perder o acesso à
   * conta. Mandar essa pessoa pro login é pedir exatamente o que ela não
   * consegue fazer, e ela perderia a mensagem que explica o que houve.
   */
  it.each([undefined, false])('401 em rota sem sessão declarada (%p) NÃO manda pro login', (autenticado) => {
    expect(sessaoExpirou(401, autenticado)).toBe(false);
  });

  it.each([400, 403, 404, 409, 429, 500, 503])('%i não é sessão morta', (status) => {
    expect(sessaoExpirou(status, true)).toBe(false);
  });

  /**
   * 403 fica de fora de propósito: é "você está logado e não pode isso",
   * não "entre de novo". Trocar um pelo outro faria a pessoa relogar em
   * laço sem nunca destravar nada.
   */
  it('403 com sessão declarada continua sendo erro de permissão', () => {
    expect(sessaoExpirou(403, true)).toBe(false);
  });
});
