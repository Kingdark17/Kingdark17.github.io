/**
 * Atributos e habilidades que sobem pelo uso — doc do Breno de 2026-11-10,
 * decidido com o usuário. Substitui os 2 pontos por nível que o jogador
 * distribuía.
 *
 * **Atributos.** Cada coisa que o herói faz anota um uso no atributo dela
 * (`anotarUso`, em `hero.usosDeAtributo`):
 * - Força: golpe corpo a corpo que acerta, e poder de dano físico;
 * - Destreza: golpe à distância que acerta, esquivar de um golpe e fugir;
 * - Inteligência: golpe mágico que acerta, poder de dano mágico e invocação;
 * - Sabedoria: poder de cura ou de apoio (buff, escudo), e poção;
 * - Carisma: conversar com NPC, comprar, vender e recrutar;
 * - Vitalidade (Constituição): não é de uso — +1 a cada nível do personagem
 *   (`gainXP`).
 *
 * Quando um monstro cai, o XP dele também treina (`treinarComXp`): é
 * repartido entre os atributos na proporção dos usos anotados desde o abate
 * anterior, e vai pro progresso de cada um (`hero.treino`). Um ponto custa
 * `custoDoPonto(nível)`, uma fração do XP do nível do personagem — então o
 * ritmo acompanha o de antes ("parecido com hoje"): `PONTOS_POR_NIVEL` pelo
 * uso, mais o de Vitalidade, dão perto dos 2 por nível. Sem uso anotado (o
 * companheiro matou sozinho), o XP não treina nada.
 *
 * **Pontos guardados.** Quem tinha pontos por distribuir não os gasta mais:
 * a cada abate, até `PONTOS_CONVERTIDOS_POR_ABATE` deles viram XP do
 * personagem (`XP_DO_PONTO_GUARDADO` do nível atual cada um). Aos poucos, e
 * não de uma vez, porque a API recusa save que suba mais de 5 níveis.
 *
 * **Habilidades.** Cada poder conta os próprios usos
 * (`hero.usosDePoder`), e o nível dele (1 a 10) dá +4% no efeito (dano e
 * cura) e −2% de mana por nível acima do primeiro.
 */

import { xpForLevel } from './derived.js';
import { ATRIBUTO_DO_NIVEL, ATRIBUTO_MAXIMO, gainXP, recomputeDerived, type Hero } from './hero.js';
import type { AttrKey } from './stats.js';

export { ATRIBUTO_DO_NIVEL, ATRIBUTO_MAXIMO };

/** Os atributos que sobem pelo uso (a Constituição sobe com o nível). */
export const ATRIBUTOS_DE_USO: readonly AttrKey[] = ['forca', 'destreza', 'intelecto', 'sabedoria', 'carisma'];

/** Quantos pontos de atributo o uso rende, em média, por nível do personagem. */
export const PONTOS_POR_NIVEL = 1.5;

/** A fração do XP do nível atual que um ponto guardado vira. */
export const XP_DO_PONTO_GUARDADO = 0.25;

/** Quantos pontos guardados viram XP a cada monstro abatido. */
export const PONTOS_CONVERTIDOS_POR_ABATE = 2;

/** Os usos acumulados em que um poder passa de nível: com 5 vai pro 2, com 15 pro 3… */
export const USOS_POR_NIVEL_DA_HABILIDADE: readonly number[] = [5, 15, 30, 50, 75, 105, 140, 180, 225];

/** Por nível de habilidade acima do primeiro: o efeito a mais e a mana a menos. */
export const EFEITO_POR_NIVEL_DA_HABILIDADE = 0.04;
export const MANA_POR_NIVEL_DA_HABILIDADE = 0.02;

export type Treino = Partial<Record<AttrKey, number>>;

const ICONES: Record<AttrKey, string> = { forca: '💪', destreza: '🏹', constituicao: '❤️', intelecto: '🧠', sabedoria: '🔮', carisma: '🗣️' };
const NOMES: Record<AttrKey, string> = { forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição', intelecto: 'Inteligência', sabedoria: 'Sabedoria', carisma: 'Carisma' };

/** O XP de treino que o próximo ponto de um atributo custa, pro personagem deste nível. */
export function custoDoPonto(nivel: number): number {
  return Math.max(1, Math.round(xpForLevel(nivel) / PONTOS_POR_NIVEL));
}

/** Anota um uso do atributo; o próximo abate o transforma em treino. A Constituição não é de uso. */
export function anotarUso(hero: Hero, chave: AttrKey, quantos = 1): Hero {
  if (!ATRIBUTOS_DE_USO.includes(chave) || quantos <= 0) return hero;
  const usos = hero.usosDeAtributo ?? {};
  return { ...hero, usosDeAtributo: { ...usos, [chave]: (usos[chave] ?? 0) + quantos } };
}

export interface ResultadoDoTreino {
  hero: Hero;
  /** O que se diz no registro: um texto por atributo que subiu. */
  log: string[];
}

/**
 * O XP de um abate treina os atributos usados desde o anterior, na proporção
 * dos usos, e zera a anotação. O atributo no teto não guarda progresso.
 */
export function treinarComXp(hero: Hero, xp: number): ResultadoDoTreino {
  const usos = hero.usosDeAtributo ?? {};
  const usados = ATRIBUTOS_DE_USO.filter((chave) => (usos[chave] ?? 0) > 0);
  const total = usados.reduce((soma, chave) => soma + (usos[chave] ?? 0), 0);
  if (!usados.length || !(xp > 0)) return { hero: hero.usosDeAtributo ? { ...hero, usosDeAtributo: {} } : hero, log: [] };

  const custo = custoDoPonto(hero.level);
  const attrs = { ...hero.attrs };
  const treino: Treino = { ...(hero.treino ?? {}) };
  const log: string[] = [];
  for (const chave of usados) {
    let progresso = (treino[chave] ?? 0) + (xp * (usos[chave] ?? 0)) / total;
    let subiu = 0;
    while (progresso >= custo && attrs[chave] < ATRIBUTO_MAXIMO) {
      progresso -= custo;
      attrs[chave] += 1;
      subiu++;
    }
    if (attrs[chave] >= ATRIBUTO_MAXIMO) delete treino[chave];
    else treino[chave] = progresso;
    if (subiu) log.push(`${ICONES[chave]} ${NOMES[chave]} subiu para ${attrs[chave]}!`);
  }
  const treinado: Hero = { ...hero, attrs, treino, usosDeAtributo: {} };
  return { hero: log.length ? recomputeDerived(treinado) : treinado, log };
}

/** Quanto do próximo ponto do atributo já foi treinado, de 0 a 1 (0 no teto e na Constituição). */
export function progressoDoTreino(hero: Hero, chave: AttrKey): number {
  if (!ATRIBUTOS_DE_USO.includes(chave) || hero.attrs[chave] >= ATRIBUTO_MAXIMO) return 0;
  return Math.max(0, Math.min(1, (hero.treino?.[chave] ?? 0) / custoDoPonto(hero.level)));
}

/**
 * Os pontos que o jogador tinha guardado viram XP do personagem, alguns por
 * abate. Devolve o herói igual quando não há ponto guardado.
 */
export function converterPontosGuardados(hero: Hero): ResultadoDoTreino {
  const guardados = Math.floor(hero.attrPoints || 0);
  if (guardados <= 0) return { hero, log: [] };
  const pontos = Math.min(guardados, PONTOS_CONVERTIDOS_POR_ABATE);
  const xp = Math.round(xpForLevel(hero.level) * XP_DO_PONTO_GUARDADO) * pontos;
  const ganho = gainXP({ ...hero, attrPoints: guardados - pontos }, xp);
  const log = [`🎓 ${pontos} ${pontos === 1 ? 'ponto guardado virou' : 'pontos guardados viraram'} ${xp} de XP.`];
  if (ganho.leveledUp) log.push(`Você subiu ${ganho.levels} nível(is)!`);
  return { hero: ganho.hero, log };
}

/** O atributo que um golpe treina: o tiro (e todo golpe de arco) é Destreza, o mágico é Inteligência, o resto é Força. */
export function atributoDoGolpe(hero: Pick<Hero, 'equip'>, estilo: 'normal' | 'magic' | 'physical' | 'ranged'): AttrKey {
  if (estilo === 'magic') return 'intelecto';
  if (estilo === 'ranged' || hero.equip.arma?.templateId === 'arco') return 'destreza';
  return 'forca';
}

/** O atributo que um poder treina: dano físico é Força; dano mágico e invocação, Inteligência; cura e apoio, Sabedoria. */
export function atributoDoPoder(tipo: string): AttrKey {
  if (tipo === 'dano_fisico') return 'forca';
  if (tipo === 'dano_magico' || tipo === 'invocar') return 'intelecto';
  return 'sabedoria';
}

/** O poder foi usado: anota o uso no atributo dele e conta o uso da habilidade. `subiu`: o nível novo dela, se passou. */
export function treinarPoder(hero: Hero, poder: { id: string; type: string }): { hero: Hero; subiu?: number } {
  return usarHabilidade(anotarUso(hero, atributoDoPoder(poder.type)), poder.id);
}

/** A linha do registro quando um poder passa de nível. */
export function textoDaHabilidade(nome: string, nivel: number): string {
  return `⭐ ${nome} subiu para o nível ${nivel}!`;
}

// ---------- habilidades ----------

/** O nível de um poder (1 a 10), pelos usos dele. */
export function nivelDaHabilidade(hero: Pick<Hero, 'usosDePoder'>, poder: string | undefined): number {
  const usos = (poder && hero.usosDePoder?.[poder]) || 0;
  let nivel = 1;
  for (const marco of USOS_POR_NIVEL_DA_HABILIDADE) if (usos >= marco) nivel++;
  return nivel;
}

/** Por quanto o nível do poder multiplica o dano e a cura dele. */
export function efeitoDaHabilidade(hero: Pick<Hero, 'usosDePoder'>, poder: string | undefined): number {
  return 1 + EFEITO_POR_NIVEL_DA_HABILIDADE * (nivelDaHabilidade(hero, poder) - 1);
}

/** A fração da mana que o nível do poder poupa. */
export function descontoDaHabilidade(hero: Pick<Hero, 'usosDePoder'>, poder: string | undefined): number {
  return MANA_POR_NIVEL_DA_HABILIDADE * (nivelDaHabilidade(hero, poder) - 1);
}

/** Quantos usos faltam pro poder passar de nível (0 no último). */
export function usosAteOProximoNivel(hero: Pick<Hero, 'usosDePoder'>, poder: string): number {
  const usos = hero.usosDePoder?.[poder] ?? 0;
  const marco = USOS_POR_NIVEL_DA_HABILIDADE.find((m) => usos < m);
  return marco === undefined ? 0 : marco - usos;
}

/** Conta um uso do poder. `subiu`: o nível novo, se passou de nível com este uso. */
export function usarHabilidade(hero: Hero, poder: string): { hero: Hero; subiu?: number } {
  const antes = nivelDaHabilidade(hero, poder);
  const usosDePoder = { ...(hero.usosDePoder ?? {}), [poder]: (hero.usosDePoder?.[poder] ?? 0) + 1 };
  const depois = nivelDaHabilidade({ usosDePoder }, poder);
  return { hero: { ...hero, usosDePoder }, ...(depois > antes ? { subiu: depois } : {}) };
}
