'use client';

/**
 * Confirma o e-mail assim que a tela abre, sem pedir clique.
 *
 * **Por que no cliente, e não no servidor.** Confirmar durante a renderização
 * seria mais simples e funcionaria sem JavaScript, mas o token é de uso
 * único: varredor de link de caixa de entrada corporativa abre todo endereço
 * que chega, gastaria a confirmação antes da pessoa, e ela veria "link
 * inválido ou expirado" num link que nunca usou. Varredor quase nunca executa
 * JavaScript — fazer aqui é o que protege o token. É também o que o
 * `handleEmailLink` do jogo antigo fazia.
 */

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { ErroDaApi } from '@/lib/api/client';
import { confirmarEmail } from '@/lib/api/email';
import styles from '../componentes/formulario-login.module.css';

const SEM_TOKEN = 'Link de confirmação inválido ou expirado.';

type Estado = { fase: 'confirmando' } | { fase: 'pronto' } | { fase: 'falhou'; erro: string };

export function Confirmacao({ token }: Readonly<{ token: string }>) {
  const [estado, setEstado] = useState<Estado>(() =>
    token ? { fase: 'confirmando' } : { fase: 'falhou', erro: SEM_TOKEN },
  );

  // O efeito roda duas vezes no modo estrito do desenvolvimento, e o token é
  // de uso único: sem esta trava a segunda chamada falharia e trocaria o
  // sucesso na tela por "link inválido", num fluxo que na verdade deu certo.
  const jaPediu = useRef(false);

  useEffect(() => {
    if (!token || jaPediu.current) return;
    jaPediu.current = true;

    confirmarEmail(token)
      .then(() => setEstado({ fase: 'pronto' }))
      .catch((falha: unknown) =>
        setEstado({ fase: 'falhou', erro: falha instanceof ErroDaApi ? falha.message : 'Erro inesperado.' }),
      );
  }, [token]);

  if (estado.fase === 'confirmando') {
    return (
      <>
        <h1 className={styles.titulo}>Confirmando seu e-mail…</h1>
        <p className={styles.rotulo}>Um instante.</p>
      </>
    );
  }

  if (estado.fase === 'pronto') {
    return (
      <>
        <h1 className={styles.titulo}>E-mail confirmado</h1>
        <p className={styles.sucesso}>Pronto. Sua conta está confirmada.</p>
        <div className={styles.acoes}>
          <Link className={styles.botao} href="/">
            Continuar
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className={styles.titulo}>Não deu certo</h1>
      <p className={styles.erro}>{estado.erro}</p>
      {/* O link expira em uma hora. Quem chegou tarde precisa de um novo, e
          o botão pra pedir mora na página da conta — por isso o caminho de
          volta aponta pra lá, e não pro portão. */}
      <div className={styles.acoes}>
        <Link className={styles.alternar} href="/conta">
          Ir para minha conta
        </Link>
      </div>
    </>
  );
}
