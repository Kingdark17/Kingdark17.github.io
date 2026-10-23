/**
 * O começo e o fim de uma luta, e o monstro que cai no meio dela: a bênção
 * do NPC, o XP e o ouro de cada abate, a sala limpa (item, tesouro bônus,
 * maestria, o chefe que leva ao andar seguinte ou zera a masmorra) e a
 * derrota.
 *
 * Morava dentro da máquina de turnos do site (`combate.ts`). Saiu de lá pra
 * luta em tempo real do app pagar **exatamente** o mesmo (decisão do usuário,
 * 2026-10-17: a recompensa é igual nos dois). As duas lutas chamam daqui; o
 * que é de cada uma — o log da rodada, o alvo, o som — fica com quem chama.
 *
 * Tudo trabalha sobre a sala atual, onde os monstros moram com a vida que
 * têm (`cell.monsters`). Quem chama já gravou ali a vida zerada de quem
 * caiu.
 */

import { FIM_DOS_ESQUELETOS, semInvocados } from '../combat/invocacao.js';
import { freshCombatMonster, type CombatMonster, type CombatMonsterView } from '../combat/monster-state.js';
import { DIFFICULTIES, DUNGEON_FLOORS, dungeonById, DUNGEONS, lockReason, markCleared, runName, type DungeonProgress } from '../dungeon/dungeons.js';
import type { DungeonCell } from '../dungeon/generate.js';
import { gainXP, type Companion, type Hero } from '../hero/hero.js';
import { winBattle } from '../hero/mastery.js';
import { addItem } from '../inventory/inventory.js';
import { concordar, displayName, randomItem, type Item } from '../items/item.js';
import { CHANCE_DA_RUNA_NO_CHEFE, sortearRuna } from '../items/runas.js';
import { applyNpcBlessing } from '../npc/npc-services.js';
import { onItemCollected, onMonsterKilled } from '../quests/quests.js';
import { defaultRng, type Rng } from '../rng.js';
import {
  andarDeForca,
  avancarAndar,
  celulaAtual,
  substituirCelulaAtual,
  voltarParaCidade,
  type EstadoDoJogo,
  type EstadoNaCidade,
  type EstadoNaMasmorra,
} from './estado.js';
import { maestriaSubiu } from './maestria.js';

const CHANCE_DE_LOOT_NORMAL = 0.25;
const CHANCE_DE_LOOT_CHEFE = 0.8;
/** Abaixo deste nível a derrota não cobra nada — é a proteção de iniciante do original. */
const NIVEL_SEM_PENALIDADE = 5;

/** O estado depois do passo, e o que ele escreveu no diário da luta, em ordem. */
export interface PassoDaLuta<E extends EstadoDoJogo = EstadoNaMasmorra> {
  estado: E;
  log: string[];
}

/** A sala limpa: o estado (que pode já ser o andar seguinte ou a cidade), o diário e o item achado. */
export interface SalaLimpa extends PassoDaLuta<EstadoDoJogo> {
  loot: Item | null;
}

/**
 * De pé: com vida, e não atrás do `monsterIndex` — nos saves da fila, quem
 * ficou pra trás já caiu.
 */
export function vivoNaSala(sala: DungeonCell, indice: number): boolean {
  const bruto = sala.monsters?.[indice];
  return !!bruto && indice >= (sala.monsterIndex ?? 0) && bruto.hp > 0;
}

/** Os índices de quem está de pé, na ordem da sala. */
export function indicesDePe(sala: DungeonCell): number[] {
  return (sala.monsters ?? []).map((_, indice) => indice).filter((indice) => vivoNaSala(sala, indice));
}

/**
 * Grava o monstro `indice` de volta na sala atual, sem os campos que
 * `monsterView()` acrescenta: o nome, o ícone e a espécie inteira iriam
 * parar dentro do save e trafegariam no multiplayer a cada golpe — exatamente
 * o que `MonsterInstance` foi desenhado pra evitar.
 */
export function gravarMonstro(estado: EstadoNaMasmorra, indice: number, monstro: CombatMonster): EstadoNaMasmorra {
  const sala = celulaAtual(estado) as DungeonCell;
  const { species, enemyClass, name, icon, behavior, ability, abilityDesc, enemyClassLabel, ...cru } = monstro as CombatMonsterView;
  void species;
  void enemyClass;
  void name;
  void icon;
  void behavior;
  void ability;
  void abilityDesc;
  void enemyClassLabel;
  const monsters = (sala.monsters ?? []).map((atual, i) => (i === indice ? cru : atual));
  return substituirCelulaAtual(estado, { ...sala, monsters });
}

/**
 * Prepara a sala pra luta: zera os buffs da luta anterior, consome uma
 * bênção de NPC se houver e deixa cada criatura de pé pronta pra receber
 * status (o grupo inteiro está na luta, não só a primeira).
 *
 * `applyNpcBlessing` assume os buffs já zerados — o original fazia
 * `hero.buffs={}` antes, sem condição.
 */
export function prepararLuta(estado: EstadoNaMasmorra): PassoDaLuta {
  const sala = celulaAtual(estado) as DungeonCell;
  const log: string[] = [];

  const dodge = estado.hero.npcBlessing?.dodge ?? 0;
  const bencao = applyNpcBlessing({ ...estado.hero, buffs: {} });
  if (bencao.applied) log.push(`A bênção recebida concede +${dodge}% de Esquiva neste combate.`);

  const monsters = (sala.monsters ?? []).map((bruto, indice) => (vivoNaSala(sala, indice) ? freshCombatMonster(bruto) : bruto));
  return { estado: substituirCelulaAtual({ ...estado, hero: bencao.hero }, { ...sala, monsters }), log };
}

/**
 * Paga o monstro que caiu: XP, ouro, a conta de abates e a missão.
 * `monsterIndex` volta a apontar o primeiro de pé. A luta não acaba aqui —
 * quem chama confere se sobrou alguém.
 */
export function pagarAbate(estado: EstadoNaMasmorra, abatido: CombatMonsterView): PassoDaLuta {
  const log: string[] = [];

  const xp = gainXP({ ...estado.hero, killCount: estado.hero.killCount + 1, gold: estado.hero.gold + abatido.gold }, abatido.xp);
  log.push(`Você derrotou ${abatido.name}! +${abatido.xp} XP e +${abatido.gold} ouro.`);
  if (xp.leveledUp) log.push(`Você subiu ${xp.levels} nível(is)!`);

  const comRecompensa: EstadoNaMasmorra = { ...estado, hero: xp.hero, quests: onMonsterKilled(estado.quests) };
  const sala = celulaAtual(comRecompensa) as DungeonCell;
  const primeiroDePe = indicesDePe(sala)[0];
  // Ninguém de pé: o índice fica onde estava, como na fila — quem lê a sala vencida olha `beaten`.
  const comIndice = primeiroDePe === undefined ? comRecompensa : substituirCelulaAtual(comRecompensa, { ...sala, monsterIndex: primeiroDePe });

  return { estado: comIndice, log };
}

/**
 * O último inimigo caiu: a sala fica marcada, os companheiros temporários
 * se despedem e vem a recompensa — a chance de item, o tesouro bônus e a
 * maestria (a sala inteira é uma batalha). O chefe leva ao andar seguinte;
 * o do último andar zera a masmorra e devolve o grupo à cidade.
 *
 * `abatido` é o último que caiu: o diário do chefe diz o nome dele. `now`
 * é o relógio do `uid` do item achado e do andar novo; sem ele, `Date.now`.
 * `app`: a luta é a do app, e o item achado (e o do andar novo, depois do
 * chefe) pode vir com material — o do chefe com mais chance.
 */
export function limparSala(estado: EstadoNaMasmorra, abatido: CombatMonsterView, rng: Rng = defaultRng, now?: () => number, app = false): SalaLimpa {
  const sala = celulaAtual(estado) as DungeonCell;
  const log: string[] = [];

  if (estado.party.some((membro) => membro.invocado)) log.push(FIM_DOS_ESQUELETOS);
  const { party, saindo } = despedirTemporarios(semInvocados(estado.party));
  for (const membro of saindo) log.push(`${membro.name} se despede da equipe após cumprir sua promessa.`);

  let hero = estado.hero;
  let inventory = estado.inventory;
  let quests = estado.quests;
  let loot: Item | null = null;

  if (rng() < (sala.type === 'boss' ? CHANCE_DE_LOOT_CHEFE : CHANCE_DE_LOOT_NORMAL)) {
    loot = randomItem({ floor: andarDeForca(estado), rng, ...(now ? { now } : {}), ...(app ? { app, chefe: sala.type === 'boss' } : {}) });
    inventory = addItem(inventory, loot);
    quests = onItemCollected(quests);
    log.push(`Encontrou ${displayName(loot)} após a batalha.`);
  }

  // No app, o chefe pode deixar uma runa (`items/runas.ts`), um tier acima do andar.
  if (app && sala.type === 'boss' && rng() < CHANCE_DA_RUNA_NO_CHEFE) {
    const runa = sortearRuna(andarDeForca(estado), true, rng, now);
    inventory = addItem(inventory, runa);
    log.push(`O chefe deixa cair ${displayName(runa)}.`);
  }

  const bonus = sala.bonusTreasure;
  if (bonus && 'gold' in bonus) {
    hero = { ...hero, gold: hero.gold + bonus.gold };
    log.push(`Com a sala livre de perigo, você encontra mais ${bonus.gold} de ouro escondido.`);
  } else if (bonus && 'item' in bonus) {
    inventory = addItem(inventory, bonus.item);
    const escondido = concordar(bonus.item, ['escondido', 'escondida', 'escondidos', 'escondidas']);
    log.push(`Com a sala livre de perigo, você encontra ${displayName(bonus.item)} ${escondido}.`);
  }

  // Maestria: a sala inteira é uma batalha e conta aqui, quando o último
  // inimigo cai. Fugir e perder não passam por este caminho.
  const vitoria = winBattle(hero);
  hero = vitoria.hero;
  if (vitoria.leveledUp) log.push(maestriaSubiu(hero, vitoria.level));

  const limpo = substituirCelulaAtual(
    { ...estado, hero: { ...hero, buffs: {} }, party, inventory, quests },
    { ...sala, beaten: true, bonusTreasure: undefined },
  );

  if (sala.type === 'boss' && estado.floor >= DUNGEON_FLOORS) {
    // O chefe do último andar: a masmorra está zerada nesta dificuldade, e o
    // diário diz o que abriu no portão.
    const progresso = markCleared(limpo.progresso, limpo.masmorra);
    log.push(`Você venceu ${abatido.name} e zerou ${runName(limpo.masmorra)}!`);
    log.push(...abertosAoZerar(limpo, progresso));
    log.push('O caminho de volta se abre, e o grupo retorna à cidade.');
    return { estado: voltarParaCidade({ ...limpo, progresso }), log, loot };
  }

  if (sala.type === 'boss') {
    const proximo = avancarAndar(limpo, rng, now, app);
    log.push(`Após vencer ${abatido.name}, o grupo avança automaticamente para o Andar ${proximo.floor}.`);
    return { estado: proximo, log, loot };
  }

  return { estado: limpo, log, loot };
}

/** O que a masmorra zerada abre no portão: a dificuldade seguinte e, no Normal, a próxima masmorra. */
function abertosAoZerar(estado: EstadoNaMasmorra, progresso: DungeonProgress): string[] {
  const linhas: string[] = [];
  const indice = DIFFICULTIES.findIndex((d) => d.id === estado.masmorra.difficulty);
  const seguinte = DIFFICULTIES[indice + 1];
  const masmorra = dungeonById(estado.masmorra.dungeon);
  if (seguinte && masmorra) linhas.push(`${masmorra.name} no ${seguinte.name} está aberta no portão.`);

  const proxima = DUNGEONS.find((d) => d.requires === estado.masmorra.dungeon);
  if (proxima && estado.masmorra.difficulty === 'normal') {
    const falta = lockReason(progresso, estado.hero.level, { dungeon: proxima.id, difficulty: 'normal' });
    linhas.push(falta?.kind === 'level' ? `A ${proxima.name} abre a partir do nível ${falta.minLevel}.` : `A ${proxima.name} está aberta no portão.`);
  }
  return linhas;
}

function despedirTemporarios(party: readonly Companion[]): { party: Companion[]; saindo: Companion[] } {
  const depois = party.map((membro) => (membro.temporary ? { ...membro, combatsLeft: (membro.combatsLeft ?? 0) - 1 } : membro));
  return {
    party: depois.filter((membro) => !membro.temporary || (membro.combatsLeft ?? 0) > 0),
    saindo: depois.filter((membro) => membro.temporary && (membro.combatsLeft ?? 0) <= 0),
  };
}

/**
 * Derrota. Até o nível 5 não custa nada (proteção de iniciante); depois
 * disso leva 10% do ouro (no máximo 500) e um item comum ou incomum que não
 * esteja equipado. O grupo volta pra cidade com 30% da vida.
 */
export function perderLuta(estado: EstadoNaMasmorra, rng: Rng = defaultRng): PassoDaLuta<EstadoNaCidade> {
  const log: string[] = [];

  let hero = estado.hero;
  let inventory = estado.inventory;

  if (hero.level > NIVEL_SEM_PENALIDADE) {
    const perdido = Math.min(500, Math.floor(hero.gold * 0.1));
    hero = { ...hero, gold: Math.max(0, hero.gold - perdido) };

    const descartavel = inventory.filter((item) => !item.equipped && (item.rarity === 'comum' || item.rarity === 'incomum'));
    const item = descartavel[Math.floor(rng() * descartavel.length)];
    if (item) inventory = inventory.filter((atual) => atual.uid !== item.uid);

    log.push(`Você perdeu ${perdido} de ouro${item ? ` e o item ${displayName(item)}.` : '.'}`);
  } else {
    log.push('A proteção de iniciante preservou seus itens e seu ouro.');
  }

  const revivido: Hero = { ...hero, hp: Math.max(1, Math.floor(hero.maxHp * 0.3)), buffs: {} };
  const equipe = semInvocados(estado.party).map((membro) => ({ ...membro, hp: Math.max(1, Math.floor(membro.maxHp * 0.3)) }));
  log.push('Você foi derrotado! O grupo retorna à cidade inicial.');

  return { estado: voltarParaCidade({ ...estado, hero: revivido, party: equipe, inventory }), log };
}
