import { primeiro } from '@/lib/api/email';
import styles from '../entrada.module.css';
import { Confirmacao } from './confirmacao';

/**
 * Onde o link de confirmação do e-mail termina, depois de o portão desviar
 * o `?verify=` pra cá.
 *
 * A casca é servidor e o trabalho é cliente, de propósito — ver o comentário
 * em `confirmacao.tsx`: confirmar no servidor entregaria o token pros
 * varredores de link que rodam em caixa de entrada corporativa, e a pessoa
 * receberia "link inválido" num link que nunca chegou a usar.
 */
export default async function ConfirmarEmail({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  return (
    <main className={styles.tela}>
      <div className={styles.cartao}>
        <p className={styles.marca}>RPG Legend</p>
        <Confirmacao token={primeiro((await searchParams).token)} />
      </div>
    </main>
  );
}
