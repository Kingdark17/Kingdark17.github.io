/**
 * Fórmulas derivadas do herói — a ÚNICA implementação.
 *
 * Antes da migração isto existia duas vezes, e as duas cópias já haviam
 * divergido em produção:
 *
 *   `js/player.js`  → `equipmentBonus()` somava os bônus de equipamento
 *                     sem teto e deixava valores negativos subtraírem.
 *   `server.js`     → `equipmentStat()` limitava cada stat a
 *                     `500 + nível*50` e transformava negativo em 0.
 *
 * O servidor é autoritativo (é ele quem valida o save contra trapaça), então
 * a semântica dele é a que vale aqui. Na prática o cliente passa a mostrar o
 * mesmo maxHp que o servidor calcula, em vez de exibir um número que o
 * servidor depois recusaria em silêncio.
 */

import {
  ATTR_KEYS,
  EQUIP_SLOTS,
  ITEM_STAT_KEYS,
  type Attributes,
  type DerivedStats,
  type HeroCore,
  type ItemStatKey,
  type ItemStats,
} from './stats.js';

/** Teto que o servidor aplica ao bônus de vida/mana vindo de equipamento. */
export function equipmentCap(level: number): number {
  return 500 + toInt(level, 1, 500) * 50;
}

/**
 * Soma um stat vindo dos quatro slots equipados.
 *
 * Quando `cap` é informado, replica `equipmentStat()` do servidor: cada item
 * é limitado a `[0, cap]` individualmente e o total volta a ser limitado a
 * `cap`. Sem `cap`, soma livre — usado nos stats que o servidor não policia.
 */
export function equipmentStat(equip: HeroCore['equip'], key: ItemStatKey, cap?: number): number {
  let total = 0;
  for (const slot of EQUIP_SLOTS) {
    const item = equip[slot];
    if (!item?.stats) continue;
    const raw = item.stats[key];
    total += cap === undefined ? finite(raw) : toInt(raw, 0, cap);
  }
  return cap === undefined ? total : Math.min(total, cap);
}

/** Todos os bônus de equipamento de uma vez, sem teto. */
export function equipmentBonus(equip: HeroCore['equip']): Record<ItemStatKey, number> {
  const sum = {} as Record<ItemStatKey, number>;
  for (const key of ITEM_STAT_KEYS) sum[key] = equipmentStat(equip, key);
  return sum;
}

/** XP necessário para sair do nível informado. */
export function xpForLevel(level: number): number {
  return 40 + (toInt(level, 1, 500) - 1) * 35;
}

/** Modificador clássico de d20 a partir do valor bruto do atributo. */
export function attrModifier(value: number): number {
  return Math.floor((finite(value) - 10) / 2);
}

/** Soma dos seis atributos — usada na validação de progressão. */
export function totalAttributePoints(attrs: Attributes): number {
  let total = 0;
  for (const key of ATTR_KEYS) total += finite(attrs[key]);
  return total;
}

/** Penalidade de crítico aplicada por debuff ativo, conforme `js/effects`. */
export const CRIT_PENALTY = 8;

export interface DerivedOptions {
  /** `true` quando o herói está sob um debuff de `critPenalty`. */
  critPenalty?: boolean;
}

/**
 * Calcula tudo que nível, atributos e equipamento concedem — sempre do zero.
 * Nunca acumula sobre o valor anterior, então chamar duas vezes seguidas dá
 * exatamente o mesmo resultado.
 *
 * O debuff de crítico entra por parâmetro em vez de ser lido do herói: assim
 * a engine continua sem depender do sistema de efeitos, e o servidor pode
 * calcular o mesmo número sem carregar o estado de combate inteiro.
 */
export function derivedStats(hero: HeroCore, options: DerivedOptions = {}): DerivedStats {
  const a = hero.attrs;
  const cap = equipmentCap(hero.level);
  const eq = equipmentBonus(hero.equip);

  return {
    maxHp: 20 + hero.level * 5 + a.constituicao * 10 + equipmentStat(hero.equip, 'vida', cap),
    maxMp: 10 + hero.level * 2 + a.intelecto * 5 + equipmentStat(hero.equip, 'mana', cap),
    dmgFisico: a.forca * 2,
    dmgMagico: a.intelecto * 3,
    esquiva: Math.max(0, a.destreza * 0.5 + eq.esquiva),
    critico: Math.max(0, 5 + a.destreza * 0.5 - (options.critPenalty ? CRIT_PENALTY : 0)),
    velocidade: a.destreza + eq.velocidade,
    curaBonus: a.sabedoria,
    resistMagica: a.sabedoria,
    descontoLoja: a.carisma * 0.5,
  };
}

// ---------- utilitários numéricos ----------
// O save vem de JSON que o jogador pode ter editado, então nada aqui confia
// em receber número: `undefined`, `NaN` e string entram e saem saneados.

function finite(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toInt(value: unknown, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.floor(Math.max(min, Math.min(max, n)));
}

export type { ItemStats };
