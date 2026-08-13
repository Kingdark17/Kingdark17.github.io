/**
 * Assunto, corpo e link dos dois e-mails transacionais — mesmo texto e
 * mesmo formato de link do `issueEmailToken()` do accounts.js original.
 *
 * O link aponta pro jogo, não pra API: `PUBLIC_GAME_URL/?verify=TOKEN` ou
 * `?reset=TOKEN`. É `rpg-legend/js/account.js` (`handleEmailLink`) que lê
 * esse parâmetro e chama a rota correspondente. Mudar o formato aqui
 * quebra o cliente sem erro visível — ele simplesmente não reconhece o
 * link.
 */

export type EmailTokenType = 'verify' | 'reset';

export interface EmailTemplate {
  subject: string;
  html: string;
}

export const DEFAULT_PUBLIC_GAME_URL = 'https://kingdark17.github.io/rpg-legend/';

export function normalizePublicGameUrl(value: string | undefined): string {
  return (value || DEFAULT_PUBLIC_GAME_URL).replace(/\/$/, '');
}

export function emailLink(publicGameUrl: string, type: EmailTokenType, token: string): string {
  return `${normalizePublicGameUrl(publicGameUrl)}/?${type}=${encodeURIComponent(token)}`;
}

export function emailTemplate(type: EmailTokenType, link: string): EmailTemplate {
  const verifying = type === 'verify';
  const action = verifying ? 'Confirme seu e-mail' : 'Redefina sua senha';
  return {
    subject: verifying ? 'Confirme seu e-mail no RPG Legend' : 'Redefina sua senha do RPG Legend',
    html:
      '<h2>RPG Legend</h2>' +
      `<p>${action} clicando no botão abaixo.</p>` +
      `<p><a href="${link}" style="padding:12px 18px;background:#8b6f3d;color:white;text-decoration:none">Continuar</a></p>` +
      '<p>O link expira em uma hora.</p>',
  };
}
