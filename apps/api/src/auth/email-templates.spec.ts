import { DEFAULT_PUBLIC_GAME_URL, emailLink, emailTemplate, normalizePublicGameUrl } from './email-templates';

describe('normalizePublicGameUrl', () => {
  it('tira a barra final e cai pro jogo publicado quando não configurado', () => {
    expect(normalizePublicGameUrl('https://exemplo.com/jogo/')).toBe('https://exemplo.com/jogo');
    expect(normalizePublicGameUrl(undefined)).toBe(DEFAULT_PUBLIC_GAME_URL.replace(/\/$/, ''));
    expect(normalizePublicGameUrl('')).toBe(DEFAULT_PUBLIC_GAME_URL.replace(/\/$/, ''));
  });
});

describe('emailLink', () => {
  it('aponta pro jogo com o token no parâmetro que o cliente lê', () => {
    expect(emailLink('https://kingdark17.github.io/rpg-legend/', 'verify', 'abc123')).toBe(
      'https://kingdark17.github.io/rpg-legend/?verify=abc123',
    );
    expect(emailLink('https://kingdark17.github.io/rpg-legend', 'reset', 'abc123')).toBe(
      'https://kingdark17.github.io/rpg-legend/?reset=abc123',
    );
  });

  it('escapa o token', () => {
    expect(emailLink('https://exemplo.com', 'verify', 'a b&c')).toBe('https://exemplo.com/?verify=a%20b%26c');
  });
});

describe('emailTemplate', () => {
  it('usa o assunto e o texto certos pra cada tipo', () => {
    const verify = emailTemplate('verify', 'https://exemplo.com/?verify=t');
    expect(verify.subject).toBe('Confirme seu e-mail no RPG Legend');
    expect(verify.html).toContain('Confirme seu e-mail clicando no botão abaixo.');
    expect(verify.html).toContain('href="https://exemplo.com/?verify=t"');

    const reset = emailTemplate('reset', 'https://exemplo.com/?reset=t');
    expect(reset.subject).toBe('Redefina sua senha do RPG Legend');
    expect(reset.html).toContain('Redefina sua senha clicando no botão abaixo.');
  });

  it('avisa que o link expira em uma hora', () => {
    expect(emailTemplate('verify', 'x').html).toContain('O link expira em uma hora.');
  });
});
