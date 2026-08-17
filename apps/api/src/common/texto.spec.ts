import { comoTexto } from './texto';

describe('comoTexto', () => {
  it('deixa string passar inteira', () => {
    expect(comoTexto('Aria')).toBe('Aria');
    expect(comoTexto('')).toBe('');
  });

  it('converte número e booleano, como o String() fazia', () => {
    expect(comoTexto(7)).toBe('7');
    expect(comoTexto(0)).toBe('0');
    expect(comoTexto(true)).toBe('true');
  });

  it('null e undefined caem no padrão', () => {
    expect(comoTexto(null)).toBe('');
    expect(comoTexto(undefined)).toBe('');
    expect(comoTexto(undefined, 'none')).toBe('none');
  });

  it('objeto e lista caem no padrão em vez de virar texto', () => {
    // Era isto que o String() deixava passar: nome de usuário
    // "[object Object]", sala "A,B", sala "" a partir de uma lista vazia.
    expect(comoTexto({})).toBe('');
    expect(comoTexto({ toString: () => 'malicioso' })).toBe('');
    expect(comoTexto(['A', 'B'])).toBe('');
    expect(comoTexto([])).toBe('');
  });
});
