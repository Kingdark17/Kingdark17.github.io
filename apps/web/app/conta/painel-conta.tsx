'use client';

/**
 * Perfil, e o formulário de entrada pra quem chegar aqui deslogado.
 *
 * Continua Client Component, mas por outro motivo que no começo. Antes era
 * porque o token vivia no `localStorage` e nada fora do navegador
 * conseguia lê-lo. Agora a sessão é cookie e o servidor **sabe** quem é o
 * jogador — quem depende disso é o portão em `app/page.tsx`, que decide no
 * servidor. Aqui o que exige cliente é a interação: editar perfil, trocar
 * avatar, sair.
 */

import { useEffect, useState } from 'react';

import { sair, usuarioAtual, type Usuario } from '@/lib/api/account';
import { ErroDaApi } from '@/lib/api/client';
import { reenviarConfirmacao } from '@/lib/api/email';
import { Avatar, NomeColorido } from '../componentes/avatar';
import { FormularioLogin } from '../componentes/formulario-login';
import { PainelPerfil } from './painel-perfil';
import styles from './conta.module.css';

export function PainelConta() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [recadoDoEmail, setRecadoDoEmail] = useState('');

  // Sessão guardada de uma visita anterior: só o servidor sabe se ainda vale.
  // Sem token, `usuarioAtual()` já rejeita sozinho (ver `chamarApi`).
  useEffect(() => {
    usuarioAtual()
      .then(setUsuario)
      .catch(() => undefined)
      .finally(() => setCarregandoSessao(false));
  }, []);

  async function aoReenviar() {
    setOcupado(true);
    setRecadoDoEmail('');
    try {
      await reenviarConfirmacao();
      setRecadoDoEmail('Link novo enviado. Confira sua caixa de entrada.');
    } catch (falha) {
      setRecadoDoEmail(falha instanceof ErroDaApi ? falha.message : 'Não foi possível reenviar agora.');
    } finally {
      setOcupado(false);
    }
  }

  async function aoSair() {
    setOcupado(true);
    try {
      await sair();
      setUsuario(null);
    } finally {
      setOcupado(false);
    }
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
          <>
            <p className={styles.aviso}>Confirme seu e-mail pelo link que enviamos.</p>
            {/* O link vale uma hora. Sem este botão, quem abrisse o e-mail no
                dia seguinte ficaria com a conta pra sempre sem confirmar, e a
                única saída seria trocar o e-mail pelo mesmo endereço — que
                por acaso reenvia, mas ninguém adivinharia isso. */}
            <button type="button" className={styles.botao} onClick={aoReenviar} disabled={ocupado}>
              Reenviar confirmação
            </button>
          </>
        )}
        {recadoDoEmail && <p className={styles.aviso}>{recadoDoEmail}</p>}
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
      <FormularioLogin aoEntrar={setUsuario} />
    </div>
  );
}
