/**
 * Conversa com NPC: as falas em sequência e o serviço que ele oferece
 * (curar, abençoar, trocar material, revelar o mapa, recrutar).
 *
 * As regras de cada serviço já estão na engine (`npc-services.ts`); aqui
 * mora só a ordem das falas e o `serviceUsed`, que precisa voltar pra
 * dentro da sala — no original o NPC é o próprio objeto guardado em
 * `cell.npc`, então marcar o serviço como usado é uma mudança de save.
 */

import {
  defaultRng,
  displayName,
  npcServiceInfo,
  resolveBarter,
  resolveBlessing,
  resolveHeal,
  resolveRecruit,
  resolveReveal,
  type CityCell,
  type CityNpc,
  type DungeonCell,
  type DungeonNpc,
  type NpcService,
  type Rng,
} from '@rpg-legend/shared';

import { celulaAtual, substituirCelulaAtual, type EstadoDoJogo } from './estado';

/** Cidade e masmorra guardam o mesmo formato de NPC, com o mesmo serviço. */
export type Npc = CityNpc | DungeonNpc;

export interface Dialogo {
  estado: EstadoDoJogo;
  npc: Npc;
  /** Qual fala está na tela. */
  linha: number;
  log: string[];
}

export function abrirDialogo(estado: EstadoDoJogo): Dialogo | null {
  const npc = (celulaAtual(estado) as { npc?: Npc } | null)?.npc;
  if (!npc) return null;
  return { estado, npc, linha: 0, log: [] };
}

export function falaAtual(dialogo: Dialogo): string {
  return dialogo.npc.lines[dialogo.linha] ?? '';
}

export function temMaisFalas(dialogo: Dialogo): boolean {
  return dialogo.linha + 1 < dialogo.npc.lines.length;
}

/** Passa pra próxima fala; na última, fica onde está. */
export function proximaFala(dialogo: Dialogo): Dialogo {
  return temMaisFalas(dialogo) ? { ...dialogo, linha: dialogo.linha + 1 } : dialogo;
}

export function rotuloDoServico(npc: Npc): string | null {
  const info = npcServiceInfo(npc.service);
  return info ? `${info.icon} ${info.label}` : null;
}

export function servicoDisponivel(npc: Npc): boolean {
  return !npc.serviceUsed && !!npcServiceInfo(npc.service);
}

/**
 * Usa o serviço do NPC. Cada serviço mexe numa parte diferente do estado —
 * ouro e vida, bênção, mochila, mapa, ou a equipe — e o `serviceUsed` só
 * é marcado quando algo realmente aconteceu, igual ao original.
 */
export function usarServico(dialogo: Dialogo, rng: Rng = defaultRng): Dialogo {
  if (dialogo.npc.serviceUsed) return { ...dialogo, log: ['Este serviço já foi utilizado durante este encontro.'] };

  const acao = ACOES[dialogo.npc.service];
  if (!acao) return { ...dialogo, log: ['Este NPC não possui um serviço disponível.'] };

  const { estado, usado, mensagem } = acao(dialogo.estado, rng);
  const npc: Npc = usado ? { ...dialogo.npc, serviceUsed: true } : dialogo.npc;

  return { ...dialogo, estado: usado ? comNpc(estado, npc) : estado, npc, log: [mensagem] };
}

interface ResultadoDoServico {
  estado: EstadoDoJogo;
  usado: boolean;
  mensagem: string;
}

type AcaoDeServico = (estado: EstadoDoJogo, rng: Rng) => ResultadoDoServico;

const ACOES: Record<NpcService, AcaoDeServico> = {
  heal: (estado) => {
    const cura = resolveHeal(estado.hero, estado.floor);
    if (cura.outcome.kind === 'insufficient_gold') {
      return { estado, usado: false, mensagem: `Você precisa de ${cura.outcome.required} de ouro para ser tratado.` };
    }
    if (cura.outcome.kind === 'already_full') {
      return { estado, usado: false, mensagem: 'Você já está em plena forma.' };
    }
    return {
      estado: { ...estado, hero: cura.hero },
      usado: true,
      mensagem: `Por ${cura.outcome.goldSpent} de ouro você recupera ${cura.outcome.hpGained} de Vida e ${cura.outcome.mpGained} de Mana.`,
    };
  },

  blessing: (estado) => {
    const bencao = resolveBlessing(estado.hero);
    return {
      estado: { ...estado, hero: bencao.hero },
      usado: true,
      mensagem: `Você recebe uma bênção: +${bencao.outcome.dodge}% de Esquiva pelos próximos ${bencao.outcome.combats} combates.`,
    };
  },

  barter: (estado, rng) => {
    const troca = resolveBarter(estado.inventory, estado.floor, { rng });
    if (troca.outcome.kind === 'no_material') {
      return { estado, usado: false, mensagem: 'Você não tem nenhum material para trocar.' };
    }
    return {
      estado: { ...estado, inventory: troca.inventory },
      usado: true,
      mensagem: `Você troca ${displayName(troca.outcome.given)} por ${displayName(troca.outcome.received)}.`,
    };
  },

  reveal: (estado) => {
    // Só faz sentido na masmorra: o mapa da cidade é fixo e já conhecido.
    if (estado.mapMode !== 'dungeon') return { estado, usado: false, mensagem: 'Não há nada de oculto na cidade.' };

    const revelacao = resolveReveal(estado.map, estado.pos);
    return {
      estado: { ...estado, map: revelacao.grid },
      usado: true,
      mensagem: `A visão revela ${revelacao.outcome.count} sala(s) ao redor.`,
    };
  },

  recruit: (estado, rng) => {
    const recruta = resolveRecruit(estado.party, rng);
    if (recruta.outcome.kind === 'party_full') {
      return { estado, usado: false, mensagem: 'Sua equipe já está completa.' };
    }
    return {
      estado: { ...estado, party: recruta.party },
      usado: true,
      mensagem: `${recruta.outcome.companion.name} se junta à equipe por 3 combates.`,
    };
  },
};

/** Grava o NPC de volta na sala — `serviceUsed` faz parte do save. */
function comNpc(estado: EstadoDoJogo, npc: Npc): EstadoDoJogo {
  const sala = celulaAtual(estado);
  if (!sala) return estado;

  if (estado.mapMode === 'city') return substituirCelulaAtual(estado, { ...(sala as CityCell), npc: npc as CityNpc });
  return substituirCelulaAtual(estado, { ...(sala as DungeonCell), npc: npc as DungeonNpc });
}
