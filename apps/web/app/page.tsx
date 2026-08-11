import { derivedStats, type HeroCore } from '@rpg-legend/shared';

import styles from './page.module.css';
import { StatsPanel } from './stats-panel';

/**
 * Página de fumaça da fase 0. Existe para provar três coisas de uma vez:
 *
 *  1. `@rpg-legend/shared` resolve e roda no servidor (isto é um Server
 *     Component — os números abaixo são calculados em Node, exatamente como o
 *     NestJS vai calculá-los para validar uma jogada).
 *  2. O mesmo pacote atravessa a fronteira e chega tipado no cliente.
 *  3. O Motion anima na borda cliente sem arrastar a página inteira junto.
 *
 * Some quando a tela de menu real chegar, na fase 3.
 */

const HERO: HeroCore = {
  level: 3,
  attrs: {
    forca: 14,
    destreza: 12,
    constituicao: 15,
    intelecto: 8,
    sabedoria: 10,
    carisma: 11,
  },
  equip: {
    arma: { stats: { ataque: 6, critico: 2 } },
    armadura: { stats: { defesa: 4, vida: 20 } },
    acessorio: { stats: { mana: 10, esquiva: 3 } },
  },
};

export default function Page() {
  const stats = derivedStats(HERO);

  return (
    <main className={styles.main}>
      <StatsPanel heroName="Aventureiro" level={HERO.level} stats={stats} />
    </main>
  );
}
