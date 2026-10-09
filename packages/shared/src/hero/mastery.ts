/**
 * Maestria de classe. Doc do Breno (2026-10): "Cada classe tem sua maestria
 * (ex: espadachim nvl 4): maestria: sendo ganhada a cada final de batalha".
 *
 * As decisões do usuário (2026-10-09):
 * - conta 1 por **sala vencida**: a fila de monstros da sala é uma batalha
 *   só, e fugir ou perder não conta;
 * - 10 níveis, cada um pedindo 10 batalhas a mais que o anterior (10, 20,
 *   30…): o nível 1 chega com 10 vitórias e o 10 com 550;
 * - cada nível dá +2% de dano, **só com a arma que a classe domina**
 *   (afinidade 100), no golpe e nos poderes;
 * - a batalha continua dando XP, e a maestria vem por cima;
 * - quem já tinha personagem começa com as vitórias de antes, convertidas
 *   do `killCount` (ver {@link veteranMasteryBattles}).
 *
 * O professor, que a maestria vai chamar, vem junto com as masmorras novas.
 *
 * `Hero` entra só como tipo: `hero.ts` importa daqui pra converter o save
 * antigo, e um import de valor no sentido contrário fecharia um ciclo.
 */

import { classById, idDaClasse, type ClassDef } from './catalog.js';
import type { Hero } from './hero.js';

export const MASTERY_MAX_LEVEL = 10;

/** +2% de dano por nível de maestria. */
export const MASTERY_DAMAGE_PER_LEVEL = 0.02;

/** Contagem que veio de save ou de outro navegador: inteiro, finito e não negativo, ou zero. */
function contagem(valor: unknown): number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : 0;
}

/** Vitórias pra chegar ao nível: 10 + 20 + … + 10×nível, que dá 5·n·(n+1). */
export function masteryBattlesFor(level: number): number {
  const n = Math.min(MASTERY_MAX_LEVEL, contagem(level));
  return 5 * n * (n + 1);
}

export function masteryLevel(battles: number): number {
  const total = contagem(battles);
  let level = 0;
  while (level < MASTERY_MAX_LEVEL && total >= masteryBattlesFor(level + 1)) level++;
  return level;
}

export interface MasteryProgress {
  level: number;
  /** Vitórias desde que o nível atual chegou. 0 no teto. */
  intoLevel: number;
  /** Quantas o próximo nível pede, contando do atual. 0 no teto. */
  toNext: number;
  maxed: boolean;
  /** Bônus do nível, em fração (0,06 = +6%). Só vale com a arma da classe. */
  bonus: number;
}

export function masteryProgress(hero: Pick<Hero, 'masteryBattles'>): MasteryProgress {
  const battles = contagem(hero.masteryBattles);
  const level = masteryLevel(battles);
  const maxed = level >= MASTERY_MAX_LEVEL;
  const start = masteryBattlesFor(level);
  return {
    level,
    intoLevel: maxed ? 0 : battles - start,
    toNext: maxed ? 0 : masteryBattlesFor(level + 1) - start,
    maxed,
    bonus: level * MASTERY_DAMAGE_PER_LEVEL,
  };
}

/** Ids de modelo das armas que a classe domina (afinidade 100). Bárbaro e bardo têm duas. */
export function masteryWeapons(cls: Pick<ClassDef, 'affinity'>): string[] {
  return Object.entries(cls.affinity)
    .filter(([, pct]) => pct === 100)
    .map(([id]) => id);
}

/**
 * Está com uma arma que a classe domina na mão principal? Olha o número da
 * tabela, e não `weaponAffinityPct`: aquela devolve 100 pra mão vazia e pra
 * arma fora da tabela, e nenhuma das duas é arma da classe.
 */
export function wieldsMasteryWeapon(hero: Pick<Hero, 'classId' | 'className' | 'equip'>): boolean {
  const cls = classById(idDaClasse(hero) ?? '');
  const arma = hero.equip.arma;
  return !!cls && !!arma && cls.affinity[arma.templateId] === 100;
}

/** Multiplicador do golpe e do dano dos poderes. 1 quando a arma na mão não é da classe. */
export function masteryDamageMult(hero: Pick<Hero, 'classId' | 'className' | 'equip' | 'masteryBattles'>): number {
  return wieldsMasteryWeapon(hero) ? 1 + masteryProgress(hero).bonus : 1;
}

export interface BattleWonResult {
  hero: Hero;
  leveledUp: boolean;
  /** Nível depois da vitória. */
  level: number;
}

/** Uma sala vencida. Sem classe não conta: a maestria é da classe. */
export function winBattle(hero: Hero): BattleWonResult {
  const before = contagem(hero.masteryBattles);
  const levelBefore = masteryLevel(before);
  if (idDaClasse(hero) === null) return { hero, leveledUp: false, level: levelBefore };

  const level = masteryLevel(before + 1);
  return { hero: { ...hero, masteryBattles: before + 1 }, leveledUp: level > levelBefore, level };
}

/**
 * As vitórias de quem jogou antes da maestria existir, a partir dos monstros
 * que derrubou: 1,6 monstro por sala vencida, medido gerando andares com a
 * própria engine (1,56 no andar 5, 1,59 no 10, 1,6 do 15 em diante).
 *
 * A conta é ×5÷8 em inteiros, e não ÷1,6: 1,6 não existe exato em ponto
 * flutuante, e 16 ÷ 1,6 dá 9,999… — um veterano perderia uma vitória no
 * arredondamento.
 */
export function veteranMasteryBattles(killCount: number): number {
  return Math.floor((contagem(killCount) * 5) / 8);
}
