import { ArmazenamentoNoSupabase, ArmazenamentoNulo, caminhoDaFoto, caminhoDoEndereco, criarArmazenamento } from './armazenamento';

const CHAVE = 'chave-secreta-que-nao-pode-vazar';

function espiao(resposta: Partial<Response> = {}) {
  const chamadas: { url: string; init: RequestInit }[] = [];
  const buscar = (url: string, init: RequestInit) => {
    chamadas.push({ url, init });
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(''), json: () => Promise.resolve([]), ...resposta } as Response);
  };

  return { chamadas, buscar };
}

function comBalde(resposta?: Partial<Response>) {
  const { chamadas, buscar } = espiao(resposta);
  return { chamadas, armazenamento: new ArmazenamentoNoSupabase({ url: 'https://projeto.supabase.co', chave: CHAVE, balde: 'avatares', buscar }) };
}

describe('caminhoDaFoto', () => {
  it('o nome é o hash do conteúdo, então foto igual dá caminho igual', () => {
    const bytes = Buffer.from('uma foto');

    expect(caminhoDaFoto(7, bytes, 'image/png')).toBe(caminhoDaFoto(7, Buffer.from('uma foto'), 'image/png'));
  });

  it('foto diferente dá caminho diferente — é o que permite cache eterno', () => {
    expect(caminhoDaFoto(7, Buffer.from('uma foto'), 'image/png')).not.toBe(caminhoDaFoto(7, Buffer.from('outra'), 'image/png'));
  });

  /**
   * Sem o id no caminho, duas pessoas com a mesma foto dividiriam o mesmo
   * objeto — e a faxina de uma apagaria a foto da outra.
   */
  it('pessoas diferentes com a mesma foto não dividem o objeto', () => {
    const bytes = Buffer.from('a mesma foto');

    expect(caminhoDaFoto(7, bytes, 'image/png')).not.toBe(caminhoDaFoto(8, bytes, 'image/png'));
  });

  it('a extensão acompanha o tipo', () => {
    const bytes = Buffer.from('x');

    expect(caminhoDaFoto(1, bytes, 'image/png')).toMatch(/\.png$/);
    expect(caminhoDaFoto(1, bytes, 'image/webp')).toMatch(/\.webp$/);
    expect(caminhoDaFoto(1, bytes, 'image/jpeg')).toMatch(/\.jpg$/);
  });
});

describe('ArmazenamentoNoSupabase', () => {
  it('sobe no balde certo e devolve o endereço público', async () => {
    const { chamadas, armazenamento } = comBalde();

    const endereco = await armazenamento.guardar('7/abc.png', Buffer.from('bytes'), 'image/png');

    expect(chamadas[0].url).toBe('https://projeto.supabase.co/storage/v1/object/avatares/7/abc.png');
    expect(endereco).toBe('https://projeto.supabase.co/storage/v1/object/public/avatares/7/abc.png');
  });

  /** O nome é o hash: reenviar a mesma foto tem que cair no mesmo objeto. */
  it('usa upsert, senão reenviar a mesma foto viraria erro', async () => {
    const { chamadas, armazenamento } = comBalde();

    await armazenamento.guardar('7/abc.png', Buffer.from('bytes'), 'image/png');

    expect((chamadas[0].init.headers as Record<string, string>)['x-upsert']).toBe('true');
  });

  it('pede cache eterno, que é o ponto do nome por hash', async () => {
    const { chamadas, armazenamento } = comBalde();

    await armazenamento.guardar('7/abc.png', Buffer.from('bytes'), 'image/png');

    expect((chamadas[0].init.headers as Record<string, string>)['cache-control']).toContain('immutable');
  });

  it('barra sobrando na URL não vira barra dobrada no endereço', () => {
    const { buscar } = espiao();
    const armazenamento = new ArmazenamentoNoSupabase({ url: 'https://projeto.supabase.co///', chave: CHAVE, balde: 'avatares', buscar });

    expect(armazenamento.endereco('7/a.png')).toBe('https://projeto.supabase.co/storage/v1/object/public/avatares/7/a.png');
  });

  /**
   * A mensagem de erro pode acabar num log. A chave só existe no
   * cabeçalho, e é assim que precisa continuar.
   */
  it('recusa do Storage vira erro sem a chave dentro', async () => {
    const { armazenamento } = comBalde({ ok: false, status: 403, text: () => Promise.resolve('acesso negado') });

    await expect(armazenamento.guardar('7/a.png', Buffer.from('b'), 'image/png')).rejects.toThrow(/403/);
    await expect(armazenamento.guardar('7/a.png', Buffer.from('b'), 'image/png')).rejects.not.toThrow(new RegExp(CHAVE));
  });

  it('listar devolve os caminhos completos, não só os nomes', async () => {
    const { armazenamento } = comBalde({ json: () => Promise.resolve([{ name: 'abc.png' }, { name: 'def.png' }]) });

    expect(await armazenamento.listar('7/')).toEqual(['7/abc.png', '7/def.png']);
  });

  it('listar com o Storage fora do ar devolve lista vazia, não estoura', async () => {
    const quebrado = (() => Promise.reject(new Error('rede'))) as unknown as typeof fetch;
    const armazenamento = new ArmazenamentoNoSupabase({ url: 'https://x.co', chave: CHAVE, balde: 'b', buscar: quebrado });

    await expect(armazenamento.listar('7/')).resolves.toEqual([]);
  });

  it('apagar não estoura quando o Storage recusa', async () => {
    const quebrado = (() => Promise.reject(new Error('rede'))) as unknown as typeof fetch;
    const armazenamento = new ArmazenamentoNoSupabase({ url: 'https://x.co', chave: CHAVE, balde: 'b', buscar: quebrado });

    await expect(armazenamento.apagar('7/a.png')).resolves.toBeUndefined();
  });
});

describe('criarArmazenamento — o caminho sem as variáveis', () => {
  it('sem SUPABASE_URL cai no nulo', () => {
    expect(criarArmazenamento({ SUPABASE_SERVICE_KEY: CHAVE })).toBeInstanceOf(ArmazenamentoNulo);
  });

  it('sem a chave cai no nulo — meia configuração não vale', () => {
    expect(criarArmazenamento({ SUPABASE_URL: 'https://x.co' })).toBeInstanceOf(ArmazenamentoNulo);
  });

  it('com as duas, é o do Supabase', () => {
    expect(criarArmazenamento({ SUPABASE_URL: 'https://x.co', SUPABASE_SERVICE_KEY: CHAVE })).toBeInstanceOf(ArmazenamentoNoSupabase);
  });

  it('o balde tem padrão, pra não exigir uma terceira variável', () => {
    const armazenamento = criarArmazenamento({ SUPABASE_URL: 'https://x.co', SUPABASE_SERVICE_KEY: CHAVE });

    expect(armazenamento.endereco('a.png')).toContain('/avatares/');
  });
});

describe('caminhoDoEndereco', () => {
  it('reconhece endereço nosso', () => {
    const { armazenamento } = comBalde();

    expect(caminhoDoEndereco(armazenamento.endereco('7/a.png'), armazenamento)).toBe('7/a.png');
  });

  /** Link que a pessoa digitou não é nosso, e apagar não faria sentido. */
  it('link de outro site não é nosso', () => {
    const { armazenamento } = comBalde();

    expect(caminhoDoEndereco('https://outro.site/foto.png', armazenamento)).toBeNull();
  });

  it('com armazenamento nulo, nada é nosso', () => {
    expect(caminhoDoEndereco('https://outro.site/foto.png', new ArmazenamentoNulo())).toBeNull();
  });
});
