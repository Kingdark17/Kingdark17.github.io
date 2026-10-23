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
 * **A sala luta em grupo** (pedido do usuário, 2026-10-16): os monstros não
 * vêm mais em fila. Todos ficam na luta, o jogador escolhe o alvo
 * (`Combate.alvo`) e **um monstro ataca por rodada**, revezando entre os de
 * pé (`cell.monsterTurn`). `cell.monsterIndex` continua apontando o
 * primeiro de pé, que é o que ele sempre quis dizer pra quem lê a sala.
 *
 * A rolagem do d20 entra por parâmetro em vez de ser sorteada aqui — a tela
 * mostra o dado girando antes de saber o resultado, e um dia o servidor vai
 * querer conferir a jogada com o mesmo número. No ataque entra também onde
 * a barra de mira parou (`JogadaDeAtaque`), pelo mesmo motivo.
 *
 * O pet também entra por parâmetro. Ele é cosmético **da conta**, não do
 * save: o original lia o global `RPG.Account.currentUser()` de dentro do
 * combate; aqui quem abre a luta já sabe quem está jogando e passa o id.
 * Assim o pet não vaza pra dentro do save nem viaja pela rede a cada golpe.
 */

import { attemptDodge } from '../combat/dodge.js';
import { attemptFlee } from '../combat/flee.js';
import { tickHeroStatus } from '../combat/hero-status.js';
import { FIM_DOS_ESQUELETOS, MAX_ESQUELETOS, semInvocados } from '../combat/invocacao.js';
import { applyMonsterHit } from '../combat/monster-hit.js';
import type { CombatMonster, CombatMonsterView } from '../combat/monster-state.js';
import { applyPartyTurn, passarRodadaDaCancao } from '../combat/party.js';
import { LADOS_DO_DANO, resolveAttack, type AttackStyle, type JogadaDeAtaque } from '../combat/resolve-attack.js';
import { tickMonsterDot } from '../combat/status-effects.js';
import { castPower } from '../combat/use-power.js';
import type { DungeonCell } from '../dungeon/generate.js';
import type { Power } from '../hero/catalog.js';
import type { Hero } from '../hero/hero.js';
import { displayName, type Item } from '../items/item.js';
import { monsterView } from '../monsters/generate.js';
import { petBonus, type PetId } from '../pets/pets.js';
import { defaultRng, type Rng } from '../rng.js';
import type { Efeito } from './efeitos.js';
import { celulaAtual, substituirCelulaAtual, type EstadoDoJogo, type EstadoNaMasmorra } from './estado.js';
import { gravarMonstro, indicesDePe, limparSala, pagarAbate, perderLuta, prepararLuta, vivoNaSala } from './fim-da-luta.js';
import { podeUsar, usar } from './mochila.js';

/**
 * `combate` é a luta; os três finais dizem à tela o que mostrar e que ela
 * acabou.
 *
 * **Havia uma fase `encontro` antes desta, e ela foi tirada.** Era a tela
 * "Fulano aparece! O que você faz? [Lutar] [Fugir]", e o Breno apontou que
 * ela não decidia nada: a pergunta de entrar na sala já tinha sido feita na
 * porta, e "Fugir" continua existindo dentro da luta. Custava um clique por
 * combate pra repetir uma escolha já feita.
 *
 * O que se perdeu junto: naquela fase, falhar a fuga só começava a luta,
 * sem a criatura revidar — era uma tentativa de graça. Agora vale a regra
 * única, a mesma do resto do combate: falhar custa o turno.
 */
export type FaseDoCombate = 'combate' | 'vitoria' | 'fuga' | 'derrota';

export interface Combate {
  estado: EstadoDoJogo;
  fase: FaseDoCombate;
  /** O que aconteceu na última ação, em ordem — vira o log da tela. */
  log: string[];
  /**
   * Último dado rolado, pra tela mostrar: o d20 de dano no ataque, o d20 da
   * esquiva ou da fuga. Carrega quantos lados por herança do tempo em que a
   * classe rolava d6 no ataque; hoje é sempre 20, mas a tela não precisa
   * supor.
   */
  dado: Rolagem | null;
  /** Item achado ao vencer, pra tela dar destaque. */
  loot: Item | null;
  /** Pet cosmético da conta, pelos bônus de crítico/esquiva/cura/mana. */
  pet: PetId | null;
  /**
   * Som da última ação, pra tela tocar. Decidido aqui porque é aqui que se
   * sabe se o golpe foi crítico ou se o herói caiu — deduzir isso do log
   * na tela seria ler texto pra descobrir o que a regra já sabia.
   *
   * Segue a disciplina do `dado`: **toda ação define o seu**, senão o
   * `{ ...combate }` carregaria o som do turno anterior.
   */
  som: Efeito | null;
  /**
   * Números que sobem e somem na tela — o `floatText` de `js/effects.js`.
   * Lista, e não um só, porque um turno produz mais de um: seu golpe e o
   * troco da criatura acontecem na mesma ação. Zera a cada ação, igual ao
   * `log`.
   */
  flutuantes: Flutuante[];
  /**
   * O monstro que o jogador escolheu atacar: o índice dele em
   * `cell.monsters`. Golpe, poder e equipe vão nele. Caiu, o alvo passa pro
   * primeiro de pé — `alvoDaLuta` confere sempre, então um índice velho
   * nunca acerta defunto.
   */
  alvo: number;
}

export interface Rolagem {
  valor: number;
  lados: number;
}

export interface Flutuante {
  texto: string;
  tom: 'dano' | 'critico';
  /** Sobre quem o número aparece. */
  alvo: 'inimigo' | 'heroi';
  /** No inimigo: em qual monstro do grupo (o índice em `cell.monsters`). */
  indice?: number;
}

// ---------- leitura da sala ----------

/** A sala onde o jogador está, se ela for de monstro ou chefe. */
export function salaDeCombate(estado: EstadoDoJogo): DungeonCell | null {
  if (estado.mapMode !== 'dungeon') return null;
  const celula = celulaAtual(estado) as DungeonCell | null;
  if (!celula || (celula.type !== 'monster' && celula.type !== 'boss')) return null;
  return celula.monsters?.length ? celula : null;
}

/** O primeiro monstro de pé — o que `monsterIndex` aponta. */
export function monstroAtual(estado: EstadoDoJogo): CombatMonsterView | null {
  const sala = salaDeCombate(estado);
  if (!sala) return null;
  const bruto = sala.monsters?.[sala.monsterIndex ?? 0];
  return bruto ? monsterView(bruto as CombatMonster) : null;
}

/** Quantos inimigos ainda estão de pé nesta sala. */
export function inimigosRestantes(estado: EstadoDoJogo): number {
  const sala = salaDeCombate(estado);
  return sala ? indicesDePe(sala).length : 0;
}

export interface InimigoNaLuta {
  /** O índice em `cell.monsters` — é o que `escolherAlvo` recebe. */
  indice: number;
  monstro: CombatMonsterView;
  vivo: boolean;
}

/** O grupo inteiro, na ordem da sala, com quem ainda está de pé: a tela da luta mostra todos. */
export function inimigosDaLuta(estado: EstadoDoJogo): InimigoNaLuta[] {
  const sala = salaDeCombate(estado);
  if (!sala?.monsters) return [];
  return sala.monsters.map((bruto, indice) => ({ indice, monstro: monsterView(bruto as CombatMonster), vivo: vivoNaSala(sala, indice) }));
}

/**
 * De quem é a vez de atacar: o primeiro de pé a partir de
 * `cell.monsterTurn`, dando a volta no grupo. Sem `monsterTurn` (luta que
 * acabou de começar, save de antes do grupo), começa pelo primeiro.
 */
export function vezDoMonstro(estado: EstadoDoJogo): number | null {
  const sala = salaDeCombate(estado);
  if (!sala) return null;
  const dePe = indicesDePe(sala);
  const desde = sala.monsterTurn ?? 0;
  return dePe.find((indice) => indice >= desde) ?? dePe[0] ?? null;
}

/** O alvo do jogador, se ainda está de pé; senão o primeiro de pé. */
export function alvoDaLuta(combate: Combate): number | null {
  const sala = salaDeCombate(combate.estado);
  if (!sala) return null;
  return vivoNaSala(sala, combate.alvo) ? combate.alvo : (indicesDePe(sala)[0] ?? null);
}

/** Trocar o alvo não gasta o turno. Monstro caído (ou índice que não existe) não vira alvo. */
export function escolherAlvo(combate: Combate, indice: number): Combate {
  const sala = salaDeCombate(combate.estado);
  if (!sala || !vivoNaSala(sala, indice)) return combate;
  return { ...combate, alvo: indice };
}

function monstroNo(estado: EstadoNaMasmorra, indice: number): CombatMonsterView {
  const sala = celulaAtual(estado) as DungeonCell;
  return monsterView((sala.monsters ?? [])[indice] as CombatMonster);
}

/**
 * O mais rápido de pé: é contra ele que fugir e esquivar medem a velocidade
 * (decisão do usuário, 2026-10-17 — de um grupo, quem barra a saída é o mais
 * rápido). Empate fica com o primeiro.
 */
function maisRapido(estado: EstadoNaMasmorra): CombatMonsterView | null {
  const sala = celulaAtual(estado) as DungeonCell;
  let rapido: CombatMonsterView | null = null;
  for (const indice of indicesDePe(sala)) {
    const monstro = monstroNo(estado, indice);
    if (!rapido || monstro.speed > rapido.speed) rapido = monstro;
  }
  return rapido;
}

// ---------- entrada e saída ----------

/**
 * Entrar na sala **já é entrar na luta** — ver `FaseDoCombate`.
 *
 * A abertura perdeu o "O que você faz?" junto com os botões: sem pergunta
 * na tela, o texto que pergunta vira mentira. Quem diz o que fazer agora é
 * a linha que `comecarCombate` escreve logo abaixo ("Ataque, use um poder
 * ou tente fugir"), e ela já existia.
 */
export function iniciarEncontro(estado: EstadoNaMasmorra, pet: PetId | null = null): Combate {
  const monstro = monstroAtual(estado);
  const restantes = inimigosRestantes(estado);
  const abertura = !monstro
    ? 'A sala está vazia.'
    : restantes > 1
      ? `Um grupo de ${restantes} criaturas aparece!`
      : `${monstro.name} aparece!`;

  const aberto: Combate = {
    estado,
    fase: 'combate',
    log: [abertura],
    dado: null,
    loot: null,
    pet,
    som: null,
    flutuantes: [],
    alvo: salaDeCombate(estado)?.monsterIndex ?? 0,
  };

  // Sala sem criatura não vira vitória: `comecarCombate` a declararia
  // ganha, e a tela mostraria "Continuar" no lugar de "A sala está vazia".
  // O combate nunca começou — não há o que celebrar.
  if (!monstro) return aberto;

  const comecado = comecarCombate(aberto);
  return { ...comecado, log: [abertura, ...comecado.log] };
}

/**
 * Começa a luta de verdade: zera os buffs do combate anterior, consome uma
 * bênção de NPC se houver e prepara cada criatura de pé pra receber status
 * (o grupo inteiro está na luta, não só a primeira).
 */
export function comecarCombate(combate: Combate): Combate {
  const estado = exigirMasmorra(combate);
  const sala = salaDeCombate(estado);
  if (!sala || !monstroAtual(estado)) return { ...combate, fase: 'vitoria' };

  const preparada = prepararLuta(estado);
  return {
    ...combate,
    estado: preparada.estado,
    fase: 'combate',
    log: [...preparada.log, 'O combate começa! Ataque, use um poder ou tente fugir.'],
    som: null,
    flutuantes: [],
  };
}

// ---------- ações do jogador ----------

/** Acerto normal, crítico e erro têm som próprio; esquiva do monstro conta como erro. */
function somDoGolpe(acertou: boolean, critico: boolean | undefined): Efeito {
  if (!acertou) return 'miss';
  return critico ? 'crit' : 'hit';
}

/**
 * Atacar: o d20 de dano e a barra de mira já aconteceram na tela, e chegam
 * aqui em `jogada` (ver `JogadaDeAtaque` na engine).
 */
export function atacar(combate: Combate, jogada: JogadaDeAtaque, estilo: AttackStyle, rng: Rng = defaultRng): Combate {
  const estado = exigirMasmorra(combate);
  const alvo = alvoDaLuta(combate);
  if (alvo === null) return combate;
  const monstro = monstroNo(estado, alvo);

  const veneno = tickHeroStatus(estado.hero);
  const log: string[] = [];
  if (veneno.damage > 0) log.push(`O veneno corrói você em ${veneno.damage} de vida.`);
  if (veneno.defeated) return morteNoVeneno(combate, veneno.hero, log, rng);

  const ataque = resolveAttack(veneno.hero, monstro, jogada, estilo, { rng, petCriticoBonus: petBonus(combate.pet).critico ?? 0 });
  const dado: Rolagem = { valor: jogada.dado, lados: LADOS_DO_DANO };

  if (ataque.outcome === 'no_mana') {
    // Turno não passa: o original só avisa e devolve o controle.
    return { ...combate, estado: { ...estado, hero: veneno.hero }, dado, log: ['Mana insuficiente. Use o ataque físico.'], som: null, flutuantes: [] };
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
    estado: gravarMonstro({ ...estado, hero: ataque.hero }, alvo, ataque.monster),
    alvo,
    dado,
    log,
    som: somDoGolpe(ataque.outcome === 'hit', ataque.isCrit),
    flutuantes:
      ataque.outcome === 'hit'
        ? [{ texto: `${ataque.isCrit ? 'CRÍTICO! ' : ''}-${ataque.damage}`, tom: ataque.isCrit ? 'critico' : 'dano', alvo: 'inimigo', indice: alvo }]
        : [],
  };

  if (ataque.monsterDefeated) return heroiMatou(depois, alvo, monstro, rng);
  return turnoDosOutros(depois, rng);
}

/**
 * O que `usarPoder` devolve: o combate, e **quanto a cura deste poder manda
 * pro parceiro online**.
 *
 * A quantia vem ao lado do `Combate`, e não dentro dele, de propósito: o
 * combate vai pro estado da tela e é espalhado (`...combate`) a cada ação;
 * um campo ali dentro ficaria parado com o valor da última cura, pronto pra
 * ser reenviado por engano. Quem chama tira a quantia, manda, e guarda só o
 * combate.
 */
export interface ResultadoDoPoder {
  combate: Combate;
  /** Zero quando o poder não curou. É a mesma parte que os companheiros recebem. */
  curaDoParceiro: number;
}

export function usarPoder(combate: Combate, poder: Power, rng: Rng = defaultRng): ResultadoDoPoder {
  const semCura = (fim: Combate): ResultadoDoPoder => ({ combate: fim, curaDoParceiro: 0 });

  const estado = exigirMasmorra(combate);
  const alvo = alvoDaLuta(combate);
  if (alvo === null) return semCura(combate);
  const monstro = monstroNo(estado, alvo);

  const veneno = tickHeroStatus(estado.hero);
  const log: string[] = [];
  if (veneno.damage > 0) log.push(`O veneno corrói você em ${veneno.damage} de vida.`);
  if (veneno.defeated) return semCura(morteNoVeneno(combate, veneno.hero, log, rng));

  const bonus = petBonus(combate.pet);
  const uso = castPower(veneno.hero, estado.party, monstro, poder, {
    rng,
    petCuraBonus: bonus.healing ?? 0,
    petManaSaveChance: bonus.manaSave ?? 0,
  });

  if (uso.outcome === 'no_mana') {
    return semCura({ ...combate, estado: { ...estado, hero: veneno.hero }, log: [`Mana insuficiente para usar ${poder.name}.`], som: null, flutuantes: [] });
  }
  if (uso.outcome === 'summon_full') {
    return semCura({ ...combate, estado: { ...estado, hero: veneno.hero }, log: [`Seus ${MAX_ESQUELETOS} esqueletos já estão de pé.`], som: null, flutuantes: [] });
  }

  if (uso.outcome === 'damage') log.push(`Você usa ${poder.name} e causa ${uso.damage} de dano!`);
  else if (uso.outcome === 'heal') log.push(`Você usa ${poder.name} e recupera ${uso.healed} de Vida. A equipe recupera ${uso.allyHealed}.`);
  else if (uso.outcome === 'summon') log.push(`Você usa ${poder.name}: ${uso.summoned?.name ?? 'um esqueleto'} se ergue para lutar ao seu lado!`);
  else log.push(`Você usa ${poder.name}.`);
  if (uso.healed && uso.outcome === 'damage') log.push(`O golpe devolve ${uso.healed} de vida a você.`);

  const depois: Combate = {
    ...combate,
    estado: gravarMonstro({ ...estado, hero: uso.hero, party: uso.party }, alvo, uso.monster),
    alvo,
    log,
    // Poder que cura não é golpe; o original só tinha som de acerto.
    som: uso.outcome === 'damage' ? 'crit' : null,
    flutuantes: uso.outcome === 'damage' ? [{ texto: `${poder.icon} -${uso.damage}`, tom: 'critico', alvo: 'inimigo', indice: alvo }] : [],
  };

  const curaDoParceiro = uso.outcome === 'heal' ? (uso.allyHealed ?? 0) : 0;
  const fim = uso.monsterDefeated ? heroiMatou(depois, alvo, monstro, rng) : turnoDosOutros(depois, rng);
  return { combate: fim, curaDoParceiro };
}

/**
 * Fugir. Falhar **custa o turno**: a equipe age e a criatura revida.
 *
 * Antes havia uma exceção pra primeira tentativa, feita da tela de
 * encontro: ali falhar só começava a luta, de graça. A tela saiu (ver
 * `FaseDoCombate`) e a exceção com ela — a saída grátis de uma sala de
 * monstro continua existindo, mas na porta, no "deseja entrar?".
 */
export function fugir(combate: Combate, roll: number, rng: Rng = defaultRng): Combate {
  const estado = exigirMasmorra(combate);
  const rapido = maisRapido(estado);
  if (!rapido) return combate;

  const tentativa = attemptFlee(estado.hero, rapido, roll);
  const comBonus = tentativa.bonus ? ` (+${tentativa.bonus} por velocidade)` : '';
  const dado: Rolagem = { valor: roll, lados: 20 };

  if (tentativa.success) {
    // Os esqueletos do necromante são da luta: ficam pra trás.
    const comEsqueletos = estado.party.some((membro) => membro.invocado);
    return {
      ...combate,
      estado: comEsqueletos ? { ...estado, party: semInvocados(estado.party) } : estado,
      fase: 'fuga',
      dado,
      log: [`Você rolou ${roll}${comBonus} e fugiu com sucesso.`, 'Você escapa da batalha, ofegante.', ...(comEsqueletos ? [FIM_DOS_ESQUELETOS] : [])],
      som: 'door',
      flutuantes: [],
    };
  }

  const log = [`Você rolou ${roll}${comBonus} e não conseguiu fugir.`];

  // `som` e `flutuantes` zerados aqui, e não herdados: sem isso, falhar a
  // fuga logo depois de um acerto repetia o som do golpe, mostrava de novo
  // o número no inimigo e girava a arma do boneco — um ataque fantasma. É a
  // disciplina que `Combate.som` pede e que só esta ação não cumpria.
  return turnoDosOutros({ ...combate, dado, log, som: null, flutuantes: [] }, rng);
}

/**
 * Esquivar: rola o d20 como a fuga (`attemptDodge`). Deu certo, o golpe da
 * criatura **nesta rodada** erra você; não deu, você perdeu o turno à toa.
 * Nos dois casos não há ataque seu — é a troca.
 *
 * Roda o veneno antes, como atacar e usar poder: é uma ação que gasta o
 * turno, e o veneno corrói a cada turno gasto.
 */
export function esquivar(combate: Combate, roll: number, rng: Rng = defaultRng): Combate {
  const estado = exigirMasmorra(combate);
  const rapido = maisRapido(estado);
  if (!rapido) return combate;

  const veneno = tickHeroStatus(estado.hero);
  const log: string[] = [];
  if (veneno.damage > 0) log.push(`O veneno corrói você em ${veneno.damage} de vida.`);
  if (veneno.defeated) return morteNoVeneno(combate, veneno.hero, log, rng);

  const tentativa = attemptDodge(veneno.hero, rapido, roll);
  const comBonus = tentativa.bonus ? ` (+${tentativa.bonus} por velocidade)` : '';
  log.push(
    tentativa.success
      ? `Você rolou ${roll}${comBonus} e se prepara para desviar.`
      : `Você rolou ${roll}${comBonus} e não consegue se preparar a tempo.`,
  );

  return turnoDosOutros(
    { ...combate, estado: { ...estado, hero: veneno.hero }, dado: { valor: roll, lados: 20 }, log, som: null, flutuantes: [] },
    rng,
    { esquivaCerta: tentativa.success },
  );
}

/** Os consumíveis que dá pra usar agora — o mesmo filtro do botão "Usar" da mochila. */
export function consumiveisDoCombate(combate: Combate): Item[] {
  return combate.estado.inventory.filter(podeUsar);
}

/**
 * Usar um consumível no meio da luta. **Gasta o turno**, como toda ação: a
 * equipe age e a criatura revida — beber poção não é de graça.
 *
 * A regra de quanto cura é a da mochila (`usar`), chamada daqui, e não
 * copiada: o texto do log e o "não faz nada agora" saem iguais nas duas
 * telas.
 *
 * Item que não faz nada não gasta o turno — mesma disciplina da falta de
 * mana: a ação foi recusada, não tentada.
 */
export function usarItem(combate: Combate, item: Item, rng: Rng = defaultRng): Combate {
  const estado = exigirMasmorra(combate);
  const monstro = monstroAtual(estado);
  if (!monstro) return combate;

  if (!podeUsar(item) || !estado.inventory.some((atual) => atual.uid === item.uid)) {
    return { ...combate, log: [`${displayName(item)} não faz nada agora.`], som: null, flutuantes: [] };
  }

  const veneno = tickHeroStatus(estado.hero);
  const log: string[] = [];
  if (veneno.damage > 0) log.push(`O veneno corrói você em ${veneno.damage} de vida.`);
  if (veneno.defeated) return morteNoVeneno(combate, veneno.hero, log, rng);

  const usado = usar({ estado: { ...estado, hero: veneno.hero }, log: [] }, item);
  if (usado.estado.mapMode !== 'dungeon') return combate;
  log.push(...usado.log);

  return turnoDosOutros({ ...combate, estado: usado.estado, dado: null, log, som: null, flutuantes: [] }, rng);
}

// ---------- turno de quem não é o jogador ----------

interface OpcoesDaRodada {
  /** O herói rolou "Esquivar" com sucesso: o golpe desta rodada nele erra. */
  esquivaCerta?: boolean;
}

/**
 * Equipe → dano contínuo → o golpe do monstro da vez. A ordem é a do
 * original; o que o grupo mudou é **em quem** cada passo cai:
 *
 * - a equipe bate no alvo do jogador;
 * - o dano contínuo corre em todo monstro de pé que tiver queimadura ou
 *   sangramento — estão todos na luta;
 * - **um só monstro ataca**, o da vez, e a vez passa pro seguinte. Atordoado
 *   ou lento demais, ele perde o ataque e ninguém bate nesta rodada; a vez
 *   passa do mesmo jeito (decisão do usuário, 2026-10-17).
 *
 * Quem cai no meio é pago na hora (`pagarAbate`); a luta só acaba quando não
 * sobra ninguém de pé.
 */
function turnoDosOutros(combate: Combate, rng: Rng, opcoes: OpcoesDaRodada = {}): Combate {
  const alvo = alvoDaLuta(combate);
  if (alvo === null) return combate;
  const comEquipe = equipeAge(combate, alvo, rng);
  if (comEquipe.fase !== 'combate') return comEquipe;
  const comDano = danoContinuo(comEquipe, rng);
  if (comDano.fase !== 'combate') return comDano;
  return golpeDaVez(comDano, rng, opcoes);
}

/** A equipe bate no alvo do jogador (ou o curandeiro cura o herói). */
function equipeAge(combate: Combate, alvo: number, rng: Rng): Combate {
  const estado = exigirMasmorra(combate);
  const monstro = monstroNo(estado, alvo);
  const equipe = applyPartyTurn(estado.hero, estado.party, monstro, rng);
  const log = [...combate.log];
  for (const acao of equipe.outcomes) {
    if (acao.kind === 'healed_hero') log.push(`${acao.member.name} cura você em ${acao.amount}.`);
    else if (acao.kind === 'hit') log.push(`${acao.member.name} acerta ${monstro.name} causando ${acao.amount}.`);
    else log.push(`${acao.member.name} erra o golpe.`);
  }
  const depois = { ...combate, estado: gravarMonstro({ ...estado, hero: equipe.hero }, alvo, equipe.monster), log };
  return equipe.defeated ? abaterNoTurno(depois, alvo, monstro, rng) : depois;
}

/** A queimadura e o sangramento correm em cada monstro de pé que os tiver: estão todos na luta. */
function danoContinuo(combate: Combate, rng: Rng): Combate {
  let atual = combate;
  for (const indice of indicesDePe(celulaAtual(exigirMasmorra(combate)) as DungeonCell)) {
    const estado = exigirMasmorra(atual);
    const monstro = monstroNo(estado, indice);
    const dot = tickMonsterDot(monstro);
    const log = dot.damage > 0 ? [...atual.log, `Os efeitos contínuos causam ${dot.damage} de dano em ${monstro.name}.`] : atual.log;
    atual = { ...atual, estado: gravarMonstro(estado, indice, dot.monster), log };
    if (dot.defeated) atual = abaterNoTurno(atual, indice, monstro, rng);
    if (atual.fase !== 'combate') return atual;
  }
  return atual;
}

/** Quem caiu na vez dos outros é pago na hora; foi o último, a sala está limpa. */
function abaterNoTurno(combate: Combate, indice: number, abatido: CombatMonsterView, rng: Rng): Combate {
  const pago = pagarNaLuta(combate, indice, abatido);
  return inimigosRestantes(pago.estado) > 0 ? pago : vencer(pago, abatido, rng);
}

/** O monstro da vez ataca — atordoado ou lento, perde o ataque — e a vez passa pro seguinte. */
function golpeDaVez(combate: Combate, rng: Rng, opcoes: OpcoesDaRodada): Combate {
  const estado = exigirMasmorra(combate);
  const vez = vezDoMonstro(estado);
  if (vez === null) return combate;
  const atacante = monstroNo(estado, vez);
  const golpe = applyMonsterHit(estado.hero, estado.party, atacante, {
    rng,
    petEsquivaBonus: petBonus(combate.pet).esquiva ?? 0,
    esquivaCerta: opcoes.esquivaCerta,
  });
  const comGolpe = gravarMonstro({ ...estado, hero: golpe.hero, party: golpe.party }, vez, golpe.monster);
  const sala = celulaAtual(comGolpe) as DungeonCell;
  const log = [...combate.log, textoDoGolpe(golpe, atacante.name)];

  const depois: Combate = {
    ...combate,
    estado: substituirCelulaAtual(comGolpe, { ...sala, monsterTurn: vez + 1 }),
    log,
    // Soma ao que o golpe do jogador já pôs na tela — os dois números
    // aparecem no mesmo turno, como no original.
    flutuantes: golpe.damage ? [...combate.flutuantes, { texto: `-${golpe.damage}`, tom: 'dano' as const, alvo: 'heroi' as const }] : combate.flutuantes,
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

/**
 * O golpe (ou poder) do herói derrubou o monstro `indice`.
 *
 * Com mais gente de pé, **a rodada segue**: a equipe age e o monstro da vez
 * ainda ataca (decisão do usuário, 2026-10-17 — derrubar um do grupo não dá
 * rodada sem troco).
 *
 * Foi o último: a luta acaba aqui, sem turno da equipe — e é nele que a
 * Canção de Batalha desconta, então a rodada é descontada à mão.
 */
function heroiMatou(combate: Combate, indice: number, abatido: CombatMonsterView, rng: Rng): Combate {
  const pago = pagarNaLuta(combate, indice, abatido);
  if (inimigosRestantes(pago.estado) > 0) return turnoDosOutros(pago, rng);
  const estado = exigirMasmorra(pago);
  return vencer({ ...pago, estado: { ...estado, hero: passarRodadaDaCancao(estado.hero) } }, abatido, rng);
}

/**
 * O veneno matou antes da ação, então ela não aconteceu. `dado`, `som` e
 * `flutuantes` zerados pelo motivo de `fugir`: herdados da ação anterior,
 * repetiam o número no inimigo, a tremida e o giro de arma do boneco — um
 * ataque fantasma na hora de morrer.
 */
function morteNoVeneno(combate: Combate, hero: Hero, log: string[], rng: Rng): Combate {
  const estado = exigirMasmorra(combate);
  return derrota({ ...combate, estado: { ...estado, hero }, dado: null, som: null, flutuantes: [] }, log, rng);
}

/**
 * Paga o monstro que caiu (`pagarAbate`, a vida dele já gravada zerada na
 * sala). O alvo que caiu passa pro primeiro de pé. A luta não acaba aqui —
 * quem chama confere se sobrou alguém.
 */
function pagarNaLuta(combate: Combate, indice: number, abatido: CombatMonsterView): Combate {
  const pago = pagarAbate(exigirMasmorra(combate), abatido);
  const primeiroDePe = indicesDePe(celulaAtual(pago.estado) as DungeonCell)[0];
  return {
    ...combate,
    estado: pago.estado,
    alvo: combate.alvo === indice && primeiroDePe !== undefined ? primeiroDePe : combate.alvo,
    fase: 'combate',
    log: [...combate.log, ...pago.log],
  };
}

/** Último inimigo caiu: a vitória, com o que `limparSala` decidiu. */
function vencer(combate: Combate, abatido: CombatMonsterView, rng: Rng): Combate {
  const limpa = limparSala(exigirMasmorra(combate), abatido, rng);
  return { ...combate, estado: limpa.estado, fase: 'vitoria', log: [...combate.log, ...limpa.log], loot: limpa.loot, som: 'victory' };
}

/** A derrota (`perderLuta`): o grupo volta pra cidade. */
function derrota(combate: Combate, log: string[], rng: Rng): Combate {
  const perdida = perderLuta(exigirMasmorra(combate), rng);
  return { ...combate, estado: perdida.estado, fase: 'derrota', som: 'defeat', log: [...log, ...perdida.log] };
}

function exigirMasmorra(combate: Combate): EstadoNaMasmorra {
  if (combate.estado.mapMode !== 'dungeon') throw new Error('combate só acontece na masmorra');
  return combate.estado;
}
