'use client';

import type { DerivedStats } from '@rpg-legend/shared';
import { domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react';

import styles from './stats-panel.module.css';

/**
 * `LazyMotion` com `domAnimation` carrega ~6 KB de features em vez dos ~34 KB
 * do pacote inteiro, e `strict` faz `motion.*` lançar erro — assim ninguém
 * importa o componente pesado por engano e desfaz a economia sem perceber.
 */

interface StatsPanelProps {
  heroName: string;
  level: number;
  stats: DerivedStats;
}

const ROWS: ReadonlyArray<{ key: keyof DerivedStats; label: string; tone: string }> = [
  { key: 'maxHp', label: 'Vida máxima', tone: styles.hp ?? '' },
  { key: 'maxMp', label: 'Mana máxima', tone: styles.mp ?? '' },
  { key: 'dmgFisico', label: 'Dano físico', tone: '' },
  { key: 'dmgMagico', label: 'Dano mágico', tone: '' },
  { key: 'critico', label: 'Crítico (%)', tone: '' },
  { key: 'esquiva', label: 'Esquiva (%)', tone: '' },
  { key: 'velocidade', label: 'Velocidade', tone: '' },
];

export function StatsPanel({ heroName, level, stats }: StatsPanelProps) {
  const reduceMotion = useReducedMotion();

  return (
    <LazyMotion features={domAnimation} strict>
      <m.section
        className={styles.panel}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        <h1 className={styles.title}>{heroName}</h1>
        <p className={styles.caption}>
          Nível {level} · calculado por @rpg-legend/shared
        </p>

        <dl className={styles.list}>
          {ROWS.map((row, index) => (
            <m.div
              key={row.key}
              className={styles.row}
              initial={reduceMotion ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, delay: reduceMotion ? 0 : 0.1 + index * 0.04 }}
            >
              <dt className={styles.label}>{row.label}</dt>
              <dd className={`${styles.value} ${row.tone}`}>{stats[row.key]}</dd>
            </m.div>
          ))}
        </dl>
      </m.section>
    </LazyMotion>
  );
}
