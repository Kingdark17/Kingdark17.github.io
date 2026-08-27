/**
 * Qual commit está no ar — a pergunta que o `/health` não sabia responder.
 *
 * O campo `version` sempre respondeu `nest-phase-2`, uma constante escrita
 * à mão. Serve pra dizer "sou a API nova"; não serve pra nada que importe
 * na hora de conferir um deploy, porque ele responde a mesma coisa tanto
 * pro commit de hoje quanto pro de duas semanas atrás.
 *
 * Isso já custou caro duas vezes. Uma feature ficou marcada como "no ar"
 * sem estar, e não deu pra separar "o deploy não pegou" de "o Cloudflare
 * mexeu no caminho" — as duas hipóteses parecem idênticas de fora quando o
 * servidor não diz quem ele é. O jeito de conferir era abrir a aba Deploys
 * do painel e ler o SHA, e um selo verde de "Live" ali não prova que a
 * variável de ambiente que você acabou de mexer entrou.
 *
 * O Render injeta `RENDER_GIT_COMMIT` e `RENDER_GIT_BRANCH` no build e no
 * runtime, sem configuração nenhuma. `GIT_COMMIT`/`GIT_BRANCH` ficam como
 * escape pra rodar isto em qualquer outro lugar.
 *
 * **Ausente vira `null`, não vira string vazia nem `undefined`.** `null`
 * aparece no JSON e denuncia a si mesmo; `undefined` some do corpo e
 * pareceria que o campo nunca existiu — que é exatamente o tipo de falha
 * silenciosa que este arquivo existe pra acabar.
 */

/** O suficiente pra casar com o SHA curto que o painel e o `git log` mostram. */
const TAMANHO_CURTO = 7;

export interface VersaoEmExecucao {
  commit: string | null;
  branch: string | null;
}

function texto(valor: string | undefined): string | null {
  const limpo = (valor ?? '').trim();
  return limpo || null;
}

/** `env` entra por parâmetro pra o teste não precisar mexer no `process.env`. */
export function versaoEmExecucao(env: NodeJS.ProcessEnv = process.env): VersaoEmExecucao {
  const commit = texto(env.RENDER_GIT_COMMIT ?? env.GIT_COMMIT);

  return {
    commit: commit && commit.slice(0, TAMANHO_CURTO),
    branch: texto(env.RENDER_GIT_BRANCH ?? env.GIT_BRANCH),
  };
}
