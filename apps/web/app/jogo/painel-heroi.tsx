'use client';

import { useEffect, useRef, useState } from 'react';

import { ATTR_KEYS, ATTR_LABELS, idDaRaca, type Hero } from '@rpg-legend/shared';

import { sinaisDoHeroi } from '@/lib/paperdoll/sinais';
import { tocar } from '@/lib/som/efeitos';
import { Paperdoll } from '../componentes/paperdoll';
import styles from './jogo.module.css';

function porcentagem(atual: number, maximo: number): string {
  return `${maximo > 0 ? Math.max(0, Math.min(100, (atual / maximo) * 100)) : 0}%`;
}

/**
 * Duas voltas da piscada de `paperdoll.module.css` (0,42 s cada).
 *
 * O número está nos dois lugares e não tem como não estar: o CSS precisa
 * dele pro ritmo e o JS pra saber quando desligar. Se um dia divergirem, a
 * piscada acaba um pouco antes ou depois — nada quebra.
 */
const DURACAO_DA_PISCADA_MS = 840;

/**
 * Um pouco **menos** que a volta do giro em `paperdoll.module.css` (0,38 s).
 *
 * De propósito: o giro é infinito e quem o desliga é este relógio, então
 * onde ele desliga importa. Em 360 ms a animação está em 94,7% do arco de
 * ida e volta — com o `ease-in-out`, sobra cerca de 1° de rotação, que
 * ninguém vê sumir. Desligar **depois** da volta pegaria o começo do
 * segundo arco, e aí a arma daria um pulo pra voltar ao lugar.
 */
const DURACAO_DO_GOLPE_MS = 360;

interface Props {
  hero: Hero;
  /**
   * Quantos golpes o herói já acertou nesta sessão. Só o **aumento**
   * importa; o número em si não significa nada e não é exibido.
   */
  golpes?: number;
}

export function PainelHeroi({ hero, golpes = 0 }: Readonly<Props>) {
  const [subiu, setSubiu] = useState(false);
  const nivelAnterior = useRef(hero.level);
  const [ferido, setFerido] = useState(false);
  const vidaAnterior = useRef(hero.hp);
  const relogioDoDano = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [atacando, setAtacando] = useState(false);
  const golpesAnteriores = useRef(golpes);
  const relogioDoGolpe = useRef<ReturnType<typeof setTimeout> | null>(null);

  // O painel percebe o nível novo sozinho, como o `renderHero()` do
  // cliente antigo: subir de nível acontece no combate, na mochila e no
  // painel ADM, e nenhum dos três precisa saber que existe uma piscada.
  useEffect(() => {
    if (hero.level > nivelAnterior.current) {
      setSubiu(true);
      tocar('levelup');
    }
    nivelAnterior.current = hero.level;
  }, [hero.level]);

  /**
   * Levar dano é **acontecimento, não estado**: a vida cair de 40 pra 32
   * não deixa rastro nenhum no herói depois. Por isso a comparação é aqui,
   * com o que a tela mostrou da última vez — o mesmo desenho da piscada de
   * nível, pelo mesmo motivo: combate, veneno e painel ADM tiram vida, e
   * nenhum dos três precisa saber que o boneco pisca.
   *
   * Só a queda liga. Poção e descanso sobem a vida e não são golpe.
   */
  /**
   * Quem desliga a piscada é o relógio, e **não** `onAnimationEnd`.
   *
   * Duas razões, e a primeira é um bug: com `prefers-reduced-motion` a
   * animação não roda, `animationend` nunca chega e o sinal ficaria preso
   * em ligado pra sempre. A segunda é que a respiração é infinita e
   * dispara `animationend` a cada volta — daria pra filtrar pelo nome, mas
   * CSS Modules embaralha nome de `@keyframes` na build, e a comparação
   * quebraria em produção sem quebrar em desenvolvimento.
   *
   * O relógio mora numa `ref`, **fora da limpeza do efeito**. Com ele na
   * limpeza, tomar um golpe e beber uma poção em seguida cancelava o
   * relógio sem marcar outro, e a piscada ficava acesa pra sempre: a
   * segunda passagem do efeito limpa, vê que a vida subiu e sai sem
   * remarcar. Fora dela, cada golpe reinicia a contagem e apanhar em
   * sequência estica a piscada — que é o que se quer ver.
   */
  useEffect(() => {
    const caiu = hero.hp < vidaAnterior.current;
    vidaAnterior.current = hero.hp;

    if (caiu) {
      setFerido(true);
      if (relogioDoDano.current !== null) clearTimeout(relogioDoDano.current);
      relogioDoDano.current = setTimeout(() => setFerido(false), DURACAO_DA_PISCADA_MS);
    }
  }, [hero.hp]);

  /**
   * O golpe, pelo mesmo desenho da piscada: acertar é acontecimento, e o
   * contador que sobe é o rastro que a tela de combate deixa.
   *
   * Comparar com o valor anterior, e não reagir a "maior que zero", é o que
   * faz o segundo golpe da mesma luta girar a arma de novo.
   */
  useEffect(() => {
    const acertou = golpes > golpesAnteriores.current;
    golpesAnteriores.current = golpes;

    if (acertou) {
      setAtacando(true);
      if (relogioDoGolpe.current !== null) clearTimeout(relogioDoGolpe.current);
      relogioDoGolpe.current = setTimeout(() => setAtacando(false), DURACAO_DO_GOLPE_MS);
    }
  }, [golpes]);

  // Sair da tela no meio da piscada ou do giro não pode deixar relógio solto.
  useEffect(
    () => () => {
      clearTimeout(relogioDoDano.current ?? undefined);
      clearTimeout(relogioDoGolpe.current ?? undefined);
    },
    [],
  );

  return (
    <aside
      className={styles.painel}
      data-subiu-de-nivel={subiu || undefined}
      onAnimationEnd={(evento) => {
        if (evento.currentTarget === evento.target) setSubiu(false);
      }}
    >
      {/* O boneco vestido com o que **está equipado agora**, e não com a
          arma inicial da classe: trocar de espada na mochila muda o que
          aparece aqui. `idDaRaca` porque o herói grava `race` como nome
          ("Elfo Negro") e só os saves novos trazem `raceId` — a função
          resolve os dois. */}
      <div className={styles.retratoDoHeroi}>
        <Paperdoll
          className={styles.balaoDoBoneco}
          raca={idDaRaca(hero)}
          arma={hero.equip.arma?.templateId}
          armadura={hero.equip.armadura?.templateId}
          secundaria={hero.equip.secundaria?.templateId}
          lado={132}
          sinais={{ ...sinaisDoHeroi(hero), ferido, atacando }}
          reserva={
            <span className={styles.reservaDoRetrato} aria-hidden>
              {hero.raceIcon}
            </span>
          }
        />
      </div>

      <h2 className={styles.nomeHeroi}>{hero.name}</h2>
      <p className={styles.classeHeroi}>
        {hero.raceIcon} {hero.race} · {hero.classIcon} {hero.className} · nível {hero.level}
      </p>

      <div className={styles.barra}>
        <div className={styles.rotuloBarra}>
          <span>Vida</span>
          <span>
            {hero.hp}/{hero.maxHp}
          </span>
        </div>
        <div className={styles.trilho}>
          <div className={`${styles.preenchimento} ${styles.vida}`} style={{ width: porcentagem(hero.hp, hero.maxHp) }} />
        </div>
      </div>

      <div className={styles.barra}>
        <div className={styles.rotuloBarra}>
          <span>Mana</span>
          <span>
            {hero.mp}/{hero.maxMp}
          </span>
        </div>
        <div className={styles.trilho}>
          <div className={`${styles.preenchimento} ${styles.mana}`} style={{ width: porcentagem(hero.mp, hero.maxMp) }} />
        </div>
      </div>

      <ul className={styles.listaAtributos}>
        {ATTR_KEYS.map((chave) => (
          <li key={chave} className={styles.linhaAtributo}>
            <span className={styles.chave}>{ATTR_LABELS[chave]}</span>
            <span className={styles.valor}>{hero.attrs[chave]}</span>
          </li>
        ))}
        <li className={styles.linhaAtributo}>
          <span className={styles.chave}>Ouro</span>
          <span className={styles.valor}>{hero.gold}</span>
        </li>
        <li className={styles.linhaAtributo}>
          <span className={styles.chave}>XP</span>
          <span className={styles.valor}>
            {hero.xp}/{hero.xpNext}
          </span>
        </li>
      </ul>
    </aside>
  );
}
