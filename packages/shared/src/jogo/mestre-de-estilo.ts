/**
 * A sala do mestre de estilo (rodada 5a, só o app a gera; a regra mora em
 * `hero/estilos.ts`): ele ensina o estilo sorteado quando o andar nasceu, e a
 * sala vira só uma sala.
 */

import type { DungeonCell } from '../dungeon/generate.js';
import { aprenderEstilo, estiloPorId, estiloUnico, type EstiloDef } from '../hero/estilos.js';
import { recomputeDerived } from '../hero/hero.js';
import { celulaAtual, substituirCelulaAtual, type EstadoDoJogo, type EstadoNaMasmorra } from './estado.js';

export interface MestreDeEstiloNaSala {
  estilo: EstiloDef;
  /** O herói já tem este estilo (aprendeu com outro mestre). */
  jaTem: boolean;
}

/** O mestre da sala de agora; `null` fora da sala dele, depois de ensinar ou com estilo que não existe. */
export function abrirMestreDeEstilo(estado: EstadoDoJogo): MestreDeEstiloNaSala | null {
  if (estado.mapMode !== 'dungeon') return null;
  const sala = celulaAtual(estado) as DungeonCell | undefined;
  const estilo = estiloPorId(sala?.mestreDeEstilo?.estilo);
  if (!sala?.mestreDeEstilo || sala.mestreDeEstilo.ensinado || !estilo) return null;
  return { estilo, jaTem: (estado.hero.estilos ?? []).includes(estilo.id) };
}

/** Aprende com o mestre: o estilo entra pro herói (e vira o ativo), e o mestre segue caminho. */
export function aprenderComMestre(estado: EstadoDoJogo): { estado: EstadoDoJogo; texto: string } {
  const mestre = abrirMestreDeEstilo(estado);
  if (!mestre) return { estado, texto: '' };
  const masmorra = estado as EstadoNaMasmorra;
  const sala = celulaAtual(masmorra) as DungeonCell;
  // A vida máxima acompanha o estilo (o Cavaleiro tem 40% a mais).
  const hero = recomputeDerived(aprenderEstilo(masmorra.hero, mestre.estilo.id));
  const depois = substituirCelulaAtual({ ...masmorra, hero }, { ...sala, mestreDeEstilo: { ...(sala.mestreDeEstilo as { estilo: string }), ensinado: true } });
  // O elemento do Mago é pra sempre (rodada 5c): nada de trocar na guilda.
  const texto = estiloUnico(masmorra.hero)
    ? `Você aprendeu o elemento ${mestre.estilo.nome}. Ele é seu pra sempre.`
    : `Você aprendeu o estilo ${mestre.estilo.nome}. Troque o estilo ativo na guilda.`;
  return { estado: depois, texto };
}
