import styles from '../entrada.module.css';
import { FormularioEsqueci } from './formulario-esqueci';

/**
 * Pedir o link de recuperação.
 *
 * Existe porque sem ela a `/redefinir-senha` seria inalcançável: nada no
 * front novo chamava `request-password-reset`, então o link que aquela
 * página espera nunca chegava a ser enviado.
 */
export default function EsqueciSenha() {
  return (
    <main className={styles.tela}>
      <div className={styles.cartao}>
        <p className={styles.marca}>RPG Legend</p>
        <FormularioEsqueci />
      </div>
    </main>
  );
}
