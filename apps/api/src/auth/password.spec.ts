import { generateSalt, hashPassword, verifyPassword } from './password';

describe('password', () => {
  describe('generateSalt', () => {
    it('gera 32 caracteres hex (16 bytes)', () => {
      const salt = generateSalt();
      expect(salt).toMatch(/^[0-9a-f]{32}$/);
    });

    it('gera valores diferentes a cada chamada', () => {
      expect(generateSalt()).not.toBe(generateSalt());
    });
  });

  describe('hashPassword', () => {
    it('gera 128 caracteres hex (64 bytes)', async () => {
      const hash = await hashPassword('senha-forte', 'sal-fixo');
      expect(hash).toMatch(/^[0-9a-f]{128}$/);
    });

    it('é determinístico para a mesma senha e sal', async () => {
      const a = await hashPassword('senha-forte', 'sal-fixo');
      const b = await hashPassword('senha-forte', 'sal-fixo');
      expect(a).toBe(b);
    });

    it('muda com a senha', async () => {
      const a = await hashPassword('senha-forte', 'sal-fixo');
      const b = await hashPassword('outra-senha', 'sal-fixo');
      expect(a).not.toBe(b);
    });

    it('muda com o sal', async () => {
      const a = await hashPassword('senha-forte', 'sal-fixo');
      const b = await hashPassword('senha-forte', 'outro-sal');
      expect(a).not.toBe(b);
    });
  });

  describe('verifyPassword', () => {
    it('aceita a senha correta', async () => {
      const salt = generateSalt();
      const hash = await hashPassword('minha-senha-123', salt);
      await expect(verifyPassword('minha-senha-123', salt, hash)).resolves.toBe(true);
    });

    it('rejeita a senha errada', async () => {
      const salt = generateSalt();
      const hash = await hashPassword('minha-senha-123', salt);
      await expect(verifyPassword('senha-errada', salt, hash)).resolves.toBe(false);
    });

    it('rejeita quando o hash esperado tem tamanho diferente', async () => {
      const salt = generateSalt();
      await expect(verifyPassword('minha-senha-123', salt, 'ab')).resolves.toBe(false);
    });
  });
});
