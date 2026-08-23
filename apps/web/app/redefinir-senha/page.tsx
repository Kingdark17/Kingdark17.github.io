import { primeiro } from '@/lib/api/email';
import styles from '../entrada.module.css';
import { FormularioSenha } from './formulario-senha';

/**
 * Onde o link de recuperação termina, depois de o portão desviar o
 * `?reset=` pra cá.
 *
 * Página própria, e não um passo dentro do portão, porque trocar senha
 * precisa de dois campos e de conferência entre eles. O jogo antigo
 * resolvia isso com dois `window.prompt` seguidos — sem ver o que se
 * digita, sem mostrar o que está errado, e sem chance de corrigir.
 */
export default async function RedefinirSenha({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  return (
    <main className={styles.tela}>
      <div className={styles.cartao}>
        <p className={styles.marca}>RPG Legend</p>
        <FormularioSenha token={primeiro((await searchParams).token)} />
      </div>
    </main>
  );
}
