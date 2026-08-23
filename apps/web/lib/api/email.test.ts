import { describe, expect, it } from 'vitest';

import { primeiro, rotaDoLinkDeEmail } from './email';

describe('primeiro', () => {
  it('pega o valor, o primeiro de um array, ou vazio', () => {
    expect(primeiro('abc')).toBe('abc');
    expect(primeiro(['a', 'b'])).toBe('a');
    expect(primeiro(undefined)).toBe('');
    expect(primeiro([])).toBe('');
  });
});

describe('rotaDoLinkDeEmail', () => {
  it('manda a confirmação pra /confirmar-email', () => {
    expect(rotaDoLinkDeEmail({ verify: 'abc123' })).toBe('/confirmar-email?token=abc123');
  });

  it('manda a recuperação pra /redefinir-senha', () => {
    expect(rotaDoLinkDeEmail({ reset: 'abc123' })).toBe('/redefinir-senha?token=abc123');
  });

  it('não desvia visita comum', () => {
    expect(rotaDoLinkDeEmail({})).toBe('');
    expect(rotaDoLinkDeEmail({ outra: 'coisa' })).toBe('');
    // Parâmetro presente e vazio é o mesmo que ausente: `?verify=` sozinho
    // não é link de e-mail, e desviar por causa dele levaria a pessoa a uma
    // tela de erro em vez do login.
    expect(rotaDoLinkDeEmail({ verify: '' })).toBe('');
  });

  it('escapa o token', () => {
    // Sem escapar, um token com `&` viraria dois parâmetros e a página de
    // destino leria só o pedaço antes dele — link "inválido" sem motivo
    // visível. Os tokens de hoje são hexadecimais, mas a rota não é.
    expect(rotaDoLinkDeEmail({ verify: 'a b&c=d' })).toBe('/confirmar-email?token=a%20b%26c%3Dd');
  });

  it('confirmar ganha de redefinir quando os dois vêm juntos', () => {
    // Não deveria acontecer, mas se acontecer é preciso escolher um: mandar
    // pro reset apagaria a senha de quem só queria confirmar o e-mail.
    expect(rotaDoLinkDeEmail({ verify: 'v', reset: 'r' })).toBe('/confirmar-email?token=v');
  });
});
