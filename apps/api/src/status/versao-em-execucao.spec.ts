import { versaoEmExecucao } from './versao-em-execucao';

describe('versaoEmExecucao', () => {
  it('encurta o SHA pro tamanho que o painel e o `git log` mostram', () => {
    const versao = versaoEmExecucao({ RENDER_GIT_COMMIT: '903e369aa1b2c3d4e5f60718293a4b5c6d7e8f90', RENDER_GIT_BRANCH: 'main' });

    expect(versao).toEqual({ commit: '903e369', branch: 'main' });
  });

  /**
   * `null` aparece no JSON e denuncia a si mesmo. `undefined` sumiria do
   * corpo, e o campo pareceria nunca ter existido — que é a falha calada
   * que este arquivo existe pra acabar.
   */
  it('sem as variáveis, responde `null` — nunca `undefined` nem string vazia', () => {
    expect(versaoEmExecucao({})).toEqual({ commit: null, branch: null });
    expect(JSON.stringify(versaoEmExecucao({}))).toBe('{"commit":null,"branch":null}');
  });

  it('variável presente e vazia conta como ausente', () => {
    expect(versaoEmExecucao({ RENDER_GIT_COMMIT: '   ', RENDER_GIT_BRANCH: '' })).toEqual({ commit: null, branch: null });
  });

  it('fora do Render, `GIT_COMMIT` serve de escape', () => {
    expect(versaoEmExecucao({ GIT_COMMIT: 'abcdef1234', GIT_BRANCH: 'teste' })).toEqual({ commit: 'abcdef1', branch: 'teste' });
  });

  it('o nome do Render ganha do escape genérico', () => {
    expect(versaoEmExecucao({ RENDER_GIT_COMMIT: '1111111', GIT_COMMIT: '2222222' }).commit).toBe('1111111');
  });
});
