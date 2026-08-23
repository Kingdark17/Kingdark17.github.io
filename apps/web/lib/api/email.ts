/**
 * As três rotas que se usa **sem sessão**: confirmar e-mail, pedir
 * recuperação e trocar a senha por um token.
 *
 * Nenhuma passa `autenticado: true`, e isso é a parte que importa. Quem
 * chega aqui clicou num link de e-mail — no caso do reset, acabou de
 * perder o acesso à conta. Um 401 nestas rotas não significa "entre na sua
 * conta", significa link vencido, e a API já devolve essa frase pronta no
 * `error`. Marcá-las como autenticadas trocaria a mensagem certa por
 * "Entre na sua conta para continuar", mandando a pessoa fazer exatamente
 * o que ela não consegue.
 */

import { chamarApi } from './client';

export async function confirmarEmail(token: string): Promise<void> {
  await chamarApi('/api/account/verify-email', { method: 'POST', body: { token } });
}

/**
 * A API responde igual com conta e sem conta, de propósito — a rota não
 * pode virar um jeito de descobrir quais e-mails estão cadastrados. Por
 * isso o que se mostra na tela é a frase que ela devolve, e não uma
 * confirmação nossa de que o e-mail existe.
 */
export async function pedirRedefinicao(email: string): Promise<string> {
  const resposta = await chamarApi<{ message?: string }>('/api/account/request-password-reset', {
    method: 'POST',
    body: { email },
  });
  return resposta.message || 'Se o e-mail estiver cadastrado, enviaremos um link de recuperação.';
}

export async function redefinirSenha(token: string, password: string): Promise<void> {
  await chamarApi('/api/account/reset-password', { method: 'POST', body: { token, password } });
}

/**
 * Esta **exige** sessão, ao contrário das outras três: quem reenvia a
 * confirmação está dentro da conta e só perdeu o link. O link expira em uma
 * hora, então sem isto um e-mail lido no dia seguinte seria um beco sem
 * saída — a conta ficaria pra sempre sem confirmar.
 */
export async function reenviarConfirmacao(): Promise<void> {
  await chamarApi('/api/account/resend-verification', { method: 'POST', autenticado: true });
}

/**
 * Um parâmetro de busca pode chegar repetido (`?verify=a&verify=b`), e aí
 * o Next entrega um array. Nada nosso produz isso, mas o endereço é
 * digitável por qualquer um, e `String(['a','b'])` viraria `"a,b"` — um
 * token inválido em vez de um token errado, com mensagem pior.
 */
export function primeiro(valor: string | string[] | undefined): string {
  return Array.isArray(valor) ? (valor[0] ?? '') : (valor ?? '');
}

/**
 * Para onde o portão manda quem chegou por link de e-mail, ou `''` se a
 * visita é comum.
 *
 * A API monta o link como `BASE/?verify=TOKEN` — formato herdado do
 * `handleEmailLink` do jogo antigo, mantido de propósito pra uma API só
 * poder atender os dois clientes. Quem traduz esse formato pras rotas
 * daqui é esta função, e não a API.
 */
export function rotaDoLinkDeEmail(busca: Record<string, string | string[] | undefined>): string {
  const confirmacao = primeiro(busca.verify);
  if (confirmacao) return `/confirmar-email?token=${encodeURIComponent(confirmacao)}`;

  const recuperacao = primeiro(busca.reset);
  if (recuperacao) return `/redefinir-senha?token=${encodeURIComponent(recuperacao)}`;

  return '';
}
