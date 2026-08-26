import { redirect } from 'next/navigation';

import { rotaDoLinkDeEmail } from '@/lib/api/email';
import { usuarioDaSessao } from '@/lib/api/sessao-servidor';
import { Entrada } from './entrada';
import styles from './entrada.module.css';

/**
 * O portão: primeira tela de quem abre o jogo.
 *
 * Decide **no servidor**, lendo o cookie de sessão. É o que a troca do
 * `localStorage` por cookie comprou: quem já entrou nunca vê formulário de
 * login piscando antes de o JavaScript descobrir que havia sessão, porque
 * a resposta que sai daqui já é o redirecionamento.
 *
 * Esta rota é dinâmica por definição — ler cookie impede prerender. Por
 * isso o menu mora em `/menu` e não aqui: lá o conteúdo é igual pra todo
 * mundo e segue estático, sem uma linha de JS.
 *
 * **Entrar é obrigatório desde 25/08/2026.** Antes havia um "Jogar sem
 * conta" que levava direto ao menu. Ele saiu porque prometia o que não
 * dava: `/api/save` responde 401 sem sessão e este front não tem save
 * local, então quem entrava por ali jogava sem conseguir salvar nada e
 * perdia tudo no primeiro F5, sem aviso nenhum.
 *
 * Quem faz o bloqueio de verdade é o `proxy.ts` na raiz do pacote — tirar
 * o botão sozinho não bastava, porque `/menu` continuava alcançável por
 * URL digitada e por favorito antigo.
 *
 * Também é aqui que caem os links de e-mail: a API os monta como
 * `BASE/?verify=TOKEN`, formato herdado do jogo antigo e mantido pra uma
 * API só poder atender os dois clientes.
 */
export default async function Portao({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  // Antes da sessão, e não depois: quem confirma e-mail normalmente **está**
  // logado, e o `redirect('/menu')` abaixo engoliria o token junto com a
  // busca. O link morreria sem erro nenhum na tela — a pessoa veria o menu,
  // acharia que deu certo, e a conta continuaria sem confirmar.
  const desvio = rotaDoLinkDeEmail(await searchParams);
  if (desvio) redirect(desvio);

  if (await usuarioDaSessao()) redirect('/menu');

  return (
    <main className={styles.tela}>
      <div className={styles.cartao}>
        <p className={styles.marca}>RPG Legend</p>
        <Entrada />
      </div>
    </main>
  );
}
