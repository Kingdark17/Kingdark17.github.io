import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * `/rpg-legend/*` era o endereço do jogo antigo no apex, e continua
   * existindo em link salvo e em e-mail já enviado. Quando o apex passar a
   * servir este app, esse caminho viraria 404 — então ele vem parar aqui.
   *
   * **O motivo mais forte não é favorito de navegador: é e-mail.** O link de
   * confirmação de conta é `PUBLIC_GAME_URL/?verify=TOKEN`, e o padrão em
   * `email-templates.ts` é `https://rpglegend.com.br/rpg-legend/`. Todo
   * e-mail já enviado e ainda não aberto aponta pra lá. Sem este redirect,
   * quem clicasse depois da virada cairia num 404 e a conta ficaria presa
   * sem confirmar — sem erro na tela, sem ninguém saber.
   *
   * A query string é preservada sozinha (verificado na doc da versão que
   * está instalada, não de memória), então `?verify=` e `?reset=` chegam
   * inteiros na raiz, que é onde `app/page.tsx` os lê.
   *
   * `:resto*` casa `/rpg-legend` e qualquer coisa abaixo dele.
   *
   * `permanent: false` (307) de propósito: 308 fica gravado no navegador
   * pra sempre, e se um dia a virada precisar voltar atrás, cada jogador
   * que tivesse aberto o link continuaria sendo redirecionado por um cache
   * que ninguém consegue limpar.
   *
   * **Medido, e o 307 não governa o caminho inteiro.** Com a barra final —
   * que é a forma dos links de e-mail — são dois saltos:
   *
   *     /rpg-legend/?verify=X  --308--> /rpg-legend?verify=X  --307--> /?verify=X
   *
   * O primeiro é a normalização de barra final do próprio Next, e ela é
   * **308 permanente**, fora do controle desta regra. O token sobrevive aos
   * dois saltos, que era o que importava.
   *
   * O resíduo: se a virada voltar atrás e o apex retornar ao GitHub Pages,
   * um navegador que guardou esse 308 entra em laço — ele reescreve
   * `/rpg-legend/` pra `/rpg-legend`, e o Pages responde 301 de volta pra
   * `/rpg-legend/`. Some limpando os dados do site.
   *
   * Dava pra evitar com `skipTrailingSlashRedirect: true`, mas isso desliga
   * a normalização no app inteiro — mudança global por um caso de borda de
   * rollback. Fica anotado em vez de consertado.
   */
  async redirects() {
    return [
      {
        source: '/rpg-legend/:resto*',
        destination: '/',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
