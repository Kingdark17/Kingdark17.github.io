/**
 * Reprodução dirigida do crash da aba ao andar rápido entre salas.
 *
 * Existe porque o crash foi relatado três vezes com hipóteses diferentes e
 * nenhuma se sustentou na leitura do código. Este roteiro mede em vez de
 * supor: sobe uma partida de verdade e acompanha heap, nós do DOM e
 * ouvintes de evento passo a passo.
 *
 * As medidas vêm do CDP (`Performance.getMetrics`) — as mesmas linhas do
 * Performance monitor do DevTools. `performance.memory` só daria o heap, e
 * ouvinte esquecido não aparece nele.
 *
 * Roda contra **produção** no Opera GX com o perfil real, porque foi a
 * única variável que sobrou depois de a engine, o áudio, a tela e o
 * tamanho do save darem todos limpos em laboratório. Exige o Opera
 * **fechado**: o Chromium recusa perfil em uso.
 *
 * ATENÇÃO: anda com o personagem de verdade, e o jogo grava sozinho.
 *
 * Uso: node scripts/repro-crash.mjs [passos]
 */

import { chromium } from 'playwright';
import { homedir } from 'node:os';
import { join } from 'node:path';

const OPERA = 'C:/Users/Pdroc/AppData/Local/Programs/Opera GX/opera.exe';
const PERFIL = join(homedir(), 'AppData', 'Roaming', 'Opera Software', 'Opera GX Stable');
const JOGO = 'https://rpglegend.com.br/jogo?slot=1';
const PASSOS = Number(process.argv[2] || 500);

const TECLA_DA_DIRECAO = { Norte: 'w', Sul: 's', Leste: 'd', Oeste: 'a' };
const DIRECOES = Object.keys(TECLA_DA_DIRECAO);
/** Rótulos que fecham qualquer tela de sala, tirados dos componentes. */
const FECHAR = ['Sair', 'Continuar', 'Encerrar conversa', 'Fugir da Batalha', 'Fechar'];

const log = (...p) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...p);
const quantos = (localizador) => localizador.count().catch(() => 0);

async function clicar(localizador) {
  await localizador.first().click({ timeout: 1500 }).catch(() => {});
}

/**
 * O Opera navega pra própria página inicial ao abrir, e isso aborta a
 * primeira tentativa. Insistir é mais simples do que mexer na configuração
 * do perfil de alguém.
 */
async function abrirOJogo(page) {
  await page.waitForTimeout(6000);
  for (let tentativa = 1; tentativa <= 4; tentativa += 1) {
    try {
      await page.goto(JOGO, { waitUntil: 'domcontentloaded', timeout: 45000 });
      return true;
    } catch {
      log(`tentativa ${tentativa} de abrir falhou — repetindo`);
      await page.waitForTimeout(3000);
    }
  }
  return false;
}

function medidor(cdp) {
  return async () => {
    try {
      const { metrics } = await cdp.send('Performance.getMetrics');
      const pega = (n) => metrics.find((m) => m.name === n)?.value ?? -1;
      return {
        heap: Math.round(pega('JSHeapUsedSize') / 1048576),
        nos: pega('Nodes'),
        ouvintes: pega('JSEventListeners'),
      };
    } catch {
      return null;
    }
  };
}

const linha = (m) => (m ? `heap ${m.heap} MB | nós ${m.nos} | ouvintes ${m.ouvintes}` : 'SEM RESPOSTA');

/** Entra na sala quando o jogo pergunta e fecha o que abrir. Devolve o que aconteceu. */
async function atravessarDialogos(page) {
  const relato = { entrou: 0, abrindo: 0 };

  const sim = page.getByRole('button', { name: 'Sim', exact: true });
  if (await quantos(sim)) {
    await clicar(sim);
    relato.entrou = 1;
    await page.waitForTimeout(250);
  }

  // Se o pedaço da tela não chega, isto fica na tela pra sempre — foi o
  // sintoma relatado logo antes do crash.
  if (await quantos(page.getByText('Abrindo…'))) {
    relato.abrindo = 1;
    await page.waitForTimeout(1500);
  }

  for (const rotulo of FECHAR) {
    const botao = page.getByRole('button', { name: rotulo, exact: true });
    if (await quantos(botao)) {
      await clicar(botao);
      await page.waitForTimeout(200);
    }
  }

  return relato;
}

/** As direções com porta aberta agora. `null` quando a página não respondeu. */
function direcoesLivres(page) {
  return page
    .$$eval(
      'button[aria-label]',
      (botoes, nomes) => botoes.filter((b) => !b.disabled && nomes.includes(b.getAttribute('aria-label'))).map((b) => b.getAttribute('aria-label')),
      DIRECOES,
    )
    .catch(() => null);
}

async function main() {
  const contexto = await chromium.launchPersistentContext(PERFIL, { executablePath: OPERA, headless: false, viewport: null });
  const page = contexto.pages()[0] ?? (await contexto.newPage());

  let morreu = false;
  const erros = new Set();

  page.on('crash', () => {
    morreu = true;
    log('!!! A ABA MORREU');
  });
  page.on('pageerror', (e) => {
    erros.add(String(e));
    log('ERRO DE PÁGINA:', String(e).slice(0, 250));
  });
  page.on('console', (m) => {
    if (m.type() === 'error') erros.add(m.text());
  });

  log('abrindo o jogo (a API leva ~7 s, então a espera é longa de propósito)');
  if (!(await abrirOJogo(page))) {
    log('não consegui abrir o jogo');
    await contexto.close();
    return;
  }
  await page.waitForTimeout(15000);

  if (!page.url().includes('/jogo')) {
    log('caiu fora do jogo — sessão não veio. URL:', page.url());
    await contexto.close();
    return;
  }

  const cdp = await contexto.newCDPSession(page);
  await cdp.send('Performance.enable');
  const medir = medidor(cdp);

  const inicio = await medir();
  log('inicial:', linha(inicio));

  let entrou = 0;
  let abrindo = 0;

  for (let passo = 1; passo <= PASSOS && !morreu; passo += 1) {
    const relato = await atravessarDialogos(page);
    entrou += relato.entrou;
    abrindo += relato.abrindo;

    const livres = await direcoesLivres(page);
    if (livres === null) {
      log(`passo ${passo}: página parou de responder`);
      morreu = true;
      break;
    }
    if (livres.length === 0) {
      await page.waitForTimeout(300);
      continue;
    }

    await page.keyboard.press(TECLA_DA_DIRECAO[livres[passo % livres.length]]).catch(() => {});
    await page.waitForTimeout(45);

    if (passo % 30 === 0) {
      const m = await medir();
      log(`passo ${passo}:`, linha(m));
      if (!m) morreu = true;
    }
  }

  log('---------- fim ----------');
  log(`entrou em ${entrou} sala(s) | "Abrindo…" ${abrindo}x | morreu: ${morreu}`);
  log('inicial:', linha(inicio));
  log('final:  ', linha(await medir()));
  log('erros distintos:', erros.size);
  for (const e of [...erros].slice(0, 12)) log('  •', e.slice(0, 220));

  await page.waitForTimeout(1500);
  await contexto.close();
}

await main();
