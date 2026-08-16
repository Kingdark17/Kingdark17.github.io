import { DestinosDoMenu, type Destino } from './destinos-do-menu';
import styles from './page.module.css';

/**
 * Menu principal. Substitui a página de fumaça da fase 0, que existia só
 * pra provar que `@rpg-legend/shared` atravessava servidor e cliente — o
 * jogo inteiro faz essa prova agora.
 *
 * Server Component: os quatro destinos são iguais pra todo mundo. Quem
 * está logado (e o que isso muda) é assunto de cada página, onde o token
 * já vive.
 */

const DESTINOS: Destino[] = [
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

        <DestinosDoMenu destinos={DESTINOS} />
      </div>
    </main>
  );
}
