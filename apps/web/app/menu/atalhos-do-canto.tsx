'use client';

/**
 * Os dois atalhos do canto: perfil em cima, conversas embaixo.
 *
 * **É a única ilha da página.** O resto de `/menu` é Server Component
 * estático, e continua sendo — o que obriga estes dois a virem pro cliente
 * é que dependem de quem está logado: o de cima mostra a foto e a moldura
 * de verdade, o de baixo conta os pedidos de amizade parados.
 *
 * Um componente só pros dois ícones, e não um pra cada, porque os dois
 * precisam da mesma sessão: separados, seriam duas chamadas a
 * `/api/account/me` pra desenhar dois botões colados.
 *
 * O selo conta **pedido de amizade**, não mensagem por ler — a API não tem
 * esse número hoje (`/api/friends` devolve `friends`, `incoming` e
 * `outgoing`, e nada sobre leitura). Badge de mensagem exige campo novo no
 * servidor.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { usuarioAtual, type Usuario } from '@/lib/api/account';
import { listarAmigos } from '@/lib/api/amigos';
import { Avatar } from '../componentes/avatar';
import styles from './menu.module.css';

export function AtalhosDoCanto() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [pedidos, setPedidos] = useState(0);

  // Deslogado cai no `catch` e fica no emoji: o menu não é tela de login,
  // e quem chegou aqui sem sessão o portão já devolve pra `/`.
  useEffect(() => {
    usuarioAtual().then(setUsuario).catch(() => undefined);
    listarAmigos()
      .then((relacoes) => setPedidos(relacoes.incoming.length))
      .catch(() => undefined);
  }, []);

  return (
    <nav className={styles.canto} aria-label="Sua conta e suas conversas">
      <Link href="/conta" className={styles.atalho} title="Conta e perfil">
        {usuario ? (
          <Avatar url={usuario.avatarUrl} frame={usuario.frame} nome={usuario.username} lado={38} />
        ) : (
          <span className={styles.rostoDoAtalho} aria-hidden>
            👤
          </span>
        )}
        <span className={styles.soPraLeitor}>Conta e perfil</span>
      </Link>

      <Link href="/amigos" className={styles.atalho} title="Amigos e conversas">
        <span className={styles.rostoDoAtalho} aria-hidden>
          ✉️
        </span>
        {pedidos > 0 && (
          <span className={styles.selo} aria-hidden>
            {pedidos}
          </span>
        )}
        <span className={styles.soPraLeitor}>
          Amigos e conversas{pedidos > 0 && ` — ${pedidos} pedido de amizade esperando`}
        </span>
      </Link>
    </nav>
  );
}
