/**
 * O esqueleto do necromante — o poder Levantar Esqueleto, do site e do app.
 *
 * Decisões do usuário (2026-10-17 e 23):
 * - um poder que só o necromante tem (`soDaClasse`), e que todo necromante
 *   ganha, inclusive quem já tinha o personagem;
 * - o esqueleto luta ao lado do herói como um companheiro (ataca depois dele,
 *   e os monstros podem mirar nele). Desde 2026-11-10 (doc do Breno, decidido
 *   com o usuário) ele não some mais no fim da luta: segue o herói de sala em
 *   sala, com a vida que tiver, até cair, até a volta à cidade ou até o herói
 *   ser derrotado;
 * - até 3 de pé ao mesmo tempo; com 3, o poder avisa e não gasta mana. Um que
 *   caiu pode ser trocado por outro na mesma luta;
 * - é do necromante, à parte dos recrutas: não ocupa vaga na equipe;
 * - vida 10 + 2 × nível + Inteligência, ataque (3 + nível + Inteligência ÷ 2) ÷ 2,
 *   na postura agressiva. É a metade do que era até 2026-11-12 (pedido do
 *   usuário: o esqueleto estava forte demais); quem já estava de pé fica como
 *   estava até cair.
 *
 * Os esqueletos moram em `party`, marcados com `invocado`. Os caídos ficam na
 * lista até a luta acabar (`semInvocadosCaidos` os tira aí): a arena do app
 * guarda os companheiros pelo índice na equipe, e tirar um do meio trocaria
 * quem é quem.
 */

import { emptyAttributes } from '../hero/stats.js';
import type { Companion, Hero } from '../hero/hero.js';
import { speciesById } from '../monsters/species.js';
import { defaultRng, type Rng } from '../rng.js';

/** Quantos esqueletos podem estar de pé ao mesmo tempo. */
export const MAX_ESQUELETOS = 3;

/** A linha do registro quando a luta acaba com esqueletos caídos na equipe. */
export const FIM_DOS_ESQUELETOS = 'Os esqueletos caídos voltam ao pó.';

/** Os esqueletos de pé agora. */
export function esqueletosDePe(party: readonly Companion[]): number {
  return party.filter((membro) => membro.invocado && membro.hp > 0).length;
}

/** A equipe sem os esqueletos: o que chega à cidade, e o que conta nas vagas dos recrutas. */
export function semInvocados(party: readonly Companion[]): Companion[] {
  return party.filter((membro) => !membro.invocado);
}

/** Há esqueleto caído na equipe. */
export function temInvocadoCaido(party: readonly Companion[]): boolean {
  return party.some((membro) => membro.invocado && membro.hp <= 0);
}

/** A equipe sem os esqueletos que caíram: o que fica quando a luta acaba. Os de pé seguem o herói. */
export function semInvocadosCaidos(party: readonly Companion[]): Companion[] {
  return party.filter((membro) => !membro.invocado || membro.hp > 0);
}

/**
 * Um esqueleto novo, na força do necromante. O nome leva o primeiro número
 * livre entre os esqueletos da equipe ("Esqueleto", "Esqueleto 2"…), pra o
 * registro dizer qual deles fez o quê.
 */
export function criarEsqueleto(hero: Pick<Hero, 'level' | 'attrs'>, party: readonly Companion[]): Companion {
  const inteligencia = hero.attrs.intelecto ?? 0;
  const maxHp = Math.max(1, Math.floor((20 + 4 * hero.level + 2 * inteligencia) / 2));
  const nomeDoNumero = (n: number): string => (n > 1 ? `Esqueleto ${n}` : 'Esqueleto');
  const usados = new Set(party.filter((membro) => membro.invocado).map((membro) => membro.name));
  let numero = 1;
  while (usados.has(nomeDoNumero(numero))) numero++;
  return {
    name: nomeDoNumero(numero),
    raceIcon: '💀',
    race: 'Morto-vivo',
    className: 'Esqueleto',
    classIcon: '💀',
    hp: maxHp,
    maxHp,
    attack: Math.max(1, Math.floor((3 + hero.level + Math.floor(inteligencia / 2)) / 2)),
    attrs: emptyAttributes(),
    stance: 'agressiva',
    ability: 'Ossos Erguidos',
    abilityDesc: 'Luta ao lado do necromante até cair ou até a volta à cidade.',
    invocado: true,
  };
}

// ---------- o lacaio do Necromante na luta do app (rodada 4b, 2026-11-17) ----------
//
// Doc do Breno de 2026-11-15, decidido com o usuário: só no app (o site
// continua com o esqueleto de cima), o lacaio tem 2× a Inteligência de dano e
// 2× a vida do herói, custa 65% da mana máxima, até 3; tem corpo na arena e
// bate como a espécie dele (o cristal do inimigo abatido troca a espécie; o do
// chefe só acima do nível dele, com 65% de falha); começa na retaguarda (perto
// do dono, +10% de dano) e pode ir pro ofensivo (qualquer inimigo, +10% de
// resistência). A Magia Proibida levanta o parceiro caído com 50%, uma vez a
// cada 14 min, com 90% de vida e de mana; o Necromante que cai se levanta com
// ela e fica sem a magia até zerar a masmorra (`Hero.bloqueioDaMagia`, no save).

export const REGRAS_DO_NECROMANTE = {
  /** O lacaio: dano = Inteligência × isto; vida = a vida máxima do herói × isto; custo = isto (%) da mana máxima. */
  danoPorInteligencia: 2,
  vidaDoHeroi: 2,
  custo: 65,
  /** A retaguarda: ataca quem estiver a até tantos blocos do dono, com este dano (%) a mais. */
  retaguarda: 3,
  danoNaRetaguarda: 10,
  /** O ofensivo: leva este tanto (%) a menos de dano. */
  resistenciaNoOfensivo: 10,
  /** Quanto o lacaio anda por passo (o herói anda 64). */
  passo: 48,
  /** A Magia Proibida: a espera (14 min, em passos), o requisito (% de vida e de mana) e com quanto (%) levanta. */
  recargaDaMagia: 50400,
  requisitoDaMagia: 90,
  levantaCom: 50,
  /** O cristal do chefe falha este tanto (%) das vezes. */
  falhaNoChefe: 65,
} as const;

/** A espécie do lacaio que não passou por cristal. */
export const ESPECIE_DO_LACAIO = 'esqueleto';

/** A espécie do lacaio (o esqueleto, se ainda não trocou). */
export function especieDoLacaio(membro: Pick<Companion, 'especie'>): string {
  return membro.especie ?? ESPECIE_DO_LACAIO;
}

/** O estado do lacaio (a retaguarda, se ainda não mudou). */
export function estadoDoLacaio(membro: Pick<Companion, 'estadoDoLacaio'>): 'retaguarda' | 'ofensivo' {
  return membro.estadoDoLacaio ?? 'retaguarda';
}

/** O nome-base de um lacaio desta espécie: "Esqueleto" pro esqueleto, o nome da espécie nos outros. */
function nomeDaEspecie(especie: string): string {
  return especie === ESPECIE_DO_LACAIO ? 'Esqueleto' : (speciesById(especie)?.name ?? 'Esqueleto');
}

/** O primeiro nome livre ("Goblin", "Goblin 2"…) entre os invocados da equipe, sem contar o do índice `exceto`. */
function nomeLivre(base: string, party: readonly Companion[], exceto = -1): string {
  const nome = (n: number): string => (n > 1 ? `${base} ${n}` : base);
  const usados = new Set(party.filter((membro, i) => membro.invocado && i !== exceto).map((membro) => membro.name));
  let numero = 1;
  while (usados.has(nome(numero))) numero++;
  return nome(numero);
}

/** Quanto custa invocar um lacaio: 65% da mana máxima, arredondado. */
export function custoDoLacaio(hero: Pick<Hero, 'maxMp'>): number {
  return Math.round((hero.maxMp * REGRAS_DO_NECROMANTE.custo) / 100);
}

/** Um lacaio novo, na força do Necromante (os números do Breno), da espécie pedida (o esqueleto, sem pedir). */
export function criarLacaio(hero: Pick<Hero, 'maxHp' | 'attrs'>, party: readonly Companion[], especie: string = ESPECIE_DO_LACAIO): Companion {
  const r = REGRAS_DO_NECROMANTE;
  const qual = speciesById(especie) ? especie : ESPECIE_DO_LACAIO;
  const icone = speciesById(qual)?.icon ?? '💀';
  const maxHp = Math.max(1, Math.trunc(hero.maxHp * r.vidaDoHeroi));
  return {
    name: nomeLivre(nomeDaEspecie(qual), party),
    raceIcon: icone,
    race: 'Morto-vivo',
    className: nomeDaEspecie(qual),
    classIcon: icone,
    hp: maxHp,
    maxHp,
    attack: Math.max(1, Math.trunc((hero.attrs.intelecto ?? 0) * r.danoPorInteligencia)),
    attrs: emptyAttributes(),
    stance: 'agressiva',
    ability: 'Lacaio',
    abilityDesc: 'Luta ao lado do Necromante até cair ou até a volta à cidade.',
    invocado: true,
    especie: qual,
    estadoDoLacaio: 'retaguarda',
  };
}

/** Muda o estado de um lacaio (a janela do K, fora da luta). Quem não é lacaio fica como está. */
export function mudarEstadoDoLacaio(party: readonly Companion[], indice: number, estado: 'retaguarda' | 'ofensivo'): Companion[] {
  return party.map((membro, i) => (i === indice && membro.invocado ? { ...membro, estadoDoLacaio: estado } : membro));
}

/** O cristal que fica onde o inimigo caiu: a espécie dele, o nível e se era chefe. */
export interface CristalDoInimigo {
  especie: string;
  nivel: number;
  chefe?: boolean;
}

/** O que o cristal fez: a equipe (com o lacaio trocado, se deu), o texto, e se o cristal se gastou. */
export interface UsoDoCristal {
  party: Companion[];
  texto: string;
  trocou: boolean;
  gasto: boolean;
}

/**
 * Encostar no cristal e escolher um lacaio: ele vira daquela espécie, com a
 * mesma vida e o mesmo dano. O cristal do chefe só funciona acima do nível
 * dele (abaixo, nada acontece e o cristal fica) e falha 65% das vezes (aí ele
 * se parte). Um número do rng, só no do chefe.
 */
export function trocarPeloCristal(hero: Pick<Hero, 'level'>, party: readonly Companion[], indice: number, cristal: CristalDoInimigo, rng: Rng = defaultRng): UsoDoCristal {
  const membro = party[indice];
  const sem = (texto: string): UsoDoCristal => ({ party: [...party], texto, trocou: false, gasto: false });
  if (!membro || !membro.invocado || membro.hp <= 0) return sem('Escolha um lacaio de pé.');
  if (!speciesById(cristal.especie)) return sem('Este cristal não guarda alma nenhuma.');
  if (cristal.chefe) {
    if (hero.level <= cristal.nivel) return sem(`A alma do chefe é forte demais: só acima do nível ${cristal.nivel}.`);
    if (rng() * 100 < REGRAS_DO_NECROMANTE.falhaNoChefe) return { party: [...party], texto: 'O cristal se parte: a alma do chefe resiste.', trocou: false, gasto: true };
  }
  const base = nomeDaEspecie(cristal.especie);
  const icone = speciesById(cristal.especie)?.icon ?? membro.classIcon;
  const nome = nomeLivre(base, party, indice);
  const novo: Companion = { ...membro, name: nome, raceIcon: icone, className: base, classIcon: icone, especie: cristal.especie };
  return { party: party.map((m, i) => (i === indice ? novo : m)), texto: `${membro.name} agora é ${nome}.`, trocou: true, gasto: true };
}

/** A masmorra foi zerada: a Magia Proibida do Necromante volta, se era essa a masmorra que ele devia. */
export function liberarMagia<T extends Pick<Hero, 'bloqueioDaMagia'>>(hero: T, masmorra: string): T {
  if (hero.bloqueioDaMagia !== masmorra) return hero;
  const { bloqueioDaMagia: _b, ...resto } = hero;
  return resto as T;
}
