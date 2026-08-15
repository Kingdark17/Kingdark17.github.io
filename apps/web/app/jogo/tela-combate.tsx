'use client';

/**
 * A tela de combate. Só desenha e rola o dado — quem decide o que acontece
 * é `lib/jogo/combate.ts`.
 *
 * O d20 é rolado aqui e passado pra máquina de turnos em vez de sorteado lá
 * dentro: a tela mostra o número que saiu, e é o mesmo número que um dia o
 * servidor vai conferir.
 */

import { useState } from 'react';

import { heroPowers, powerManaCost, type CombatMonsterView, type Power } from '@rpg-legend/shared';

import { atacar, comecarCombate, fugir, inimigosRestantes, monstroAtual, usarPoder, type Combate } from '@/lib/jogo/combate';
import styles from './jogo.module.css';
import { TextoDoJogo } from './texto-do-jogo';

const LADOS_DO_DADO = 20;
const LINHAS_DO_LOG = 8;

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
  const [historico, setHistorico] = useState<string[]>(combate.log);

  const monstro = monstroAtual(combate.estado);
  const hero = combate.estado.hero;
  const restantes = inimigosRestantes(combate.estado);
  const acabou = combate.fase === 'vitoria' || combate.fase === 'fuga' || combate.fase === 'derrota';

  function avancar(proximo: Combate) {
    setHistorico((atual) => [...atual, ...proximo.log].slice(-LINHAS_DO_LOG));
    onCombate(proximo);
  }

  const ehMago = hero.className === 'Mago';
  const poderes: Power[] = heroPowers(hero);

  if (!monstro && !acabou) return <p className={styles.erro}>A sala está vazia.</p>;

  return (
    <section className={styles.combate}>
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

      <ul className={styles.log}>
        {historico.map((linha, indice) => (
          <li key={`${indice}-${linha}`} className={styles.linhaDoLog}>
            <TextoDoJogo>{linha}</TextoDoJogo>
          </li>
        ))}
      </ul>

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
