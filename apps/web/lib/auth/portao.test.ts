import { describe, expect, it } from 'vitest';

import { DESTINO_PADRAO, destinoDoPortao, ehRotaPublica, rotaDeVolta, ROTAS_PUBLICAS } from './portao';

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

  /**
   * A lista inteira, escrita à mão.
   *
   * Os testes acima percorrem `ROTAS_PUBLICAS`, então **acrescentar** uma
   * rota a ela passa sozinho — a suíte só provaria que a rota nova é
   * pública, que é o que quem a acrescentou já queria. Este aqui obriga a
   * edição a ser deliberada: abrir uma tela sem sessão passa a exigir
   * mexer no teste e escrever o motivo, que é o preço certo pra tirar o
   * cadeado de alguma coisa.
   */
  it('abrir rota nova exige mexer aqui também', () => {
    expect([...ROTAS_PUBLICAS]).toEqual(['/', '/confirmar-email', '/esqueci-senha', '/redefinir-senha', '/versao']);
  });
});

describe('rotaDeVolta', () => {
  it('devolve o caminho local, com busca', () => {
    expect(rotaDeVolta('/loja')).toBe('/loja');
    expect(rotaDeVolta('/loja?item=42')).toBe('/loja?item=42');
    expect(rotaDeVolta('/personagens/novo')).toBe('/personagens/novo');
  });

  it('sem parâmetro, vai pro menu', () => {
    expect(rotaDeVolta(undefined)).toBe(DESTINO_PADRAO);
    expect(rotaDeVolta('')).toBe(DESTINO_PADRAO);
  });

  /**
   * O teste que justifica a função existir.
   *
   * Este parâmetro vem da barra de endereço. Sem a barreira, alguém manda
   * `/?de=https://site-falso/entre` pro seu jogador: ele vê o portão
   * legítimo, no domínio legítimo, digita a senha certa — e é cuspido num
   * clone que a recebe. Rouba-se a conta sem invadir nada.
   *
   * `/\outro` está aqui porque é o caso que a checagem ingênua esquece: a
   * normalização de URL troca barra invertida por barra, então ele é
   * `//outro` disfarçado, e um `startsWith('//')` passa por ele.
   */
  it.each([
    'https://site-falso.com/entre',
    'http://site-falso.com',
    '//site-falso.com',
    '/\\site-falso.com',
    '/\\/site-falso.com',
    'javascript:alert(1)',
    'site-falso.com',
  ])('recusa %s — isto é roubo de senha, não caminho', (cru) => {
    expect(rotaDeVolta(cru)).toBe(DESTINO_PADRAO);
  });

  it('não volta pra rota pública — seria laço com o portão', () => {
    expect(rotaDeVolta('/')).toBe(DESTINO_PADRAO);
    expect(rotaDeVolta('/esqueci-senha')).toBe(DESTINO_PADRAO);
  });
});

describe('destinoDoPortao', () => {
  it('sem sessão, rota do jogo volta pro portão levando de onde veio', () => {
    expect(destinoDoPortao('/menu', '', false)).toBe('/?de=%2Fmenu');
    expect(destinoDoPortao('/jogo', '', false)).toBe('/?de=%2Fjogo');
  });

  it('a busca vai junto — quem clicou num item volta pro item', () => {
    expect(destinoDoPortao('/loja', '?item=42', false)).toBe('/?de=%2Floja%3Fitem%3D42');
  });

  /** O `?de=` só vale se voltar inteiro. Ida e volta, na mesma suíte. */
  it('o que o portão monta é o que a volta aceita', () => {
    const montado = destinoDoPortao('/loja', '?item=42', false);
    const de = new URLSearchParams(montado!.slice(1)).get('de');
    expect(rotaDeVolta(de ?? undefined)).toBe('/loja?item=42');
  });

  it('com sessão, passa', () => {
    expect(destinoDoPortao('/menu', '', true)).toBeNull();
  });

  /**
   * O caso que mais dói errar: estas são as telas de quem **não consegue**
   * entrar. Barrá-las prenderia a pessoa fora da conta pra sempre — o link
   * do e-mail cairia no portão, e o portão pediria justamente a sessão que
   * o link existe pra destravar.
   */
  it.each(['/confirmar-email', '/esqueci-senha', '/redefinir-senha'])('%s passa sem sessão — é o caminho de volta pra conta', (rota) => {
    expect(destinoDoPortao(rota, '', false)).toBeNull();
  });

  it('o portão não redireciona pra si mesmo', () => {
    expect(destinoDoPortao('/', '', false)).toBeNull();
  });

  /**
   * O link de e-mail chega como `/?verify=TOKEN`, e a raiz é pública — mas
   * se um dia alguém a fechasse, o token viraria `?de=` e o portão pediria
   * a sessão que o link existe justamente pra destravar.
   */
  it('link de e-mail na raiz passa com a busca intacta', () => {
    expect(destinoDoPortao('/', '?verify=TOKEN123', false)).toBeNull();
    expect(destinoDoPortao('/', '?reset=TOKEN456', false)).toBeNull();
  });
});
