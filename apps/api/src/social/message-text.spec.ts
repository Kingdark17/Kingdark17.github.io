import { cleanMessageText } from './message-text';

describe('cleanMessageText', () => {
  it('remove espaços nas pontas', () => {
    expect(cleanMessageText('  oi  ')).toBe('oi');
  });

  it('vira string vazia pra null/undefined/número', () => {
    expect(cleanMessageText(null)).toBe('');
    expect(cleanMessageText(undefined)).toBe('');
  });

  it('corta em 2000 caracteres', () => {
    const long = 'a'.repeat(2500);
    expect(cleanMessageText(long)).toHaveLength(2000);
  });

  it('string só com espaço vira vazia', () => {
    expect(cleanMessageText('   ')).toBe('');
  });
});
