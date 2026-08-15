'use client';

/**
 * Entrar, cadastrar e sair — primeira tela real da fase 3.
 *
 * Client Component inteiro de propósito: o token vive no navegador (ver
 * `lib/api/session.ts`), então não há nada que o servidor do Next possa
 * renderizar sabendo quem é o jogador. Server Component aqui só adiantaria
 * uma casca vazia.
 */

import { useEffect, useState } from 'react';

import { cadastrar, entrar, sair, usuarioAtual, type Usuario } from '@/lib/api/account';
import { ErroDaApi } from '@/lib/api/client';
import { Avatar, NomeColorido } from './avatar';
import { PainelPerfil } from './painel-perfil';
import styles from './conta.module.css';

type Modo = 'entrar' | 'cadastrar';

export function PainelConta() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [modo, setModo] = useState<Modo>('entrar');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [carregandoSessao, setCarregandoSessao] = useState(true);

  // Sessão guardada de uma visita anterior: só o servidor sabe se ainda vale.
  // Sem token, `usuarioAtual()` já rejeita sozinho (ver `chamarApi`).
  useEffect(() => {
    usuarioAtual()
      .then(setUsuario)
      .catch(() => undefined)
      .finally(() => setCarregandoSessao(false));
  }, []);

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
      setUsuario(modo === 'entrar' ? await entrar(entrada) : await cadastrar({ ...entrada, email: String(dados.get('email') ?? '') }));
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? falha.message : 'Erro inesperado.');
    } finally {
      setOcupado(false);
    }
  }

  async function aoSair() {
    setOcupado(true);
    await sair();
    setUsuario(null);
    setOcupado(false);
  }

  if (carregandoSessao) {
    return (
      <div className={styles.painel}>
        <p>Verificando sessão…</p>
      </div>
    );
  }

  if (usuario) {
    return (
      <div className={`${styles.painel} ${styles.painelLargo}`}>
        <div className={styles.previa}>
          <Avatar url={usuario.avatarUrl} frame={usuario.frame} nome={usuario.username} />
          <h1 className={styles.titulo} style={{ margin: 0 }}>
            <NomeColorido nome={usuario.username} cor={usuario.nameColor || '#e8d7a5'} />
          </h1>
        </div>
        <p className={styles.linhaUsuario}>
          <span className={styles.chave}>E-mail</span>
          <span>{usuario.email ?? '—'}</span>
        </p>
        <p className={styles.linhaUsuario}>
          <span className={styles.chave}>Confirmado</span>
          <span>{usuario.emailVerified ? 'sim' : 'não'}</span>
        </p>
        <p className={styles.linhaUsuario}>
          <span className={styles.chave}>Administrador</span>
          <span>{usuario.isAdmin ? 'sim' : 'não'}</span>
        </p>
        {!usuario.emailVerified && usuario.email && (
          <p className={styles.aviso}>Confirme seu e-mail pelo link que enviamos.</p>
        )}
        <div className={styles.acoes}>
          <button type="button" className={styles.botao} onClick={aoSair} disabled={ocupado}>
            Sair
          </button>
        </div>

        <PainelPerfil usuario={usuario} onUsuario={setUsuario} />
      </div>
    );
  }

  return (
    <div className={styles.painel}>
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
        </div>
      </form>

      {erro && <p className={styles.erro}>{erro}</p>}
    </div>
  );
}
