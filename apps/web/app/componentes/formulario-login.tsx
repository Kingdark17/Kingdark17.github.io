'use client';

/**
 * Entrar e cadastrar, num componente só, porque agora tem dois donos: o
 * portão da raiz (`app/page.tsx`) e a página de conta (`app/conta`).
 *
 * Client Component pelo motivo certo — o formulário é interativo — e não
 * porque precise de sessão. Quem sabe quem é o jogador agora é o servidor,
 * lendo o cookie; este componente só cuida de trocar credencial por sessão
 * e avisar quem chamou.
 */

import { useState } from 'react';

import { cadastrar, entrar, type Usuario } from '@/lib/api/account';
import { ErroDaApi } from '@/lib/api/client';
import styles from './formulario-login.module.css';

type Modo = 'entrar' | 'cadastrar';

interface Props {
  /** Chamado com o usuário resolvido. A sessão já está no cookie aqui. */
  aoEntrar: (usuario: Usuario) => void;
  /** Ex.: o "Jogar sem conta" do portão. A página de conta não passa nada. */
  children?: React.ReactNode;
}

export function FormularioLogin({ aoEntrar, children }: Props) {
  const [modo, setModo] = useState<Modo>('entrar');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function aoEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    setErro('');
    setOcupado(true);
    try {
      const entrada = {
        username: String(dados.get('username') ?? ''),
        password: String(dados.get('password') ?? ''),
      };
      aoEntrar(modo === 'entrar' ? await entrar(entrada) : await cadastrar({ ...entrada, email: String(dados.get('email') ?? '') }));
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? falha.message : 'Erro inesperado.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      {/* O título mora aqui, e não em quem chama, porque ele muda junto com
          o modo — e o modo é estado deste componente. Do lado de fora só
          daria pra escrever um rótulo fixo que mentiria metade do tempo. */}
      <h1 className={styles.titulo}>{modo === 'entrar' ? 'Entrar na conta' : 'Criar conta'}</h1>

      <form onSubmit={aoEnviar}>
        <label className={styles.campo}>
          <span className={styles.rotulo}>{modo === 'entrar' ? 'Usuário ou e-mail' : 'Usuário'}</span>
          <input className={styles.entrada} name="username" autoComplete="username" required />
        </label>

        {modo === 'cadastrar' && (
          <label className={styles.campo}>
            <span className={styles.rotulo}>E-mail</span>
            <input className={styles.entrada} name="email" type="email" autoComplete="email" required />
          </label>
        )}

        <label className={styles.campo}>
          <span className={styles.rotulo}>Senha</span>
          <input
            className={styles.entrada}
            name="password"
            type="password"
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            required
          />
        </label>

        <div className={styles.acoes}>
          <button type="submit" className={styles.botao} disabled={ocupado}>
            {modo === 'entrar' ? 'Entrar' : 'Cadastrar'}
          </button>
          <button
            type="button"
            className={styles.alternar}
            onClick={() => {
              setModo(modo === 'entrar' ? 'cadastrar' : 'entrar');
              setErro('');
            }}
          >
            {modo === 'entrar' ? 'Criar uma conta' : 'Já tenho conta'}
          </button>
          {children}
        </div>
      </form>

      {erro && <p className={styles.erro}>{erro}</p>}
    </>
  );
}
