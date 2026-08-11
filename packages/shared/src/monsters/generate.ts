import { defaultRng, pick, randomInt, type Rng } from '../rng.js';
import {
  BOSS_TITLES,
  ENEMY_CLASSES,
  enemyClassById,
  SPECIES,
  speciesById,
  tierLabelFor,
  type Behavior,
  type EnemyClass,
  type Species,
} from './species.js';

/**
 * Overrides pontuais para monstros especiais que não vêm de uma espécie
 * comum — hoje o único caso é o Mímico (`dungeon.js`, sala de tesouro
 * armadilhada): ele gera um monstro normal de espécie aleatória (mantendo
 * fraqueza, resistência e classe de inimigo do sorteio) e só troca nome,
 * ícone, comportamento e texto de habilidade. Combate deve sempre ler o
 * comportamento e a narração através de `monsterView()`, nunca direto da
 * espécie, para que esse override seja respeitado.
 */
export interface MonsterOverrides {
  name?: string;
  icon?: string;
  behavior?: Behavior;
  ability?: string;
  abilityDesc?: string;
}

/**
 * Instância de monstro num andar. Guarda só o que a geração decide na hora —
 * nome, ícone, comportamento, textos de habilidade e classe de inimigo vêm da
 * espécie via `monsterView()`, exatamente pelo mesmo motivo que o item guarda
 * `templateId` em vez do catálogo inteiro: essas strings persistem dentro de
 * `cell.monsters[]` no mapa salvo, e o mapa inteiro trafega a cada
 * sincronização multiplayer.
 */
export interface MonsterInstance {
  speciesId: string;
  enemyClassId: string;
  floor: number;
  hp: number;
  maxHp: number;
  dmg: number;
  speed: number;
  xp: number;
  gold: number;
  isBoss: boolean;
  isMainBoss?: boolean;
  /** Título sorteado do chefe — guardado porque é aleatório e precisa ficar estável. */
  bossTitle?: string;
  overrides?: MonsterOverrides;
}

export interface GenerateOptions {
  rng?: Rng;
}

export function generate(floor: number, { rng = defaultRng }: GenerateOptions = {}): MonsterInstance {
  const species = pick(SPECIES, rng);
  const enemyClass = pick(ENEMY_CLASSES, rng);
  const scale = 1 + (floor - 1) * 0.27;
  const hp = Math.round(species.baseHp * scale * enemyClass.hpMult) + randomInt(4, rng);

  return {
    speciesId: species.id,
    enemyClassId: enemyClass.id,
    floor,
    hp,
    maxHp: hp,
    dmg: Math.max(1, Math.round((species.baseDmg + Math.floor((floor - 1) * 0.6)) * enemyClass.dmgMult)),
    speed: Math.max(1, Math.round(species.baseSpeed * (1 + (floor - 1) * 0.09) * enemyClass.speedMult)),
    xp: 6 + floor * 3 + randomInt(4, rng),
    gold: 4 + floor * 2 + randomInt(6, rng),
    isBoss: false,
  };
}

/** Mini-chefe a cada 5 andares, chefe principal a cada 10 (`floor % 10 === 0`). */
export function generateBoss(floor: number, { rng = defaultRng }: GenerateOptions = {}): MonsterInstance {
  const species = pick(SPECIES, rng);
  const enemyClass = pick(ENEMY_CLASSES, rng);
  const isMain = floor % 10 === 0;
  const title = pick(BOSS_TITLES, rng);
  const mult = isMain ? 3.2 : 2.1;
  const hp = Math.round(species.baseHp * (1 + (floor - 1) * 0.27) * mult * enemyClass.hpMult) + 20;

  return {
    speciesId: species.id,
    enemyClassId: enemyClass.id,
    floor,
    hp,
    maxHp: hp,
    dmg: Math.round(
      (species.baseDmg + Math.floor((floor - 1) * 0.65) + (isMain ? 5 : 3)) * enemyClass.dmgMult,
    ),
    speed: Math.round(species.baseSpeed * (1 + (floor - 1) * 0.08) * 0.9),
    xp: (isMain ? 60 : 30) + floor * 5,
    gold: (isMain ? 80 : 40) + floor * 6,
    isBoss: true,
    isMainBoss: isMain,
    bossTitle: title,
  };
}

/**
 * Mímico: sala de tesouro armadilhada (`dungeon.js`, sala de baú). Reaproveita
 * um monstro comum sorteado num andar acima (mais forte que o andar atual) e
 * só troca a fachada — fraqueza, resistência e classe de inimigo continuam as
 * do sorteio original, então dois mímicos podem ter pontos fracos diferentes.
 */
export function generateMimic(floor: number, { rng = defaultRng }: GenerateOptions = {}): MonsterInstance {
  const base = generate(floor + 1, { rng });
  const hp = Math.round(base.hp * 1.45);

  return {
    ...base,
    hp,
    maxHp: hp,
    dmg: Math.round(base.dmg * 1.25),
    xp: base.xp + 8 + floor * 2,
    gold: base.gold + 10 + floor * 2,
    overrides: {
      name: `Mímico ${floor >= 8 ? 'Ancestral' : 'Faminto'}`,
      icon: '🧰',
      behavior: 'agressivo',
      ability: 'Mordida Surpresa',
      abilityDesc: 'Ataca com força depois de se revelar como um baú falso.',
    },
  };
}

/** Campos que a visão soma por cima do que já está na instância. */
export interface MonsterViewFields {
  species: Species;
  enemyClass: EnemyClass;
  name: string;
  icon: string;
  behavior: Behavior;
  ability: string;
  abilityDesc: string;
  /** `'Chefe Brutamontes'` para chefe, `'Brutamontes'` para monstro comum. */
  enemyClassLabel: string;
}

export type MonsterView = MonsterInstance & MonsterViewFields;

/**
 * Genérica em `T` de propósito: `combat.ts` estende `MonsterInstance` com
 * campos de runtime (`status`, `attackCount`, `guardHits`...) que só existem
 * durante um combate. Chamar `monsterView(combatMonster)` precisa devolver
 * esses campos de volta tipados — `MonsterView` sozinho não os conhece.
 */
export function monsterView<T extends MonsterInstance>(monster: T): T & MonsterViewFields {
  const species = speciesById(monster.speciesId);
  const enemyClass = enemyClassById(monster.enemyClassId);
  if (!species) throw new Error(`Espécie desconhecida: ${monster.speciesId}`);
  if (!enemyClass) throw new Error(`Classe de inimigo desconhecida: ${monster.enemyClassId}`);

  const overrides = monster.overrides ?? {};
  const tierLabel = tierLabelFor(monster.floor);
  const baseName = tierLabel ? `${species.name} ${tierLabel}` : species.name;
  const name = overrides.name ?? (monster.isBoss ? `${species.name}, ${monster.bossTitle}` : baseName);

  return {
    ...monster,
    species,
    enemyClass,
    name,
    icon: overrides.icon ?? species.icon,
    behavior: overrides.behavior ?? species.behavior,
    ability: overrides.ability ?? species.ability,
    abilityDesc: overrides.abilityDesc ?? species.abilityDesc,
    enemyClassLabel: monster.isBoss ? `Chefe ${enemyClass.name}` : enemyClass.name,
  };
}
