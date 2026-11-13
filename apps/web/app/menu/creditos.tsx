import styles from './menu.module.css';

/**
 * Os créditos do menu (doc do Breno, 2026-11-13: "o mais discreto
 * possível"): um "créditos" miúdo no canto de baixo à esquerda, longe do
 * gato e dos atalhos, que abre uma janelinha. O mesmo texto do app
 * (`App.uxml`, `janela-de-creditos`).
 *
 * **Popover do navegador, sem JavaScript.** O `popover` abre pelo botão,
 * fecha com Esc e com o clique fora, e fica por cima de tudo; assim o menu
 * continua Server Component e estático.
 */
export function Creditos() {
  return (
    <>
      <button type="button" className={styles.botaoDosCreditos} popoverTarget="creditos">
        créditos
      </button>
      <div id="creditos" popover="auto" className={styles.creditos} aria-label="Créditos">
        <h2 className={styles.tituloDosCreditos}>Créditos</h2>
        <p className={styles.linhaDosCreditos}>Arte: Breno</p>
        <p className={styles.linhaDosCreditos}>Jogo: Kingdark17</p>
        <h3 className={styles.secaoDosCreditos}>Fontes</h3>
        <p className={styles.notaDosCreditos}>
          Alkhemikal, de jeti (
          <a href="https://creativecommons.org/licenses/by/4.0/deed.pt-br" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
          )
        </p>
        <p className={styles.notaDosCreditos}>Pixelify Sans e VT323 (SIL Open Font License 1.1)</p>
        <h3 className={styles.secaoDosCreditos}>Efeitos da luta do app</h3>
        <p className={styles.notaDosCreditos}>Feitos com a pixelfx, de Patch e Hugo Duprez (MIT)</p>
        <button type="button" className={styles.fecharCreditos} popoverTarget="creditos" popoverTargetAction="hide">
          Fechar
        </button>
      </div>
    </>
  );
}
