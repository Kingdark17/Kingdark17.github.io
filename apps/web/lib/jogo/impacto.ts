/**
 * "O que muda em você" — a conta que a ficha da mochila mostra antes de
 * você equipar uma peça.
 *
 * **Nenhuma fórmula nasce aqui.** `derivedStats`, `equipmentBonus`,
 * `weaponAtkContribution`, `otherEquipAtk` e `equipItem` são exatamente as
 * funções que o combate roda e que o servidor usa pra validar o save. O
 * "depois" é o herói passado por `equipItem` e medido de novo pelas mesmas
 * réguas — não uma segunda implementação do cálculo.
 *
 * Isso importa porque a versão que existia no jogo antigo era uma segunda
 * implementação, e foi assim que `equipmentBonus()` do cliente e
 * `equipmentStat()` do servidor divergiram em produção (ver o cabeçalho de
 * `hero/derived.ts`). Um painel que promete +4 de ataque e entrega +2 é
 * pior que painel nenhum.
 *
 * Duas armadilhas moram nos números escolhidos, e as duas custam a
 * aparecer:
 *
 * 1. **`derivedStats().critico` não soma o crítico do equipamento.** Quem
 *    soma é `resolve-attack.ts`, na hora do golpe:
 *    `d.critico + bonus.critico + ...`. Ler só o derivado mostraria um anel
 *    de +5% de crítico como se não fizesse nada.
 * 2. **Ataque passa pela afinidade da classe.** Uma espada de ataque 20 vale
 *    20 no guerreiro (afinidade 100) e 6 no mago (afinidade 30) — e a
 *    afinidade depende da arma que está equipada, então tem que ser lida do
 *    herói *depois* da troca, não do de antes.
 */

import {
  derivedStats,
  equipItem,
  equipmentBonus,
  equippedSlot,
  otherEquipAtk,
  unequipItem,
  weaponAffinityPct,
  weaponAtkContribution,
  type EquipSlot,
  type Hero,
  type Item,
} from '@rpg-legend/shared';

export interface LinhaDeImpacto {
  rotulo: string;
  antes: number;
  depois: number;
}

/** O que a peça vai fazer: entrar num slot ou sair de um. */
export type AcaoDaPeca = 'equipar' | 'guardar';

export interface Impacto {
  acao: AcaoDaPeca;
  /** Só o que **mudou**. Vazia quer dizer "não altera nada em você". */
  linhas: LinhaDeImpacto[];
}

/**
 * Os sete números que equipamento de fato move, e as casas com que cada um
 * aparece.
 *
 * A lista é curta de propósito. `derivedStats` devolve dez, mas
 * `dmgFisico`, `dmgMagico`, `curaBonus`, `resistMagica` e `descontoLoja`
 * saem só de atributo — nenhuma peça os altera, e mostrá-los seria cinco
 * linhas de "18 → 18" empurrando pra fora as que importam.
 */
const MEDIDAS = [
  { chave: 'vida', rotulo: 'Vida máxima', casas: 0 },
  { chave: 'mana', rotulo: 'Mana máxima', casas: 0 },
  { chave: 'ataque', rotulo: 'Ataque', casas: 0 },
  { chave: 'defesa', rotulo: 'Defesa', casas: 0 },
  { chave: 'critico', rotulo: 'Crítico', casas: 1 },
  { chave: 'esquiva', rotulo: 'Esquiva', casas: 1 },
  { chave: 'velocidade', rotulo: 'Velocidade', casas: 0 },
] as const;

type Medida = (typeof MEDIDAS)[number]['chave'];

/** O retrato do herói nas sete medidas, lido pelas funções da engine. */
function retrato(hero: Hero): Record<Medida, number> {
  const derivados = derivedStats(hero);
  const daPeca = equipmentBonus(hero.equip);

  return {
    vida: derivados.maxHp,
    mana: derivados.maxMp,
    // Afinidade lida deste herói: é a arma dele que decide o quanto do
    // ataque entra (ver armadilha 2 no cabeçalho).
    ataque: weaponAtkContribution(hero, weaponAffinityPct(hero)) + otherEquipAtk(hero),
    defesa: daPeca.defesa,
    // A mesma soma de `resolve-attack.ts` (armadilha 1).
    critico: derivados.critico + daPeca.critico,
    esquiva: derivados.esquiva,
    velocidade: derivados.velocidade,
  };
}

function arredondar(valor: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

/**
 * Compara dois retratos e devolve só as linhas que mudam **na tela**.
 *
 * A comparação é feita no valor já arredondado, e não no bruto: uma esquiva
 * que vai de 7,04 para 7,041 vira "7,0 → 7,0", uma linha que grita mudança
 * e mostra dois números iguais. Quem lê acredita no que vê, não no float.
 */
function diferencas(antes: Record<Medida, number>, depois: Record<Medida, number>): LinhaDeImpacto[] {
  const linhas: LinhaDeImpacto[] = [];
  for (const medida of MEDIDAS) {
    const de = arredondar(antes[medida.chave], medida.casas);
    const para = arredondar(depois[medida.chave], medida.casas);
    if (de !== para) linhas.push({ rotulo: medida.rotulo, antes: de, depois: para });
  }
  return linhas;
}

/**
 * O impacto de mexer nesta peça, ou `null` quando ela não é de vestir
 * (poção, material, ou peça que não cabe em slot nenhum).
 *
 * `null` e lista vazia querem dizer coisas diferentes, e a tela trata as
 * duas separado: `null` é "não há o que equipar aqui"; lista vazia é "cabe,
 * mas não muda nada em você" — que é informação real sobre uma peça
 * puramente decorativa ou de valor.
 */
export function impactoDaPeca(hero: Hero, item: Item, slotDesejado?: EquipSlot): Impacto | null {
  const jaEquipada = equippedSlot(hero, item);

  if (jaEquipada) {
    return { acao: 'guardar', linhas: diferencas(retrato(hero), retrato(unequipItem(hero, jaEquipada))) };
  }

  const resultado = equipItem(hero, item, slotDesejado);
  if (resultado.equipped) return { acao: 'equipar', linhas: diferencas(retrato(hero), retrato(resultado.hero)) };

  // Recusada porque a arma ocupa as duas mãos. O que a tela oferece ali é a
  // troca inteira — guardar a arma e vestir a peça —, então é dela que os
  // números têm que falar. Medir o escudo sozinho prometeria a defesa que
  // entra e esconderia o ataque que sai junto.
  if (resultado.reason === 'two_handed_weapon') {
    const trocado = equipItem(unequipItem(hero, 'arma'), item, 'secundaria');
    if (trocado.equipped) return { acao: 'equipar', linhas: diferencas(retrato(hero), retrato(trocado.hero)) };
  }

  return null;
}
