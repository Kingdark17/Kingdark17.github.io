/**
 * A sessão em cookie contra Postgres de verdade, pela porta que o navegador
 * usa: `Set-Cookie` no login, cookie autenticando rota protegida, e o
 * cookie caindo no logout.
 *
 * Os testes de unidade em `session-cookie.spec.ts` cobrem o parsing e as
 * opções. O que se verifica aqui é a **fiação** — que o controller de fato
 * emite, que o guard de fato aceita, e que os dois falam do mesmo cookie.
 * Nenhum teste de unidade pega um `Set-Cookie` que nunca foi enviado.
 */

import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { AppModule } from '../app.module';
import { configureApp } from '../bootstrap';
import { NOME_DO_COOKIE } from '../auth/session-cookie';
import { startPglite, type PgliteHarness } from './testing/pglite-harness';
import { servidorDe } from '../testing/servidor';

jest.setTimeout(60_000);

let harness: PgliteHarness;
let app: NestExpressApplication;

const CREDENCIAIS = { username: 'aria', email: 'aria@exemplo.com', password: 'segredo123' };

/** O `Set-Cookie` da sessão, cru, ou `undefined` se a resposta não trouxe. */
function cookieDaResposta(resposta: request.Response): string | undefined {
  const cabecalho: unknown = resposta.headers['set-cookie'];
  const lista = (Array.isArray(cabecalho) ? cabecalho : [cabecalho]).map(String).filter(Boolean);
  return lista.find((linha) => linha.startsWith(`${NOME_DO_COOKIE}=`));
}

/** Só o `nome=valor`, que é o que o navegador manda de volta. */
function paraEnviar(bruto: string): string {
  return bruto.split(';')[0];
}

beforeAll(async () => {
  harness = await startPglite();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = configureApp(moduleRef.createNestApplication<NestExpressApplication>());
  await app.init();
});

beforeEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await app.close();
  await harness.stop();
});

describe('sessão em cookie', () => {
  it('o cadastro já devolve o cookie — ninguém precisa logar depois de criar conta', async () => {
    const resposta = await request(servidorDe(app)).post('/api/account/register').send(CREDENCIAIS);

    expect(resposta.status).toBe(201);
    expect(cookieDaResposta(resposta)).toBeDefined();
  });

  it('o login devolve o cookie com os atributos que protegem a sessão', async () => {
    await request(servidorDe(app)).post('/api/account/register').send(CREDENCIAIS);
    const resposta = await request(servidorDe(app))
      .post('/api/account/login')
      .send({ username: CREDENCIAIS.username, password: CREDENCIAIS.password });

    expect(resposta.status).toBe(200);
    const cookie = cookieDaResposta(resposta);
    expect(cookie).toBeDefined();

    // HttpOnly é o ponto todo: sem ele, o cookie é legível por XSS e a
    // mudança não teria valido nada.
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//i);
  });

  it('o cookie sozinho autentica rota protegida, sem header nenhum', async () => {
    const registro = await request(servidorDe(app)).post('/api/account/register').send(CREDENCIAIS);
    const cookie = paraEnviar(cookieDaResposta(registro)!);

    const eu = await request(servidorDe(app)).get('/api/account/me').set('Cookie', cookie);

    expect(eu.status).toBe(200);
    expect((eu.body as { user: { username: string } }).user.username).toBe(CREDENCIAIS.username);
  });

  it('sem cookie e sem header, a mesma rota responde 401', async () => {
    await request(servidorDe(app)).post('/api/account/register').send(CREDENCIAIS);
    expect((await request(servidorDe(app)).get('/api/account/me')).status).toBe(401);
  });

  // O header continua valendo enquanto o cliente antigo e o evento `auth`
  // do socket mandarem token na mão. Cortar isso quebraria os dois.
  it('o Bearer continua funcionando — a transição não derruba quem ainda usa header', async () => {
    const registro = await request(servidorDe(app)).post('/api/account/register').send(CREDENCIAIS);
    const token = (registro.body as { token: string }).token;

    const eu = await request(servidorDe(app)).get('/api/account/me').set('Authorization', `Bearer ${token}`);

    expect(eu.status).toBe(200);
  });

  it('o logout apaga o cookie e a sessão morre de verdade', async () => {
    const registro = await request(servidorDe(app)).post('/api/account/register').send(CREDENCIAIS);
    const cookie = paraEnviar(cookieDaResposta(registro)!);

    const saida = await request(servidorDe(app)).post('/api/account/logout').set('Cookie', cookie);
    expect(saida.status).toBe(200);

    // Duas coisas separadas, e as duas importam: o navegador recebe ordem
    // de descartar, e o token não vale mais nem se alguém o tiver copiado.
    expect(cookieDaResposta(saida)).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
    expect((await request(servidorDe(app)).get('/api/account/me').set('Cookie', cookie)).status).toBe(401);
  });

  it('cookie com valor fora do formato é tratado como ausência, não como erro', async () => {
    await request(servidorDe(app)).post('/api/account/register').send(CREDENCIAIS);

    const eu = await request(servidorDe(app)).get('/api/account/me').set('Cookie', `${NOME_DO_COOKIE}=nao-e-um-token`);

    expect(eu.status).toBe(401);
  });
});
