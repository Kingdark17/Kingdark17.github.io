import { generateSessionToken, hashToken } from './tokens';

describe('tokens', () => {
  describe('generateSessionToken', () => {
    it('gera 64 caracteres hex (32 bytes)', () => {
      expect(generateSessionToken()).toMatch(/^[0-9a-f]{64}$/);
    });

    it('gera valores diferentes a cada chamada', () => {
      expect(generateSessionToken()).not.toBe(generateSessionToken());
    });
  });

  describe('hashToken', () => {
    it('bate com o vetor de teste conhecido do sha256("abc")', () => {
      expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });

    it('é determinístico', () => {
      const token = generateSessionToken();
      expect(hashToken(token)).toBe(hashToken(token));
    });

    it('muda com o token', () => {
      expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
    });
  });
});
