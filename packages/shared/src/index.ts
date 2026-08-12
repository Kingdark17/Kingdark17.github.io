/**
 * @rpg-legend/shared — engine e contratos compartilhados.
 *
 * Regra do pacote: TypeScript puro. Nada de React, nada de DOM, nada de
 * Node. O que mora aqui roda igual no navegador e no servidor, que é o que
 * permite o NestJS validar uma jogada com exatamente o mesmo código que o
 * cliente usou para produzi-la.
 */

export * from './rng.js';

export * from './hero/stats.js';
export * from './hero/derived.js';
export * from './hero/catalog.js';
export * from './hero/hero.js';

export * from './items/rarity.js';
export * from './items/templates.js';
export * from './items/item.js';
export * from './items/tiers.js';

export * from './monsters/species.js';
export * from './monsters/generate.js';

export * from './combat/monster-state.js';
export * from './combat/damage.js';
export * from './combat/status-effects.js';
export * from './combat/weapon-proc.js';
export * from './combat/hero-status.js';
export * from './combat/class-passives.js';
export * from './combat/party.js';
export * from './combat/resolve-attack.js';
export * from './combat/monster-hit.js';

export * from './events/events.js';

export * from './dungeon/graph.js';
export * from './dungeon/generate.js';

export * from './inventory/inventory.js';
export * from './npc/npc-services.js';
export * from './quests/quests.js';
export * from './city/city.js';
export * from './pets/pets.js';
