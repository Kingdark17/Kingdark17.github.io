'use client';

/**
 * Pede o e-mail e dispara o link de recuperação.
 *
 * A resposta mostrada é a que a API devolve, palavra por palavra, e ela é
 * vaga de propósito: "se o e-mail estiver cadastrado…". Trocar por "enviamos
 * pro seu e-mail" transformaria esta tela num jeito de descobrir quais
 * e-mails têm conta — bastaria comparar as duas mensagens.
 */

import Link from 'next/link';
import { useState } from 'react';

import { ErroDaApi } from '@/lib/api/client';
import { pedirRedefinicao } from '@/lib/api/email';
import styles from '../componentes/formulario-login.module.css';

export function FormularioEsqueci() {
  const [erro, setErro] = useState('');
  const [recado, setRecado] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function aoEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const email = String(new FormData(evento.currentTarget).get('email') ?? '');

    setErro('');
    setRecado('');
    setOcupado(true);
    try {
      setRecado(await pedirRedefinicao(email));
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? falha.message : 'Erro inesperado.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <h1 className={styles.titulo}>Recuperar senha</h1>

      <form onSubmit={aoEnviar}>
        <label className={styles.campo}>
          <span className={styles.rotulo}>E-mail da conta</span>
          <input className={styles.entrada} name="email" type="email" autoComplete="email" required />
        </label>

        <div className={styles.acoes}>
          <button type="submit" className={styles.botao} disabled={ocupado}>
            Enviar link
          </button>
          <Link className={styles.alternar} href="/">
            Voltar
          </Link>
        </div>
      </form>

      {recado && <p className={styles.sucesso}>{recado}</p>}
      {erro && <p className={styles.erro}>{erro}</p>}
    </>
  );
}
