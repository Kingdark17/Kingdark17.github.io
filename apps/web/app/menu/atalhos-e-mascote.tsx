'use client';

/**
 * Tudo que o menu mostra e depende de quem está logado: os dois atalhos do
 * canto de cima (perfil em cima da cartinha) e o mascote no canto de baixo.
 *
 * **É a única ilha da página.** O resto de `/menu` é Server Component
 * estático, e continua sendo.
 *
 * Os três num componente só, e não um por peça, porque os três saem da
 * mesma sessão: separados, seriam três chamadas a `/api/account/me` pra
 * desenhar três coisas. Ficam longe um do outro na tela, mas os dois blocos
 * são posicionados por `position: absolute` dentro de `.tela` — quem manda
 * no lugar é o CSS, então a ordem no HTML não atrapalha.
 *
 * O selo conta **pedido de amizade**, não mensagem por ler — a API não tem
 * esse número hoje (`/api/friends` devolve `friends`, `incoming` e
 * `outgoing`, e nada sobre leitura). Badge de mensagem exige campo novo no
 * servidor.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { petIcon, type PetId } from '@rpg-legend/shared';

import { usuarioAtual, type Usuario } from '@/lib/api/account';
import { listarAmigos } from '@/lib/api/amigos';
import { ROSTOS_DE_PET } from '@/lib/pets/rostos';
import { tocar } from '@/lib/som/efeitos';
import { Avatar } from '../componentes/avatar';
import { SpriteDePet } from '../componentes/sprite-de-pet';
import styles from './menu.module.css';

/**
 * Sem pet escolhido — ou sem sessão — fica o gato preto do esboço. É o
 * mascote da casa: `petIcon(null)` devolveria uma pegada (🐾), que num canto
 * de menu parece bug, não bicho.
 */
const GATO_DA_CASA = '🐈‍⬛';

/**
 * O mesmo tempo do carinho na tela de jogo (`bicho-de-estimacao.tsx`), e
 * pela mesma regra: vale só pra arte parada. Pet com tira dita o próprio
 * tempo, senão a reação cortaria no meio ou ficaria congelada esperando.
 */
const DURACAO_DO_CARINHO_MS = 1200;

export function AtalhosEMascote() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [pedidos, setPedidos] = useState(0);
  const [carinho, setCarinho] = useState(false);

  // Deslogado cai no `catch` e fica no emoji: o menu não é tela de login,
  // e quem chegou aqui sem sessão o portão já devolve pra `/`.
  useEffect(() => {
    usuarioAtual().then(setUsuario).catch(() => undefined);
    listarAmigos()
      .then((relacoes) => setPedidos(relacoes.incoming.length))
      .catch(() => undefined);
  }, []);

  const pet = usuario?.pet && usuario.pet !== 'none' ? (usuario.pet as PetId) : null;
  const rosto = pet ? ROSTOS_DE_PET[pet] : undefined;
  const duracaoDoCarinho = rosto?.coracao.duracaoMs || DURACAO_DO_CARINHO_MS;

  useEffect(() => {
    if (!carinho) return;
    const relogio = setTimeout(() => setCarinho(false), duracaoDoCarinho);
    return () => clearTimeout(relogio);
  }, [carinho, duracaoDoCarinho]);

  return (
    <>
      <nav className={styles.canto} aria-label="Sua conta e suas conversas">
        <Link href="/conta" className={styles.atalho} title="Conta e perfil">
          {usuario ? (
            <Avatar url={usuario.avatarUrl} frame={usuario.frame} nome={usuario.username} lado={44} />
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

      <div className={styles.mascote}>
        <button
          type="button"
          className={styles.gato}
          onClick={() => {
            setCarinho(true);
            tocar('heal');
          }}
          aria-label={pet ? 'Fazer carinho no seu pet' : 'Fazer carinho no gato'}
        >
          {rosto ? (
            <SpriteDePet
              // `gatoRespira` só na arte parada: quem tem tira já se mexe
              // sozinho, e o balanço por cima daria dois movimentos
              // sobrepostos, cada um no seu compasso.
              className={`${styles.gatoArte} ${rosto.normal.quadros > 1 ? '' : styles.gatoRespira}`}
              animacao={carinho ? rosto.coracao : rosto.normal}
              umaVez={carinho}
            />
          ) : (
            <span className={styles.gatoRosto} aria-hidden>
              {pet ? petIcon(pet) : GATO_DA_CASA}
            </span>
          )}
          <span className={`${styles.gatoCoracao} ${carinho ? styles.gatoCoracaoVisivel : ''}`} aria-hidden>
            ❤
          </span>
        </button>
      </div>
    </>
  );
}
