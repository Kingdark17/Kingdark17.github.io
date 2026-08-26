'use client';

/**
 * A parte interativa do portão. O `page.tsx` ao lado já decidiu, no
 * servidor, que quem chegou aqui não tem sessão — então este componente
 * não verifica nada: ele só troca credencial por sessão e navega.
 *
 * O `refresh()` antes do `push()` não é redundância. O portão é um Server
 * Component que leu cookie; sem invalidar o cache do roteador, uma volta
 * pra raiz depois do login mostraria a versão renderizada quando ainda não
 * havia sessão.
 *
 * O `destino` vem do `page.tsx` já higienizado pelo `rotaDeVolta` — quem
 * foi barrado indo pra `/loja` volta pra `/loja`, e quem chegou direto vai
 * pro menu. **Não higienizar aqui é proposital**: um só lugar decide o que
 * é destino aceitável, e ele tem teste.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { FormularioLogin } from './componentes/formulario-login';
import styles from './entrada.module.css';

export function Entrada({ destino }: Readonly<{ destino: string }>) {
  const router = useRouter();

  return (
    <FormularioLogin
      aoEntrar={() => {
        router.refresh();
        router.push(destino);
      }}
    >
      {/* Único caminho até `/redefinir-senha`: é este link que faz a API
          mandar o e-mail que leva pra lá. Sem ele, aquela página existiria
          sem nenhuma forma de ser alcançada. */}
      <Link className={styles.semConta} href="/esqueci-senha">
        Esqueci minha senha
      </Link>
    </FormularioLogin>
  );
}
