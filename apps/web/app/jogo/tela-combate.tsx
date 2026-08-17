'use client';

/**
 * A tela de combate. Só desenha e rola o dado — quem decide o que acontece
 * é `lib/jogo/combate.ts`.
 *
 * O d20 é rolado aqui e passado pra máquina de turnos em vez de sorteado lá
 * dentro: a tela mostra o número que saiu, e é o mesmo número que um dia o
 * servidor vai conferir.
 *
 * **É a única tela com Motion, e por um motivo.** O log guarda oito
 * linhas: cada golpe entra embaixo e empurra a mais velha pra fora. Sem
 * animação de saída a linha some no mesmo quadro em que a nova aparece,
 * e a leitura fica um pulo. Animar saída é justamente o que CSS não faz
 * — o elemento já não está mais no DOM. Entrada, brilho e loop decorativo
 * continuam em CSS, como no resto do jogo.
 *
 * `LazyMotion` + `m` em vez de `motion`: o `motion` cheio carrega todo o
 * pacote de recursos junto. `MotionConfig reducedMotion="user"` respeita
 * quem pediu menos movimento no sistema, igual ao `@media` das outras
 * telas.
 */

import { AnimatePresence, LazyMotion, MotionConfig } from 'motion/react';
import * as m from 'motion/react-m';
import { useRef, useState } from 'react';

import { heroPowers, powerManaCost, type CombatMonsterView, type Power } from '@rpg-legend/shared';

import { atacar, comecarCombate, fugir, inimigosRestantes, monstroAtual, usarPoder, type Combate, type Flutuante } from '@/lib/jogo/combate';
import { tocar } from '@/lib/som/efeitos';
import styles from './jogo.module.css';
import { TextoDoJogo } from './texto-do-jogo';

const LADOS_DO_DADO = 20;
const LINHAS_DO_LOG = 8;

const carregarAnimacoes = () => import('./animacoes-do-log').then((modulo) => modulo.default);

const ENTRADA_DA_LINHA = { opacity: 0, x: -10 };
const LINHA_PARADA = { opacity: 1, x: 0 };
const SAIDA_DA_LINHA = { opacity: 0, height: 0, marginTop: -4 };
const RITMO = { duration: 0.18, ease: 'easeOut' } as const;

/** O log precisa de chave estável: sem ela a saída nunca chega a rodar. */
interface LinhaDoLog {
  id: number;
  texto: string;
}

/**
 * Número que sobe e some. Ganha id próprio pelo mesmo motivo do log — e
 * some sozinho quando a animação acaba (`onAnimationEnd`), sem
 * `setTimeout`: quem sabe a hora certa é a animação, não um relógio
 * paralelo que erra quando a aba fica em segundo plano.
 */
interface NumeroNaTela extends Flutuante {
  id: number;
}

const ROTULOS_DE_STATUS: Record<string, string> = {
  queimadura: '🔥 Queimando',
  sangramento: '🩸 Sangrando',
  veneno: '☣️ Envenenado',
  atordoado: '💫 Atordoado',
  enfraquecido: '📉 Enfraquecido',
  vulneravel: '🎯 Vulnerável',
  lento: '❄️ Lento',
};

function rolarD20(): number {
  return Math.floor(Math.random() * LADOS_DO_DADO) + 1;
}

function statusAtivos(monstro: CombatMonsterView): string[] {
  const status = monstro.status ?? {};
  return Object.entries(status)
    .filter(([, valor]) => (typeof valor === 'number' ? valor > 0 : !!valor && valor.turns > 0))
    .map(([chave]) => ROTULOS_DE_STATUS[chave] ?? chave);
}

interface Props {
  combate: Combate;
  onCombate: (proximo: Combate) => void;
  onEncerrar: (final: Combate) => void;
}

export function TelaCombate({ combate, onCombate, onEncerrar }: Props) {
  const [historico, setHistorico] = useState<LinhaDoLog[]>(() => combate.log.map((texto, indice) => ({ id: indice, texto })));
  const [naTela, setNaTela] = useState<NumeroNaTela[]>([]);
  const [tremida, setTremida] = useState(false);
  const proximoId = useRef(combate.log.length);

  const monstro = monstroAtual(combate.estado);
  const hero = combate.estado.hero;
  const restantes = inimigosRestantes(combate.estado);
  const acabou = combate.fase === 'vitoria' || combate.fase === 'fuga' || combate.fase === 'derrota';

  function avancar(proximo: Combate) {
    // Os ids saem daqui, não de dentro do `setHistorico`: em StrictMode o
    // atualizador roda duas vezes e a mesma linha ganharia ids diferentes.
    const novas = proximo.log.map((texto) => ({ id: proximoId.current++, texto }));
    setHistorico((atual) => [...atual, ...novas].slice(-LINHAS_DO_LOG));

    const numeros = proximo.flutuantes.map((flutuante) => ({ ...flutuante, id: proximoId.current++ }));
    setNaTela((atual) => [...atual, ...numeros]);
    // A tremida se apaga sozinha no fim da animação (ver `onAnimationEnd`
    // na seção), que é o equivalente React do `classList.remove` + reflow
    // que o cliente antigo fazia à mão.
    if (numeros.some((numero) => numero.alvo === 'heroi')) setTremida(true);

    // Aqui e não num efeito: dois acertos seguidos têm o mesmo `som`, e
    // um efeito que observa o valor não tocaria o segundo.
    if (proximo.som) tocar(proximo.som);
    onCombate(proximo);
  }

  const ehMago = hero.className === 'Mago';
  const poderes: Power[] = heroPowers(hero);

  if (!monstro && !acabou) return <p className={styles.erro}>A sala está vazia.</p>;

  return (
    <section
      className={styles.combate}
      data-tremendo={tremida || undefined}
      onAnimationEnd={(evento) => {
        if (evento.currentTarget === evento.target) setTremida(false);
      }}
    >
      {/* Os números do golpe. Ficam sobre a cena inteira, como o
          `#combatScene` do cliente antigo, e cada um se remove quando a
          própria animação termina. */}
      <div className={styles.numerosFlutuantes} aria-hidden>
        {naTela.map((numero) => (
          <span
            key={numero.id}
            className={`${styles.numeroFlutuante} ${numero.tom === 'critico' ? styles.critico : ''} ${numero.alvo === 'heroi' ? styles.noHeroi : ''}`}
            onAnimationEnd={() => setNaTela((atual) => atual.filter((outro) => outro.id !== numero.id))}
          >
            {numero.texto}
          </span>
        ))}
      </div>

      {monstro && !acabou && (
        <div className={`${styles.cartaInimigo} ${monstro.isBoss ? styles.cartaChefe : ''}`}>
          <span className={styles.iconeInimigo} aria-hidden>
            {monstro.icon}
          </span>
          <h2 className={styles.nomeInimigo}>
            {monstro.name}
            {monstro.isBoss ? ' 👑' : ''}
          </h2>
          <p className={styles.classeInimigo}>{monstro.enemyClassLabel}</p>

          {restantes > 1 && <p className={styles.filaInimigos}>Ainda restam {restantes} inimigos nesta sala</p>}

          <div className={styles.trilho}>
            <div
              className={`${styles.preenchimento} ${styles.vida}`}
              style={{ width: `${Math.max(0, Math.min(100, (monstro.hp / monstro.maxHp) * 100))}%` }}
            />
          </div>
          <p className={styles.vidaInimigo}>
            {Math.max(0, monstro.hp)} / {monstro.maxHp}
          </p>

          {statusAtivos(monstro).length > 0 && (
            <ul className={styles.marcadores}>
              {statusAtivos(monstro).map((rotulo) => (
                <li key={rotulo} className={styles.marcador}>
                  {rotulo}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {combate.dado !== null && !acabou && (
        <p className={styles.dado} aria-label={`Dado: ${combate.dado}`}>
          🎲 {combate.dado}
        </p>
      )}

      <MotionConfig reducedMotion="user">
        <LazyMotion features={carregarAnimacoes} strict>
          <ul className={styles.log}>
            {/* `initial={false}`: ao abrir a tela as linhas já existentes
                aparecem prontas, sem desfilar uma cascata de entrada. */}
            <AnimatePresence initial={false}>
              {historico.map((linha) => (
                <m.li
                  key={linha.id}
                  className={styles.linhaDoLog}
                  initial={ENTRADA_DA_LINHA}
                  animate={LINHA_PARADA}
                  exit={SAIDA_DA_LINHA}
                  transition={RITMO}
                >
                  <TextoDoJogo>{linha.texto}</TextoDoJogo>
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        </LazyMotion>
      </MotionConfig>

      {acabou ? (
        <div className={styles.escolhas}>
          <button type="button" className={`${styles.botao} ${styles.botaoPrincipal}`} onClick={() => onEncerrar(combate)}>
            Continuar
          </button>
        </div>
      ) : combate.fase === 'encontro' ? (
        <div className={styles.escolhas}>
          <button
            type="button"
            className={`${styles.botao} ${styles.botaoPrincipal}`}
            onClick={() => avancar(comecarCombate(combate))}
          >
            Lutar
          </button>
          <button type="button" className={styles.botao} onClick={() => avancar(fugir(combate, rolarD20()))}>
            Fugir
          </button>
        </div>
      ) : (
        <>
          <div className={styles.escolhas}>
            {ehMago ? (
              <>
                <button
                  type="button"
                  className={`${styles.botao} ${styles.botaoPrincipal}`}
                  onClick={() => avancar(atacar(combate, rolarD20(), 'magic'))}
                  disabled={hero.mp < 5}
                >
                  Ataque Mágico (d20 · 5 MP)
                </button>
                <button type="button" className={styles.botao} onClick={() => avancar(atacar(combate, rolarD20(), 'physical'))}>
                  Ataque Físico (d20)
                </button>
              </>
            ) : (
              <button
                type="button"
                className={`${styles.botao} ${styles.botaoPrincipal}`}
                onClick={() => avancar(atacar(combate, rolarD20(), 'normal'))}
              >
                Atacar (d20)
              </button>
            )}
            <button type="button" className={styles.botao} onClick={() => avancar(fugir(combate, rolarD20()))}>
              Fugir da Batalha
            </button>
          </div>

          {poderes.length > 0 && (
            <div className={styles.escolhas}>
              {poderes.map((poder) => {
                const custo = powerManaCost(hero, poder);
                return (
                  <button
                    key={poder.id}
                    type="button"
                    className={styles.botao}
                    onClick={() => avancar(usarPoder(combate, poder))}
                    disabled={hero.mp < custo}
                    title={poder.desc}
                  >
                    {poder.icon} {poder.name} <span className={styles.custoDeMana}>({custo} MP)</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
