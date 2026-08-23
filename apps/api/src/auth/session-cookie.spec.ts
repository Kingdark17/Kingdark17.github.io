import type { Request } from 'express';

import { NOME_DO_COOKIE, extrairTokenDaSessao, lerTokenDoCookie, opcoesDeRemocao, opcoesDoCookie } from './session-cookie';
import { SESSION_TTL_MS, generateSessionToken } from './tokens';

const TOKEN = 'a'.repeat(64);

/** Só o que `extrairTokenDaSessao` lê, pra o teste não montar um Request inteiro. */
const requisicao = (headers: { cookie?: string; authorization?: string }) => ({ headers }) as Request;

describe('lerTokenDoCookie', () => {
  it('acha o cookie sozinho ou no meio de outros', () => {
    expect(lerTokenDoCookie(`${NOME_DO_COOKIE}=${TOKEN}`)).toBe(TOKEN);
    expect(lerTokenDoCookie(`tema=escuro; ${NOME_DO_COOKIE}=${TOKEN}; idioma=pt`)).toBe(TOKEN);
    expect(lerTokenDoCookie(`   ${NOME_DO_COOKIE}=${TOKEN}   `)).toBe(TOKEN);
  });

  it('devolve vazio quando não há cookie nenhum', () => {
    expect(lerTokenDoCookie(undefined)).toBe('');
    expect(lerTokenDoCookie('')).toBe('');
    expect(lerTokenDoCookie('tema=escuro')).toBe('');
  });

  it('não confunde com um cookie de nome parecido', () => {
    expect(lerTokenDoCookie(`x_${NOME_DO_COOKIE}=${TOKEN}`)).toBe('');
    expect(lerTokenDoCookie(`${NOME_DO_COOKIE}_antigo=${TOKEN}`)).toBe('');
  });

  // O formato é fechado (32 bytes em hex). Aceitar valor fora dele seria
  // repassar entrada de terceiro pro `me()` — e o cookie é escrito por
  // qualquer script do domínio, então não é entrada confiável.
  it('rejeita o que não tem a cara de um token', () => {
    expect(lerTokenDoCookie(`${NOME_DO_COOKIE}=`)).toBe('');
    expect(lerTokenDoCookie(`${NOME_DO_COOKIE}=abc`)).toBe('');
    expect(lerTokenDoCookie(`${NOME_DO_COOKIE}=${'a'.repeat(63)}`)).toBe('');
    expect(lerTokenDoCookie(`${NOME_DO_COOKIE}=${'a'.repeat(65)}`)).toBe('');
    expect(lerTokenDoCookie(`${NOME_DO_COOKIE}=${'A'.repeat(64)}`)).toBe('');
    expect(lerTokenDoCookie(`${NOME_DO_COOKIE}=${'z'.repeat(64)}`)).toBe('');
    expect(lerTokenDoCookie(`${NOME_DO_COOKIE}=<script>alert(1)</script>`)).toBe('');
  });

  it('aceita o que generateSessionToken emite de verdade', () => {
    const emitido = generateSessionToken();
    expect(lerTokenDoCookie(`${NOME_DO_COOKIE}=${emitido}`)).toBe(emitido);
  });
});

describe('extrairTokenDaSessao', () => {
  const outro = 'b'.repeat(64);

  it('prefere o cookie ao header', () => {
    const req = requisicao({ cookie: `${NOME_DO_COOKIE}=${TOKEN}`, authorization: `Bearer ${outro}` });
    expect(extrairTokenDaSessao(req)).toBe(TOKEN);
  });

  it('cai no Bearer quando não há cookie — é o que segura o cliente antigo', () => {
    expect(extrairTokenDaSessao(requisicao({ authorization: `Bearer ${outro}` }))).toBe(outro);
  });

  // Cookie presente mas corrompido não pode "vencer" e derrubar a
  // autenticação de quem mandou um Bearer bom junto.
  it('cai no Bearer quando o cookie existe mas está fora do formato', () => {
    const req = requisicao({ cookie: `${NOME_DO_COOKIE}=lixo`, authorization: `Bearer ${outro}` });
    expect(extrairTokenDaSessao(req)).toBe(outro);
  });

  it('devolve vazio quando não veio nada', () => {
    expect(extrairTokenDaSessao(requisicao({}))).toBe('');
  });
});

describe('opcoesDoCookie', () => {
  const ambiente = { ...process.env };
  afterEach(() => {
    process.env = { ...ambiente };
  });

  it('em desenvolvimento não pede Secure nem domínio', () => {
    delete process.env.COOKIE_SECURE;
    delete process.env.COOKIE_DOMAIN;
    const opcoes = opcoesDoCookie();
    expect(opcoes.secure).toBe(false);
    expect(opcoes).not.toHaveProperty('domain');
  });

  it('sempre httpOnly — é o ponto todo da mudança', () => {
    expect(opcoesDoCookie().httpOnly).toBe(true);
  });

  it('a validade do cookie é a mesma da sessão no banco', () => {
    expect(opcoesDoCookie().maxAge).toBe(SESSION_TTL_MS);
  });

  it('em produção liga Secure e o domínio declarado', () => {
    process.env.COOKIE_SECURE = 'true';
    process.env.COOKIE_DOMAIN = '.rpglegend.com.br';
    const opcoes = opcoesDoCookie();
    expect(opcoes.secure).toBe(true);
    expect(opcoes.domain).toBe('.rpglegend.com.br');
  });

  it('só o literal "true" liga o Secure', () => {
    process.env.COOKIE_SECURE = 'sim';
    expect(opcoesDoCookie().secure).toBe(false);
  });

  // O navegador casa o cookie a apagar por nome + domínio + caminho. Se a
  // remoção mandar atributos diferentes da emissão, o cookie sobrevive e o
  // jogador continua logado depois de clicar em "Sair".
  it('a remoção repete os atributos da emissão, menos o tempo', () => {
    process.env.COOKIE_DOMAIN = '.rpglegend.com.br';
    const { maxAge, ...emissao } = opcoesDoCookie();
    expect(maxAge).toBeGreaterThan(0);
    expect(opcoesDeRemocao()).toEqual(emissao);
  });
});
