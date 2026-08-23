import { DEFAULT_PUBLIC_GAME_URL, emailLink, emailTemplate, normalizePublicGameUrl } from './email-templates';

describe('normalizePublicGameUrl', () => {
  it('tira a barra final e cai pro jogo publicado quando não configurado', () => {
    expect(normalizePublicGameUrl('https://exemplo.com/jogo/')).toBe('https://exemplo.com/jogo');
    expect(normalizePublicGameUrl(undefined)).toBe(DEFAULT_PUBLIC_GAME_URL.replace(/\/$/, ''));
    expect(normalizePublicGameUrl('')).toBe(DEFAULT_PUBLIC_GAME_URL.replace(/\/$/, ''));
  });

  // O teste acima usa a constante nos dois lados, entao passa com qualquer
  // valor que ela tenha. Este prega o endereco de verdade: e' o que vai no
  // e-mail de confirmacao e de troca de senha, e apontar pro lugar errado
  // nao da erro em lugar nenhum — o link so' nao funciona pra quem clicar.
  it('o padrao e o dominio proprio, no caminho completo do jogo', () => {
    expect(DEFAULT_PUBLIC_GAME_URL).toBe('https://rpglegend.com.br/rpg-legend/');
  });

  // A raiz do dominio redireciona pra ca', mas por JavaScript, e o link
  // visivel de reserva nao leva a busca junto. Quem tiver JS desligado
  // perderia o ?verify= no caminho. Por isso o padrao aponta direto.
  it('nao aponta pra raiz do dominio, que depende de redirecionamento', () => {
    expect(DEFAULT_PUBLIC_GAME_URL).toContain('/rpg-legend/');
  });
});

describe('emailLink', () => {
  it('aponta pro jogo com o token no parâmetro que o cliente lê', () => {
    expect(emailLink('https://kingdark17.github.io/rpg-legend/', 'verify', 'abc123')).toBe('https://kingdark17.github.io/rpg-legend/?verify=abc123');
    expect(emailLink('https://kingdark17.github.io/rpg-legend', 'reset', 'abc123')).toBe('https://kingdark17.github.io/rpg-legend/?reset=abc123');
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
