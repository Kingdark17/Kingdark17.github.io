'use client';

/**
 * Troca a senha usando o token do link de recuperação.
 *
 * A conferência das duas senhas acontece só aqui: a API não recebe a
 * segunda, porque ela não é um dado, é uma proteção contra erro de digitação
 * — e o único lugar onde dá pra avisar a tempo é a tela.
 */

import Link from 'next/link';
import { useState } from 'react';

import { ErroDaApi } from '@/lib/api/client';
import { redefinirSenha } from '@/lib/api/email';
import styles from '../componentes/formulario-login.module.css';

/** Os mesmos limites de `auth.service.ts`, que é quem recusa de verdade. */
const MIN = 8;
const MAX = 128;

export function FormularioSenha({ token }: Readonly<{ token: string }>) {
  const [erro, setErro] = useState(token ? '' : 'Link de recuperação inválido ou expirado.');
  const [ocupado, setOcupado] = useState(false);
  const [pronto, setPronto] = useState(false);

  async function aoEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const senha = String(dados.get('password') ?? '');
    const repetida = String(dados.get('confirmacao') ?? '');

    if (senha.length < MIN || senha.length > MAX) {
      setErro(`A senha precisa ter entre ${MIN} e ${MAX} caracteres.`);
      return;
    }
    if (senha !== repetida) {
      setErro('As duas senhas não são iguais.');
      return;
    }

    setErro('');
    setOcupado(true);
    try {
      await redefinirSenha(token, senha);
      setPronto(true);
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? falha.message : 'Erro inesperado.');
    } finally {
      setOcupado(false);
    }
  }

  if (pronto) {
    return (
      <>
        <h1 className={styles.titulo}>Senha alterada</h1>
        {/* Trocar a senha derruba todas as sessões da conta, inclusive as de
            outros aparelhos (`consumePasswordReset` apaga a tabela inteira do
            usuário na mesma transação). Quem chegou aqui por ter perdido o
            acesso precisa saber que isso foi de propósito. */}
        <p className={styles.sucesso}>Pronto. Entre de novo com a senha nova — as sessões antigas foram encerradas.</p>
        <div className={styles.acoes}>
          <Link className={styles.botao} href="/">
            Entrar
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className={styles.titulo}>Nova senha</h1>

      <form onSubmit={aoEnviar}>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Nova senha</span>
          <input
            className={styles.entrada}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN}
            maxLength={MAX}
            required
          />
        </label>

        <label className={styles.campo}>
          <span className={styles.rotulo}>Repita a nova senha</span>
          <input
            className={styles.entrada}
            name="confirmacao"
            type="password"
            autoComplete="new-password"
            minLength={MIN}
            maxLength={MAX}
            required
          />
        </label>

        <div className={styles.acoes}>
          <button type="submit" className={styles.botao} disabled={ocupado || !token}>
            Trocar senha
          </button>
          <Link className={styles.alternar} href="/">
            Voltar
          </Link>
        </div>
      </form>

      {erro && <p className={styles.erro}>{erro}</p>}
    </>
  );
}
