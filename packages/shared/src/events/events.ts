/**
 * Eventos de masmorra: escolhas curtas com resultado influenciado pelos
 * atributos do herói. Porta de `js/events.js`, só a parte de regras —
 * `open()`/`finish()` do original tocam DOM (`document.getElementById`,
 * `RPG.UI.*`) e persistência (`RPG.Save.save`) direto; isso fica para a
 * camada de orquestração futura.
 *
 * Segue o mesmo padrão de `combat/*`: `resolveEvent()` devolve só dado
 * estruturado (o que mudou no herói, sucesso ou falha, item ganho), sem
 * montar a frase de narração — quem chama decide o texto a partir de
 * `outcome.kind`, igual `resolveAttack`/`applyMonsterHit` deixam a narração
 * para fora do motor.
 */

import { gainXP, type Hero } from '../hero/hero.js';
import { randomItem, type Item } from '../items/item.js';
import { defaultRng, pick, type Rng } from '../rng.js';

export type EventTemplateId = 'ferido' | 'altar' | 'porta';

export interface EventTemplate {
  id: EventTemplateId;
  icon: string;
  title: string;
  text: string;
}

/** Igual a `js/events.js`'s `TEMPLATES`. `dungeon/generate.ts` sorteia a partir daqui em vez de manter a própria lista de ids. */
export const EVENT_TEMPLATES: EventTemplate[] = [
  { id: 'ferido', icon: '🩹', title: 'Aventureiro Ferido', text: 'Um aventureiro ferido pede ajuda no canto da sala.' },
  { id: 'altar', icon: '🕯️', title: 'Altar Antigo', text: 'Runas antigas brilham sobre um altar coberto de poeira.' },
  { id: 'porta', icon: '🚪', title: 'Porta Lacrada', text: 'Uma porta de pedra protege algo valioso. Força ou conhecimento podem abri-la.' },
];

export function eventTemplateById(id: EventTemplateId): EventTemplate | null {
  return EVENT_TEMPLATES.find((t) => t.id === id) ?? null;
}

export function randomEventTemplate(rng: Rng = defaultRng): EventTemplate {
  return pick(EVENT_TEMPLATES, rng);
}

/**
 * Escolhas válidas por evento (`ferido`: ajudar/curar/ignorar; `altar`:
 * estudar/rezar/sacrificar; `porta`: forçar/examinar/desistir). `estudar` e
 * `examinar` são ids diferentes de eventos diferentes que compartilham a
 * MESMA fórmula no original (checagem de Intelecto) — preservado assim de
 * propósito, não é engano de porte.
 */
export type EventChoiceId = 'ajudar' | 'curar' | 'ignorar' | 'estudar' | 'rezar' | 'sacrificar' | 'forcar' | 'examinar' | 'desistir';

export type EventOutcome =
  | { kind: 'declined' }
  | { kind: 'insufficient_gold'; required: number }
  | { kind: 'too_wounded'; required: number }
  | { kind: 'helped_wounded'; xpGained: number; leveledUp: boolean; levels: number }
  | { kind: 'healed_wounded'; success: boolean; goldGained: number }
  | { kind: 'studied'; success: boolean; item: Item | null }
  | { kind: 'prayed'; success: boolean }
  | { kind: 'sacrificed'; hpLost: number }
  | { kind: 'forced_door'; success: boolean; goldGained: number; hpLost: number }
  | { kind: 'invalid_choice' };

export interface EventResolveResult {
  hero: Hero;
  outcome: EventOutcome;
  /** `false` quando a escolha foi rejeitada e nada mudou (ouro/vida insuficiente, escolha desconhecida) — a sala continua sem resolver. */
  resolved: boolean;
}

export interface EventResolveOptions {
  rng?: Rng;
  /** Injetável para o `uid` do item de `estudar`/`examinar` ficar reproduzível em teste — mesmo padrão de `InstantiateOptions.now`. */
  now?: () => number;
}

function resolveAjudar(hero: Hero): EventResolveResult {
  if (hero.gold < 15) return { hero, outcome: { kind: 'insufficient_gold', required: 15 }, resolved: false };
  const afterCost: Hero = { ...hero, gold: hero.gold - 15, hp: Math.min(hero.maxHp, hero.hp + 20) };
  const xpResult = gainXP(afterCost, 8);
  return { hero: xpResult.hero, outcome: { kind: 'helped_wounded', xpGained: 8, leveledUp: xpResult.leveledUp, levels: xpResult.levels }, resolved: true };
}

function resolveCurar(hero: Hero): EventResolveResult {
  const success = hero.attrs.sabedoria >= 12;
  const nextHero = success ? { ...hero, gold: hero.gold + 30 } : hero;
  return { hero: nextHero, outcome: { kind: 'healed_wounded', success, goldGained: success ? 30 : 0 }, resolved: true };
}

/** Compartilhada por `estudar` (altar) e `examinar` (porta) — mesma fórmula no original, ver nota de `EventChoiceId`. */
function resolveEstudarOuExaminar(hero: Hero, floor: number, rng: Rng, now: (() => number) | undefined): EventResolveResult {
  const success = hero.attrs.intelecto >= 13;
  if (success) {
    const item = randomItem({ floor, rng, now });
    return { hero, outcome: { kind: 'studied', success: true, item }, resolved: true };
  }
  return { hero: { ...hero, mp: Math.max(0, hero.mp - 8) }, outcome: { kind: 'studied', success: false, item: null }, resolved: true };
}

function resolveRezar(hero: Hero): EventResolveResult {
  const success = hero.attrs.sabedoria >= 13;
  const nextHero = success ? { ...hero, hp: hero.maxHp, mp: hero.maxMp } : hero;
  return { hero: nextHero, outcome: { kind: 'prayed', success }, resolved: true };
}

function resolveSacrificar(hero: Hero): EventResolveResult {
  const amount = Math.max(10, Math.floor(hero.maxHp * 0.2));
  if (hero.hp <= amount) return { hero, outcome: { kind: 'too_wounded', required: amount }, resolved: false };
  const nextHero: Hero = { ...hero, hp: hero.hp - amount, attrPoints: (hero.attrPoints || 0) + 1 };
  return { hero: nextHero, outcome: { kind: 'sacrificed', hpLost: amount }, resolved: true };
}

function resolveForcar(hero: Hero, floor: number): EventResolveResult {
  const success = hero.attrs.forca >= 13;
  if (success) {
    const amount = 18 + floor * 3;
    return { hero: { ...hero, gold: hero.gold + amount }, outcome: { kind: 'forced_door', success: true, goldGained: amount, hpLost: 0 }, resolved: true };
  }
  return { hero: { ...hero, hp: Math.max(1, hero.hp - 10) }, outcome: { kind: 'forced_door', success: false, goldGained: 0, hpLost: 10 }, resolved: true };
}

/**
 * Resolve uma escolha de evento. Não confere se `choice` pertence ao evento
 * certo (`ferido`/`altar`/`porta`) — o original também não confere no
 * `resolve()`, só limita as escolhas possíveis nos botões que `open()`
 * desenha; quem chama aqui tem a mesma responsabilidade.
 */
export function resolveEvent(hero: Hero, floor: number, choice: EventChoiceId, options: EventResolveOptions = {}): EventResolveResult {
  const rng = options.rng ?? defaultRng;

  if (choice === 'ignorar' || choice === 'desistir') return { hero, outcome: { kind: 'declined' }, resolved: true };
  if (choice === 'ajudar') return resolveAjudar(hero);
  if (choice === 'curar') return resolveCurar(hero);
  if (choice === 'estudar' || choice === 'examinar') return resolveEstudarOuExaminar(hero, floor, rng, options.now);
  if (choice === 'rezar') return resolveRezar(hero);
  if (choice === 'sacrificar') return resolveSacrificar(hero);
  if (choice === 'forcar') return resolveForcar(hero, floor);

  return { hero, outcome: { kind: 'invalid_choice' }, resolved: false };
}
