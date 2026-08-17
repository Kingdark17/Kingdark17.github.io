import { avatarVersion, decodeAvatar, isUploadedAvatar, publicAvatarUrl, resumoDoAvatar } from './avatar';

/** PNG de 1×1, o mesmo formato que `compressPhoto()` produz no navegador. */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('isUploadedAvatar', () => {
  it('distingue foto enviada de link externo', () => {
    expect(isUploadedAvatar(PNG)).toBe(true);
    expect(isUploadedAvatar('https://exemplo.com/foto.png')).toBe(false);
    expect(isUploadedAvatar('')).toBe(false);
  });
});

describe('resumoDoAvatar', () => {
  it('foto enviada vira só versão; o base64 não passa adiante', () => {
    const resumo = resumoDoAvatar(PNG);

    expect(resumo.url).toBe('');
    expect(resumo.version).toMatch(/^[0-9a-f]{12}$/);
  });

  it('link externo passa como está, sem versão', () => {
    expect(resumoDoAvatar('https://exemplo.com/foto.png')).toEqual({ url: 'https://exemplo.com/foto.png', version: '' });
  });

  it('sem foto, nada dos dois', () => {
    expect(resumoDoAvatar('')).toEqual({ url: '', version: '' });
  });

  it('a versão muda com a foto e não muda sozinha', () => {
    const outra = PNG.replace('iVBOR', 'iVBOQ');

    expect(resumoDoAvatar(PNG).version).toBe(resumoDoAvatar(PNG).version);
    expect(resumoDoAvatar(PNG).version).not.toBe(resumoDoAvatar(outra).version);
  });
});

describe('publicAvatarUrl', () => {
  it('troca a foto enviada pelo endereço do endpoint, com a versão do conteúdo', () => {
    expect(publicAvatarUrl('Aria', resumoDoAvatar(PNG))).toBe(`/api/users/Aria/avatar?v=${avatarVersion(PNG)}`);
  });

  it('deixa link externo e ausência de foto como estão', () => {
    expect(publicAvatarUrl('Aria', resumoDoAvatar('https://exemplo.com/foto.png'))).toBe('https://exemplo.com/foto.png');
    expect(publicAvatarUrl('Aria', resumoDoAvatar(''))).toBe('');
  });

  it('escapa o nome — ele vem do cliente e entra numa URL', () => {
    expect(publicAvatarUrl('a/b?c', resumoDoAvatar(PNG))).toContain('/api/users/a%2Fb%3Fc/avatar');
  });

  it('serve qualquer versão, venha do SQL ou do JS — o valor é opaco', () => {
    expect(publicAvatarUrl('Aria', { url: '', version: 'ab12cd34ef56' })).toBe('/api/users/Aria/avatar?v=ab12cd34ef56');
  });
});

describe('decodeAvatar', () => {
  it('devolve o tipo e os bytes de verdade', () => {
    const foto = decodeAvatar(PNG);

    expect(foto?.mime).toBe('image/png');
    // Assinatura de arquivo PNG: sem ela o navegador não desenharia nada.
    expect(foto?.bytes.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it('recusa link externo, formato desconhecido e conteúdo vazio', () => {
    expect(decodeAvatar('https://exemplo.com/foto.png')).toBeNull();
    expect(decodeAvatar('data:image/svg+xml;base64,AAAA')).toBeNull();
    expect(decodeAvatar('data:image/png;base64,')).toBeNull();
    expect(decodeAvatar('')).toBeNull();
  });
});
