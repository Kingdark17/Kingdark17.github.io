'use client';

import { useEffect, useRef, useState } from 'react';

import { ATTR_KEYS, ATTR_LABELS, idDaRaca, type Hero } from '@rpg-legend/shared';

import { tocar } from '@/lib/som/efeitos';
import { Paperdoll } from '../componentes/paperdoll';
import styles from './jogo.module.css';

function porcentagem(atual: number, maximo: number): string {
  return `${maximo > 0 ? Math.max(0, Math.min(100, (atual / maximo) * 100)) : 0}%`;
}

export function PainelHeroi({ hero }: { hero: Hero }) {
  const [subiu, setSubiu] = useState(false);
  const nivelAnterior = useRef(hero.level);

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
