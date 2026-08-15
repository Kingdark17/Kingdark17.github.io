/**
 * Evento de sala da masmorra: aventureiro ferido, altar antigo, porta
 * lacrada. Cada um tem três escolhas e o resultado depende de um atributo.
 *
 * `resolveEvent` na engine faz a conta; aqui ficam os rótulos dos botões
 * (que no original eram string de HTML em `js/events.js`) e o `resolved`
 * que precisa voltar pra sala, porque um evento resolvido não reabre.
 */

import {
  defaultRng,
  displayName,
  eventTemplateById,
  resolveEvent,
  type DungeonCell,
  type EventChoiceId,
  type EventOutcome,
  type EventTemplate,
  type EventTemplateId,
  type Rng,
} from '@rpg-legend/shared';

import { celulaAtual, substituirCelulaAtual, type EstadoNaMasmorra } from './estado';

export interface Escolha {
  id: EventChoiceId;
  label: string;
}

/** Mesmos rótulos e a mesma ordem dos botões de `js/events.js`. */
export const ESCOLHAS: Record<EventTemplateId, Escolha[]> = {
  ferido: [
    { id: 'ajudar', label: 'Dar 15 ouro' },
    { id: 'curar', label: 'Usar SAB' },
    { id: 'ignorar', label: 'Seguir caminho' },
  ],
  altar: [
    { id: 'estudar', label: 'Estudar com INT' },
    { id: 'rezar', label: 'Rezar com SAB' },
    { id: 'sacrificar', label: 'Sacrificar Vida' },
  ],
  porta: [
    { id: 'forcar', label: 'Forçar com FOR' },
    { id: 'examinar', label: 'Examinar com INT' },
    { id: 'desistir', label: 'Deixar fechada' },
  ],
};

export interface Evento {
  estado: EstadoNaMasmorra;
  template: EventTemplate;
  resolvido: boolean;
  log: string[];
}

export function abrirEvento(estado: EstadoNaMasmorra): Evento | null {
  const sala = celulaAtual(estado) as DungeonCell | null;
  const template = sala?.event ? eventTemplateById(sala.event.templateId) : null;
  if (!sala || !template) return null;

  return {
    estado,
    template,
    resolvido: !!sala.resolved,
    log: [sala.resolved ? 'Este evento já foi resolvido.' : template.text],
  };
}

export function escolhas(evento: Evento): Escolha[] {
  return ESCOLHAS[evento.template.id];
}

export function escolher(evento: Evento, escolha: EventChoiceId, rng: Rng = defaultRng): Evento {
  if (evento.resolvido) return evento;

  const resultado = resolveEvent(evento.estado.hero, evento.estado.floor, escolha, { rng });
  const mensagem = narrar(resultado.outcome);

  if (!resultado.resolved) {
    // Escolha recusada (ouro ou vida insuficiente): a sala continua aberta.
    return { ...evento, estado: { ...evento.estado, hero: resultado.hero }, log: [mensagem] };
  }

  const sala = celulaAtual(evento.estado) as DungeonCell;
  const comHeroi: EstadoNaMasmorra = { ...evento.estado, hero: resultado.hero };

  return {
    ...evento,
    estado: substituirCelulaAtual(comHeroi, { ...sala, resolved: true }),
    resolvido: true,
    log: [mensagem],
  };
}

function narrar(outcome: EventOutcome): string {
  switch (outcome.kind) {
    case 'declined':
      return 'Você segue seu caminho sem se envolver.';
    case 'insufficient_gold':
      return `Você precisaria de ${outcome.required} de ouro para isso.`;
    case 'too_wounded':
      return `Você está ferido demais: precisaria de ${outcome.required} de Vida.`;
    case 'helped_wounded':
      return `Você ajuda o aventureiro e ganha ${outcome.xpGained} XP.${outcome.leveledUp ? ` Subiu ${outcome.levels} nível(is)!` : ''}`;
    case 'healed_wounded':
      return outcome.success
        ? `Seus cuidados funcionam. O aventureiro deixa ${outcome.goldGained} de ouro em agradecimento.`
        : 'Você tenta ajudar, mas não sabe o que fazer. O aventureiro se afasta.';
    case 'studied':
      return outcome.success && outcome.item
        ? `Você decifra as runas e encontra ${displayName(outcome.item)}.`
        : 'As runas não fazem sentido para você.';
    case 'prayed':
      return outcome.success ? 'Uma calma quente percorre seu corpo.' : 'Nada responde à sua prece.';
    case 'sacrificed':
      return `Você oferece ${outcome.hpLost} de Vida ao altar.`;
    case 'forced_door':
      return outcome.success
        ? `A porta cede e revela ${outcome.goldGained} de ouro.`
        : `A porta não cede e você se machuca em ${outcome.hpLost} de Vida.`;
    default:
      return 'Nada acontece.';
  }
}
