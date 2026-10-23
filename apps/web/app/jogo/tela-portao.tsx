'use client';

/**
 * O portão da cidade: Floresta, Caverna ou Torre, a dificuldade e por onde
 * entrar — o andar 1 ou um totem já tocado. O que está fechado aparece
 * apagado, com o que falta escrito no próprio botão: esconder a Torre de
 * quem ainda não chegou lá esconderia também pra onde o jogo vai.
 *
 * A regra mora na engine, em `jogo/portao.ts` e `dungeon/dungeons.ts`.
 */

import {
  andares,
  dificuldades,
  dungeonById,
  entrar,
  escolherAndar,
  escolherDificuldade,
  escolherMasmorra,
  masmorras,
  runName,
  type Entrada,
  type OpcaoDoPortao,
  type Portao,
} from '@rpg-legend/shared';

import styles from './jogo.module.css';

interface Props {
  portao: Portao;
  onPortao: (proximo: Portao) => void;
  onEntrar: (entrada: Entrada) => void;
  onFechar: () => void;
}

function Opcao<Id extends string>({ opcao, escolhida, onEscolher }: Readonly<{ opcao: OpcaoDoPortao<Id>; escolhida: boolean; onEscolher: (id: Id) => void }>) {
  return (
    <button
      type="button"
      className={`${styles.botao} ${escolhida ? styles.botaoPrincipal : ''}`}
      aria-pressed={escolhida}
      disabled={opcao.falta !== null}
      onClick={() => onEscolher(opcao.id)}
    >
      {opcao.icone && <span aria-hidden>{opcao.icone}</span>}
      {opcao.nome}
      {opcao.falta && <span className={styles.custoDeMana}> · {opcao.falta}</span>}
    </button>
  );
}

export function TelaPortao({ portao, onPortao, onEntrar, onFechar }: Readonly<Props>) {
  const pelo = portao.andar === 1 ? 'pelo andar 1' : `pelo totem do andar ${portao.andar}`;

  return (
    <section className={styles.loja}>
      <header className={styles.cabecalhoLoja}>
        <h1 className={styles.local}>🌟 Portão da Masmorra</h1>
        <button type="button" className={styles.botao} onClick={onFechar}>
          Sair
        </button>
      </header>

      {/* Pela entrada da cidade desenhada a masmorra já está escolhida: é a do caminho. */}
      {portao.fixa ? (
        <p className={styles.textoDaGuilda}>{`O caminho leva à ${dungeonById(portao.escolha.dungeon)?.name ?? portao.escolha.dungeon}. Escolha a dificuldade e por onde entrar.`}</p>
      ) : (
        <>
          <p className={styles.textoDaGuilda}>O guarda abre o portão. Para onde você vai?</p>

          <div className={styles.grupoDoPortao}>
            <h2 className={styles.tituloDaSecao}>Masmorra</h2>
            <div className={styles.escolhasDoPortao}>
              {masmorras(portao).map((opcao) => (
                <Opcao key={opcao.id} opcao={opcao} escolhida={portao.escolha.dungeon === opcao.id} onEscolher={(id) => onPortao(escolherMasmorra(portao, id))} />
              ))}
            </div>
          </div>
        </>
      )}

      <div className={styles.grupoDoPortao}>
        <h2 className={styles.tituloDaSecao}>Dificuldade</h2>
        <div className={styles.escolhasDoPortao}>
          {dificuldades(portao).map((opcao) => (
            <Opcao
              key={opcao.id}
              opcao={opcao}
              escolhida={portao.escolha.difficulty === opcao.id}
              onEscolher={(id) => onPortao(escolherDificuldade(portao, id))}
            />
          ))}
        </div>
      </div>

      <div className={styles.grupoDoPortao}>
        <h2 className={styles.tituloDaSecao}>Entrada</h2>
        <div className={styles.abasDeTexto}>
          {andares(portao).map((andar) => (
            <button
              key={andar}
              type="button"
              className={styles.abaDeTexto}
              aria-pressed={portao.andar === andar}
              onClick={() => onPortao(escolherAndar(portao, andar))}
            >
              {andar === 1 ? 'Andar 1' : `Andar ${andar} · totem`}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.escolhas}>
        <button
          type="button"
          className={`${styles.botao} ${styles.botaoPrincipal}`}
          onClick={() => {
            const entrada = entrar(portao);
            if (entrada) onEntrar(entrada);
          }}
        >
          Entrar: {runName(portao.escolha)}, {pelo}
        </button>
      </div>
    </section>
  );
}
