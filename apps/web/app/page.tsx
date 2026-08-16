import Link from 'next/link';

import styles from './page.module.css';

/**
 * Menu principal. Substitui a página de fumaça da fase 0, que existia só
 * pra provar que `@rpg-legend/shared` atravessava servidor e cliente — o
 * jogo inteiro faz essa prova agora.
 *
 * Server Component, sem uma linha de JS próprio: os cinco destinos são
 * iguais pra todo mundo, e a entrada dos cartões é CSS. Chegou a ser
 * Motion; medido, custava ~106 KB de JavaScript na primeira página que
 * qualquer pessoa abre, por um fade de quatro cartões. É a mesma regra
 * que já valia pros loops decorativos do jogo.
 */

const DESTINOS = [
  { href: '/personagens', icone: '⚔️', titulo: 'Jogar', texto: 'Escolha um personagem e volte pra masmorra.' },
  { href: '/personagens/novo', icone: '✨', titulo: 'Novo personagem', texto: 'Raça, classe, fraqueza e poderes.' },
  { href: '/multiplayer', icone: '👥', titulo: 'Jogar com alguém', texto: 'Crie uma sala ou entre na de um amigo.' },
  { href: '/amigos', icone: '💬', titulo: 'Amigos', texto: 'Adicione jogadores e converse.' },
  { href: '/conta', icone: '🎭', titulo: 'Conta e perfil', texto: 'Foto, moldura, cor do nome, pet e loja.' },
];

export default function Page() {
  return (
    <main className={styles.main}>
      <div className={styles.menu}>
        <h1 className={styles.marca}>RPG Legend</h1>
        <p className={styles.subtitulo}>Uma masmorra diferente a cada descida.</p>

        <nav className={styles.destinos}>
          {DESTINOS.map((destino, indice) => (
            <Link
              key={destino.href}
              href={destino.href}
              className={styles.destino}
              style={{ animationDelay: `${indice * 60}ms` }}
            >
              <span className={styles.iconeDoDestino} aria-hidden>
                {destino.icone}
              </span>
              <span className={styles.tituloDoDestino}>{destino.titulo}</span>
              <span className={styles.textoDoDestino}>{destino.texto}</span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
