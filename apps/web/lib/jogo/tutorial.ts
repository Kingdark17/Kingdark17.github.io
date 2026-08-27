/**
 * Primeiros Passos e Guia do Aventureiro — porta de `js/tutorial.js`.
 *
 * Duas coisas diferentes com o mesmo nome no original: um **guia** de
 * texto que fica disponível pra sempre, e uma **missãozinha** de seis
 * etapas que dá 40 de ouro e uma poção ao completar.
 *
 * O progresso vive no save (`state.tutorial` no original), então trocar de
 * navegador não recomeça o tutorial. `enabled: false` desliga o
 * acompanhamento sem apagar o que já foi feito — é o que o original faz
 * pra quem dispensa o tutorial na criação do personagem.
 */

import { addItem, randomItem, defaultRng, type Item, type Rng } from '@rpg-legend/shared';

import type { EstadoDoJogo } from './estado';

export type PassoDoTutorial = 'move' | 'inventory' | 'npc' | 'shop' | 'dungeon' | 'combat';

export interface Tutorial {
  enabled: boolean;
  completed: Partial<Record<PassoDoTutorial, boolean>>;
  rewarded: boolean;
}

export interface Passo {
  id: PassoDoTutorial;
  icone: string;
  nome: string;
  dica: string;
}

/** Textos iguais aos do original, na mesma ordem. */
export const PASSOS: Passo[] = [
  { id: 'move', icone: '🧭', nome: 'Dê o primeiro passo', dica: 'Use WASD, as setas do teclado ou os botões de direção para andar.' },
  { id: 'inventory', icone: '🎒', nome: 'Abra a mochila', dica: 'Selecione um item para ver atributos, comparar, equipar, usar ou descartar.' },
  { id: 'npc', icone: '🧙', nome: 'Converse com um NPC', dica: 'NPCs podem curar, negociar, revelar o mapa ou entrar temporariamente na equipe.' },
  { id: 'shop', icone: '🏵️', nome: 'Visite uma loja', dica: 'Compare o item da loja com o equipado. Carisma melhora seus descontos.' },
  { id: 'dungeon', icone: '🏰', nome: 'Entre na masmorra', dica: 'Explore antes de usar a saída ou a escada. O mapa oculta salas ainda desconhecidas.' },
  { id: 'combat', icone: '⚔️', nome: 'Comece um combate', dica: 'Observe fraquezas e resistências. Poderes gastam Mana e podem aplicar debuffs.' },
];

export const GUIAS: { titulo: string; texto: string }[] = [
  {
    titulo: '🧭 Movimentação',
    texto: 'Use WASD, as setas ou os controles. Ao escolher “Não” em NPCs, lojas e saídas, você pode atravessar sem interagir.',
  },
  {
    titulo: '⚔️ Combate',
    texto: 'Ataques usam atributos e afinidade da arma. Poderes gastam Mana. Você também pode fugir com uma rolagem.',
  },
  {
    titulo: '☣️ Efeitos',
    texto:
      'Queimadura, veneno e sangramento causam dano contínuo. Atordoamento impede ataques; lentidão, vulnerabilidade e fraqueza reduzem a defesa do inimigo.',
  },
  { titulo: '🎒 Itens e tiers', texto: 'Compare atributos e tiers antes de equipar. A ordem é E, D, C, B, A, S, SS, SSS, SSS+ e MAX.' },
  {
    titulo: '⚒️ Reforja',
    texto: 'No ferreiro, materiais diferentes alteram as chances. A Pedra de Proteção impede queda e quatro falhas ativam garantia.',
  },
  { titulo: '🧙 NPCs e aliados', texto: 'Você começa sozinho. Converse e realize serviços para conseguir ajuda e companheiros temporários.' },
  { titulo: '👥 Multiplayer', texto: 'Cada jogador cria o próprio herói. O mapa é compartilhado e os turnos são usados somente nas batalhas.' },
  { titulo: '💾 Salvamento', texto: 'O progresso vai pra nuvem sozinho alguns segundos depois de cada passo.' },
];

/** A recompensa de fechar as seis etapas, igual ao original. */
const OURO_DA_RECOMPENSA = 40;

export interface Recado {
  titulo: string;
  texto: string;
}

export interface ResultadoDoPasso {
  estado: EstadoDoJogo;
  recado: Recado | null;
}

export function tutorialDe(estado: EstadoDoJogo): Tutorial {
  return estado.tutorial ?? { enabled: true, completed: {}, rewarded: false };
}

export function concluidos(tutorial: Tutorial): number {
  return PASSOS.filter((passo) => tutorial.completed[passo.id]).length;
}

/**
 * Marca uma etapa. Devolve o estado intacto (mesma referência) quando não
 * há nada a fazer — etapa repetida ou tutorial desligado —, pra tela não
 * agendar uma gravação à toa.
 */
export function marcar(estado: EstadoDoJogo, id: PassoDoTutorial, rng: Rng = defaultRng): ResultadoDoPasso {
  const tutorial = tutorialDe(estado);
  if (!tutorial.enabled || tutorial.completed[id]) return { estado, recado: null };

  const marcado: Tutorial = { ...tutorial, completed: { ...tutorial.completed, [id]: true } };
  const passo = PASSOS.find((atual) => atual.id === id);
  const recado: Recado | null = passo ? { titulo: `${passo.icone} Etapa concluída`, texto: passo.dica } : null;

  const faltando = PASSOS.some((atual) => !marcado.completed[atual.id]);
  if (faltando || marcado.rewarded) return { estado: { ...estado, tutorial: marcado }, recado };

  const premio: Item = randomItem({ category: 'consumivel', floor: 1, rng });
  return {
    estado: {
      ...estado,
      tutorial: { ...marcado, rewarded: true },
      hero: { ...estado.hero, gold: estado.hero.gold + OURO_DA_RECOMPENSA },
      inventory: addItem(estado.inventory, premio),
    },
    recado: {
      titulo: '🏆 Tutorial concluído',
      texto: `Você recebeu ${OURO_DA_RECOMPENSA} de ouro e uma poção. O Guia continua disponível.`,
    },
  };
}
