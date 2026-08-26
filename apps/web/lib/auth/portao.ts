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
 * As quatro telas que existem justamente pra quem **não** tem sessão.
 *
 * `/` é o portão. As outras três são pontas de link de e-mail ou caminho
 * até um: barrar qualquer uma delas quebraria a confirmação de conta e a
 * redefinição de senha — que é exatamente o momento em que a pessoa não
 * consegue entrar.
 */
export const ROTAS_PUBLICAS: readonly string[] = ['/', '/confirmar-email', '/esqueci-senha', '/redefinir-senha'];

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
 * O resíduo, anotado de propósito: cookie **vencido** passa pelo portão e
 * a pessoa chega no menu, onde as chamadas falham com "Entre na sua conta
 * para continuar." em vez de voltar pro login sozinha. É o mesmo
 * comportamento de hoje, não uma piora — mas é o próximo buraco a fechar.
 */
export function destinoDoPortao(caminho: string, temSessao: boolean): string | null {
  if (ehRotaPublica(caminho)) return null;
  if (temSessao) return null;
  return '/';
}
