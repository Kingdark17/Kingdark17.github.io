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

export * from './items/rarity.js';
export * from './items/templates.js';
export * from './items/item.js';
export * from './items/tiers.js';

export * from './monsters/species.js';
export * from './monsters/generate.js';
