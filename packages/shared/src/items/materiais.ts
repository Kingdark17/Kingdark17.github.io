/**
 * Os materiais das armas e armaduras, só do app (decisão do usuário,
 * 2026-10-17): cada peça tem uma escada de três degraus pelo tipo dela, e o
 * primeiro degrau é a peça de hoje.
 *
 * - **metal:** ferro → aço → aço mágico;
 * - **madeira** (arco, cajado, violão, escudo): carvalho → ébano → madeira élfica;
 * - **couro:** couro → couro reforçado → couro de dragão;
 * - **tecido** (as roupas de mago): linho → seda → seda arcana.
 *
 * O material soma por cima da raridade: cada degrau acima do primeiro põe
 * +25% na base da peça, e a raridade multiplica depois, como sempre —
 * "Espada de Aço Rara". Os acessórios ficam de fora.
 *
 * Os degraus 2 e 3 só nascem no app: a chance cresce com o andar em todo
 * item que cai (monstro, baú, chefe), o chefe tem mais, e a loja do app
 * vende só o degrau 2. O site mostra e usa a peça que veio do app, mas
 * nunca faz cair uma (quem cria item passa `app` só quando é o app).
 */

import { defaultRng, type Rng } from '../rng.js';
import type { EscadaId, ItemTemplate } from './templates.js';

/** O nome do material em cada degrau de cada escada. O do primeiro degrau não aparece no nome da peça. */
export const MATERIAIS: Readonly<Record<EscadaId, readonly string[]>> = {
  metal: ['Ferro', 'Aço', 'Aço Mágico'],
  madeira: ['Carvalho', 'Ébano', 'Madeira Élfica'],
  couro: ['Couro', 'Couro Reforçado', 'Couro de Dragão'],
  tecido: ['Linho', 'Seda', 'Seda Arcana'],
};

/** O degrau mais alto da escada. */
export const ULTIMO_DEGRAU = 3;

/** Quanto cada degrau acima do primeiro soma na base da peça, antes da raridade: 1×, 1,25×, 1,5×. */
export const BONUS_POR_DEGRAU = 0.25;

/**
 * A chance de uma peça cair no degrau 2 e no 3, pelo andar de força: zero
 * até `desde`, subindo reto até a chance cheia em `cheio`, e dali em diante
 * parada. O degrau 2 aparece no andar 5 e chega a 40% no 50; o 3 aparece no
 * 25 e chega a 15% no 75.
 */
export const CHANCE_DO_DEGRAU_2 = { desde: 5, cheio: 50, chance: 0.4 };
export const CHANCE_DO_DEGRAU_3 = { desde: 25, cheio: 75, chance: 0.15 };

/** O que o chefe deixa cair tem as duas chances multiplicadas por isto. */
export const CHANCE_DO_CHEFE = 2;

/** O multiplicador da base da peça neste degrau. */
export function multiplicadorDoDegrau(degrau: number): number {
  return 1 + BONUS_POR_DEGRAU * (degrau - 1);
}

function rampa(andar: number, { desde, cheio, chance }: { desde: number; cheio: number; chance: number }): number {
  if (andar <= desde) return 0;
  return chance * Math.min(1, (andar - desde) / (cheio - desde));
}

/** A chance de cair no degrau 2 e no 3 neste andar; as duas juntas nunca passam de 1. */
export function chancesDoDegrau(andar: number, chefe = false): { dois: number; tres: number } {
  const vezes = chefe ? CHANCE_DO_CHEFE : 1;
  const tres = Math.min(1, rampa(andar, CHANCE_DO_DEGRAU_3) * vezes);
  const dois = Math.min(1 - tres, rampa(andar, CHANCE_DO_DEGRAU_2) * vezes);
  return { dois, tres };
}

/**
 * Sorteia o degrau de uma peça que cai, com um número do `rng`. `teto` 2 é
 * a loja do app, que só vende até o degrau 2: o que seria 3 vira 2.
 */
export function sortearDegrau(andar: number, chefe = false, rng: Rng = defaultRng, teto = ULTIMO_DEGRAU): number {
  const { dois, tres } = chancesDoDegrau(andar, chefe);
  const sorteio = rng();
  if (sorteio < tres) return Math.min(3, teto);
  if (sorteio < tres + dois) return Math.min(2, teto);
  return 1;
}

/** O nome do material da peça neste degrau, ou `null` no primeiro degrau e em peça sem escada. */
export function nomeDoMaterial(template: Pick<ItemTemplate, 'escada'>, degrau: number | undefined): string | null {
  if (!template.escada || degrau === undefined || degrau < 2) return null;
  return MATERIAIS[template.escada][Math.min(degrau, ULTIMO_DEGRAU) - 1] ?? null;
}

/**
 * O nome da peça com o material: o de hoje no primeiro degrau, e "de" mais
 * o material nos outros — "Espada de Aço", "Escudo de Ébano" (o nome sem o
 * carvalho, `nomeSemMaterial`).
 */
export function nomeComMaterial(template: Pick<ItemTemplate, 'name' | 'escada' | 'nomeSemMaterial'>, degrau: number | undefined): string {
  const material = nomeDoMaterial(template, degrau);
  return material ? `${template.nomeSemMaterial ?? template.name} de ${material}` : template.name;
}
