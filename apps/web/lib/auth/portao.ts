/**
 * Quem entra sem sessão, e quem não entra.
 *
 * Mora aqui, e não dentro do `proxy.ts`, por dois motivos. O vitest deste
 * pacote só enxerga `lib/**\/*.test.ts`, então regra escrita no arquivo de
 * proxy seria regra sem teste. E a doc do `proxy` pede que ele não dependa
 * de módulo com estado — este não tem nenhum: função pura, sem React, sem
 * DOM, sem Node.
 *
 * **A lista é de quem passa, não de quem é barrado.** A diferença importa:
 * com lista de barrados, cada tela nova nasce aberta e só fecha se alguém
 * lembrar de acrescentá-la. Assim, tela nova nasce fechada e só abre por
 * decisão explícita — que é o lado certo pra errar.
 */

/**
 * O que passa sem sessão.
 *
 * `/` é o portão. As três seguintes são pontas de link de e-mail ou
 * caminho até um: barrar qualquer uma delas quebraria a confirmação de
 * conta e a redefinição de senha — que é exatamente o momento em que a
 * pessoa não consegue entrar.
 *
 * `/versao` é a última, e é a única que não é tela: ela diz qual build
 * está no ar (ver `app/versao/route.ts`). Precisa ser pública porque a
 * pergunta que ela responde — "o deploy pegou?" — costuma ser feita
 * justamente de fora, por quem não tem sessão nenhuma, e um `307` não
 * responde. Não expõe nada: o commit é de repositório público.
 */
export const ROTAS_PUBLICAS: readonly string[] = ['/', '/confirmar-email', '/esqueci-senha', '/redefinir-senha', '/versao'];

/**
 * Tira a barra final antes de comparar. O Next normaliza isso com um 308
 * próprio, mas o proxy roda cedo demais pra eu garantir de que lado da
 * normalização ele cai — e `/menu/` escapando do portão seria um buraco
 * que ninguém encontraria de propósito.
 */
function normalizar(caminho: string): string {
  if (caminho.length > 1 && caminho.endsWith('/')) return caminho.slice(0, -1);
  return caminho;
}

export function ehRotaPublica(caminho: string): boolean {
  return ROTAS_PUBLICAS.includes(normalizar(caminho));
}

/** Onde o portão guarda de onde a pessoa veio. */
export const PARAMETRO_DE_VOLTA = 'de';

/** Quem entra sem ter sido barrado antes vai pro menu. */
export const DESTINO_PADRAO = '/menu';

/**
 * Base impossível de existir, usada só pra resolver um caminho relativo e
 * perguntar se ele continua apontando pra cá.
 */
const BASE_INVENTADA = 'http://portao.invalido';

/**
 * Para onde mandar quem acabou de entrar, dado o `?de=` que veio na URL.
 *
 * **Isto é uma barreira de redirecionamento aberto, não uma conveniência.**
 * O valor vem da barra de endereço, então qualquer um consegue montar
 * `/?de=https://site-falso/entre` e mandar pro seu jogador. Ele veria o
 * portão legítimo, no domínio legítimo, digitaria a senha certa — e seria
 * cuspido num clone. É assim que se rouba conta sem invadir nada.
 *
 * A defesa é resolver o valor contra uma base inventada e exigir que a
 * origem continue sendo ela. Isso derruba de uma vez `https://outro`,
 * `//outro` (que herda o esquema) e `/\outro` — a barra invertida vira
 * barra na normalização de URL, então o terceiro é o segundo disfarçado.
 * Testar prefixo à mão pega os dois primeiros e esquece o terceiro.
 *
 * Voltar pra uma rota pública também é recusado: mandar de volta pro
 * portão depois de entrar é laço, e é o que `?de=/` pediria.
 */
export function rotaDeVolta(cru: string | undefined): string {
  if (!cru?.startsWith('/')) return DESTINO_PADRAO;

  let alvo: URL;
  try {
    alvo = new URL(cru, BASE_INVENTADA);
  } catch {
    return DESTINO_PADRAO;
  }

  if (alvo.origin !== BASE_INVENTADA) return DESTINO_PADRAO;
  if (ehRotaPublica(alvo.pathname)) return DESTINO_PADRAO;

  return `${alvo.pathname}${alvo.search}`;
}

/**
 * Pra onde mandar quem pediu `caminho`, ou `null` pra deixar passar.
 *
 * `temSessao` é **presença de cookie, não sessão válida**, e isso é
 * deliberado. Validar de verdade custaria uma chamada à API a cada
 * navegação, e a API está no plano free do Render, que hiberna e demora
 * até 50 segundos pra acordar — o portão viraria a coisa mais lenta do
 * jogo. A validação de verdade continua onde sempre esteve: a API responde
 * 401, e o `/` confere pelo `usuarioDaSessao()` antes de mostrar o
 * formulário.
 *
 * Cookie **vencido** passa por aqui, porque daqui ele é indistinguível de
 * um válido. Quem fecha esse buraco é o `chamarApi`: o primeiro 401 numa
 * rota autenticada devolve a pessoa pro portão, pelo mesmo `?de=` que esta
 * função monta. Os dois caminhos convergem de propósito.
 *
 * O `?de=` leva caminho **e** busca: quem clicou em `/loja?item=42` volta
 * pro item, não pra vitrine.
 */
export function destinoDoPortao(caminho: string, busca: string, temSessao: boolean): string | null {
  if (ehRotaPublica(caminho)) return null;
  if (temSessao) return null;
  const de = encodeURIComponent(caminho + busca);
  return `/?${PARAMETRO_DE_VOLTA}=${de}`;
}
