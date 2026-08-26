import { describe, expect, it } from 'vitest';

import { destinoDoPortao, ehRotaPublica, ROTAS_PUBLICAS } from './portao';

describe('ehRotaPublica', () => {
  it.each(ROTAS_PUBLICAS)('%s é pública', (rota) => {
    expect(ehRotaPublica(rota)).toBe(true);
  });

  it.each(['/menu', '/jogo', '/loja', '/amigos', '/multiplayer', '/personagens', '/personagens/novo', '/conta', '/configuracoes'])(
    '%s exige sessão',
    (rota) => {
      expect(ehRotaPublica(rota)).toBe(false);
    },
  );

  // O Next normaliza barra final com um 308 próprio, mas o proxy roda cedo
  // demais pra eu contar com isso. Sem esta linha, `/menu/` entraria.
  it('barra final não abre buraco', () => {
    expect(ehRotaPublica('/menu/')).toBe(false);
    expect(ehRotaPublica('/esqueci-senha/')).toBe(true);
  });

  it('a raiz sozinha continua pública — normalizar não pode comê-la', () => {
    expect(ehRotaPublica('/')).toBe(true);
  });

  /**
   * O ponto da lista de permitidos: uma tela que ninguém pensou em
   * classificar nasce **fechada**. Se um dia isto virar `true`, alguém
   * trocou a lista de quem passa por uma lista de quem é barrado.
   */
  it('tela inventada agora nasce fechada', () => {
    expect(ehRotaPublica('/tela-que-ainda-nao-existe')).toBe(false);
  });
});

describe('destinoDoPortao', () => {
  it('sem sessão, rota do jogo volta pro portão', () => {
    expect(destinoDoPortao('/menu', false)).toBe('/');
    expect(destinoDoPortao('/jogo', false)).toBe('/');
  });

  it('com sessão, passa', () => {
    expect(destinoDoPortao('/menu', true)).toBeNull();
  });

  /**
   * O caso que mais dói errar: estas são as telas de quem **não consegue**
   * entrar. Barrá-las prenderia a pessoa fora da conta pra sempre — o link
   * do e-mail cairia no portão, e o portão pediria justamente a sessão que
   * o link existe pra destravar.
   */
  it.each(['/confirmar-email', '/esqueci-senha', '/redefinir-senha'])('%s passa sem sessão — é o caminho de volta pra conta', (rota) => {
    expect(destinoDoPortao(rota, false)).toBeNull();
  });

  it('o portão não redireciona pra si mesmo', () => {
    expect(destinoDoPortao('/', false)).toBeNull();
  });
});
