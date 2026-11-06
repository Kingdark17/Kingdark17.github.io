/**
 * Pisar numa armadilha (`dungeon/armadilhas.ts`): o herói andou até a casa
 * dela. Quem desenha a sala confere a casa a cada passo (`armadilhaSob`) e
 * chama `pisarNaArmadilha`; o resto é daqui: o dano (que nunca mata: para
 * em 1), o sangramento e o veneno, a chance de quebrar um membro, e a
 * armadilha que fica à vista.
 */

import { ARMADILHAS } from '../dungeon/armadilhas.js';
import type { DungeonCell } from '../dungeon/generate.js';
import { envenenar, nomeDoMembro, quebrarMembro } from '../hero/ferimentos.js';
import { defaultRng, type Rng } from '../rng.js';
import { celulaAtual, substituirCelulaAtual, type EstadoNaMasmorra } from './estado.js';
import type { Aviso } from './sala.js';

export interface ResultadoDaArmadilha {
  estado: EstadoNaMasmorra;
  aviso: Aviso;
}

/** A armadilha `indice` da sala atual dispara. `null` se ela não existe ou já disparou. Quebrar um membro gasta um número do rng (dois, quando quebra). */
export function pisarNaArmadilha(estado: EstadoNaMasmorra, indice: number, rng: Rng = defaultRng): ResultadoDaArmadilha | null {
  const sala = celulaAtual(estado) as DungeonCell | null;
  const armadilha = sala?.armadilhas?.[indice];
  if (!sala || !armadilha || armadilha.disparada) return null;
  const def = ARMADILHAS[armadilha.tipo];

  const dano = Math.min(Math.max(1, Math.round(estado.hero.maxHp * def.dano)), Math.max(0, estado.hero.hp - 1));
  let hero = envenenar({ ...estado.hero, hp: estado.hero.hp - dano }, { veneno: def.veneno, sangramento: def.sangramento });
  const textos = [`${def.nome}! Você perde ${dano} de vida.`];
  if (def.sangramento) textos.push(`O corte sangra por ${def.sangramento} salas.`);
  if (def.veneno) textos.push(`O veneno corre por ${def.veneno} salas.`);
  if (def.quebra && rng() < def.quebra) {
    const quebra = quebrarMembro(hero, rng);
    hero = quebra.hero;
    textos.push(`As pedras quebram ${nomeDoMembro(quebra.membro)}. Uma tala ou uma noite na taverna resolvem.`);
  }

  const armadilhas = (sala.armadilhas ?? []).map((a, i) => (i === indice ? { ...a, disparada: true as const } : a));
  return {
    estado: substituirCelulaAtual({ ...estado, hero }, { ...sala, armadilhas }),
    aviso: { icone: def.icone, titulo: 'Armadilha', texto: textos.join(' ') },
  };
}
