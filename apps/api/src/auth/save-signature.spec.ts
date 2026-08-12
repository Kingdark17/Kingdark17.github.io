import { canonical, signSave, validSignature } from './save-signature';

describe('canonical', () => {
  it('serializa primitivos como JSON normal', () => {
    expect(canonical(1)).toBe('1');
    expect(canonical('x')).toBe('"x"');
    expect(canonical(null)).toBe('null');
    expect(canonical(true)).toBe('true');
  });

  it('serializa arrays preservando a ordem', () => {
    expect(canonical([1, 'x', null])).toBe('[1,"x",null]');
  });

  it('ordena as chaves de objetos', () => {
    expect(canonical({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('ordena as chaves recursivamente, dentro de arrays e objetos aninhados', () => {
    expect(canonical({ a: [1, 2], b: { d: 1, c: 2 } })).toBe('{"a":[1,2],"b":{"c":2,"d":1}}');
  });
});

describe('signSave', () => {
  it('é determinístico para os mesmos argumentos', () => {
    const data = { hero: { name: 'Aria' } };
    expect(signSave(1, 1, data, 'segredo')).toBe(signSave(1, 1, data, 'segredo'));
  });

  it('gera 64 caracteres hex (HMAC-SHA256)', () => {
    expect(signSave(1, 1, { hero: {} }, 'segredo')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('muda com o userId', () => {
    const data = { hero: {} };
    expect(signSave(1, 1, data, 'segredo')).not.toBe(signSave(2, 1, data, 'segredo'));
  });

  it('muda com o slot', () => {
    const data = { hero: {} };
    expect(signSave(1, 1, data, 'segredo')).not.toBe(signSave(1, 2, data, 'segredo'));
  });

  it('muda com o segredo', () => {
    const data = { hero: {} };
    expect(signSave(1, 1, data, 'segredo-a')).not.toBe(signSave(1, 1, data, 'segredo-b'));
  });

  it('muda com o conteúdo do save', () => {
    expect(signSave(1, 1, { gold: 10 }, 'segredo')).not.toBe(signSave(1, 1, { gold: 20 }, 'segredo'));
  });

  it('ignora o campo integrity de nível superior', () => {
    const withIntegrity = { gold: 10, integrity: 'qualquer-coisa' };
    const without = { gold: 10 };
    expect(signSave(1, 1, withIntegrity, 'segredo')).toBe(signSave(1, 1, without, 'segredo'));
  });

  it('não muta o objeto de save original', () => {
    const data = { gold: 10, integrity: 'qualquer-coisa' };
    signSave(1, 1, data, 'segredo');
    expect(data).toEqual({ gold: 10, integrity: 'qualquer-coisa' });
  });
});

describe('validSignature', () => {
  it('aceita a assinatura correta', () => {
    const data = { gold: 10 };
    const signature = signSave(1, 1, data, 'segredo');
    expect(validSignature(1, 1, data, signature, 'segredo')).toBe(true);
  });

  it('rejeita quando o save foi adulterado', () => {
    const signature = signSave(1, 1, { gold: 10 }, 'segredo');
    expect(validSignature(1, 1, { gold: 999 }, signature, 'segredo')).toBe(false);
  });

  it('rejeita assinatura ausente', () => {
    expect(validSignature(1, 1, { gold: 10 }, undefined, 'segredo')).toBe(false);
  });

  it('rejeita assinatura de outro segredo', () => {
    const signature = signSave(1, 1, { gold: 10 }, 'segredo-a');
    expect(validSignature(1, 1, { gold: 10 }, signature, 'segredo-b')).toBe(false);
  });
});
