/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';

import { AtalhosDoCanto } from './atalhos-do-canto';
import styles from './menu.module.css';

/**
 * Menu principal, no layout do esboço: brasão em cima, três botões
 * empilhados com "Jogar" em destaque, o mascote ao lado e os dois atalhos
 * no canto.
 *
 * **Server Component estático.** Só `AtalhosDoCanto` é ilha, porque só ele
 * depende de quem está logado. Os botões são `<Link>`, o mascote é CSS —
 * nenhum dos dois manda JavaScript.
 *
 * **Mora em `/menu`, e não na raiz, exatamente pra continuar assim.** A
 * raiz virou o portão de login, que lê cookie e por isso não pode ser
 * prerenderizada. Deixar as duas coisas na mesma rota tornaria esta página
 * dinâmica junto, de graça.
 *
 * Não há `<h1>` com o nome do jogo: o brasão já traz "RPG LEGEND" escrito
 * na fita, e repetir embaixo em Jacquard seria dizer duas vezes. O `alt`
 * da imagem é que carrega o nome pra quem lê por leitor de tela.
 */

const DESTINOS = [
  { href: '/personagens', titulo: 'Jogar', forte: true },
  { href: '/configuracoes', titulo: 'Configurações', forte: false },
  { href: '/loja', titulo: 'Loja', forte: false },
];

export default function Page() {
  return (
    <main className={styles.tela}>
      <AtalhosDoCanto />

      <div className={styles.coluna}>
        {/* `<img>` cru, e não `next/image`: o brasão é pixel art, e o
            otimizador reamostra pra largura do dispositivo — o que borra
            exatamente as bordas duras que fazem o desenho. São 16 KB, não
            há o que otimizar. Mesmo motivo do `avatar.tsx`. */}
        <img
          className={`${styles.brasao} pixelated`}
          src="/img/branding/logo.png"
          width={724}
          height={724}
          alt="RPG Legend"
        />

        <nav className={styles.botoes} aria-label="Menu principal">
          {DESTINOS.map((destino) => (
            <Link
              key={destino.href}
              href={destino.href}
              className={`${styles.botao} ${destino.forte ? styles.botaoForte : ''}`}
            >
              {destino.titulo}
            </Link>
          ))}
        </nav>
      </div>

      {/* Fora da coluna: o gato mora no canto de baixo à direita, o mesmo
          da tela de jogo (`.bichinho` em `jogo.module.css`), pra o mascote
          estar sempre no mesmo lugar.

          Decorativo: `aria-hidden` porque um gato que só faz carinho não é
          informação, e o `<button>` sem `onClick` existe só pra o `:active`
          do CSS valer no toque também. */}
      <div className={styles.mascote} aria-hidden>
        <button type="button" className={styles.gato} tabIndex={-1}>
          <span className={styles.gatoRosto}>🐈‍⬛</span>
          <span className={styles.gatoCoracao}>❤</span>
        </button>
      </div>
    </main>
  );
}
