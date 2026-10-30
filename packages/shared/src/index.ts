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
export * from './hero/mastery.js';
export * from './hero/teachers.js';

export * from './items/rarity.js';
export * from './items/templates.js';
export * from './items/item.js';
export * from './items/materiais.js';
export * from './items/runas.js';
export * from './items/encantamentos.js';
export * from './items/acessorios-unicos.js';
export * from './items/tiers.js';

export * from './monsters/species.js';
export * from './monsters/generate.js';

export * from './combat/monster-state.js';
export * from './combat/damage.js';
export * from './combat/status-effects.js';
export * from './combat/invocacao.js';
export * from './combat/weapon-proc.js';
export * from './combat/hero-status.js';
export * from './combat/class-passives.js';
export * from './combat/party.js';
export * from './combat/resolve-attack.js';
export * from './combat/monster-hit.js';
export * from './combat/use-power.js';
export * from './combat/flee.js';
export * from './combat/dodge.js';

export * from './events/events.js';

export * from './dungeon/graph.js';
export * from './dungeon/dungeons.js';
export * from './dungeon/generate.js';
export * from './dungeon/room-walk.js';
export * from './dungeon/extras.js';
export * from './dungeon/arte-da-sala.js';

export * from './inventory/inventory.js';
export * from './npc/npc-services.js';
export * from './quests/quests.js';
export * from './city/city.js';
export * from './city/mapa-da-cidade.js';
export * from './pets/pets.js';
export * from './shop/shop.js';

// O fluxo do jogo — o que junta as peças acima: entrar na sala, abrir o
// baú, vencer a luta, equipar, comprar, missões, co-op. Morava no site
// (`apps/web/lib/jogo`) e veio pra cá pra o app ter as mesmas regras,
// conferidas pelos mesmos casos (decisão do usuário, 2026-10-11). Os nomes
// seguem em português, como eram. `jogo/heroi-sorteado.ts` fica de fora:
// só os testes usam.
export * from './jogo/adm.js';
export * from './jogo/andar-na-sala.js';
export * from './jogo/apresentacao.js';
export * from './jogo/cartao.js';
export * from './jogo/chefe-final.js';
export * from './jogo/cidade.js';
export * from './jogo/combate.js';
export * from './jogo/conquista.js';
export * from './jogo/coop.js';
export * from './jogo/criacao.js';
export * from './jogo/cura-do-parceiro.js';
export * from './jogo/dialogo.js';
export * from './jogo/diario.js';
export * from './jogo/efeitos.js';
export * from './jogo/encantadora.js';
export * from './jogo/estado.js';
export * from './jogo/evento.js';
export * from './jogo/extras.js';
export * from './jogo/fim-da-luta.js';
export * from './jogo/guilda.js';
export * from './jogo/impacto.js';
export * from './jogo/loja.js';
export * from './jogo/maestria.js';
export * from './jogo/missoes.js';
export * from './jogo/mochila.js';
export * from './jogo/narrador.js';
export * from './jogo/neblina.js';
export * from './jogo/portao.js';
export * from './jogo/professor.js';
export * from './jogo/sala.js';
export * from './jogo/save-inicial.js';
export * from './jogo/totem.js';
export * from './jogo/tutorial.js';

// A luta em tempo real do app (etapa 5, decisões do usuário de 2026-10-17):
// só o app usa, mas mora aqui pelo mesmo motivo do resto — uma regra só,
// conferida pelos casos.
export * from './luta/eventos-de-arma.js';
export * from './luta/arena.js';
