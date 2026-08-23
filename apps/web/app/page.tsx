import { redirect } from 'next/navigation';

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
 * **Entrar não é obrigatório.** O "Jogar sem conta" leva direto ao menu; a
 * conta serve pra guardar progresso na nuvem e pra jogar acompanhado, não
 * pra liberar o jogo.
 */
export default async function Portao() {
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
