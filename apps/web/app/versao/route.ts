/**
 * Qual build do front está no ar — o `/health` da API, do lado de cá.
 *
 * ## Por que existe
 *
 * Depois de empurrar o boneco que respira, não houve **como conferir de
 * fora** se o deploy pegou. Todas as telas que mostram o boneco estão
 * atrás do portão (`lib/auth/portao.ts`), e as rotas públicas que sobram
 * não desenham nenhum. Um `curl` só conseguia arrancar `307`.
 *
 * O selo verde de "Ready" na Vercel não serve de resposta pelo mesmo
 * motivo que não servia no Render: ele diz que *um* build terminou, não
 * que o build com a sua mudança é o que está respondendo agora. Foi
 * exatamente essa cegueira que deixou a compressão do socket e a
 * persistência de sala inertes em produção por dias, sem ninguém perceber
 * — e o conserto lá foi o `commit` no `/health`. Este é o mesmo conserto.
 *
 * ## O que responde
 *
 * As variáveis são injetadas pela Vercel em build e em execução. Fora dela
 * — `next dev` na sua máquina — não existem, e os campos vêm `null`. Isso
 * é resposta, não falha: `null` quer dizer "não é um deploy da Vercel".
 *
 * `GET` de route handler **não é cacheado** nesta versão do Next (ver
 * `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`),
 * então não precisa de `dynamic`. O `Cache-Control` é contra o que vem
 * depois: a borda da Vercel e o proxy da Cloudflare guardariam a resposta
 * e devolveriam o commit **anterior** justamente quando a pergunta é se o
 * novo subiu — um medidor que mente na única hora que importa.
 */

export async function GET() {
  return Response.json(
    {
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      ambiente: process.env.VERCEL_ENV ?? null,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
