/**
 * A máquina de turnos do combate — o que sobrou de `js/combat.js` depois
 * que a engine levou a parte pura (`resolveAttack`, `castPower`,
 * `applyPartyTurn`, `tickMonsterDot`, `applyMonsterHit`, `attemptFlee`).
 *
 * Aqui mora só a **ordem** das coisas e o que cada resultado significa pro
 * estado do jogo: quem morreu, quem entra na fila, o que cai de recompensa,
 * pra onde o jogador vai depois. A engine não sabe nada disso de propósito.
 *
 * O monstro em combate vive dentro da própria sala (`cell.monsters[i]`),
 * como no original: assim o save no meio da luta guarda a vida e os status
 * da criatura, e recarregar a página não cura o chefe.
 *
 * A rolagem do d20 entra por parâmetro em vez de ser sorteada aqui — a tela
 * mostra o dado girando antes de saber o resultado, e um dia o servidor vai
 * querer conferir a jogada com o mesmo número.
 */

import {
  addItem,
  applyMonsterHit,
  applyNpcBlessing,
  applyPartyTurn,
  attemptFlee,
  defaultRng,
  displayName,
  freshCombatMonster,
  gainXP,
  monsterView,
  onItemCollected,
  onMonsterKilled,
  randomItem,
  resolveAttack,
  tickHeroStatus,
  tickMonsterDot,
  castPower,
  type AttackStyle,
  type CombatMonster,
  type CombatMonsterView,
  type Companion,
  type DungeonCell,
  type Hero,
  type Item,
  type Power,
  type Rng,
} from '@rpg-legend/shared';

import {
  avancarAndar,
  celulaAtual,
  substituirCelulaAtual,
  voltarParaCidade,
  type EstadoDoJogo,
  type EstadoNaMasmorra,
} from './estado';

/**
 * `encontro` é a pergunta "lutar ou fugir" antes do primeiro golpe;
 * `combate` é a luta em si. Os três finais dizem à tela o que mostrar e
 * que o combate acabou.
 */
export type FaseDoCombate = 'encontro' | 'combate' | 'vitoria' | 'fuga' | 'derrota';

export interface Combate {
  estado: EstadoDoJogo;
  fase: FaseDoCombate;
  /** O que aconteceu na última ação, em ordem — vira o log da tela. */
  log: string[];
  /** Último d20 rolado, pra tela poder mostrar o dado. */
  dado: number | null;
  /** Item achado ao vencer, pra tela dar destaque. */
  loot: Item | null;
}

const CHANCE_DE_LOOT_NORMAL = 0.25;
const CHANCE_DE_LOOT_CHEFE = 0.8;
/** Abaixo deste nível a derrota não cobra nada — é a proteção de iniciante do original. */
const NIVEL_SEM_PENALIDADE = 5;

// ---------- leitura da sala ----------

/** A sala onde o jogador está, se ela for de monstro ou chefe. */
export function salaDeCombate(estado: EstadoDoJogo): DungeonCell | null {
  if (estado.mapMode !== 'dungeon') return null;
  const celula = celulaAtual(estado) as DungeonCell | null;
  if (!celula || (celula.type !== 'monster' && celula.type !== 'boss')) return null;
  return celula.monsters?.length ? celula : null;
}

export function monstroAtual(estado: EstadoDoJogo): CombatMonsterView | null {
  const sala = salaDeCombate(estado);
  if (!sala) return null;
  const bruto = sala.monsters?.[sala.monsterIndex ?? 0];
  return bruto ? monsterView(bruto as CombatMonster) : null;
}

/** Quantos inimigos ainda faltam nesta sala, contando o que está na frente. */
export function inimigosRestantes(estado: EstadoDoJogo): number {
  const sala = salaDeCombate(estado);
  if (!sala?.monsters) return 0;
  return sala.monsters.length - (sala.monsterIndex ?? 0);
}

function comMonstro(estado: EstadoNaMasmorra, monstro: CombatMonster): EstadoNaMasmorra {
  const sala = celulaAtual(estado) as DungeonCell;
  const indice = sala.monsterIndex ?? 0;
  const monsters = (sala.monsters ?? []).map((atual, i) => (i === indice ? despirView(monstro) : atual));
  return substituirCelulaAtual(estado, { ...sala, monsters });
}

/**
 * Tira os campos que `monsterView()` acrescenta antes de guardar de volta
 * na sala. Sem isso o nome, o ícone e a espécie inteira iriam parar dentro
 * do save e trafegariam no multiplayer a cada golpe — exatamente o que
 * `MonsterInstance` foi desenhado pra evitar.
 */
function despirView(monstro: CombatMonster): CombatMonster {
  const { species, enemyClass, name, icon, behavior, ability, abilityDesc, enemyClassLabel, ...cru } =
    monstro as CombatMonsterView;
  void species;
  void enemyClass;
  void name;
  void icon;
  void behavior;
  void ability;
  void abilityDesc;
  void enemyClassLabel;
  return cru;
}

// ---------- entrada e saída ----------

export function iniciarEncontro(estado: EstadoNaMasmorra): Combate {
  const monstro = monstroAtual(estado);
  const restantes = inimigosRestantes(estado);
  const abertura = !monstro
    ? 'A sala está vazia.'
    : restantes > 1
      ? `Um grupo de ${restantes} criaturas aparece! O que você faz?`
      : `${monstro.name} aparece! O que você faz?`;

  return { estado, fase: 'encontro', log: [abertura], dado: null, loot: null };
}

/**
 * Começa a luta de verdade: zera os buffs do combate anterior, consome uma
 * bênção de NPC se houver e prepara a criatura pra receber status.
 */
export function comecarCombate(combate: Combate): Combate {
  const estado = exigirMasmorra(combate);
  const monstro = monstroAtual(estado);
  if (!monstro) return { ...combate, fase: 'vitoria' };

  const log: string[] = [];

  // `applyNpcBlessing` assume que os buffs do combate anterior já foram
  // zerados — o original faz `hero.buffs={}` incondicionalmente antes.
  const dodge = estado.hero.npcBlessing?.dodge ?? 0;
  const bencao = applyNpcBlessing({ ...estado.hero, buffs: {} });
  const hero: Hero = bencao.hero;

  if (bencao.applied) log.push(`A bênção recebida concede +${dodge}% de Esquiva neste combate.`);
  log.push('O combate começa! Ataque, use um poder ou tente fugir.');

  return {
    ...combate,
    estado: comMonstro({ ...estado, hero }, freshCombatMonster(monstro)),
    fase: 'combate',
    log,
  };
}

// ---------- ações do jogador ----------

export function atacar(combate: Combate, roll: number, estilo: AttackStyle, rng: Rng = defaultRng): Combate {
  const estado = exigirMasmorra(combate);
  const monstro = monstroAtual(estado);
  if (!monstro) return combate;

  const veneno = tickHeroStatus(estado.hero);
  const log: string[] = [];
  if (veneno.damage > 0) log.push(`O veneno corrói você em ${veneno.damage} de vida.`);
  if (veneno.defeated) return derrota({ ...combate, estado: { ...estado, hero: veneno.hero } }, log, rng);

  const ataque = resolveAttack(veneno.hero, monstro, roll, estilo, { rng });

  if (ataque.outcome === 'no_mana') {
    // Turno não passa: o original só avisa e devolve o controle.
    return { ...combate, estado: { ...estado, hero: veneno.hero }, dado: roll, log: ['Mana insuficiente. Use o ataque físico.'] };
  }

  if (ataque.outcome === 'hit') {
    const tipo = ataque.magical ? 'mágico' : 'físico';
    const afinidade = ataque.affinityPct < 100 ? ` (afinidade de arma ${ataque.affinityPct}%)` : '';
    log.push(`Você acerta ${monstro.name} causando ${ataque.damage} de dano ${tipo}${ataque.isCrit ? ' (crítico!)' : ''}${afinidade}.`);
    if (ataque.procTriggered) log.push(`${ataque.procTriggered.icon} ${ataque.procTriggered.label} dispara na criatura.`);
  } else if (ataque.outcome === 'dodged') {
    log.push(`${monstro.ability} permite que ${monstro.name} evite seu ataque.`);
  } else {
    log.push('Você erra o ataque!');
  }

  const depois: Combate = {
    ...combate,
    estado: comMonstro({ ...estado, hero: ataque.hero }, ataque.monster),
    dado: roll,
    log,
  };

  if (ataque.monsterDefeated) return derrotarMonstro(depois, monstro, rng);
  return turnoDosOutros(depois, rng);
}

export function usarPoder(combate: Combate, poder: Power, rng: Rng = defaultRng): Combate {
  const estado = exigirMasmorra(combate);
  const monstro = monstroAtual(estado);
  if (!monstro) return combate;

  const veneno = tickHeroStatus(estado.hero);
  const log: string[] = [];
  if (veneno.damage > 0) log.push(`O veneno corrói você em ${veneno.damage} de vida.`);
  if (veneno.defeated) return derrota({ ...combate, estado: { ...estado, hero: veneno.hero } }, log, rng);

  const uso = castPower(veneno.hero, estado.party, monstro, poder, { rng });

  if (uso.outcome === 'no_mana') {
    return { ...combate, estado: { ...estado, hero: veneno.hero }, log: [`Mana insuficiente para usar ${poder.name}.`] };
  }

  if (uso.outcome === 'damage') log.push(`Você usa ${poder.name} e causa ${uso.damage} de dano!`);
  else if (uso.outcome === 'heal') log.push(`Você usa ${poder.name} e recupera ${uso.healed} de Vida. A equipe recupera ${uso.allyHealed}.`);
  else log.push(`Você usa ${poder.name}.`);
  if (uso.healed && uso.outcome === 'damage') log.push(`O golpe devolve ${uso.healed} de vida a você.`);

  const depois: Combate = {
    ...combate,
    estado: comMonstro({ ...estado, hero: uso.hero, party: uso.party }, uso.monster),
    log,
  };

  if (uso.monsterDefeated) return derrotarMonstro(depois, monstro, rng);
  return turnoDosOutros(depois, rng);
}

/**
 * Fugir. No encontro (antes do primeiro golpe) falhar joga o jogador
 * direto na luta; já dentro do combate, falhar custa o turno.
 */
export function fugir(combate: Combate, roll: number, rng: Rng = defaultRng): Combate {
  const estado = exigirMasmorra(combate);
  const monstro = monstroAtual(estado);
  if (!monstro) return combate;

  const tentativa = attemptFlee(estado.hero, monstro, roll);
  const comBonus = tentativa.bonus ? ` (+${tentativa.bonus} por velocidade)` : '';

  if (tentativa.success) {
    return {
      ...combate,
      fase: 'fuga',
      dado: roll,
      log: [`Você rolou ${roll}${comBonus} e fugiu com sucesso.`, 'Você escapa da batalha, ofegante.'],
    };
  }

  const log = [`Você rolou ${roll}${comBonus} e não conseguiu fugir.`];

  if (combate.fase === 'encontro') {
    const comecado = comecarCombate({ ...combate, log: [] });
    return { ...comecado, dado: roll, log: [...log, 'A fuga falha! A criatura parte para cima de você.', ...comecado.log] };
  }

  return turnoDosOutros({ ...combate, dado: roll, log }, rng);
}

// ---------- turno de quem não é o jogador ----------

/** Equipe → dano contínuo no monstro → golpe do monstro. É a ordem exata do original. */
function turnoDosOutros(combate: Combate, rng: Rng): Combate {
  const estado = exigirMasmorra(combate);
  const monstro = monstroAtual(estado);
  if (!monstro) return combate;

  const log = [...combate.log];

  const equipe = applyPartyTurn(estado.hero, estado.party, monstro, rng);
  for (const acao of equipe.outcomes) {
    if (acao.kind === 'healed_hero') log.push(`${acao.member.name} cura você em ${acao.amount}.`);
    else if (acao.kind === 'hit') log.push(`${acao.member.name} acerta a criatura causando ${acao.amount}.`);
    else log.push(`${acao.member.name} erra o golpe.`);
  }

  let comEquipe = comMonstro({ ...estado, hero: equipe.hero }, equipe.monster);
  if (equipe.defeated) return derrotarMonstro({ ...combate, estado: comEquipe, log }, monstro, rng);

  const dot = tickMonsterDot(equipe.monster);
  if (dot.damage > 0) log.push(`Os efeitos contínuos causam ${dot.damage} de dano em ${monstro.name}.`);
  comEquipe = comMonstro(comEquipe, dot.monster);
  if (dot.defeated) return derrotarMonstro({ ...combate, estado: comEquipe, log }, monstro, rng);

  const golpe = applyMonsterHit(comEquipe.hero, comEquipe.party, monsterView(dot.monster), { rng });
  log.push(textoDoGolpe(golpe, monstro.name));

  const depois: Combate = {
    ...combate,
    estado: comMonstro({ ...comEquipe, hero: golpe.hero, party: golpe.party }, golpe.monster),
    log,
  };

  return golpe.heroDefeated ? derrota(depois, log, rng) : depois;
}

function textoDoGolpe(golpe: ReturnType<typeof applyMonsterHit>, nome: string): string {
  switch (golpe.outcome) {
    case 'stunned':
      return `${nome} está atordoado e perde o turno.`;
    case 'lento_skip':
      return `${nome} está lento demais para agir.`;
    case 'dodged':
      return `Você desvia do ataque de ${nome}.`;
    case 'hit_party':
      return `${nome} atinge um companheiro causando ${golpe.damage} de dano.`;
    default:
      return `${nome} acerta você causando ${golpe.damage} de dano.`;
  }
}

// ---------- fim de combate ----------

function derrotarMonstro(combate: Combate, abatido: CombatMonsterView, rng: Rng): Combate {
  const estado = exigirMasmorra(combate);
  const sala = celulaAtual(estado) as DungeonCell;
  const log = [...combate.log];

  const xp = gainXP({ ...estado.hero, killCount: estado.hero.killCount + 1, gold: estado.hero.gold + abatido.gold }, abatido.xp);
  log.push(`Você derrotou ${abatido.name}! +${abatido.xp} XP e +${abatido.gold} ouro.`);
  if (xp.leveledUp) log.push(`Você subiu ${xp.levels} nível(is)!`);

  const comRecompensa: EstadoNaMasmorra = { ...estado, hero: xp.hero, quests: onMonsterKilled(estado.quests) };

  const indice = sala.monsterIndex ?? 0;
  const fila = sala.monsters ?? [];
  if (indice + 1 < fila.length) {
    const proximo = monsterView(fila[indice + 1] as CombatMonster);
    log.push(`${proximo.name} aparece para continuar a briga.`);
    return {
      ...combate,
      estado: substituirCelulaAtual(comRecompensa, { ...sala, monsterIndex: indice + 1 }),
      fase: 'combate',
      log,
    };
  }

  return limparSala({ ...combate, estado: comRecompensa, log }, abatido, rng);
}

/** Último inimigo caiu: a sala fica marcada, os temporários se despedem e vem a recompensa. */
function limparSala(combate: Combate, abatido: CombatMonsterView, rng: Rng): Combate {
  const estado = exigirMasmorra(combate);
  const sala = celulaAtual(estado) as DungeonCell;
  const log = [...combate.log];

  const { party, saindo } = despedirTemporarios(estado.party);
  for (const membro of saindo) log.push(`${membro.name} se despede da equipe após cumprir sua promessa.`);

  let hero = estado.hero;
  let inventory = estado.inventory;
  let quests = estado.quests;
  let loot: Item | null = null;

  if (rng() < (sala.type === 'boss' ? CHANCE_DE_LOOT_CHEFE : CHANCE_DE_LOOT_NORMAL)) {
    loot = randomItem({ floor: estado.floor, rng });
    inventory = addItem(inventory, loot);
    quests = onItemCollected(quests);
    log.push(`Encontrou ${displayName(loot)} após a batalha.`);
  }

  const bonus = sala.bonusTreasure;
  if (bonus && 'gold' in bonus) {
    hero = { ...hero, gold: hero.gold + bonus.gold };
    log.push(`Com a sala livre de perigo, você encontra mais ${bonus.gold} de ouro escondido.`);
  } else if (bonus && 'item' in bonus) {
    inventory = addItem(inventory, bonus.item);
    log.push(`Com a sala livre de perigo, você encontra ${displayName(bonus.item)} escondido.`);
  }

  const limpo = substituirCelulaAtual(
    { ...estado, hero: { ...hero, buffs: {} }, party, inventory, quests },
    { ...sala, beaten: true, bonusTreasure: undefined },
  );

  if (sala.type === 'boss') {
    const proximo = avancarAndar(limpo, rng);
    log.push(`Após vencer ${abatido.name}, o grupo avança automaticamente para o Andar ${proximo.floor}.`);
    return { ...combate, estado: proximo, fase: 'vitoria', log, loot };
  }

  return { ...combate, estado: limpo, fase: 'vitoria', log, loot };
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
function derrota(combate: Combate, log: string[], rng: Rng): Combate {
  const estado = exigirMasmorra(combate);
  const linhas = [...log];

  let hero = estado.hero;
  let inventory = estado.inventory;

  if (hero.level > NIVEL_SEM_PENALIDADE) {
    const perdido = Math.min(500, Math.floor(hero.gold * 0.1));
    hero = { ...hero, gold: Math.max(0, hero.gold - perdido) };

    const descartavel = inventory.filter((item) => !item.equipped && (item.rarity === 'comum' || item.rarity === 'incomum'));
    const item = descartavel[Math.floor(rng() * descartavel.length)];
    if (item) inventory = inventory.filter((atual) => atual.uid !== item.uid);

    linhas.push(`Você perdeu ${perdido} de ouro${item ? ` e o item ${displayName(item)}.` : '.'}`);
  } else {
    linhas.push('A proteção de iniciante preservou seus itens e seu ouro.');
  }

  const revivido: Hero = { ...hero, hp: Math.max(1, Math.floor(hero.maxHp * 0.3)), buffs: {} };
  const equipe = estado.party.map((membro) => ({ ...membro, hp: Math.max(1, Math.floor(membro.maxHp * 0.3)) }));
  linhas.push('Você foi derrotado! O grupo retorna à cidade inicial.');

  return {
    ...combate,
    estado: voltarParaCidade({ ...estado, hero: revivido, party: equipe, inventory }),
    fase: 'derrota',
    log: linhas,
  };
}

function exigirMasmorra(combate: Combate): EstadoNaMasmorra {
  if (combate.estado.mapMode !== 'dungeon') throw new Error('combate só acontece na masmorra');
  return combate.estado;
}
