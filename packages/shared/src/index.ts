/**
 * @rpg-legend/shared — engine e contratos compartilhados.
 *
 * Regra do pacote: TypeScript puro. Nada de React, nada de DOM, nada de
 * Node. O que mora aqui roda igual no navegador e no servidor, que é o que
 * permite o NestJS validar uma jogada com exatamente o mesmo código que o
 * cliente usou para produzi-la.
 */

export * from './hero/stats.js';
export * from './hero/derived.js';
