/**
 * Resultados de referência ("golden fixtures") da engine, pra portá-la pro
 * C# e conferir o porte caso a caso, com os mesmos números.
 *
 *     cd packages/shared
 *     pnpm dlx tsx scripts/gen-fixtures.ts
 *
 * (O tsx não é dependência do pacote; o `dlx` baixa e roda. Neste
 * workspace o `npx tsx` não o encontra.)
 *
 * Grava duas coisas.
 *
 * `fixtures/<modulo>.json` — rng, hero, items, monsters, combat, dungeon,
 * shop, inventory, events, npc, quests, city e pets —, cada um uma lista
 * de casos `{ "name", "input", "expected" }`.
 *
 * `fixtures/data/<caminho do módulo>.json` — as tabelas: toda constante de
 * nível de módulo cujo valor é só dado (catálogo, número, lista), na ordem
 * do código-fonte, com as chaves na ordem em que estão escritas. Entram
 * também as que o módulo não exporta, lidas do código-fonte; essas vêm
 * listadas em `"$privadas"`. `Set` vira lista, e vem listado em
 * `"$conjuntos"`. Mapas montados a partir de outra tabela (`RACES_BY_ID`…)
 * não entram: são índice, não dado.
 *
 * `input`
 * - `fn`: a função exportada que o caso chama. Caso de constante tem
 *   `const` no lugar de `fn`, e o valor em `expected.value`;
 * - `args`: os argumentos, pelo nome do parâmetro na assinatura. `count`,
 *   quando aparece, é quantas vezes seguidas a função foi chamada com o
 *   mesmo `rng`, e o resultado é a lista dos retornos;
 * - `rng`: de onde saem os sorteios, quando a função recebe `Rng`.
 *   `{ "seed": n }` é `seededRng(n)`, o mulberry32 de `src/rng.ts`;
 *   `{ "sequence": [...] }` devolve os valores em ordem e, acabada a lista,
 *   repete o último (0 se ela for vazia) — o `sequenceRng` dos testes;
 * - `now`: o relógio fixo, quando a função monta `uid` de item.
 *
 * `expected`
 * - `result`: o retorno. `"undefined": true` quando a função devolve
 *   `undefined`, e `throws: { name, message }` quando ela lança;
 * - `rngCalls`: quantos números a função tirou do `rng`. A ordem e a
 *   quantidade de sorteios fazem parte do contrato: um porte que tire um
 *   número a mais desloca todos os seguintes, e o andar inteiro sai outro.
 *
 * Em `generateRoomGraph` e `generateDungeonFloor`, `rooms` e `start` vêm
 * como coordenadas `[x, y]`. No retorno de verdade são as mesmas células de
 * `grid`, e gravá-las de novo só repetiria o andar.
 *
 * JSON não tem `undefined`, `NaN` nem `Infinity`. Campo ausente é campo
 * `undefined`; número especial vai como `{ "$num": "NaN" }` (ou
 * `"Infinity"`, `"-Infinity"`), na entrada e na saída.
 *
 * **Só a entrada gravada decide o resultado.** Enquanto um caso roda,
 * `Math.random` e `Date.now` lançam erro: se alguma função sortear ou ler
 * o relógio por fora do que recebeu, o gerador para, em vez de gravar um
 * número que o porte não teria como reproduzir. Por isso as funções que criam
 * item recebem `now` (e o `rng`) por parâmetro, como `buildHero` e
 * `trainAtGuild` fazem com a arma inicial (`armaInicial`).
 *
 * Os casos reaproveitam os cenários dos `.test.ts` (o mesmo herói, monstro
 * e sequência de sorteios) e somam bordas — crítico, esquiva, nível alto,
 * arredondamento — e lotes sorteados com seed fixa.
 */

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import type {
  AttackStyle,
  AttrKey,
  Attributes,
  CelulaDoMapa,
  CityCell,
  ClassDef,
  CombatMonster,
  CombatMonsterView,
  Companion,
  CompanionStance,
  Direction,
  DungeonCell,
  DungeonExtra,
  DungeonProgress,
  DungeonRun,
  EquipSlot,
  EquippableItem,
  EstadoDoJogo,
  EstadoNaCidade,
  EstadoNaMasmorra,
  GuildTraining,
  Hero,
  HeroBuffs,
  HeroCreation,
  HeroEquipment,
  Item,
  ItemTemplate,
  JogadaDeAtaque,
  Mochila,
  MonsterInstance,
  MonsterStatus,
  PassoDoTutorial,
  Power,
  Quest,
  Rng,
  RoomCell,
  RoomObject,
  SaveCarregado,
  Tutorial,
  Walker,
  WalkStep,
  GeometriaDaSala,
} from '../src/index.js';
import type {
  Encantadora,
  EncantamentoId,
  EncantamentoNaPeca,
  EntradaDaLuta,
  EventoDeArma,
  JogadaDoEvento,
  LeituraDaMira,
  LutaEmTempoReal,
  MonstroNaArena,
  PontoDoTraco,
  RunaId,
  RunaNaArma,
} from '../src/index.js';

const PACOTE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(PACOTE, 'fixtures');

// ---------- armadilhas, antes de a engine carregar ----------
//
// `defaultRng` é `Math.random` capturado na carga de `src/rng.ts`, então a
// troca precisa vir antes do import. Fora dos casos as duas funções se
// comportam como sempre — o tsx e o Node também as usam.

class SorteioEscondido extends Error {}

const sorteioDeVerdade = Math.random;
const relogioDeVerdade = Date.now;
let vigiando = false;

Math.random = () => {
  if (vigiando) throw new SorteioEscondido('Math.random chamado por dentro da engine, sem rng injetado');
  return sorteioDeVerdade();
};
Date.now = () => {
  if (vigiando) throw new SorteioEscondido('Date.now chamado por dentro da engine, sem now injetado');
  return relogioDeVerdade();
};

const E = await import('../src/index.js');

// ---------- JSON ----------

type Json = unknown;

function substituto(_chave: string, valor: unknown): unknown {
  return typeof valor === 'number' && !Number.isFinite(valor) ? { $num: String(valor) } : valor;
}

function restaurador(_chave: string, valor: unknown): unknown {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    const chaves = Object.keys(valor);
    if (chaves.length === 1 && chaves[0] === '$num') return Number((valor as { $num: string }).$num);
  }
  return valor;
}

/** O valor como vai pro arquivo. */
function gravavel(valor: unknown): Json {
  return valor === undefined ? undefined : JSON.parse(JSON.stringify(valor, substituto));
}

/** O valor como o porte vai lê-lo do arquivo — é isto que a função recebe. */
function viaJson<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor, substituto), restaurador) as T;
}

// ---------- sorteios ----------

type RngSpec = { seed: number } | { sequence: number[] };

function sequenceRng(valores: readonly number[]): Rng {
  let i = 0;
  return () => (i < valores.length ? (valores[i++] as number) : (valores[valores.length - 1] ?? 0));
}

function contarSorteios(spec: RngSpec): { rng: Rng; chamadas: () => number } {
  const fonte = 'seed' in spec ? E.seededRng(spec.seed) : sequenceRng(spec.sequence);
  let chamadas = 0;
  return {
    rng: () => {
      chamadas++;
      return fonte();
    },
    chamadas: () => chamadas,
  };
}

// ---------- registro dos casos ----------

interface Caso {
  name: string;
  input: Record<string, Json>;
  expected: Record<string, Json>;
}

const arquivos = new Map<string, Caso[]>();
let atual: Caso[] = [];
let nomesDoModulo = new Set<string>();

function modulo(nome: string): void {
  atual = [];
  nomesDoModulo = new Set();
  arquivos.set(nome, atual);
}

function registrar(caso: Caso): void {
  if (nomesDoModulo.has(caso.name)) throw new Error(`caso repetido: ${caso.name}`);
  nomesDoModulo.add(caso.name);
  atual.push(caso);
}

interface Contexto {
  rng: Rng;
  now: () => number;
}

interface Chamada {
  rng?: RngSpec;
  now?: number;
  /**
   * `'pular'`: se a função sortear ou ler o relógio por fora, o caso fica de
   * fora com um aviso, em vez de parar o gerador. Só pra função que se sabe
   * que ainda faz isso — ver o cabeçalho.
   */
  seEscondido?: 'pular';
}

const pulados: string[] = [];

function caso<A extends Record<string, unknown>>(
  name: string,
  fn: string,
  args: A,
  executar: (a: A, ctx: Contexto) => unknown,
  chamada: Chamada = {},
): void {
  const entrada = viaJson(args);
  const sorteio = chamada.rng ? contarSorteios(chamada.rng) : null;
  const ctx: Contexto = {
    rng:
      sorteio?.rng ??
      (() => {
        throw new SorteioEscondido(`${name}: sorteou sem rng na entrada`);
      }),
    now: () => {
      if (chamada.now === undefined) throw new SorteioEscondido(`${name}: leu o relógio sem now na entrada`);
      return chamada.now;
    },
  };

  let expected: Record<string, Json>;
  vigiando = true;
  try {
    const result = executar(entrada, ctx);
    expected = result === undefined ? { undefined: true } : { result: gravavel(result) };
  } catch (erro) {
    if (erro instanceof SorteioEscondido && chamada.seEscondido === 'pular') {
      pulados.push(`${name} — ${erro.message}`);
      return;
    }
    if (erro instanceof SorteioEscondido) throw erro;
    const e = erro as Error;
    expected = { throws: { name: e.name, message: e.message } };
  } finally {
    vigiando = false;
  }
  if (sorteio) expected.rngCalls = sorteio.chamadas();

  const input: Record<string, Json> = { fn, args: gravavel(args) };
  if (chamada.rng) input.rng = chamada.rng;
  if (chamada.now !== undefined) input.now = chamada.now;
  registrar({ name, input, expected });
}

function constante(nome: string, valor: unknown): void {
  registrar({ name: `${nome} (constante)`, input: { const: nome }, expected: { value: gravavel(valor) } });
}

// ---------- quem aparece nos casos ----------

/** O relógio fixo dos `uid` de item. */
const AGORA = 1_700_000_000_000;
const relogio = () => AGORA;

/**
 * Sorteador do próprio gerador, pra montar os lotes. Fica fora dos casos:
 * o que ele decide vai gravado na entrada, e o porte não precisa repeti-lo.
 */
const lote = E.seededRng(20261009);
const umDe = <T>(lista: readonly T[]): T => lista[Math.floor(lote() * lista.length)] as T;
const entre = (min: number, max: number): number => min + Math.floor(lote() * (max - min + 1));
const chance = (p: number): boolean => lote() < p;

function item(templateId: string, raridade = 'comum', semente = 1): Item {
  const template = E.templateById(templateId);
  const rarity = E.rarityById(raridade);
  if (!template || !rarity) throw new Error(`item de teste desconhecido: ${templateId}/${raridade}`);
  return E.instantiate(template, rarity, { rng: E.seededRng(semente), now: relogio });
}

function atributos(o: Partial<Attributes> = {}): Attributes {
  return { forca: 10, destreza: 10, constituicao: 10, intelecto: 10, sabedoria: 10, carisma: 10, ...o };
}

const SLOTS_VAZIOS: HeroEquipment = { arma: null, secundaria: null, elmo: null, armadura: null, calca: null, botas: null, acessorio: null };

interface HeroiDeTeste {
  /** Id da classe; `null` é o Aprendiz. Padrão: bárbaro, a classe sem ataque principal e sem passiva que sorteie. */
  classe?: string | null;
  /** Força o `className` e tira o `classId` — o save de antes dos ids. */
  nomeDaClasse?: string;
  /** Id do template, o item pronto, ou `null`. Ausente: a arma inicial da classe. */
  arma?: string | Item | null;
  equip?: Partial<HeroEquipment>;
  attrs?: Partial<Attributes>;
  level?: number;
  /** Id do debuff. Padrão: `orgulhoso`, que não tem efeito em combate. */
  debuff?: string;
  extra?: Partial<Hero>;
}

/** Herói montado à mão, como nos testes — sem `buildHero`, que sorteia o `uid` da arma por fora. */
function heroi(o: HeroiDeTeste = {}): Hero {
  const cls = o.classe === null ? null : E.classById(o.classe ?? 'barbaro');
  const attrs = atributos(o.attrs);
  const arma = o.arma === undefined ? (cls ? item(cls.weaponTemplate) : null) : typeof o.arma === 'string' ? item(o.arma) : o.arma;
  const equip: HeroEquipment = { ...SLOTS_VAZIOS, arma, ...o.equip };
  const level = o.level ?? 1;
  const debuff = E.debuffById(o.debuff ?? 'orgulhoso');
  if (!debuff) throw new Error(`debuff de teste desconhecido: ${o.debuff}`);
  const derived = E.derivedStats({ level, attrs, equip });
  return {
    level,
    attrs,
    equip,
    name: 'Teste',
    race: 'Humano',
    raceIcon: '🧑',
    className: o.nomeDaClasse ?? cls?.name ?? E.APPRENTICE.name,
    classIcon: cls?.icon ?? E.APPRENTICE.icon,
    ...(cls && !o.nomeDaClasse ? { classId: cls.id } : {}),
    raceId: 'humano',
    xp: 0,
    xpNext: E.xpForLevel(level),
    attrPoints: 0,
    gold: 100,
    powerNames: [],
    powerIds: [],
    debuff,
    killCount: 0,
    masteryBattles: 0,
    derived,
    maxHp: derived.maxHp,
    hp: derived.maxHp,
    maxMp: derived.maxMp,
    mp: derived.maxMp,
    buffs: {},
    ...o.extra,
  };
}

/** Monstro montado à mão, como nos testes: goblin brutamontes do andar 5, 100 de vida. */
function monstro(o: Partial<CombatMonster> = {}): CombatMonsterView {
  const instancia: MonsterInstance = {
    speciesId: 'goblin',
    enemyClassId: 'brutamontes',
    floor: 5,
    hp: 100,
    maxHp: 100,
    dmg: 5,
    speed: 8,
    xp: 10,
    gold: 10,
    isBoss: false,
  };
  return E.monsterView({ ...E.freshCombatMonster(instancia), ...o });
}

function companheiro(classe = 'guerreiro', o: Partial<Companion> = {}): Companion {
  const cls = E.classById(classe);
  if (!cls) throw new Error(`classe de teste desconhecida: ${classe}`);
  return {
    name: 'Aliado',
    raceIcon: '🧑',
    race: 'Humano',
    className: cls.name,
    classIcon: cls.icon,
    classId: cls.id,
    hp: 20,
    maxHp: 20,
    attack: 5,
    attrs: atributos(),
    stance: 'equilibrada',
    ability: '',
    abilityDesc: '',
    ...o,
  };
}

const CLASSES_IDS = E.CLASSES.map((c) => c.id);
const ARMAS_IDS = E.templatesByCategory('arma').map((t) => t.id);
const ESPECIES_IDS = E.SPECIES.map((s) => s.id);
const CLASSES_DE_INIMIGO = E.ENEMY_CLASSES.map((c) => c.id);
const DEBUFFS_IDS = E.DEBUFFS.map((d) => d.id);
const POSTURAS: CompanionStance[] = ['equilibrada', 'agressiva', 'defensiva', 'suporte'];

/** Herói de lote: classe, arma, atributos, nível, armadura e buffs sorteados pelo gerador. */
function heroiDeLote(): Hero {
  const classe = chance(0.08) ? null : umDe(CLASSES_IDS);
  const arma = chance(0.1) ? null : chance(0.6) && classe ? E.classById(classe)!.weaponTemplate : umDe(ARMAS_IDS);
  const armaduras: Partial<HeroEquipment> = {};
  if (chance(0.4)) armaduras.armadura = item(umDe(['couro', 'placas', 'robe']), umDe(E.RARITY_IDS), entre(1, 9));
  if (chance(0.3)) armaduras.elmo = item(umDe(['placas_elmo', 'robe_chapeu']), 'comum', entre(1, 9));
  if (chance(0.3)) armaduras.acessorio = item(umDe(['anel_som', 'amuleto_sab', 'colar_forca']), umDe(E.RARITY_IDS), entre(1, 9));
  const level = entre(1, 40);
  const base = heroi({
    classe,
    arma: arma ? item(arma, umDe(E.RARITY_IDS), entre(1, 9)) : null,
    equip: armaduras,
    attrs: {
      forca: entre(3, 25),
      destreza: entre(3, 25),
      constituicao: entre(3, 25),
      intelecto: entre(3, 25),
      sabedoria: entre(3, 25),
      carisma: entre(3, 25),
    },
    level,
    debuff: umDe(DEBUFFS_IDS),
    extra: { masteryBattles: umDe([0, 0, 10, 60, 200, 550]) },
  });
  const buffs: HeroBuffs = {};
  if (chance(0.15)) buffs.critNext = true;
  if (chance(0.2)) Object.assign(buffs, { precisaoTurns: entre(0, 2), precisaoAmount: umDe([5, 7, 25, 100]) });
  if (chance(0.2)) Object.assign(buffs, { forcaTurns: entre(0, 3), forcaAmount: 0.3 });
  if (chance(0.2)) Object.assign(buffs, { esquivaTurns: entre(0, 3), esquivaAmount: 20 });
  if (chance(0.15)) buffs.shield = 0.5;
  if (chance(0.15)) Object.assign(buffs, { inspiracaoTurns: entre(1, 3), inspiracaoAmount: 0.25 });
  return { ...base, hp: entre(1, base.maxHp), mp: entre(0, base.maxMp), buffs };
}

function statusDeLote(): MonsterStatus {
  const status: MonsterStatus = {};
  if (chance(0.15)) status.atordoado = entre(1, 2);
  if (chance(0.2)) status.lento = { turns: entre(1, 3), amount: 0.2 };
  if (chance(0.2)) status.enfraquecido = { turns: entre(1, 3), amount: umDe([0.2, 0.25, 0.3]) };
  if (chance(0.2)) status.vulneravel = { turns: entre(1, 3), amount: umDe([0.15, 0.2]) };
  if (chance(0.15)) status.veneno = { turns: entre(1, 4), dmg: entre(2, 6) };
  return status;
}

function monstroDeLote(): CombatMonsterView {
  const isBoss = chance(0.2);
  const maxHp = entre(10, 300);
  return monstro({
    speciesId: umDe(ESPECIES_IDS),
    enemyClassId: umDe(CLASSES_DE_INIMIGO),
    floor: entre(1, 40),
    maxHp,
    hp: entre(1, maxHp),
    dmg: entre(1, 30),
    speed: entre(3, 20),
    isBoss,
    ...(isBoss ? { isMainBoss: chance(0.5), bossTitle: umDe(E.BOSS_TITLES) } : {}),
    attackCount: entre(0, 5),
    guardHits: chance(0.15) ? entre(1, 2) : 0,
    poisonStrike: chance(0.1),
    status: statusDeLote(),
  });
}

function equipeDeLote(): Companion[] {
  return Array.from({ length: entre(0, 3) }, () => {
    const maxHp = entre(15, 40);
    return companheiro(umDe(CLASSES_IDS), {
      hp: chance(0.15) ? 0 : entre(1, maxHp),
      maxHp,
      attack: entre(3, 12),
      attrs: atributos({ sabedoria: entre(5, 20) }),
      stance: umDe(POSTURAS),
    });
  });
}

// ---------- a ordenação do V8 ----------

/**
 * O `Array.prototype.sort` do V8 (TimSort, `builtins/array-sort.tq`) pra
 * listas de até 63 itens: um "run" inicial (crescente, ou estritamente
 * decrescente e então invertido) e o resto entrando por inserção binária.
 *
 * O grafo e o andar embaralham com `sort(() => rng() - 0.5)`. Com um
 * comparador assim o resultado — e **quantos números ele tira do `rng`** —
 * depende do algoritmo de ordenação, e o `List.Sort` do .NET (introsort)
 * dá outro. Esta cópia é a referência pro porte: ela é conferida aqui
 * contra o sort de verdade antes de qualquer arquivo ser gravado, e os
 * casos de `Array.prototype.sort` em `dungeon.json` gravam a ordem e cada
 * comparação feita.
 *
 * Ela também é estável, como o sort do JS: o `List.Sort` do .NET não é, e a
 * ordenação das salas distantes depende disso nos empates.
 */
function ordenarComoV8<T>(lista: readonly T[], comparar: (a: T, b: T) => number): T[] {
  const a = lista.slice();
  const n = a.length;
  if (n < 2) return a;
  if (n >= 64) throw new Error('a cópia do sort do V8 só cobre listas de até 63 itens');

  // CountAndMakeRun(0, n)
  let run = 2;
  let ordem = comparar(a[1] as T, a[0] as T);
  const decrescente = ordem < 0;
  let anterior = a[1] as T;
  for (let i = 2; i < n; i++) {
    const corrente = a[i] as T;
    ordem = comparar(corrente, anterior);
    if (decrescente ? ordem >= 0 : ordem < 0) break;
    anterior = corrente;
    run++;
  }
  if (decrescente) a.splice(0, run, ...a.slice(0, run).reverse());

  // BinaryInsertionSort(0, run, n)
  for (let inicio = run; inicio < n; inicio++) {
    const pivo = a[inicio] as T;
    let esquerda = 0;
    let direita = inicio;
    while (esquerda < direita) {
      const meio = esquerda + ((direita - esquerda) >> 1);
      if (comparar(pivo, a[meio] as T) < 0) direita = meio;
      else esquerda = meio + 1;
    }
    for (let p = inicio; p > esquerda; p--) a[p] = a[p - 1] as T;
    a[esquerda] = pivo;
  }
  return a;
}

(function conferirOrdenacao(): void {
  for (let n = 0; n < 64; n++) {
    for (let seed = 0; seed < 120; seed++) {
      const indices = Array.from({ length: n }, (_, i) => i);
      const r1 = E.seededRng(seed);
      const r2 = E.seededRng(seed);
      let c1 = 0;
      let c2 = 0;
      const deVerdade = indices.slice().sort(() => (c1++, r1() - 0.5));
      const copia = ordenarComoV8(indices, () => (c2++, r2() - 0.5));
      if (deVerdade.join() !== copia.join() || c1 !== c2) throw new Error(`a cópia do sort do V8 divergiu: ${n} itens, seed ${seed}`);

      const chaves = indices.map(() => Math.floor(r1() * 4));
      const estavel = indices.slice().sort((x, y) => (chaves[y] as number) - (chaves[x] as number));
      if (estavel.join() !== ordenarComoV8(indices, (x, y) => (chaves[y] as number) - (chaves[x] as number)).join()) {
        throw new Error(`a cópia do sort do V8 divergiu nos empates: ${n} itens, seed ${seed}`);
      }
    }
  }
})();

// =====================================================================
// rng
// =====================================================================

modulo('rng');

for (const [seed, nota] of [
  [0, ''],
  [1, ''],
  [2, ''],
  [42, ''],
  [1337, ''],
  [123456789, ''],
  [0xdeadbeef, ''],
  [2 ** 31, ''],
  [4294967295, ''],
  [2 ** 32, ' — vira 0 no `>>> 0`'],
  [-1, ' — vira 4294967295 no `>>> 0`'],
  [3.7, ' — vira 3 no `>>> 0`'],
  [1e10, ' — vira 1410065408 no `>>> 0`'],
] as const) {
  caso(`seededRng: 12 primeiros valores da seed ${seed}${nota}`, 'seededRng', { seed, count: 12 }, (a) => {
    const rng = E.seededRng(a.seed);
    const values = Array.from({ length: a.count }, () => rng());
    // `u32` é o inteiro de 32 bits antes da divisão por 2^32 — o estado que o porte em uint confere direto.
    return { values, u32: values.map((v) => v * 4294967296) };
  });
}

caso('seededRng: 1000 valores da seed 42', 'seededRng', { seed: 42, count: 1000 }, (a) => {
  const rng = E.seededRng(a.seed);
  return Array.from({ length: a.count }, () => rng());
});

for (const max of [1, 2, 6, 20, 21, 99999]) {
  caso(`randomInt: max ${max}, 20 sorteios`, 'randomInt', { max, count: 20 }, (a, { rng }) => Array.from({ length: a.count }, () => E.randomInt(a.max, rng)), {
    rng: { seed: 7 },
  });
}
caso('randomInt: max 0 dá sempre 0', 'randomInt', { max: 0, count: 3 }, (a, { rng }) => Array.from({ length: a.count }, () => E.randomInt(a.max, rng)), {
  rng: { seed: 7 },
});
caso(
  'randomInt: bordas do [0, 1) com max 6 — 1/6 em ponto flutuante ainda cai no 0',
  'randomInt',
  { max: 6, count: 5 },
  (a, { rng }) => Array.from({ length: a.count }, () => E.randomInt(a.max, rng)),
  { rng: { sequence: [0, 0.16666666666666666, 0.5, 0.8333333333333334, 0.9999999999999999] } },
);

caso('pick: 20 escolhas numa lista de 5', 'pick', { list: ['a', 'b', 'c', 'd', 'e'], count: 20 }, (a, { rng }) => Array.from({ length: a.count }, () => E.pick(a.list, rng)), {
  rng: { seed: 99 },
});
caso('pick: lista vazia lança, sem sortear', 'pick', { list: [] as string[] }, (a, { rng }) => E.pick(a.list, rng), { rng: { seed: 1 } });

// =====================================================================
// hero — stats, derived e o que o combate usa de hero, mastery e catalog
// =====================================================================

modulo('hero');

constante('ATTR_KEYS', E.ATTR_KEYS);
constante('EQUIP_SLOTS', E.EQUIP_SLOTS);
constante('ITEM_STAT_KEYS', E.ITEM_STAT_KEYS);
constante('CRIT_PENALTY', E.CRIT_PENALTY);
constante('RACES', E.RACES);
constante('CLASSES', E.CLASSES);
constante('POWERS', E.POWERS);
constante('DEBUFFS', E.DEBUFFS);
constante('LEGACY_DEBUFF_EFFECTS', E.LEGACY_DEBUFF_EFFECTS);
constante('CLASS_PASSIVES', E.CLASS_PASSIVES);
constante('BASE_ATTR', E.BASE_ATTR);
constante('APPRENTICE', E.APPRENTICE);
constante('MASTERY_MAX_LEVEL', E.MASTERY_MAX_LEVEL);
constante('MASTERY_DAMAGE_PER_LEVEL', E.MASTERY_DAMAGE_PER_LEVEL);

caso('emptyAttributes', 'emptyAttributes', {}, () => E.emptyAttributes());

// --- derived ---

for (const level of [1, 2, 10, 100, 500, 501, 1000, 0, -5, 2.7, Number.NaN]) {
  caso(`equipmentCap: nível ${level}`, 'equipmentCap', { level }, (a) => E.equipmentCap(a.level));
}

const EQUIP_DE_VIDA: Record<string, EquippableItem | null> = {
  arma: { stats: { ataque: 5, vida: 300 } },
  secundaria: null,
  elmo: { stats: { vida: 100, defesa: 2 } },
  armadura: { stats: { vida: 400, defesa: 6 } },
  acessorio: { stats: { vida: -50, esquiva: 3, critico: 4 } },
};
caso('equipmentStat: vida sem teto soma tudo, negativo inclusive', 'equipmentStat', { equip: EQUIP_DE_VIDA, key: 'vida' }, (a) => E.equipmentStat(a.equip, 'vida'));
caso('equipmentStat: vida com teto 550 — negativo vira 0 e o total para no teto', 'equipmentStat', { equip: EQUIP_DE_VIDA, key: 'vida', cap: 550 }, (a) =>
  E.equipmentStat(a.equip, 'vida', a.cap),
);
caso('equipmentStat: item sozinho acima do teto fica no teto', 'equipmentStat', { equip: { armadura: { stats: { vida: 9999 } } }, key: 'vida', cap: 550 }, (a) =>
  E.equipmentStat(a.equip, 'vida', a.cap),
);
caso('equipmentStat: esquiva sem teto', 'equipmentStat', { equip: EQUIP_DE_VIDA, key: 'esquiva' }, (a) => E.equipmentStat(a.equip, 'esquiva'));
caso('equipmentStat: nada equipado', 'equipmentStat', { equip: {}, key: 'vida', cap: 550 }, (a) => E.equipmentStat(a.equip, 'vida', a.cap));
caso(
  'equipmentStat: save editado — string, null, NaN e fração (saneamento, com teto)',
  'equipmentStat',
  { equip: { arma: { stats: { vida: '25' } }, elmo: { stats: { vida: null } }, armadura: { stats: { vida: Number.NaN } }, botas: { stats: { vida: 2.9 } }, acessorio: {} }, key: 'vida', cap: 550 },
  (a) => E.equipmentStat(a.equip as never, 'vida', a.cap),
);
caso(
  'equipmentStat: save editado — string, null, NaN e fração (saneamento, sem teto)',
  'equipmentStat',
  { equip: { arma: { stats: { vida: '25' } }, elmo: { stats: { vida: null } }, armadura: { stats: { vida: Number.NaN } }, botas: { stats: { vida: 2.9 } }, acessorio: {} }, key: 'vida' },
  (a) => E.equipmentStat(a.equip as never, 'vida'),
);
caso('equipmentBonus: todos os stats de uma vez', 'equipmentBonus', { equip: EQUIP_DE_VIDA }, (a) => E.equipmentBonus(a.equip));

for (const level of [1, 2, 3, 10, 100, 499, 500, 501, 0, -3, 2.9, Number.NaN]) {
  caso(`xpForLevel: nível ${level}`, 'xpForLevel', { level }, (a) => E.xpForLevel(a.level));
}
for (const value of [10, 11, 12, 9, 8, 7, 1, 0, 20, 21, 99, 10.5, -1, Number.NaN]) {
  caso(`attrModifier: ${value}${value < 10 ? ' — floor de negativo, não truncamento' : ''}`, 'attrModifier', { value }, (a) => E.attrModifier(a.value));
}
caso('totalAttributePoints', 'totalAttributePoints', { attrs: atributos({ forca: 14, carisma: 6 }) }, (a) => E.totalAttributePoints(a.attrs));
caso('totalAttributePoints: atributo NaN conta 0 (saneamento)', 'totalAttributePoints', { attrs: atributos({ forca: Number.NaN }) }, (a) => E.totalAttributePoints(a.attrs));

const DERIVADOS: Array<[string, { level: number; attrs: Attributes; equip: Record<string, EquippableItem | null> }, { critPenalty?: boolean }?]> = [
  ['herói base, tudo 10, nível 1', { level: 1, attrs: atributos(), equip: {} }],
  ['atributos ímpares dão meio ponto de esquiva e crítico', { level: 7, attrs: atributos({ destreza: 13, carisma: 7, constituicao: 15, intelecto: 3 }), equip: {} }],
  ['penalidade de crítico do Azarado', { level: 1, attrs: atributos({ destreza: 12 }), equip: {} }, { critPenalty: true }],
  ['crítico com penalidade não fica negativo', { level: 1, attrs: atributos({ destreza: 3 }), equip: {} }, { critPenalty: true }],
  ['esquiva do equipamento negativa não fica abaixo de 0; velocidade pode', { level: 3, attrs: atributos({ destreza: 4 }), equip: { armadura: { stats: { esquiva: -20, velocidade: -9 } } } }],
  ['vida e mana de equipamento acima do teto do nível 1', { level: 1, attrs: atributos(), equip: { armadura: { stats: { vida: 5000, mana: 800 } }, acessorio: { stats: { vida: 200 } } } }],
  ['o mesmo equipamento no nível 100, com teto maior', { level: 100, attrs: atributos(), equip: { armadura: { stats: { vida: 5000, mana: 800 } }, acessorio: { stats: { vida: 200 } } } }],
  ['nível 500 e atributos 99', { level: 500, attrs: atributos({ forca: 99, destreza: 99, constituicao: 99, intelecto: 99, sabedoria: 99, carisma: 99 }), equip: {} }],
  ['equipamento de verdade em sete slots', { level: 12, attrs: atributos({ forca: 16 }), equip: { arma: item('espada', 'raro'), secundaria: item('escudo'), elmo: item('placas_elmo'), armadura: item('placas', 'epico'), calca: item('placas_calca'), botas: item('botas'), acessorio: item('colar_forca', 'lendario') } }],
];
for (const [nome, hero, options] of DERIVADOS) {
  caso(`derivedStats: ${nome}`, 'derivedStats', { hero, ...(options ? { options } : {}) }, (a) => E.derivedStats(a.hero as never, (a as { options?: { critPenalty?: boolean } }).options));
}

// --- maestria ---

for (const level of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, -1, 2.5, Number.NaN]) {
  caso(`masteryBattlesFor: nível ${level}`, 'masteryBattlesFor', { level }, (a) => E.masteryBattlesFor(a.level));
}
for (const battles of [0, 9, 10, 29, 30, 59, 60, 549, 550, 551, 100000, -5, 59.9, Number.NaN]) {
  caso(`masteryLevel: ${battles} vitórias`, 'masteryLevel', { battles }, (a) => E.masteryLevel(a.battles));
}
for (const masteryBattles of [0, 15, 60, 549, 550, 9999]) {
  caso(`masteryProgress: ${masteryBattles} vitórias`, 'masteryProgress', { hero: { masteryBattles } }, (a) => E.masteryProgress(a.hero));
}
caso('masteryProgress: sem contagem no save', 'masteryProgress', { hero: {} }, (a) => E.masteryProgress(a.hero));
for (const cls of E.CLASSES) caso(`masteryWeapons: ${cls.id}`, 'masteryWeapons', { cls }, (a) => E.masteryWeapons(a.cls));
for (const [nome, hero] of [
  ['guerreiro de espada, 60 vitórias', heroi({ classe: 'guerreiro', arma: 'espada', extra: { masteryBattles: 60 } })],
  ['guerreiro de machado não domina a arma', heroi({ classe: 'guerreiro', arma: 'machado', extra: { masteryBattles: 550 } })],
  ['bárbaro de marreta, que também é dele', heroi({ classe: 'barbaro', arma: 'marreta', extra: { masteryBattles: 210 } })],
  ['mão vazia não é arma da classe', heroi({ classe: 'guerreiro', arma: null, extra: { masteryBattles: 550 } })],
  ['Aprendiz de espada não tem classe', heroi({ classe: null, arma: 'espada', extra: { masteryBattles: 550 } })],
  ['save antigo: só o nome "Cacador", sem acento e sem id', heroi({ classe: 'cacador', nomeDaClasse: 'Cacador', arma: 'arco', extra: { masteryBattles: 550 } })],
] as const) {
  caso(`wieldsMasteryWeapon: ${nome}`, 'wieldsMasteryWeapon', { hero }, (a) => E.wieldsMasteryWeapon(a.hero));
  caso(`masteryDamageMult: ${nome}`, 'masteryDamageMult', { hero }, (a) => E.masteryDamageMult(a.hero));
}
for (const killCount of [0, 1, 7, 8, 15, 16, 100, 1000, -3, 15.9]) {
  caso(`veteranMasteryBattles: ${killCount} monstros`, 'veteranMasteryBattles', { killCount }, (a) => E.veteranMasteryBattles(a.killCount));
}
caso('winBattle: 9 vitórias viram 10 e sobem o nível', 'winBattle', { hero: heroi({ classe: 'mago', extra: { masteryBattles: 9 } }) }, (a) => E.winBattle(a.hero));
caso('winBattle: no teto continua contando', 'winBattle', { hero: heroi({ classe: 'mago', extra: { masteryBattles: 550 } }) }, (a) => E.winBattle(a.hero));
caso('winBattle: Aprendiz não conta', 'winBattle', { hero: heroi({ classe: null, extra: { masteryBattles: 3 } }) }, (a) => E.winBattle(a.hero));

// --- buscas no catálogo (toda regra de classe passa por idDaClasse) ---

for (const id of ['mago', 'cacador', 'nada']) caso(`classById: ${id}`, 'classById', { id }, (a) => E.classById(a.id));
for (const name of ['Clérigo', 'Clerigo', 'CAÇADOR', 'caçador', 'Aprendiz', '']) caso(`classByName: "${name}"`, 'classByName', { name }, (a) => E.classByName(a.name));
for (const name of ['Elfo Negro', 'elfo negro', 'Anão', 'Anao', 'Gnomo']) caso(`raceByName: "${name}"`, 'raceByName', { name }, (a) => E.raceByName(a.name));
for (const id of ['bola_de_fogo', 'nada']) caso(`powerById: ${id}`, 'powerById', { id }, (a) => E.powerById(a.id));
for (const name of ['Bola de Fogo', 'bola de fogo']) caso(`powerByName: "${name}" (exato, com acento e caixa)`, 'powerByName', { name }, (a) => E.powerByName(a.name));
for (const id of ['azarado', 'nada']) caso(`debuffById: ${id}`, 'debuffById', { id }, (a) => E.debuffById(a.id));
for (const classId of ['ladino', 'nada']) caso(`classPassive: ${classId}`, 'classPassive', { classId }, (a) => E.classPassive(a.classId));
for (const [nome, quem] of [
  ['classId manda', { classId: 'mago', className: 'Guerreiro' }],
  ['só o nome, sem acento', { className: 'Cacador' }],
  ['Aprendiz não é classe', { className: 'Aprendiz' }],
  ['nada', {}],
] as const) {
  caso(`idDaClasse: ${nome}`, 'idDaClasse', { quem }, (a) => E.idDaClasse(a.quem));
}
for (const [nome, quem] of [
  ['raceId manda', { raceId: 'orc', race: 'Elfo' }],
  ['só o nome', { race: 'Meio-Elfo' }],
  ['nada', {}],
] as const) {
  caso(`idDaRaca: ${nome}`, 'idDaRaca', { quem }, (a) => E.idDaRaca(a.quem));
}

// --- o que o combate usa de hero.ts ---

for (const [nome, hero, effect] of [
  ['efeito gravado', { debuff: E.debuffById('visao_fraca') }, 'rangedPenalty'],
  ['outro efeito', { debuff: E.debuffById('visao_fraca') }, 'critPenalty'],
  ['save antigo: só o nome, sem acento', { debuff: { id: '', name: 'Visao Fraca', icon: '', desc: '', attr: null } }, 'rangedPenalty'],
  ['save antigo: Teimoso pelo nome', { debuff: { id: '', name: 'Teimoso', icon: '', desc: '', attr: 'sabedoria' } }, 'fleePenalty'],
  ['debuff sem efeito', { debuff: E.debuffById('orgulhoso') }, 'critPenalty'],
  ['herói nulo', null, 'critPenalty'],
] as const) {
  caso(`hasDebuffEffect: ${nome}`, 'hasDebuffEffect', { hero, effect }, (a) => E.hasDebuffEffect(a.hero as never, a.effect));
}

for (const [nome, hero] of [
  ['mão vazia', heroi({ classe: 'guerreiro', arma: null })],
  ['guerreiro de espada', heroi({ classe: 'guerreiro', arma: 'espada' })],
  ['mago de espada', heroi({ classe: 'mago', arma: 'espada' })],
  ['bardo de violão', heroi({ classe: 'bardo', arma: 'violao' })],
  ['Aprendiz de espada', heroi({ classe: null, arma: 'espada' })],
  ['save antigo: "Clerigo" sem acento, de maça', heroi({ classe: 'clerigo', nomeDaClasse: 'Clerigo', arma: 'maca' })],
] as const) {
  caso(`weaponAffinityPct: ${nome}`, 'weaponAffinityPct', { hero }, (a) => E.weaponAffinityPct(a.hero));
}

for (const id of [...ARMAS_IDS, 'escudo', 'grimorio', 'couro']) {
  caso(`isTwoHanded: ${id}`, 'isTwoHanded', { item: item(id) }, (a) => E.isTwoHanded(a.item));
  caso(`isOffhandEligible: ${id}`, 'isOffhandEligible', { item: item(id) }, (a) => E.isOffhandEligible(a.item));
}
caso('isTwoHanded: null', 'isTwoHanded', { item: null }, (a) => E.isTwoHanded(a.item));

// O grimório cabe ao lado do cajado, e de nenhuma outra arma de duas mãos (AO_LADO_DO_CAJADO).
for (const [arma, peca] of [
  ['cajado', 'grimorio'],
  ['cajado', 'escudo'],
  ['cajado', 'adaga'],
  ['arco', 'grimorio'],
  ['machado', 'grimorio'],
  ['espada', 'escudo'],
  ['espada', 'grimorio'],
  [null, 'grimorio'],
  ['cajado', null],
] as const) {
  caso(`cabeNaMaoLivre: ${arma ?? 'mão vazia'} e ${peca ?? 'nada'}`, 'cabeNaMaoLivre', { arma: arma ? item(arma) : null, peca: peca ? item(peca) : null }, (a) =>
    E.cabeNaMaoLivre(a.arma, a.peca),
  );
}

{
  const guerreiro = heroi({ classe: 'guerreiro', arma: 'espada', attrs: { constituicao: 12 } });
  caso('recomputeDerived: vida máxima maior cura pela diferença', 'recomputeDerived', { hero: { ...guerreiro, attrs: { ...guerreiro.attrs, constituicao: 15 }, hp: 50 } }, (a) =>
    E.recomputeDerived(a.hero),
  );
  caso('recomputeDerived: vida máxima menor só limita, não cura', 'recomputeDerived', { hero: { ...guerreiro, attrs: { ...guerreiro.attrs, constituicao: 5 } } }, (a) =>
    E.recomputeDerived(a.hero),
  );
  caso('recomputeDerived: hp 0 conta como cheio (o `||` do original)', 'recomputeDerived', { hero: { ...guerreiro, hp: 0, mp: 0 } }, (a) => E.recomputeDerived(a.hero));
  caso('recomputeDerived: com penalidade de crítico', 'recomputeDerived', { hero: guerreiro, options: { critPenalty: true } }, (a) => E.recomputeDerived(a.hero, a.options));

  const xp = (hero: Hero, amount: number) => ({ hero, amount });
  caso('gainXP: não sobe', 'gainXP', xp(guerreiro, 10), (a) => E.gainXP(a.hero, a.amount));
  caso('gainXP: exatamente o que falta sobe um nível', 'gainXP', xp(guerreiro, 40), (a) => E.gainXP(a.hero, a.amount));
  caso('gainXP: vários níveis de uma vez', 'gainXP', xp(guerreiro, 1000), (a) => E.gainXP(a.hero, a.amount));
  caso('gainXP: um milhão de XP', 'gainXP', xp(guerreiro, 1e6), (a) => E.gainXP(a.hero, a.amount));
  caso('gainXP: NaN não estraga o save', 'gainXP', xp(guerreiro, Number.NaN), (a) => E.gainXP(a.hero, a.amount));
  caso('gainXP: Infinity vira 0 em vez de travar', 'gainXP', xp(guerreiro, Number.POSITIVE_INFINITY), (a) => E.gainXP(a.hero, a.amount));
  caso('gainXP: negativo vira 0', 'gainXP', xp(guerreiro, -50), (a) => E.gainXP(a.hero, a.amount));
  caso('gainXP: xpNext estragado no save', 'gainXP', xp({ ...guerreiro, xpNext: Number.NaN, xp: 10 }, 35), (a) => E.gainXP(a.hero, a.amount));

  const comPontos = { ...guerreiro, attrPoints: 2 };
  const gastar = (a: { hero: Hero; key: string }) => E.spendAttrPoint(a.hero, a.key as keyof Attributes);
  caso('spendAttrPoint: gasta um ponto e recalcula', 'spendAttrPoint', { hero: comPontos, key: 'constituicao' }, gastar);
  caso('spendAttrPoint: sem pontos devolve igual', 'spendAttrPoint', { hero: guerreiro, key: 'forca' }, gastar);
  caso('spendAttrPoint: 99 é o teto', 'spendAttrPoint', { hero: { ...comPontos, attrs: { ...comPontos.attrs, forca: 99 } }, key: 'forca' }, gastar);
  caso('spendAttrPoint: 999 (do painel ADM) cai pra 99', 'spendAttrPoint', { hero: { ...comPontos, attrs: { ...comPontos.attrs, forca: 999 } }, key: 'forca' }, gastar);

  const comEscudo = { ...guerreiro, equip: { ...guerreiro.equip, secundaria: item('escudo') } };
  caso('equipItem: arma de duas mãos esvazia a secundária', 'equipItem', { hero: comEscudo, item: item('machado') }, (a) => E.equipItem(a.hero, a.item));
  caso('equipItem: secundária recusada com arma de duas mãos', 'equipItem', { hero: heroi({ classe: 'arqueiro' }), item: item('escudo') }, (a) => E.equipItem(a.hero, a.item));
  const grimorio = item('grimorio', 'raro', 3);
  const deEspadaEGrimorio = heroi({ classe: 'mago', arma: 'espada', equip: { secundaria: grimorio } });
  caso('equipItem: o grimório ao lado do cajado', 'equipItem', { hero: heroi({ classe: 'mago' }), item: grimorio }, (a) => E.equipItem(a.hero, a.item));
  caso('equipItem: o grimório não cabe com o arco', 'equipItem', { hero: heroi({ classe: 'arqueiro' }), item: grimorio }, (a) => E.equipItem(a.hero, a.item));
  caso('equipItem: o cajado deixa o grimório na mão', 'equipItem', { hero: deEspadaEGrimorio, item: item('cajado') }, (a) => E.equipItem(a.hero, a.item));
  caso('equipItem: o machado larga o grimório', 'equipItem', { hero: deEspadaEGrimorio, item: item('machado') }, (a) => E.equipItem(a.hero, a.item));
  caso('equipItem: adaga na secundária', 'equipItem', { hero: guerreiro, item: item('adaga'), requestedSlot: 'secundaria' }, (a) =>
    E.equipItem(a.hero, a.item, a.requestedSlot as 'secundaria'),
  );
  caso('equipItem: elmo vai pro elmo e recalcula', 'equipItem', { hero: guerreiro, item: item('placas_elmo', 'raro') }, (a) => E.equipItem(a.hero, a.item));
  caso('equipItem: poção não veste', 'equipItem', { hero: guerreiro, item: item('pot_vida') }, (a) => E.equipItem(a.hero, a.item));
  caso('equipItem: slot errado', 'equipItem', { hero: guerreiro, item: item('botas'), requestedSlot: 'elmo' }, (a) => E.equipItem(a.hero, a.item, a.requestedSlot as 'elmo'));
  caso('unequipItem: tira a arma', 'unequipItem', { hero: guerreiro, slot: 'arma' }, (a) => E.unequipItem(a.hero, a.slot as 'arma'));
}

{
  const humano = E.raceById('humano')!;
  const fada = E.raceById('fada')!;
  const azarado = E.debuffById('azarado')!;
  const desajeitado = E.debuffById('desajeitado')!;
  caso('apprenticeAttrs: humano sem atributo na fraqueza', 'apprenticeAttrs', { race: humano, debuff: azarado }, (a) => E.apprenticeAttrs(a.race, a.debuff));
  caso('apprenticeAttrs: fada desajeitada', 'apprenticeAttrs', { race: fada, debuff: desajeitado }, (a) => E.apprenticeAttrs(a.race, a.debuff));
  for (const seed of [1, 2, 3]) {
    const cls = E.classById(CLASSES_IDS[seed] as string)!;
    caso(`rollAttrs: seed ${seed}, ${cls.id}`, 'rollAttrs', { race: fada, cls, debuff: desajeitado }, (a, { rng }) => E.rollAttrs(a.race, a.cls, a.debuff, rng), { rng: { seed } });
    caso(`generateCompanion: seed ${seed}`, 'generateCompanion', {}, (_a, { rng }) => E.generateCompanion(rng), { rng: { seed } });
    caso(`buildApprentice: seed ${seed}`, 'buildApprentice', { creation: { name: 'Novo', race: humano, debuff: azarado, hair: 'curto' } }, (a, { rng }) => E.buildApprentice(a.creation, rng), {
      rng: { seed },
    });
  }
}

// --- o resto de hero.ts ---

{
  const bardo = heroi({ classe: 'bardo', extra: { powerIds: ['cancao_debilitante', 'escudo_arcano'], powerNames: ['Canção Debilitante', 'Escudo Arcano'] } });
  for (const [nome, hero] of [
    ['pelos ids', heroi({ classe: 'mago', extra: { powerIds: ['bola_de_fogo', 'escudo_arcano'], powerNames: ['Bola de Fogo', 'Escudo Arcano'] } })],
    ['save antigo: só os nomes, um que não existe mais', { ...heroi({ classe: 'mago' }), powerIds: undefined, powerNames: ['Bola de Fogo', 'Poder Esquecido'] }],
    ['o bardo ganha a Canção de Batalha da classe', bardo],
    ['o bardo que já tem a Canção não a recebe duas vezes', { ...bardo, powerIds: ['cancao_debilitante', 'cancao_de_batalha'] }],
    ['o necromante ganha Levantar Esqueleto da classe', heroi({ classe: 'necromante', extra: { powerIds: ['maldicao_sombria'], powerNames: ['Maldição Sombria'] } })],
    ['Aprendiz sem poderes', heroi({ classe: null })],
  ] as const) {
    caso(`heroPowers: ${nome}`, 'heroPowers', { hero }, (a) => E.heroPowers(a.hero as never));
  }

  for (const [nome, hero] of [
    ['classId', { classId: 'mago' }],
    ['só o nome "Cacador"', { className: 'Cacador' }],
    ['Aprendiz', { className: 'Aprendiz' }],
  ] as const) {
    caso(`hasClass: ${nome}`, 'hasClass', { hero }, (a) => E.hasClass(a.hero));
  }

  const armado = heroi({ classe: 'guerreiro' });
  caso('equippedSlot: acha pelo uid', 'equippedSlot', { hero: armado, item: { ...armado.equip.arma!, equipped: false } }, (a) => E.equippedSlot(a.hero, a.item));
  caso('equippedSlot: item que não está vestido', 'equippedSlot', { hero: armado, item: item('adaga', 'comum', 9) }, (a) => E.equippedSlot(a.hero, a.item));

  // Saves de antes: sem os slots novos, sem ids, só nomes de poder, sem contagem de maestria.
  const antigo = heroi({ classe: 'clerigo', nomeDaClasse: 'Clerigo', equip: { armadura: item('robe') } }) as Partial<Hero>;
  delete antigo.raceId;
  delete antigo.masteryBattles;
  delete antigo.powerIds;
  const saveAntigo = {
    ...antigo,
    race: 'Elfo',
    equip: { arma: antigo.equip!.arma, armadura: antigo.equip!.armadura },
    powerNames: ['Cura Menor', 'Escudo Arcano'],
    killCount: 17,
    attrPoints: undefined,
    buffs: { shield: 0.5, poisonTurns: 2 },
  };
  caso('hydrateSavedHero: save de antes dos ids e dos slots novos', 'hydrateSavedHero', { hero: saveAntigo }, (a) => E.hydrateSavedHero(a.hero as never));
  caso('hydrateSavedHero: arco e escudo de antes da regra das duas mãos', 'hydrateSavedHero', { hero: heroi({ classe: 'arqueiro', equip: { secundaria: item('escudo') } }) }, (a) =>
    E.hydrateSavedHero(a.hero),
  );
  caso('hydrateSavedHero: o cajado e o grimório ficam juntos', 'hydrateSavedHero', { hero: heroi({ classe: 'necromante', equip: { secundaria: item('grimorio') } }) }, (a) =>
    E.hydrateSavedHero(a.hero),
  );
  caso('hydrateSavedHero: o arco não guarda o grimório', 'hydrateSavedHero', { hero: heroi({ classe: 'arqueiro', equip: { secundaria: item('grimorio') } }) }, (a) =>
    E.hydrateSavedHero(a.hero),
  );
  caso('hydrateSavedHero: com classe e sem poder nenhum ganha o da classe', 'hydrateSavedHero', { hero: heroi({ classe: 'monge', extra: { powerIds: [], powerNames: [] } }) }, (a) =>
    E.hydrateSavedHero(a.hero),
  );
  caso('hydrateSavedHero: contagem de maestria fracionária', 'hydrateSavedHero', { hero: heroi({ classe: 'monge', extra: { masteryBattles: 12.7, killCount: 400 } }) }, (a) =>
    E.hydrateSavedHero(a.hero),
  );
  caso('hydrateSavedHero: Aprendiz sem contagem continua em 0', 'hydrateSavedHero', { hero: { ...heroi({ classe: null }), masteryBattles: undefined, killCount: 30 } }, (a) =>
    E.hydrateSavedHero(a.hero),
  );
}

// --- buildHero e trainAtGuild ---
//
// O terceiro argumento é o `rng` e o relógio do `uid` da arma inicial. Sem
// ele, as duas sorteiam o uid por dentro, com `defaultRng` e `Date.now`.

{
  const buildHeroComArma = E.buildHero;
  const trainAtGuildComArma = E.trainAtGuild;
  const humano = E.raceById('humano')!;
  const orgulhoso = E.debuffById('orgulhoso')!;
  for (const [seed, classe, escolhidos] of [
    [1, 'guerreiro', []],
    [2, 'mago', ['escudo_arcano', 'bola_de_fogo']],
    [3, 'bardo', ['passo_veloz']],
  ] as const) {
    const creation = { name: 'Pronto', race: humano, cls: E.classById(classe)!, debuff: orgulhoso, chosenPowerIds: [...escolhidos] };
    caso(`buildHero: ${classe}, seed ${seed}`, 'buildHero', { creation, armaInicial: { now: AGORA } }, (a, { rng, now }) => buildHeroComArma(a.creation, rng, { rng, now }), {
      rng: { seed },
      now: AGORA,
      seEscondido: 'pular',
    });
  }
  const aprendiz = E.buildApprentice({ name: 'Novo', race: humano, debuff: orgulhoso }, E.seededRng(1));
  for (const [nome, hero, classe] of [
    ['Aprendiz de mão vazia vira mago', aprendiz, 'mago'],
    ['Aprendiz com espada: o cajado vai pra mochila', { ...aprendiz, equip: { ...aprendiz.equip, arma: item('espada') } }, 'mago'],
    ['Aprendiz de escudo: o machado de duas mãos vai pra mochila', { ...aprendiz, equip: { ...aprendiz.equip, secundaria: item('escudo') } }, 'barbaro'],
    ['Aprendiz de grimório: o cajado entra na mão', { ...aprendiz, equip: { ...aprendiz.equip, secundaria: item('grimorio') } }, 'mago'],
  ] as const) {
    caso(`trainAtGuild: ${nome}`, 'trainAtGuild', { hero, cls: E.classById(classe)!, armaInicial: { now: AGORA } }, (a, { rng, now }) => trainAtGuildComArma(a.hero, a.cls, { rng, now }), {
      rng: { seed: 1 },
      now: AGORA,
      seEscondido: 'pular',
    });
  }
  // Quem já tem classe sai como entrou, sem instanciar nada: este grava hoje.
  caso('trainAtGuild: quem já tem classe sai como entrou', 'trainAtGuild', { hero: heroi({ classe: 'guerreiro' }), cls: E.classById('mago')!, armaInicial: { now: AGORA } }, (a, { rng, now }) =>
    trainAtGuildComArma(a.hero, a.cls, { rng, now }),
  { rng: { seed: 1 }, now: AGORA, seEscondido: 'pular' });
}

// --- teachers ---

constante('CLASS_TEACHER_POWERS', E.CLASS_TEACHER_POWERS);
constante('TEACHERS', E.TEACHERS);

{
  const comMaestria = (classe: string | null, powerIds: string[], teachersMet: number, masteryBattles: number, nomeDaClasse?: string): Hero =>
    heroi({
      classe,
      ...(nomeDaClasse ? { nomeDaClasse } : {}),
      extra: { powerIds, powerNames: powerIds.map((id) => E.powerById(id)?.name ?? id), teachersMet, masteryBattles },
    });
  const novo = comMaestria('guerreiro', ['golpe_poderoso'], 0, 100);
  const depoisDoPrimeiro = comMaestria('guerreiro', ['golpe_poderoso', 'grito_de_guerra'], 1, 360);
  const veterano = comMaestria('guerreiro', ['golpe_poderoso', 'escudo_arcano', 'bola_de_fogo'], 0, 100);
  const veteranoComALista = comMaestria('guerreiro', ['golpe_poderoso', 'grito_de_guerra', 'golpe_atordoante', 'passo_veloz'], 0, 100);
  const pouco = comMaestria('guerreiro', ['golpe_poderoso'], 0, 60);
  const aprendizComMaestria = comMaestria(null, [], 0, 550);
  const clerigoAntigo = comMaestria('clerigo', ['cura_menor'], 0, 100, 'Clerigo');
  const soDaClasse = comMaestria('guerreiro', ['golpe_poderoso', 'golpe_poderoso'], 0, 100);
  const herois: Array<[string, Hero]> = [
    ['novo guerreiro, maestria 4', novo],
    ['depois do primeiro professor, maestria 8', depoisDoPrimeiro],
    ['veterano com 3 poderes da criação antiga', veterano],
    ['veterano que já tem a lista toda', veteranoComALista],
    ['maestria 3', pouco],
    ['Aprendiz', aprendizComMaestria],
    ['save antigo "Clerigo"', clerigoAntigo],
    ['só o poder da classe, repetido', soDaClasse],
    ['já encontrou os dois', comMaestria('guerreiro', ['golpe_poderoso', 'grito_de_guerra', 'passo_veloz'], 2, 550)],
  ];
  for (const [nome, hero] of herois) {
    caso(`teacherOffer: ${nome}`, 'teacherOffer', { hero }, (a) => E.teacherOffer(a.hero));
    caso(`teacherMode: ${nome}`, 'teacherMode', { hero }, (a) => E.teacherMode(a.hero));
    caso(`swappablePowers: ${nome}`, 'swappablePowers', { hero }, (a) => E.swappablePowers(a.hero));
    for (const floor of [24, 25, 50, 51, 74, 75, 80, 81]) {
      caso(`teacherFor: ${nome}, andar ${floor}`, 'teacherFor', { hero, floor }, (a) => E.teacherFor(a.hero, a.floor));
    }
  }
  for (const [professor, floor, roll] of [
    [E.TEACHERS[0]!, 25, 0.05],
    [E.TEACHERS[0]!, 25, 0.1],
    [E.TEACHERS[0]!, 49, 0.99],
    [E.TEACHERS[0]!, 50, 0.99],
    [E.TEACHERS[1]!, 77, 0.2],
    [E.TEACHERS[1]!, 77, 0.3],
    [E.TEACHERS[1]!, 80, 0.99],
  ] as const) {
    caso(`teacherAppears: professor ${professor.number}, andar ${floor}, rolo ${roll}`, 'teacherAppears', { professor, floor, roll }, (a) => E.teacherAppears(a.professor, a.floor, a.roll));
  }
  for (const [nome, hero, powerId] of [
    ['novo aprende da lista', novo, 'passo_veloz'],
    ['poder fora da lista', novo, 'bola_de_fogo'],
    ['veterano não aprende, troca', veterano, 'grito_de_guerra'],
    ['segundo professor', depoisDoPrimeiro, 'golpe_atordoante'],
  ] as const) {
    caso(`learnFromTeacher: ${nome}`, 'learnFromTeacher', { hero, powerId }, (a) => E.learnFromTeacher(a.hero, a.powerId));
  }
  for (const [nome, hero, giveUp, learn] of [
    ['veterano troca um extra', veterano, 'escudo_arcano', 'grito_de_guerra'],
    ['não troca o poder da classe', veterano, 'golpe_poderoso', 'grito_de_guerra'],
    ['não aprende fora da lista', veterano, 'escudo_arcano', 'rajada_glacial'],
    ['novo não troca, aprende', novo, 'golpe_poderoso', 'passo_veloz'],
  ] as const) {
    caso(`swapWithTeacher: ${nome}`, 'swapWithTeacher', { hero, giveUp, learn }, (a) => E.swapWithTeacher(a.hero, a.giveUp, a.learn));
  }
}

// =====================================================================
// items — templates, rarity, item e tiers
// =====================================================================

modulo('items');

constante('RARITY_IDS', E.RARITY_IDS);
constante('RARITIES', E.RARITIES);
constante('ITEM_CATEGORIES', E.ITEM_CATEGORIES);
constante('EQUIPPABLE_CATEGORIES', E.EQUIPPABLE_CATEGORIES);
constante('STAT_LABELS', E.STAT_LABELS);
constante('PROC_EFFECTS', E.PROC_EFFECTS);
constante('TEMPLATES', E.TEMPLATES);
constante('TIER_ORDER', E.TIER_ORDER);
constante('TIER_MIN', E.TIER_MIN);

for (const id of ['comum', 'mitico', 'nada']) caso(`rarityById: ${id}`, 'rarityById', { id }, (a) => E.rarityById(a.id));
for (const floor of [1, 2, 6, 12, 13, 50, 0, -3, 1.5]) caso(`rarityWeights: andar ${floor}`, 'rarityWeights', { floor }, (a) => E.rarityWeights(a.floor));
for (const floor of [1, 5, 13, 40]) {
  for (const seed of [1, 2]) {
    caso(`pickRarity: andar ${floor}, 30 sorteios, seed ${seed}`, 'pickRarity', { floor, count: 30 }, (a, { rng }) => Array.from({ length: a.count }, () => E.pickRarity(a.floor, rng).id), {
      rng: { seed },
    });
  }
}
caso('pickRarity: rng 0 é comum', 'pickRarity', { floor: 1 }, (a, { rng }) => E.pickRarity(a.floor, rng), { rng: { sequence: [0] } });
caso('pickRarity: rng no fim do intervalo é mítico', 'pickRarity', { floor: 1 }, (a, { rng }) => E.pickRarity(a.floor, rng), { rng: { sequence: [0.9999999999999999] } });

for (const id of ['espada', 'bota_vento', 'nada']) caso(`templateById: ${id}`, 'templateById', { id }, (a) => E.templateById(a.id));
for (const category of E.ITEM_CATEGORIES) caso(`templatesByCategory: ${category}`, 'templatesByCategory', { category }, (a) => E.templatesByCategory(a.category));
for (const category of [...E.ITEM_CATEGORIES, 'nada']) caso(`isEquippable: ${category}`, 'isEquippable', { category }, (a) => E.isEquippable(a.category));
for (const template of E.TEMPLATES.filter((t) => E.isEquippable(t.category))) {
  caso(`slotForTemplate: ${template.id}`, 'slotForTemplate', { template }, (a) => E.slotForTemplate(a.template));
}

for (const template of E.TEMPLATES) {
  caso(
    `instantiate: ${template.id} em cada raridade`,
    'instantiate',
    { template, rarities: E.RARITIES, options: { now: AGORA } },
    (a, { rng, now }) => a.rarities.map((rarity) => E.instantiate(a.template, rarity, { rng, now })),
    { rng: { seed: 1 }, now: AGORA },
  );
}
/** Template de mentira com meios exatos: o `Math.round` do JS sobe no .5 (e no −2,5 vai pra −2); o do C# arredonda pro par. */
const TEMPLATE_DE_ARREDONDAMENTO: ItemTemplate = {
  id: 'arredondamento',
  name: 'Arredondamento',
  genero: 'm',
  category: 'arma',
  desc: '',
  sprite: '',
  base: { ataque: 2.5, defesa: -2.5, vida: 0.5, mana: 3.5, critico: -3.5, velocidade: 1.5 },
  value: 4.5,
  proc: { chance: 0.45, effect: 'queimadura', label: '', icon: '' },
};
caso(
  'instantiate: arredondamento de .5 e −.5, e o teto de 0,5 na chance do proc',
  'instantiate',
  { template: TEMPLATE_DE_ARREDONDAMENTO, rarities: [E.RARITIES[0], E.RARITIES[5]], options: { now: AGORA } },
  (a, { rng, now }) => a.rarities.map((rarity) => E.instantiate(a.template, rarity as never, { rng, now })),
  { rng: { seed: 1 }, now: AGORA },
);

for (let seed = 1; seed <= 12; seed++) {
  caso(`randomItem: qualquer categoria, andar 1, seed ${seed}`, 'randomItem', { options: { now: AGORA } }, (_a, { rng, now }) => E.randomItem({ rng, now }), {
    rng: { seed },
    now: AGORA,
  });
}
for (const category of E.ITEM_CATEGORIES.filter((c) => c !== 'missao')) {
  for (const floor of [1, 10]) {
    caso(`randomItem: ${category}, andar ${floor}`, 'randomItem', { options: { category, floor, now: AGORA } }, (a, { rng, now }) => E.randomItem({ ...a.options, rng, now }), {
      rng: { seed: floor * 7 },
      now: AGORA,
    });
  }
}
for (const floor of [2, 10, 40, 51, 60, 100, 0, -5]) {
  caso(`randomItem: arma comum forçada no andar ${floor} (bônus de profundidade, teto +75%)`, 'randomItem', { options: { category: 'arma', rarity: 'comum', floor, now: AGORA } }, (a, { rng, now }) =>
    E.randomItem({ ...a.options, rng, now } as never),
  { rng: { seed: 3 }, now: AGORA });
}
caso('randomItem: raridade forçada mítica', 'randomItem', { options: { category: 'acessorio', rarity: 'mitico', floor: 5, now: AGORA } }, (a, { rng, now }) =>
  E.randomItem({ ...a.options, rng, now } as never),
{ rng: { seed: 4 }, now: AGORA });
caso('randomItem: raridade desconhecida cai pra comum, sem sortear raridade', 'randomItem', { options: { category: 'arma', rarity: 'xyz', floor: 5, now: AGORA } }, (a, { rng, now }) =>
  E.randomItem({ ...a.options, rng, now } as never),
{ rng: { seed: 4 }, now: AGORA });
caso('randomItem: material fundo não ganha foundFloor', 'randomItem', { options: { category: 'material', floor: 40, now: AGORA } }, (a, { rng, now }) =>
  E.randomItem({ ...a.options, rng, now } as never),
{ rng: { seed: 5 }, now: AGORA });

// ---------- os materiais das peças (só do app) ----------

constante('MATERIAIS', E.MATERIAIS);
for (const degrau of [1, 2, 3]) caso(`multiplicadorDoDegrau: ${degrau}`, 'multiplicadorDoDegrau', { degrau }, (a) => E.multiplicadorDoDegrau(a.degrau));
for (const andar of [1, 5, 6, 20, 25, 26, 37, 49, 50, 51, 74, 75, 76, 100, 300, 0, -4]) {
  for (const chefe of [false, true]) {
    caso(`chancesDoDegrau: andar ${andar}${chefe ? ', chefe' : ''}`, 'chancesDoDegrau', { andar, chefe }, (a) => E.chancesDoDegrau(a.andar, a.chefe));
  }
}
for (const [andar, chefe, sorteio, teto] of [
  [75, false, 0.1, 3],
  [75, false, 0.2, 3],
  [75, false, 0.55, 3],
  [75, false, 0.6, 3],
  [75, false, 0.1, 2],
  [30, true, 0.05, 3],
  [40, false, 0.3, 3],
  [1, false, 0, 3],
  [100, true, 0.999, 3],
  [100, true, 0.29, 1],
] as const) {
  caso(`sortearDegrau: andar ${andar}${chefe ? ', chefe' : ''}, sorteio ${sorteio}, teto ${teto}`, 'sortearDegrau', { andar, chefe, teto }, (a, { rng }) => E.sortearDegrau(a.andar, a.chefe, rng, a.teto), {
    rng: { sequence: [sorteio] },
  });
}
for (const template of E.TEMPLATES) {
  caso(`nomeComMaterial: ${template.id}`, 'nomeComMaterial', { template, degraus: [1, 2, 3, 4, 0, 2.5] }, (a) => a.degraus.map((d) => E.nomeComMaterial(a.template, d)));
}
for (const template of E.TEMPLATES.filter((t) => E.isEquippable(t.category))) {
  for (const degrau of [2, 3]) {
    caso(
      `instantiate: ${template.id} no degrau ${degrau}`,
      'instantiate',
      { template, rarities: [E.RARITIES[0], E.RARITIES[2], E.RARITIES[5]], options: { now: AGORA, degrau } },
      (a, { rng, now }) => a.rarities.map((rarity) => E.instantiate(a.template, rarity as never, { rng, now, degrau: a.options.degrau })),
      { rng: { seed: 1 }, now: AGORA },
    );
  }
}
for (const degrau of [0, 9, 2.7, -1]) {
  caso(`instantiate: espada no degrau ${degrau} (fica entre 1 e 3, inteiro)`, 'instantiate', { template: E.templateById('espada'), rarities: [E.RARITIES[2]], options: { now: AGORA, degrau } }, (a, { rng, now }) =>
    a.rarities.map((rarity) => E.instantiate(a.template as never, rarity as never, { rng, now, degrau: a.options.degrau })),
  { rng: { seed: 1 }, now: AGORA });
}
caso('instantiate: o arredondamento com o degrau', 'instantiate', { template: { ...TEMPLATE_DE_ARREDONDAMENTO, escada: 'metal' as const }, rarities: [E.RARITIES[0], E.RARITIES[3]], options: { now: AGORA, degrau: 2 } }, (a, { rng, now }) =>
  a.rarities.map((rarity) => E.instantiate(a.template, rarity as never, { rng, now, degrau: a.options.degrau })),
{ rng: { seed: 1 }, now: AGORA });
{
  const noApp = (nome: string, options: Record<string, unknown>, rng: RngSpec) =>
    caso(`randomItem: app, ${nome}`, 'randomItem', { options: { ...options, now: AGORA, app: true } }, (a, { rng: r, now }) => E.randomItem({ ...a.options, rng: r, now } as never), { rng, now: AGORA });
  for (const floor of [1, 30, 60, 100]) {
    for (const seed of [1, 2, 3, 4, 5, 6]) noApp(`arma, andar ${floor}, seed ${seed}`, { category: 'arma', floor }, { seed });
  }
  for (const seed of [7, 8, 9, 10]) noApp(`armadura do chefe, andar 80, seed ${seed}`, { category: 'armadura', floor: 80, chefe: true }, { seed });
  for (const seed of [11, 12, 13]) noApp(`qualquer categoria, andar 90, seed ${seed}`, { floor: 90 }, { seed });
  noApp('espada no degrau 3, sorteio na mão', { category: 'arma', floor: 100 }, { sequence: [0, 0, 0.01, 0] });
  noApp('espada no degrau 2, sorteio na mão', { category: 'arma', floor: 100 }, { sequence: [0, 0, 0.2, 0] });
  noApp('teto 2 vira o 3 em 2', { category: 'arma', floor: 100, tetoDoDegrau: 2 }, { sequence: [0, 0, 0.01, 0] });
  noApp('acessório não sorteia degrau', { category: 'acessorio', floor: 100 }, { sequence: [0, 0, 0.01, 0] });
  noApp('consumível não sorteia degrau', { category: 'consumivel', floor: 100 }, { sequence: [0, 0, 0.01, 0] });
  noApp('raridade forçada também sorteia o degrau', { category: 'armadura', rarity: 'epico', floor: 70 }, { sequence: [0.5, 0.05, 0] });
  caso('randomItem: app false é o site', 'randomItem', { options: { category: 'arma', floor: 100, now: AGORA, app: false } }, (a, { rng, now }) =>
    E.randomItem({ ...a.options, rng, now } as never),
  { rng: { sequence: [0, 0, 0.01, 0] }, now: AGORA });
}

// ---------- as runas (só do app) ----------

constante('RUNAS', E.RUNAS);
{
  const runa = (tipo: RunaId, tier: number): Item => E.criarRuna(tipo, tier, { rng: E.seededRng(1), now: relogio });
  const armaDe = (id: string, raridade = 'comum', degrau = 1): Item => E.instantiate(E.templateById(id)!, E.rarityById(raridade)!, { rng: E.seededRng(2), now: relogio, degrau });
  const com = (peca: Item, runas: RunaNaArma[]): Item => ({ ...peca, runas });
  const r = (tipo: RunaId, tier: number): RunaNaArma => ({ runa: tipo, tier });

  for (const tipo of E.TIPOS_DE_RUNA) {
    for (const tier of [1, 2, 3, 0, 5, 2.5]) {
      caso(`criarRuna: ${tipo}, tier ${tier}`, 'criarRuna', { runa: tipo, tier, options: { now: AGORA } }, (a, { rng, now }) => E.criarRuna(a.runa as RunaId, a.tier, { rng, now }), {
        rng: { seed: 3 },
        now: AGORA,
      });
    }
  }
  for (const andar of [1, 29, 30, 59, 60, 100, 0]) caso(`tierMaximoNoAndar: ${andar}`, 'tierMaximoNoAndar', { andar }, (a) => E.tierMaximoNoAndar(a.andar));
  for (const [andar, chefe, sorteios] of [
    [10, false, [0, 0.99, 0]],
    [10, true, [0.3, 0, 0]],
    [45, false, [0.6, 0.6, 0]],
    [90, false, [0.99, 0.99, 0]],
    [90, true, [0.5, 0.99, 0]],
    [70, true, [0.26, 0.1, 0.5]],
  ] as const) {
    caso(`sortearRuna: andar ${andar}${chefe ? ', chefe' : ''}, sorteios ${sorteios.join(' ')}`, 'sortearRuna', { andar, chefe, options: { now: AGORA } }, (a, { rng, now }) =>
      E.sortearRuna(a.andar, a.chefe, rng, now),
    { rng: { sequence: [...sorteios] }, now: AGORA });
  }
  for (const [nome, peca] of [
    ['runa de fogo II', runa('fogo', 2)],
    ['runa elétrica III', runa('eletrica', 3)],
    ['runa de gelo I', runa('gelo', 1)],
    ['runa vampírica sem tier', { ...runa('vampirica', 3), tierDaRuna: undefined }],
    ['runa com tier fora (7)', { ...runa('gelo', 1), tierDaRuna: 7 }],
  ] as const) {
    caso(`displayName: ${nome}`, 'displayName', { item: peca }, (a) => E.displayName(a.item));
    caso(`itemView: ${nome}`, 'itemView', { item: peca }, (a) => E.itemView(a.item));
  }
  for (const [nome, peca] of [
    ['espada comum', armaDe('espada')],
    ['espada mítica', armaDe('espada', 'mitico')],
    ['espada lendária', armaDe('espada', 'lendario')],
    ['arco de madeira élfica', armaDe('arco', 'comum', 3)],
    ['marreta mítica de aço mágico', armaDe('marreta', 'mitico', 3)],
    ['espada reforjada até o tier A', { ...armaDe('espada', 'raro'), tierAdjustment: 20 }],
    ['peitoral mítico de aço mágico', armaDe('placas', 'mitico', 3)],
    ['runa', runa('fogo', 1)],
  ] as const) {
    caso(`espacosDeRuna: ${nome}`, 'espacosDeRuna', { item: peca }, (a) => E.espacosDeRuna(a.item));
  }
  const espada = armaDe('espada');
  const quatro = armaDe('marreta', 'mitico', 3);
  for (const [nome, arma, pedra, indice] of [
    ['espaço livre', espada, runa('fogo', 2), undefined],
    ['cheia, sem dizer qual', com(espada, [r('gelo', 1)]), runa('fogo', 2), undefined],
    ['cheia, troca a do espaço 0', com(espada, [r('gelo', 1)]), runa('fogo', 2), 0],
    ['cheia, espaço que não existe', com(espada, [r('gelo', 1)]), runa('fogo', 2), 3],
    ['cheia, espaço quebrado', com(espada, [r('gelo', 1)]), runa('fogo', 2), 0.5],
    ['a mesma runa de novo, na arma de quatro espaços', com(quatro, [r('fogo', 3)]), runa('fogo', 3), undefined],
    ['não é arma', armaDe('placas'), runa('fogo', 1), undefined],
    ['não é runa', espada, armaDe('adaga'), undefined],
    ['arma com mais runas que espaços', com(espada, [r('gelo', 1), r('fogo', 1)]), runa('eletrica', 1), 1],
  ] as const) {
    caso(`engastar: ${nome}`, 'engastar', { arma, runa: pedra, indice }, (a) => E.engastar(a.arma, a.runa, a.indice));
  }
  for (const [nome, arma, indice, sorteio] of [
    ['tier I quebra com 0,39', com(espada, [r('fogo', 1)]), 0, 0.39],
    ['tier I volta com 0,4', com(espada, [r('fogo', 1)]), 0, 0.4],
    ['tier II quebra com 0,24', com(espada, [r('gelo', 2)]), 0, 0.24],
    ['tier II volta com 0,25', com(espada, [r('gelo', 2)]), 0, 0.25],
    ['tier III quebra com 0,09', com(espada, [r('eletrica', 3)]), 0, 0.09],
    ['tier III volta com 0,1', com(espada, [r('eletrica', 3)]), 0, 0.1],
    ['tira a do meio', com(quatro, [r('fogo', 1), r('gelo', 2), r('eletrica', 3)]), 1, 0.9],
    ['espaço vazio', espada, 0, 0.5],
    ['índice quebrado', com(espada, [r('fogo', 1)]), 0.5, 0.5],
  ] as const) {
    caso(`tirar: ${nome}`, 'tirar', { arma, indice, options: { now: AGORA } }, (a, { rng, now }) => E.tirar(a.arma, a.indice, rng, now), {
      rng: { sequence: [sorteio, 0.3] },
      now: AGORA,
    });
  }
  for (const [nome, arma] of [
    ['cabe tudo', com(quatro, [r('fogo', 1)])],
    ['sobram duas', com(espada, [r('fogo', 1), r('gelo', 2), r('eletrica', 3)])],
    ['sem runas', espada],
    ['quem não é arma devolve tudo', com(armaDe('placas'), [r('fogo', 1)])],
  ] as const) {
    caso(`aposMudarDeTier: ${nome}`, 'aposMudarDeTier', { arma, options: { now: AGORA } }, (a, { rng, now }) => E.aposMudarDeTier(a.arma, rng, now), {
      rng: { seed: 4 },
      now: AGORA,
    });
  }
  for (const [nome, runas] of [
    ['uma de cada', [r('eletrica', 1), r('fogo', 2), r('gelo', 3), r('vampirica', 1)]],
    ['duas de fogo somam', [r('fogo', 1), r('fogo', 3)]],
    ['quatro elétricas no teto', [r('eletrica', 3), r('eletrica', 3), r('eletrica', 3), r('eletrica', 3)]],
    ['tier fora da régua', [r('gelo', 9), r('gelo', 0)]],
    ['sem runas', []],
  ] as const) {
    caso(`efeitosDaArma: ${nome}`, 'efeitosDaArma', { arma: com(espada, [...runas]) }, (a) => E.efeitosDaArma(a.arma));
  }
  caso('efeitosDaArma: sem arma', 'efeitosDaArma', { arma: null }, (a) => E.efeitosDaArma(a.arma));
  const heroiCom = (runas: RunaNaArma[]): Hero => {
    const h = heroi({ classe: 'guerreiro', extra: { hp: 50 } });
    return { ...h, equip: { ...h.equip, arma: { ...com(espada, runas), equipped: true } } };
  };
  const quaseCheio = heroiCom([r('vampirica', 3)]);
  for (const [nome, hero, dano, alvo, sorteios] of [
    ['todas disparam', heroiCom([r('eletrica', 2), r('fogo', 2), r('gelo', 2), r('vampirica', 2)]), 20, monstro(), [0, 0, 0, 0]],
    ['nenhuma dispara', heroiCom([r('eletrica', 1), r('fogo', 1), r('gelo', 1), r('vampirica', 1)]), 20, monstro(), [0.99, 0.99, 0.99, 0.99]],
    ['o choque derruba', heroiCom([r('eletrica', 3), r('eletrica', 3)]), 200, monstro({ hp: 30 }), [0]],
    ['o choque soma ao atordoado que já havia', heroiCom([r('eletrica', 1)]), 10, monstro({ status: { atordoado: 2 } }), [0]],
    ['a cura para na vida cheia', { ...quaseCheio, hp: quaseCheio.maxHp - 2 }, 40, monstro(), [0]],
    ['a cura com a vida cheia', { ...quaseCheio, hp: quaseCheio.maxHp }, 40, monstro(), [0]],
    ['queima mínima', heroiCom([r('fogo', 1)]), 3, monstro(), [0]],
    ['dano zero', heroiCom([r('eletrica', 1), r('vampirica', 1)]), 0, monstro(), [0, 0]],
    ['só a segunda dispara', heroiCom([r('fogo', 3), r('gelo', 3)]), 30, monstro(), [0.5, 0.1]],
  ] as const) {
    caso(`aplicarRunas: ${nome}`, 'aplicarRunas', { hero, monster: alvo, dano }, (a, { rng }) => E.aplicarRunas(a.hero, a.monster, a.dano, rng), {
      rng: { sequence: [...sorteios] },
    });
  }
}

// ---------- os encantamentos (só do app) ----------

constante('ENCANTAMENTOS', E.ENCANTAMENTOS);
{
  const peca = (id: string, raridade = 'comum'): Item => E.instantiate(E.templateById(id)!, E.rarityById(raridade)!, { rng: E.seededRng(2), now: relogio });
  const enc = (tipo: EncantamentoId, nivel: number): EncantamentoNaPeca => ({ tipo, nivel });
  const com = (p: Item, e: EncantamentoNaPeca): Item => ({ ...p, encantamento: e, equipped: true });

  for (const id of ['placas', 'escudo', 'placas_elmo', 'robe_calca', 'botas', 'espada', 'bota_vento', 'anel_som', 'pot_vida', 'minerio']) {
    caso(`podeEncantar: ${id}`, 'podeEncantar', { item: peca(id) }, (a) => E.podeEncantar(a.item));
  }
  for (const tipo of E.TIPOS_DE_ENCANTAMENTO) {
    for (const nivel of [1, 2, 3, 0, 7, 2.5]) {
      caso(`nomeDoEncantamento: ${tipo}, nível ${nivel}`, 'nomeDoEncantamento', { encantamento: enc(tipo, nivel) }, (a) => E.nomeDoEncantamento(a.encantamento));
      caso(`efeitoDoEncantamento: ${tipo}, nível ${nivel}`, 'efeitoDoEncantamento', { tipo, nivel }, (a) => E.efeitoDoEncantamento(a.tipo as EncantamentoId, a.nivel));
    }
  }
  for (const nivel of [1, 2, 3, 0, 4, 1.9]) caso(`custoDoEncantamento: ${nivel}`, 'custoDoEncantamento', { nivel }, (a) => E.custoDoEncantamento(a.nivel));
  for (const [nome, p, tipo, nivel] of [
    ['peitoral novo', peca('placas'), 'robustez', 2],
    ['troca a que havia', com(peca('placas'), enc('vigor', 1)), 'resistencia_magica', 3],
    ['nível fora da régua', peca('escudo'), 'vigor', 9],
    ['arma não recebe', peca('espada'), 'robustez', 1],
  ] as const) {
    caso(`encantarPeca: ${nome}`, 'encantarPeca', { peca: p, tipo, nivel }, (a) => E.encantarPeca(a.peca, a.tipo as EncantamentoId, a.nivel));
  }
  caso('encantamentoDaPeca: com', 'encantamentoDaPeca', { item: com(peca('placas'), enc('robustez', 1)) }, (a) => E.encantamentoDaPeca(a.item));
  caso('encantamentoDaPeca: sem', 'encantamentoDaPeca', { item: peca('placas') }, (a) => E.encantamentoDaPeca(a.item));

  const tres = (tipo: EncantamentoId): Partial<HeroEquipment> => ({
    armadura: com(peca('placas'), enc(tipo, 3)),
    elmo: com(peca('placas_elmo'), enc(tipo, 3)),
    calca: com(peca('placas_calca'), enc(tipo, 3)),
  });
  for (const [nome, equip] of [
    ['nada encantado', { armadura: peca('placas') }],
    [
      'uma de cada',
      {
        armadura: com(peca('placas'), enc('robustez', 1)),
        elmo: com(peca('placas_elmo'), enc('resistencia_magica', 2)),
        calca: com(peca('placas_calca'), enc('resistencia_veneno', 3)),
        botas: com(peca('botas'), enc('vigor', 2)),
      },
    ],
    ['robustez no teto', tres('robustez')],
    ['resistência mágica e o dreno no teto', { ...tres('resistencia_magica'), secundaria: com(peca('escudo'), enc('resistencia_magica', 2)) }],
    ['veneno no teto', tres('resistencia_veneno')],
    ['vigor no teto', tres('vigor')],
    ['vigor somado', { armadura: com(peca('placas'), enc('vigor', 1)), botas: com(peca('botas'), enc('vigor', 2)) }],
    ['encantamento numa arma não conta', { arma: com(peca('espada'), enc('robustez', 3)) }],
    ['nível fora da régua', { armadura: com(peca('placas'), enc('vigor', 9)) }],
  ] as const) {
    const hero = heroi({ equip: equip as Partial<HeroEquipment>, extra: { maxHp: 157 } });
    caso(`defesasDoHeroi: ${nome}`, 'defesasDoHeroi', { hero }, (a) => E.defesasDoHeroi(a.hero));
    caso(`escudoDoVigor: ${nome}`, 'escudoDoVigor', { hero }, (a) => E.escudoDoVigor(a.hero));
  }
}

const ITENS_DE_NOME: Array<[string, Item]> = [
  ['espada comum', item('espada')],
  ['espada lendária', item('espada', 'lendario')],
  ['botas raras (feminino plural)', item('botas', 'raro')],
  ['poção de mana incomum', item('pot_mana', 'incomum')],
  ['pergaminho épico', item('pergaminho', 'epico')],
  ['arco mítico', item('arco', 'mitico')],
  ['espada de aço rara', { ...item('espada', 'raro'), degrau: 2 }],
  ['botas de couro de dragão raras', { ...item('botas', 'raro'), degrau: 3 }],
  ['escudo de ébano', { ...item('escudo'), degrau: 2 }],
  ['robe de seda arcana mítico', { ...item('robe', 'mitico'), degrau: 3 }],
  ['anel com degrau (acessório não tem material)', { ...item('anel_som', 'epico'), degrau: 3 }],
];
for (const [nome, it] of ITENS_DE_NOME) {
  caso(`displayName: ${nome}`, 'displayName', { item: it }, (a) => E.displayName(a.item));
  caso(`itemView: ${nome}`, 'itemView', { item: it }, (a) => E.itemView(a.item));
  caso(`itemCategory: ${nome}`, 'itemCategory', { item: it }, (a) => E.itemCategory(a.item));
  caso(`concordar: ${nome}`, 'concordar', { item: it, formas: ['escondido', 'escondida', 'escondidos', 'escondidas'] }, (a) => E.concordar(a.item, a.formas as never));
}

// Os acessórios únicos das masmorras (items/acessorios-unicos.ts): a versão vai no nome, o efeito na descrição.
for (const masmorra of E.DUNGEONS) {
  for (const dificuldade of E.DIFFICULTIES) {
    const run = { dungeon: masmorra.id, difficulty: dificuldade.id };
    caso(`acessorioUnico: ${E.runKey(run)}`, 'acessorioUnico', { run }, (a, ctx) => E.acessorioUnico(a.run, ctx.rng, ctx.now), { rng: { seed: 7 }, now: AGORA });
    const peca = E.acessorioUnico(run, E.seededRng(7), () => AGORA);
    caso(`displayName: o único de ${E.runKey(run)}`, 'displayName', { item: peca }, (a) => E.displayName(a.item));
    caso(`itemView: o único de ${E.runKey(run)}`, 'itemView', { item: peca }, (a) => E.itemView(a.item));
    const comEle = { ...heroi(), equip: { ...heroi().equip, acessorio: { ...peca, equipped: true } } };
    caso(`efeitoDoUnico: ${E.runKey(run)}`, 'efeitoDoUnico', { hero: comEle }, (a) => E.efeitoDoUnico(a.hero));
    caso(`descontoDeMana: ${E.runKey(run)}`, 'descontoDeMana', { hero: comEle }, (a) => E.descontoDeMana(a.hero));
  }
}
caso('efeitoDoUnico: sem acessório', 'efeitoDoUnico', { hero: heroi() }, (a) => E.efeitoDoUnico(a.hero));
caso('efeitoDoUnico: acessório comum', 'efeitoDoUnico', { hero: { ...heroi(), equip: { ...heroi().equip, acessorio: item('anel_som', 'raro') } } }, (a) => E.efeitoDoUnico(a.hero));
// O sorteio por categoria nunca dá o único: as mesmas sementes, a mesma peça de antes.
for (const semente of [1, 2, 3, 4, 5, 6, 7, 8]) {
  caso(`randomItem: acessório, semente ${semente} (sem os únicos)`, 'randomItem', { options: { category: 'acessorio', floor: 30, now: AGORA } }, (a, { rng, now }) => E.randomItem({ ...a.options, rng, now } as never), { rng: { seed: semente }, now: AGORA });
}
caso('itemTemplate: template que sumiu lança', 'itemTemplate', { item: { templateId: 'nada' } }, (a) => E.itemTemplate(a.item));
caso('statTags: sinal, polaridade e stat zerado', 'statTags', { item: { stats: { ataque: 5, defesa: -2, vida: 0, critico: 3, curaMana: 10 } } }, (a) => E.statTags(a.item));

// --- tiers ---

const ITENS_DE_TIER: Array<[string, Item]> = [];
for (const id of ['espada', 'adaga', 'cajado', 'placas', 'robe', 'botas', 'colar_forca', 'escudo']) {
  for (const raridade of ['comum', 'raro', 'mitico']) ITENS_DE_TIER.push([`${id} ${raridade}`, item(id, raridade)]);
}
ITENS_DE_TIER.push(['espada comum com tierAdjustment +30', { ...item('espada'), tierAdjustment: 30 }]);
ITENS_DE_TIER.push(['espada comum com tierAdjustment −100', { ...item('espada'), tierAdjustment: -100 }]);
ITENS_DE_TIER.push(['poção (sem tier)', item('pot_vida', 'mitico')]);
ITENS_DE_TIER.push(['material (sem tier)', item('minerio')]);
for (const [nome, it] of ITENS_DE_TIER) {
  caso(`powerScore: ${nome}`, 'powerScore', { item: it }, (a) => E.powerScore(a.item));
  caso(`tierFor: ${nome}`, 'tierFor', { item: it }, (a) => E.tierFor(a.item));
  caso(`tierRank: ${nome}`, 'tierRank', { item: it }, (a) => E.tierRank(a.item));
  if (E.isEquippable(E.itemCategory(it))) caso(`tierInfo: ${nome}`, 'tierInfo', { item: it }, (a) => E.tierInfo(a.item));
}
for (const score of [-5, 0, 24, 25, 39, 40, 59, 60, 84, 85, 114, 115, 144, 145, 174, 175, 209, 210, 249, 250, 300, 1000, Number.NaN]) {
  caso(`tierFromScore: ${score}`, 'tierFromScore', { score }, (a) => E.tierFromScore(a.score));
}
for (const tier of ['E', 'SSS+', 'MAX', 'XYZ']) caso(`tierRank: tier "${tier}"`, 'tierRank', { item: tier }, (a) => E.tierRank(a.item as never));
for (const tier of ['E', 'SSS+', 'MAX', null]) caso(`tierClass: ${tier}`, 'tierClass', { tier }, (a) => E.tierClass(a.tier as never));
caso('tierInfo: item no MAX tem progresso 100', 'tierInfo', { item: { ...item('espada', 'mitico'), tierAdjustment: 400 } }, (a) => E.tierInfo(a.item));

for (const [nome, it] of [
  ['espada comum', item('espada')],
  ['placas raras', item('placas', 'raro')],
  ['cajado épico já reforjado', { ...item('cajado', 'epico'), reforgeCount: 2, reforgeFails: 1 }],
] as const) {
  for (const delta of [-3, -1, 0, 1, 2, 3]) {
    caso(`reforge: ${nome}, delta ${delta}`, 'reforge', { item: it, delta }, (a) => E.reforge(a.item, a.delta));
  }
}
caso('reforge: no MAX, +1 não sai do lugar', 'reforge', { item: { ...item('espada', 'mitico'), tierAdjustment: 400 }, delta: 1 }, (a) => E.reforge(a.item, a.delta));
caso('reforge: no E, −1 não sai do lugar', 'reforge', { item: { ...item('espada'), tierAdjustment: -100 }, delta: -1 }, (a) => E.reforge(a.item, a.delta));

// =====================================================================
// monsters — species e generate
// =====================================================================

modulo('monsters');

constante('BEHAVIORS', E.BEHAVIORS);
constante('AFFINITY_TYPES', E.AFFINITY_TYPES);
constante('SPECIES', E.SPECIES);
constante('ENEMY_CLASSES', E.ENEMY_CLASSES);
constante('TIER_ADJECTIVES', E.TIER_ADJECTIVES);
constante('BOSS_TITLES', E.BOSS_TITLES);

for (const id of ['zumbi', 'nada']) caso(`speciesById: ${id}`, 'speciesById', { id }, (a) => E.speciesById(a.id));
for (const id of ['xama', 'nada']) caso(`enemyClassById: ${id}`, 'enemyClassById', { id }, (a) => E.enemyClassById(a.id));
for (const floor of [-1, 0, 1, 3, 4, 7, 8, 12, 13, 18, 19, 99, 100]) caso(`tierLabelFor: andar ${floor}`, 'tierLabelFor', { floor }, (a) => E.tierLabelFor(a.floor));

for (const floor of [1, 2, 3, 4, 5, 8, 13, 19, 20, 50, 100]) {
  for (const seed of [1, 2, 3]) {
    caso(`generate: andar ${floor}, seed ${seed}`, 'generate', { floor }, (a, { rng }) => E.generate(a.floor, { rng }), { rng: { seed } });
  }
}
for (const [nome, species] of [
  ['só morcego e zumbi', ['morcego', 'zumbi']],
  ['lista vazia vale todas', []],
  ['só id desconhecido vale todas', ['dragao_de_papel']],
  ['a Torre', E.dungeonById('torre')!.species],
] as const) {
  for (const seed of [4, 5]) {
    caso(`generate: ${nome}, seed ${seed}`, 'generate', { floor: 5, options: { species } }, (a, { rng }) => E.generate(a.floor, { ...a.options, rng }), { rng: { seed } });
  }
}
for (const floor of [5, 10, 15, 20, 25, 100]) {
  for (const seed of [1, 2]) {
    caso(`generateBoss: andar ${floor}, seed ${seed}`, 'generateBoss', { floor }, (a, { rng }) => E.generateBoss(a.floor, { rng }), { rng: { seed } });
  }
}
caso('generateBoss: quem chama decide o chefe principal (24, main true)', 'generateBoss', { floor: 24, options: { main: true } }, (a, { rng }) =>
  E.generateBoss(a.floor, { ...a.options, rng }),
{ rng: { seed: 1 } });
caso('generateBoss: andar 20 com main false', 'generateBoss', { floor: 20, options: { main: false } }, (a, { rng }) => E.generateBoss(a.floor, { ...a.options, rng }), {
  rng: { seed: 1 },
});
caso('generateBoss: só orc', 'generateBoss', { floor: 5, options: { species: ['orc'] } }, (a, { rng }) => E.generateBoss(a.floor, { ...a.options, rng }), { rng: { seed: 6 } });
for (const floor of [1, 3, 7, 8, 20]) {
  caso(`generateMimic: andar ${floor}`, 'generateMimic', { floor }, (a, { rng }) => E.generateMimic(a.floor, { rng }), { rng: { seed: floor + 10 } });
}

{
  const comum = E.generate(1, { rng: E.seededRng(1) });
  const fundo = E.generate(10, { rng: E.seededRng(2) });
  const lendario = E.generate(40, { rng: E.seededRng(3) });
  const chefe = E.generateBoss(10, { rng: E.seededRng(5) });
  const mini = E.generateBoss(5, { rng: E.seededRng(2) });
  const mimico = E.generateMimic(8, { rng: E.seededRng(1) });
  for (const [nome, monster] of [
    ['comum do andar 1', comum],
    ['andar 10 (Ancestral)', fundo],
    ['andar 40 (sem adjetivo acima do 99, mas Lendário aqui)', lendario],
    ['chefe principal', chefe],
    ['mini-chefe', mini],
    ['mímico (override)', mimico],
  ] as const) {
    caso(`monsterView: ${nome}`, 'monsterView', { monster }, (a) => E.monsterView(a.monster));
  }
  caso('monsterView: espécie que sumiu lança', 'monsterView', { monster: { ...comum, speciesId: 'nada' } }, (a) => E.monsterView(a.monster));
}

// O chefe final (jogo/chefe-final.ts): um chefe principal 30% mais forte, sorteado igual.
{
  const DA_FLORESTA = ['goblin', 'lobo_sombras', 'aranha', 'slime'];
  caso('generateBoss: o chefe final', 'generateBoss', { floor: 100, options: { species: DA_FLORESTA, main: true, final: true } }, (a, { rng }) =>
    E.generateBoss(a.floor, { ...a.options, rng }), { rng: { seed: 9 } });
  caso('generateBoss: o chefe final da Torre no Pesadelo', 'generateBoss', { floor: 331, options: { main: true, final: true } }, (a, { rng }) =>
    E.generateBoss(a.floor, { ...a.options, rng }), { rng: { seed: 10 } });
}

// =====================================================================
// combat
// =====================================================================

modulo('combat');

constante('LADOS_DO_DANO', E.LADOS_DO_DANO);
constante('FAIXA_CRITICA', E.FAIXA_CRITICA);
constante('FORCA_NA_BORDA', E.FORCA_NA_BORDA);
constante('FORCA_NO_CENTRO', E.FORCA_NO_CENTRO);
constante('FLEE_TARGET', E.FLEE_TARGET);
constante('ESQUIVA_TARGET', E.ESQUIVA_TARGET);

// --- monster-state ---

caso('freshCombatMonster', 'freshCombatMonster', { monster: E.generate(3, { rng: E.seededRng(1) }) }, (a) => E.freshCombatMonster(a.monster));
caso('setStatusField: acrescenta', 'setStatusField', { status: { atordoado: 1 }, key: 'veneno', value: { turns: 3, dmg: 4 } }, (a) =>
  E.setStatusField(a.status, a.key as 'veneno', a.value),
);
caso('setStatusField: troca', 'setStatusField', { status: { veneno: { turns: 1, dmg: 2 } }, key: 'veneno', value: { turns: 3, dmg: 4 } }, (a) =>
  E.setStatusField(a.status, a.key as 'veneno', a.value),
);
caso('setStatusField: value ausente remove a chave', 'setStatusField', { status: { veneno: { turns: 1, dmg: 2 }, atordoado: 1 }, key: 'veneno' }, (a) =>
  E.setStatusField(a.status, a.key as 'veneno', undefined),
);
caso('setStatusField: status ausente', 'setStatusField', { key: 'atordoado', value: 2 }, (a) => E.setStatusField(undefined, a.key as 'atordoado', a.value));
caso('decrementField: 2 turnos viram 1', 'decrementField', { status: { turns: 2, dmg: 3 } }, (a) => E.decrementField(a.status));
caso('decrementField: o último turno acaba com o status', 'decrementField', { status: { turns: 1, amount: 0.2 } }, (a) => E.decrementField(a.status));
caso('decrementField: ausente', 'decrementField', {}, () => E.decrementField(undefined));

// --- damage ---

for (const [nome, destreza, speed, debuff] of [
  ['velocidade igual', 10, 10, 'orgulhoso'],
  ['monstro mais rápido', 7, 10, 'orgulhoso'],
  ['vantagem de 1', 11, 10, 'orgulhoso'],
  ['vantagem de 4', 14, 10, 'orgulhoso'],
  ['vantagem de 5', 15, 10, 'orgulhoso'],
  ['vantagem de 9', 19, 10, 'orgulhoso'],
  ['Teimoso tira 2', 15, 10, 'teimoso'],
  ['Teimoso pode deixar negativo', 10, 10, 'teimoso'],
] as const) {
  caso(`fleeBonus: ${nome}`, 'fleeBonus', { hero: heroi({ attrs: { destreza }, debuff }), monster: { speed } }, (a) => E.fleeBonus(a.hero, a.monster));
}
caso('fleeBonus: save antigo com Teimoso só pelo nome', 'fleeBonus', { hero: heroi({ attrs: { destreza: 15 }, extra: { debuff: { id: '', name: 'Teimoso', icon: '', desc: '', attr: 'sabedoria' } } }), monster: { speed: 10 } }, (a) =>
  E.fleeBonus(a.hero, a.monster),
);

for (const affinityPct of [100, 55, 30, 25, 0, 150]) {
  caso(`weaponAtkContribution: espada a ${affinityPct}%`, 'weaponAtkContribution', { hero: { equip: { arma: item('espada') } }, affinityPct }, (a) =>
    E.weaponAtkContribution(a.hero, a.affinityPct),
  );
}
for (const ataque of [5, 3, 1, 7]) {
  caso(`weaponAtkContribution: ataque ${ataque} a 50% — meio exato arredonda pra cima`, 'weaponAtkContribution', { hero: { equip: { arma: { ...item('espada'), stats: { ataque } } } }, affinityPct: 50 }, (a) =>
    E.weaponAtkContribution(a.hero, a.affinityPct),
  );
}
caso('weaponAtkContribution: sem arma', 'weaponAtkContribution', { hero: { equip: {} }, affinityPct: 100 }, (a) => E.weaponAtkContribution(a.hero, a.affinityPct));

for (const [nome, hero] of [
  ['guerreiro com adaga na secundária (55%)', heroi({ classe: 'guerreiro', equip: { secundaria: item('adaga', 'raro') } })],
  ['ladino com adaga na secundária (100%)', heroi({ classe: 'ladino', equip: { secundaria: item('adaga', 'raro') } })],
  ['armadura e acessório entram cheios', heroi({ classe: 'mago', equip: { armadura: { ...item('placas'), stats: { ataque: 3, defesa: 6 } }, acessorio: item('colar_forca', 'epico') } })],
  ['Aprendiz com espada na secundária (sem afinidade, 100%)', heroi({ classe: null, equip: { secundaria: item('espada') } })],
  ['nada que dê ataque', heroi({ classe: 'guerreiro', equip: { secundaria: item('escudo') } })],
] as const) {
  caso(`otherEquipAtk: ${nome}`, 'otherEquipAtk', { hero }, (a) => E.otherEquipAtk(a.hero));
}

{
  const alvo = E.freshCombatMonster(E.generate(5, { rng: E.seededRng(1) }));
  const md = (nome: string, monster: CombatMonster, weakness: string, resistance: string, dmg: number, type: string, halfResist: boolean) =>
    caso(`modifyDamageByAffinity: ${nome}`, 'modifyDamageByAffinity', { monster, weakness, resistance, dmg, type, halfResist }, (a) =>
      E.modifyDamageByAffinity(a.monster, a.weakness as never, a.resistance as never, a.dmg, a.type as never, a.halfResist),
    );
  md('neutro', alvo, 'nenhuma', 'nenhuma', 10, 'fisico', false);
  md('fraqueza +25%', alvo, 'fisico', 'nenhuma', 10, 'fisico', false);
  md('fraqueza em 2 dá 2,5 → 3', alvo, 'magico', 'nenhuma', 2, 'magico', false);
  md('fraqueza em 13', alvo, 'magico', 'nenhuma', 13, 'magico', false);
  md('resistência −20%', alvo, 'nenhuma', 'fisico', 13, 'fisico', false);
  md('resistência pela metade (mago) em 5 dá 4,5 → 5', alvo, 'nenhuma', 'magico', 5, 'magico', true);
  md('fraqueza e resistência ao mesmo tipo', alvo, 'fisico', 'fisico', 10, 'fisico', false);
  md('tipo diferente não pega', alvo, 'magico', 'fisico', 10, 'nenhuma', false);
  md('vulnerável soma e gasta um turno', { ...alvo, status: { vulneravel: { turns: 2, amount: 0.2 } } }, 'nenhuma', 'nenhuma', 10, 'fisico', false);
  md('vulnerável no último turno sai do status', { ...alvo, status: { vulneravel: { turns: 1, amount: 0.15 } } }, 'nenhuma', 'nenhuma', 10, 'fisico', false);
  md('vulnerável sem amount vale 0,2', { ...alvo, status: { vulneravel: { turns: 2 } as never } }, 'nenhuma', 'nenhuma', 10, 'fisico', false);
  md('vulnerável com amount 0 vale 0,2 (o `||` do original)', { ...alvo, status: { vulneravel: { turns: 2, amount: 0 } } }, 'nenhuma', 'nenhuma', 10, 'fisico', false);
  md('Muralha Sombria reduz 35% e gasta um guardHits', { ...alvo, guardHits: 2 }, 'nenhuma', 'nenhuma', 10, 'fisico', false);
  md('Muralha em dano 1 continua 1', { ...alvo, guardHits: 1 }, 'nenhuma', 'nenhuma', 1, 'fisico', false);
  md('tudo junto', { ...alvo, guardHits: 1, status: { vulneravel: { turns: 3, amount: 0.2 }, atordoado: 1 } }, 'fisico', 'nenhuma', 17, 'fisico', false);
  md('dano 0 sai 1', alvo, 'nenhuma', 'nenhuma', 0, 'fisico', false);
}

// --- status-effects ---

{
  const base = E.freshCombatMonster(E.generate(5, { rng: E.seededRng(1) }));
  const tick = (nome: string, monster: CombatMonster) => caso(`tickMonsterDot: ${nome}`, 'tickMonsterDot', { monster }, (a) => E.tickMonsterDot(a.monster));
  tick('queimadura, sangramento e veneno no mesmo turno', { ...base, status: { queimadura: { turns: 3, dmg: 4 }, sangramento: { turns: 1, dmg: 3 }, veneno: { turns: 2, dmg: 2 } } });
  tick('sem dano contínuo', { ...base, status: { atordoado: 1, lento: { turns: 2, amount: 0.2 } } });
  tick('o dano contínuo derruba', { ...base, hp: 5, status: { veneno: { turns: 2, dmg: 5 } } });
  tick('sem campo status', (({ status: _s, ...resto }) => resto)(base));
  tick('turns 0 não dispara', { ...base, status: { queimadura: { turns: 0, dmg: 9 } } });

  const monstroComStatus = { ...base, status: { atordoado: 1, veneno: { turns: 1, dmg: 2 } } };
  for (const derived of [
    { dmgFisico: 20, dmgMagico: 30 },
    { dmgFisico: 40, dmgMagico: 9 },
    { dmgFisico: 2, dmgMagico: 3 },
  ]) {
    for (const power of E.POWERS.filter((p) => p.status)) {
      caso(`applyPowerStatus: ${power.id}, físico ${derived.dmgFisico} / mágico ${derived.dmgMagico}`, 'applyPowerStatus', { power, monster: monstroComStatus, derived }, (a) =>
        E.applyPowerStatus(a.power, a.monster, a.derived),
      );
    }
  }
  caso('applyPowerStatus: poder sem status devolve o monstro', 'applyPowerStatus', { power: E.powerById('golpe_poderoso'), monster: monstroComStatus, derived: { dmgFisico: 20, dmgMagico: 30 } }, (a) =>
    E.applyPowerStatus(a.power!, a.monster, a.derived),
  );
  for (const power of [{ status: 'veneno' }, { status: 'lento' }, { status: 'atordoado' }] as const) {
    caso(`applyPowerStatus: ${power.status} sem turns, dotRatio nem amount usa os padrões`, 'applyPowerStatus', { power, monster: base, derived: { dmgFisico: 20, dmgMagico: 30 } }, (a) =>
      E.applyPowerStatus(a.power, a.monster, a.derived),
    );
  }
}

// --- weapon-proc ---

for (const armaId of ['espada', 'machado', 'adaga', 'cajado', 'maca', 'marreta', 'violao', 'arco']) {
  const hero = heroi({ classe: 'guerreiro', arma: armaId, attrs: { forca: 17, sabedoria: 13 }, extra: { hp: 60, mp: 40 } });
  const monster = E.freshCombatMonster(E.generate(5, { rng: E.seededRng(2) }));
  caso(`applyWeaponProc: ${armaId}, rolo favorável`, 'applyWeaponProc', { hero, monster }, (a, { rng }) => E.applyWeaponProc(a.hero, a.monster, rng), { rng: { sequence: [0] } });
  caso(`applyWeaponProc: ${armaId}, rolo contra`, 'applyWeaponProc', { hero, monster }, (a, { rng }) => E.applyWeaponProc(a.hero, a.monster, rng), { rng: { sequence: [0.99] } });
}
caso('applyWeaponProc: mana grátis não passa do máximo', 'applyWeaponProc', { hero: heroi({ classe: 'mago' }), monster: monstro() }, (a, { rng }) => E.applyWeaponProc(a.hero, a.monster, rng), {
  rng: { sequence: [0] },
});
caso('applyWeaponProc: cura no acerto não passa do máximo', 'applyWeaponProc', { hero: heroi({ classe: 'clerigo' }), monster: monstro() }, (a, { rng }) => E.applyWeaponProc(a.hero, a.monster, rng), {
  rng: { sequence: [0] },
});
caso('applyWeaponProc: atordoar acumula', 'applyWeaponProc', { hero: heroi({ classe: 'barbaro' }), monster: monstro({ status: { atordoado: 2 } }) }, (a, { rng }) =>
  E.applyWeaponProc(a.hero, a.monster, rng),
{ rng: { sequence: [0] } });
caso('applyWeaponProc: mão vazia, sem sortear', 'applyWeaponProc', { hero: heroi({ arma: null }), monster: monstro() }, (a, { rng }) => E.applyWeaponProc(a.hero, a.monster, rng), {
  rng: { sequence: [0] },
});

// --- hero-status ---

for (const [nome, buffs, hp] of [
  ['sem veneno', {}, 50],
  ['poisonTurns 0', { poisonTurns: 0, poisonDmg: 5 }, 50],
  ['veneno de 4 por 3 turnos', { poisonTurns: 3, poisonDmg: 4 }, 50],
  ['sem poisonDmg vale 2', { poisonTurns: 1 }, 50],
  ['o veneno derruba', { poisonTurns: 2, poisonDmg: 6 }, 5],
] as const) {
  caso(`tickHeroStatus: ${nome}`, 'tickHeroStatus', { hero: heroi({ extra: { buffs, hp } }) }, (a) => E.tickHeroStatus(a.hero));
}

// --- class-passives ---

{
  const alvo = monstro({ status: { atordoado: 1 } });
  for (const cls of E.CLASSES) {
    for (const dmg of [5, 13]) {
      for (const [rolo, valor] of [
        ['favorável', 0],
        ['contra', 0.99],
      ] as const) {
        caso(`applyHeroClassPassive: ${cls.id}, dano ${dmg}, rolo ${rolo}`, 'applyHeroClassPassive', { hero: heroi({ classe: cls.id, extra: { hp: 40 } }), monster: alvo, dmg }, (a, { rng }) =>
          E.applyHeroClassPassive(a.hero, a.monster, a.dmg, rng),
        { rng: { sequence: [valor] } });
      }
    }
  }
  caso('applyHeroClassPassive: Aprendiz nunca sorteia', 'applyHeroClassPassive', { hero: heroi({ classe: null }), monster: alvo, dmg: 10 }, (a, { rng }) =>
    E.applyHeroClassPassive(a.hero, a.monster, a.dmg, rng),
  { rng: { sequence: [0] } });
  caso('applyHeroClassPassive: "Cacador" sem acento ainda dispara', 'applyHeroClassPassive', { hero: heroi({ classe: 'cacador', nomeDaClasse: 'Cacador' }), monster: alvo, dmg: 10 }, (a, { rng }) =>
    E.applyHeroClassPassive(a.hero, a.monster, a.dmg, rng),
  { rng: { sequence: [0] } });
  caso('applyHeroClassPassive: "Clerigo" sem acento NÃO dispara (compara o nome, não o id)', 'applyHeroClassPassive', { hero: heroi({ classe: 'clerigo', nomeDaClasse: 'Clerigo', extra: { hp: 40 } }), monster: alvo, dmg: 10 }, (a, { rng }) =>
    E.applyHeroClassPassive(a.hero, a.monster, a.dmg, rng),
  { rng: { sequence: [0] } });
  caso('applyHeroClassPassive: ladino com dano 1 tira 1', 'applyHeroClassPassive', { hero: heroi({ classe: 'ladino' }), monster: alvo, dmg: 1 }, (a, { rng }) =>
    E.applyHeroClassPassive(a.hero, a.monster, a.dmg, rng),
  { rng: { sequence: [0] } });
}

for (const enemyClassId of CLASSES_DE_INIMIGO) {
  for (const attackCount of [1, 3, 6]) {
    caso(`triggerEnemyClassPower: ${enemyClassId}, ataque ${attackCount}`, 'triggerEnemyClassPower', { monster: monstro({ enemyClassId, attackCount, hp: 60 }), hero: heroi({ extra: { mp: 30 } }) }, (a) =>
      E.triggerEnemyClassPower(a.monster, a.hero),
    );
  }
}
caso('triggerEnemyClassPower: attackCount 0 não dispara', 'triggerEnemyClassPower', { monster: monstro({ attackCount: 0 }), hero: heroi() }, (a) => E.triggerEnemyClassPower(a.monster, a.hero));
caso('triggerEnemyClassPower: Xamã não cura além do máximo', 'triggerEnemyClassPower', { monster: monstro({ enemyClassId: 'xama', attackCount: 3, hp: 99 }), hero: heroi() }, (a) =>
  E.triggerEnemyClassPower(a.monster, a.hero),
);
caso('triggerEnemyClassPower: Xamã de vida baixa cura no mínimo 4', 'triggerEnemyClassPower', { monster: monstro({ enemyClassId: 'xama', attackCount: 3, hp: 5, maxHp: 20 }), hero: heroi() }, (a) =>
  E.triggerEnemyClassPower(a.monster, a.hero),
);
caso('triggerEnemyClassPower: Feiticeiro drena no máximo a mana que há', 'triggerEnemyClassPower', { monster: monstro({ enemyClassId: 'feiticeiro', attackCount: 3, dmg: 20 }), hero: heroi({ extra: { mp: 2 } }) }, (a) =>
  E.triggerEnemyClassPower(a.monster, a.hero),
);

// --- party ---

{
  const inspirado = heroi({ classe: 'bardo', extra: { hp: 30, buffs: { inspiracaoTurns: 2, inspiracaoAmount: 0.25 } } });
  const pt = (nome: string, hero: Hero, party: Companion[], monster: CombatMonster, rng: RngSpec) =>
    caso(`applyPartyTurn: ${nome}`, 'applyPartyTurn', { hero, party, monster }, (a, ctx) => E.applyPartyTurn(a.hero, a.party, a.monster, ctx.rng), { rng });
  pt('sem equipe só desconta a canção', inspirado, [], monstro(), { sequence: [] });
  pt('suporte clérigo cura o herói', heroi({ extra: { hp: 20 } }), [companheiro('clerigo', { stance: 'suporte', attrs: atributos({ sabedoria: 14 }) })], monstro(), { sequence: [0.1] });
  pt('suporte que não cura ataca (×0,8)', heroi(), [companheiro('druida', { stance: 'suporte' })], monstro(), { sequence: [0.9, 0.1, 0.5, 0.99] });
  pt('errou', heroi(), [companheiro('guerreiro')], monstro(), { sequence: [0.95] });
  for (const classe of CLASSES_IDS) {
    pt(`${classe} acerta, passiva favorável`, heroi(), [companheiro(classe, { hp: 8, attack: 7 })], monstro({ hp: 200, maxHp: 200 }), { sequence: [0.1, 0.5, 0] });
    pt(`${classe} acerta, passiva contra`, heroi(), [companheiro(classe, { attack: 7 })], monstro({ hp: 200, maxHp: 200 }), { sequence: [0.1, 0.5, 0.99] });
  }
  pt('agressiva (×1,3) com a canção (×1,25)', inspirado, [companheiro('guerreiro', { stance: 'agressiva', attack: 9 })], monstro(), { sequence: [0.1, 0.99] });
  pt('defensiva (×0,8)', heroi(), [companheiro('guerreiro', { stance: 'defensiva', attack: 9 })], monstro(), { sequence: [0.1, 0.99] });
  pt('o monstro morre no primeiro e o segundo não age', heroi(), [companheiro('guerreiro', { attack: 12 }), companheiro('ladino')], monstro({ hp: 5 }), { sequence: [0.1, 0.99] });
  pt('companheiro morto não age', heroi(), [companheiro('guerreiro', { hp: 0 }), companheiro('mago')], monstro(), { sequence: [0.1, 0.4] });
  pt('sem attack vale 5', heroi(), [companheiro('guerreiro', { attack: 0 })], monstro(), { sequence: [0.1, 0] });
  for (let i = 1; i <= 15; i++) {
    const hero = heroiDeLote();
    pt(`lote ${i}`, hero, equipeDeLote(), monstroDeLote(), { seed: 1000 + i });
  }
  // A vez de um só companheiro, que a luta em tempo real chama. Sem lote aqui: o lote do gerador é uma
  // sequência só, e sortear a mais no meio mudaria todos os casos de lote que vêm depois.
  const pm = (nome: string, hero: Hero, member: Companion, monster: CombatMonster, rng: RngSpec) =>
    caso(`partyMemberAct: ${nome}`, 'partyMemberAct', { hero, member, monster }, (a, ctx) => E.partyMemberAct(a.hero, a.member, a.monster, ctx.rng), { rng });
  pm('suporte clérigo cura o herói', heroi({ extra: { hp: 20 } }), companheiro('clerigo', { stance: 'suporte', attrs: atributos({ sabedoria: 14 }) }), monstro(), { sequence: [0.1] });
  pm('suporte que não cura ataca', heroi(), companheiro('druida', { stance: 'suporte' }), monstro(), { sequence: [0.9, 0.1, 0.5, 0.99] });
  pm('errou', heroi(), companheiro('guerreiro'), monstro(), { sequence: [0.95] });
  for (const classe of CLASSES_IDS) {
    pm(`${classe}, passiva favorável`, heroi(), companheiro(classe, { hp: 8, attack: 7 }), monstro({ hp: 200, maxHp: 200 }), { sequence: [0.1, 0.5, 0] });
  }
  pm('com a canção do herói', inspirado, companheiro('guerreiro', { stance: 'agressiva', attack: 9 }), monstro(), { sequence: [0.1, 0.99] });
  pm('derruba o monstro', heroi(), companheiro('guerreiro', { attack: 12 }), monstro({ hp: 5 }), { sequence: [0.1, 0.99] });
  pm('paladino cura acima do máximo não passa', heroi(), companheiro('paladino', { attack: 30 }), monstro({ hp: 200, maxHp: 200 }), { sequence: [0.1, 0.5, 0] });
  for (const semente of [11, 12, 13, 14, 15]) pm(`semente ${semente}`, heroi({ classe: 'bardo' }), companheiro(CLASSES_IDS[semente % CLASSES_IDS.length]!), monstro(), { seed: semente });

  caso('passarRodadaDaCancao: desconta uma rodada', 'passarRodadaDaCancao', { hero: inspirado }, (a) => E.passarRodadaDaCancao(a.hero));
  caso('passarRodadaDaCancao: sem canção devolve igual', 'passarRodadaDaCancao', { hero: heroi() }, (a) => E.passarRodadaDaCancao(a.hero));
}

// --- resolve-attack ---

{
  const combinacoes: Array<[string, string | null, AttackStyle]> = [];
  for (const classe of [...CLASSES_IDS, null]) for (const estilo of ['normal', 'magic', 'physical', 'ranged'] as const) combinacoes.push([classe ?? 'aprendiz', classe, estilo]);
  for (const [nome, classe, estilo] of combinacoes) {
    caso(`ehAtaqueDaClasse: ${nome}, ${estilo}`, 'ehAtaqueDaClasse', { hero: heroi({ classe }), estilo }, (a) => E.ehAtaqueDaClasse(a.hero, a.estilo));
  }
  caso('ehAtaqueDaClasse: arqueiro sem arco não tem tiro', 'ehAtaqueDaClasse', { hero: heroi({ classe: 'arqueiro', arma: 'espada' }), estilo: 'ranged' }, (a) => E.ehAtaqueDaClasse(a.hero, a.estilo as AttackStyle));
  caso('ehAtaqueDaClasse: "Cacador" sem acento, pelo nome', 'ehAtaqueDaClasse', { hero: heroi({ classe: 'cacador', nomeDaClasse: 'Cacador' }), estilo: 'ranged' }, (a) =>
    E.ehAtaqueDaClasse(a.hero, a.estilo as AttackStyle),
  );

  const zona = (nome: string, hero: Hero, estilo: AttackStyle) => caso(`zonaDoAtaque: ${nome}`, 'zonaDoAtaque', { hero, estilo }, (a) => E.zonaDoAtaque(a.hero, a.estilo));
  zona('comum, metade da barra', heroi(), 'normal');
  zona('da classe, 2/3', heroi({ classe: 'guerreiro' }), 'normal');
  zona('Precisão 25 soma 5 fatias', heroi({ extra: { buffs: { precisaoTurns: 2, precisaoAmount: 25 } } }), 'normal');
  zona('Precisão 7 soma 1 fatia (floor)', heroi({ extra: { buffs: { precisaoTurns: 1, precisaoAmount: 7 } } }), 'normal');
  zona('Precisão 100 para nos 85%', heroi({ extra: { buffs: { precisaoTurns: 2, precisaoAmount: 100 } } }), 'normal');
  zona('Precisão com 0 turnos não vale', heroi({ extra: { buffs: { precisaoTurns: 0, precisaoAmount: 25 } } }), 'normal');
  zona('da classe com Precisão 25 também para nos 85%', heroi({ classe: 'guerreiro', extra: { buffs: { precisaoTurns: 2, precisaoAmount: 25 } } }), 'normal');
  zona('Visão Fraca com arco tira 10%', heroi({ arma: 'arco', debuff: 'visao_fraca' }), 'normal');
  zona('Visão Fraca com espada não tira', heroi({ arma: 'espada', debuff: 'visao_fraca' }), 'normal');
  zona('mago de cajado com Visão Fraca, mágico', heroi({ classe: 'mago', debuff: 'visao_fraca' }), 'magic');
  zona('arqueiro, tiro, Visão Fraca e Precisão 25', heroi({ classe: 'arqueiro', debuff: 'visao_fraca', extra: { buffs: { precisaoTurns: 1, precisaoAmount: 25 } } }), 'ranged');

  for (const [nome, hero] of [
    ['mago de cajado', heroi({ classe: 'mago' })],
    ['arqueiro de arco', heroi({ classe: 'arqueiro' })],
    ['arqueiro de espada', heroi({ classe: 'arqueiro', arma: 'espada' })],
    ['caçador de arco', heroi({ classe: 'cacador' })],
    ['guerreiro', heroi({ classe: 'guerreiro' })],
    ['ladino', heroi({ classe: 'ladino' })],
    ['clérigo', heroi({ classe: 'clerigo' })],
    ['Aprendiz', heroi({ classe: null })],
    ['guerreiro com Precisão', heroi({ classe: 'guerreiro', extra: { buffs: { precisaoTurns: 2, precisaoAmount: 25 } } })],
  ] as const) {
    caso(`ataquesDisponiveis: ${nome}`, 'ataquesDisponiveis', { hero }, (a) => E.ataquesDisponiveis(a.hero));
  }

  const leituras: Array<[number, number | null]> = [
    [0.5, 0.5],
    [0.5, 0.75],
    [0.5, 0.25],
    [0.5, 0.625],
    [0.5, 0.76],
    [0.5, 0],
    [0.5, 1],
    [0.5, null],
    [0.5, 0.52],
    [0.5, 0.48],
    [0.5, 0.525],
    [0.5, 0.475],
    [0.5, 0.53],
    [0.5, 0.47],
    [2 / 3, 0.55],
    [2 / 3, 0.5 + 1 / 3],
    [2 / 3, 0.8],
    [2 / 3, 0.8334],
    [0.85, 0.07500000000000001],
    [0.4, 0.7],
    [0.1, 0.5],
    [0.1, 0.55],
    [0.75, 0.123456789],
  ];
  for (const [z, mira] of leituras) caso(`lerMira: zona ${z}, mira ${mira}`, 'lerMira', { zona: z, mira }, (a) => E.lerMira(a.zona, a.mira));

  /** Nem crítico de sorte, nem proc: as duas chamadas de `rng` de um acerto, como o `LISO` dos testes. */
  const LISO: RngSpec = { sequence: [0.99, 0.99] };
  const golpeNeutro = (hero: Hero, estilo: AttackStyle = 'normal', dado = 1): JogadaDeAtaque => ({ dado, mira: 0.5 + E.zonaDoAtaque(hero, estilo) / 4 });
  const NO_VAZIO: JogadaDeAtaque = { dado: 1, mira: null };
  const ra = (nome: string, hero: Hero, monster: CombatMonsterView, jogada: JogadaDeAtaque, attackStyle: AttackStyle, rng: RngSpec, options: { petCriticoBonus?: number } = {}) =>
    caso(`resolveAttack: ${nome}`, 'resolveAttack', { hero, monster, jogada, attackStyle, options }, (a, ctx) => E.resolveAttack(a.hero, a.monster, a.jogada, a.attackStyle, { ...a.options, rng: ctx.rng }), { rng });

  const guerreiro = heroi({ classe: 'guerreiro', arma: 'espada' });
  const barbaroDeEspada = heroi({ arma: 'espada' });
  const mago = heroi({ classe: 'mago' });
  const agil = monstro({ speciesId: 'lobo_sombras' });

  ra('guerreiro de espada, d20 em 1, força 1× — 27 calculado à mão', guerreiro, monstro(), golpeNeutro(guerreiro), 'normal', LISO);
  ra('a face 20 do d20', guerreiro, monstro(), golpeNeutro(guerreiro, 'normal', 20), 'normal', LISO);
  ra('o 20 não fura a esquiva do monstro ágil', barbaroDeEspada, agil, golpeNeutro(barbaroDeEspada, 'normal', 20), 'normal', { sequence: [0.05] });
  ra('maestria nível 3 com a arma da classe', heroi({ classe: 'guerreiro', arma: 'espada', extra: { masteryBattles: 60 } }), monstro(), golpeNeutro(guerreiro), 'normal', LISO);
  ra('maestria não vale com machado', heroi({ classe: 'guerreiro', arma: 'machado', extra: { masteryBattles: 550 } }), monstro(), golpeNeutro(guerreiro), 'normal', LISO);
  ra('maestria no golpe mágico do mago', heroi({ classe: 'mago', extra: { masteryBattles: 550 } }), monstro(), golpeNeutro(mago, 'magic'), 'magic', LISO);
  ra('sem mana pro ataque mágico', heroi({ classe: 'mago', extra: { mp: 2 } }), monstro(), golpeNeutro(mago, 'magic'), 'magic', LISO);
  ra('desconta 5 de mana', heroi({ classe: 'mago', extra: { mp: 20 } }), monstro(), golpeNeutro(mago, 'magic'), 'magic', LISO);
  ra('critNext acerta com a barra no vazio e crita com força 1×', heroi({ arma: 'espada', extra: { buffs: { critNext: true } } }), monstro(), NO_VAZIO, 'normal', LISO);
  ra('crítico de sorte multiplica 1,6', barbaroDeEspada, monstro(), golpeNeutro(barbaroDeEspada), 'normal', { sequence: [0, 0.99] });
  ra('o monstro ágil esquiva fora da faixa do crítico', barbaroDeEspada, agil, golpeNeutro(barbaroDeEspada), 'normal', { sequence: [0.05] });
  ra('critNext pula a esquiva do ágil', heroi({ arma: 'espada', extra: { buffs: { critNext: true } } }), agil, NO_VAZIO, 'normal', { sequence: [0.05, 0.99, 0.99] });
  ra('a faixa do crítico pula a esquiva do ágil', barbaroDeEspada, agil, { dado: 1, mira: 0.5 }, 'normal', { sequence: [0.05, 0.99, 0.99] });
  ra('Precisão faz o mesmo ponto acertar', heroi({ arma: 'espada', extra: { buffs: { precisaoTurns: 2, precisaoAmount: 25 } } }), monstro(), { dado: 1, mira: 0.8 }, 'normal', LISO);
  ra('sem Precisão o mesmo ponto erra', barbaroDeEspada, monstro(), { dado: 1, mira: 0.8 }, 'normal', LISO);
  ra('desconta Precisão e Força no acerto', heroi({ arma: 'espada', extra: { buffs: { precisaoTurns: 2, forcaTurns: 3, forcaAmount: 0.3 } } }), monstro(), golpeNeutro(barbaroDeEspada), 'normal', LISO);
  ra('desconta Precisão e Força no erro', heroi({ arma: 'espada', extra: { buffs: { precisaoTurns: 2, forcaTurns: 3, forcaAmount: 0.3 } } }), monstro(), NO_VAZIO, 'normal', LISO);
  ra('Visão Fraca com arco: o ponto de 0,72 erra', heroi({ arma: 'arco', debuff: 'visao_fraca' }), monstro(), { dado: 1, mira: 0.72 }, 'normal', LISO);
  ra('Visão Fraca com espada: o ponto de 0,72 acerta', heroi({ arma: 'espada', debuff: 'visao_fraca' }), monstro(), { dado: 1, mira: 0.72 }, 'normal', LISO);
  ra('golpe mágico ignora o buff de Força', heroi({ classe: 'mago', extra: { buffs: { forcaTurns: 3, forcaAmount: 1 } } }), monstro(), golpeNeutro(mago, 'magic'), 'magic', LISO);
  ra('golpe mágico usa dmgMagico e pega a fraqueza do goblin — 45 à mão', mago, monstro(), golpeNeutro(mago, 'magic'), 'magic', LISO);
  ra('mago no físico usa metade do dano físico — 16 à mão', mago, monstro(), golpeNeutro(mago, 'physical'), 'physical', LISO);
  ra('não mago no estilo "magic" bate físico', guerreiro, monstro(), golpeNeutro(guerreiro, 'magic'), 'magic', LISO);
  ra('bárbaro abaixo de 50% de vida, ×1,35', heroi({ arma: 'machado', extra: { hp: 40 } }), monstro(), golpeNeutro(barbaroDeEspada), 'normal', LISO);
  ra('proc da arma dispara', barbaroDeEspada, monstro(), golpeNeutro(barbaroDeEspada), 'normal', { sequence: [0.99, 0] });
  ra('passiva do ladino dispara', heroi({ classe: 'ladino' }), monstro(), golpeNeutro(heroi({ classe: 'ladino' })), 'normal', { sequence: [0.99, 0.99, 0] });
  ra('o golpe derruba o monstro', barbaroDeEspada, monstro({ hp: 5 }), golpeNeutro(barbaroDeEspada), 'normal', LISO);
  ra('força 1,35 a 0,05 do centro na zona da classe — 36 à mão', guerreiro, monstro(), { dado: 1, mira: 0.55 }, 'normal', LISO);
  ra('a zona da classe acerta onde a comum erra', guerreiro, monstro(), { dado: 1, mira: 0.8 }, 'normal', LISO);
  ra('tiro do arqueiro', heroi({ classe: 'arqueiro' }), monstro(), golpeNeutro(heroi({ classe: 'arqueiro' }), 'ranged'), 'ranged', { sequence: [0.99, 0.99, 0.99] });
  ra('arqueiro soma 8 de crítico', heroi({ classe: 'arqueiro' }), monstro(), golpeNeutro(heroi({ classe: 'arqueiro' }), 'ranged'), 'ranged', { sequence: [0.17, 0.99, 0.99] });
  ra('pet de crítico', barbaroDeEspada, monstro(), golpeNeutro(barbaroDeEspada), 'normal', { sequence: [0.12, 0.99] }, { petCriticoBonus: 5 });
  ra('Canção de Batalha no golpe físico', heroi({ classe: 'bardo', arma: 'adaga', extra: { buffs: { inspiracaoTurns: 2, inspiracaoAmount: 0.25 } } }), monstro(), golpeNeutro(barbaroDeEspada), 'normal', { sequence: [0.99, 0.99, 0.99] });
  ra('Canção de Batalha no golpe mágico', heroi({ classe: 'mago', extra: { buffs: { inspiracaoTurns: 2, inspiracaoAmount: 0.25 } } }), monstro(), golpeNeutro(mago, 'magic'), 'magic', LISO);
  ra('resistência física do lobo', barbaroDeEspada, monstro({ speciesId: 'lobo_sombras' }), golpeNeutro(barbaroDeEspada), 'normal', { sequence: [0.99, 0.99, 0.99] });
  ra('mago contra resistência mágica do esqueleto (metade da penalidade)', mago, monstro({ speciesId: 'esqueleto' }), golpeNeutro(mago, 'magic'), 'magic', LISO);
  ra('vulnerável e Muralha Sombria no mesmo golpe', barbaroDeEspada, monstro({ guardHits: 2, status: { vulneravel: { turns: 1, amount: 0.2 } } }), golpeNeutro(barbaroDeEspada), 'normal', LISO);
  ra('borda da zona: força 0,5', barbaroDeEspada, monstro(), { dado: 20, mira: 0.25 }, 'normal', LISO);
  ra('mira 0 erra', barbaroDeEspada, monstro(), { dado: 20, mira: 0 }, 'normal', LISO);
  ra('nível alto, equipamento épico', heroi({ classe: 'paladino', level: 80, attrs: { forca: 60 }, arma: item('espada', 'mitico'), equip: { secundaria: item('escudo', 'epico'), acessorio: item('colar_forca', 'mitico') } }), monstro({ hp: 2000, maxHp: 2000 }), { dado: 17, mira: 0.51 }, 'normal', { sequence: [0.99, 0.99, 0.99] });
  for (const dado of [0, 21, 2.5]) ra(`dado ${dado} lança`, barbaroDeEspada, monstro(), { dado, mira: 0.5 }, 'normal', LISO);
  for (const mira of [-0.1, 1.1, Number.NaN]) ra(`mira ${mira} lança`, barbaroDeEspada, monstro(), { dado: 10, mira }, 'normal', LISO);

  for (let i = 1; i <= 40; i++) {
    const hero = heroiDeLote();
    const estilo = chance(0.8) ? umDe(E.ataquesDisponiveis(hero)).estilo : umDe(['normal', 'magic', 'physical', 'ranged'] as const);
    const mira = chance(0.1) ? null : chance(0.1) ? 0.5 : lote();
    ra(`lote ${i}`, hero, monstroDeLote(), { dado: entre(1, 20), mira }, estilo, { seed: 2000 + i }, chance(0.2) ? { petCriticoBonus: 5 } : {});
  }
}

// --- monster-hit ---

{
  const mh = (nome: string, hero: Hero, party: Companion[], monster: CombatMonsterView, rng: RngSpec, options: { esquivaCerta?: boolean; petEsquivaBonus?: number } = {}) =>
    caso(`applyMonsterHit: ${nome}`, 'applyMonsterHit', { hero, party, monster, options }, (a, ctx) => E.applyMonsterHit(a.hero, a.party, a.monster, { ...a.options, rng: ctx.rng }), { rng });

  const ladino = heroi({ classe: 'ladino', arma: null });
  const esqueleto = monstro({ speciesId: 'esqueleto' });
  mh('atordoado: pula e gasta um turno, sem sortear', ladino, [], monstro({ status: { atordoado: 2 } }), { sequence: [] });
  mh('lento: perde o turno', ladino, [], monstro({ status: { lento: { turns: 2, amount: 0.2 } } }), { sequence: [0.1] });
  mh('lento: não perde o turno', ladino, [], monstro({ status: { lento: { turns: 1, amount: 0.2 } } }), { sequence: [0.5, 0.99, 0.99, 0] });
  mh('enrage do mini-chefe abaixo de 50%', ladino, [], monstro({ isBoss: true, isMainBoss: false, hp: 40, maxHp: 100 }), { sequence: [0.99, 0.99, 0] });
  mh('enrage não dispara duas vezes', ladino, [], monstro({ isBoss: true, isMainBoss: false, hp: 40, maxHp: 100, rageTriggered: true, dmg: 8 }), { sequence: [0.99, 0.99, 0] });
  mh('enfraquecido reduz o golpe', ladino, [], monstro({ status: { enfraquecido: { turns: 2, amount: 0.3 } } }), { sequence: [0.99, 0.99, 0] });
  mh('enfraquecido sem amount vale 0,25', ladino, [], monstro({ status: { enfraquecido: { turns: 2 } as never } }), { sequence: [0.99, 0.99, 0] });
  mh('mira o defensor', ladino, [companheiro('guerreiro')], monstro(), { sequence: [0.99, 0.1, 0, 0] });
  mh('derruba o defensor', ladino, [companheiro('guerreiro', { hp: 3 })], monstro(), { sequence: [0.99, 0.1, 0, 0] });
  mh('sem defensor nem sorteio, vai no herói', ladino, [companheiro('clerigo', { stance: 'suporte' })], monstro(), { sequence: [0.99, 0.99, 0.99, 0] });
  mh('mira um companheiro qualquer', ladino, [companheiro('mago'), companheiro('bardo')], monstro(), { sequence: [0.99, 0.1, 0.6, 0.5] });
  mh('equipe toda morta: vai no herói', ladino, [companheiro('guerreiro', { hp: 0 })], monstro(), { sequence: [0.99, 0.99, 0] });
  mh('esquiva do Passo Veloz', heroi({ classe: 'ladino', arma: null, extra: { buffs: { esquivaTurns: 3, esquivaAmount: 10 } } }), [], monstro(), { sequence: [0.99, 0.1] });
  mh('esquiva rolada: erra mesmo com rng que acertaria', ladino, [], monstro(), { sequence: [0.99, 0.99, 0] }, { esquivaCerta: true });
  mh('esquiva rolada não gasta Passo Veloz nem escudo', heroi({ classe: 'ladino', arma: null, extra: { buffs: { esquivaTurns: 3, esquivaAmount: 20, shield: 0.5 } } }), [], monstro(), { sequence: [0.99] }, { esquivaCerta: true });
  mh('esquiva rolada não protege o companheiro', ladino, [companheiro('druida', { stance: 'defensiva' })], monstro(), { sequence: [0.99, 0, 0, 0] }, { esquivaCerta: true });
  mh('dano base ao herói — 4 à mão', ladino, [], monstro(), { sequence: [0.99, 0.99, 0] });
  mh('dano máximo do d6', ladino, [], monstro(), { sequence: [0.99, 0.99, 0.99] });
  mh('agressivo: ×1,45', ladino, [], monstro(), { sequence: [0.1, 0.99, 0.5] });
  mh('defesa e resistência mágica cortam o golpe', heroi({ classe: 'ladino', arma: null, attrs: { sabedoria: 20 }, equip: { armadura: item('placas', 'mitico'), elmo: item('placas_elmo', 'epico') } }), [], esqueleto, { sequence: [0.99, 0.5] });
  mh('dano nunca abaixo de 1', heroi({ classe: 'ladino', arma: null, attrs: { sabedoria: 60 } }), [], esqueleto, { sequence: [0.99, 0] });
  mh('Medo do Fogo contra mágico', heroi({ classe: 'ladino', arma: null, debuff: 'medo_do_fogo' }), [], monstro({ speciesId: 'elemental_fogo' }), { sequence: [0.99, 0, 0.99] });
  mh('Medo do Fogo pelo nome do monstro ("Fogo" no nome)', heroi({ classe: 'ladino', arma: null, debuff: 'medo_do_fogo' }), [], monstro({ speciesId: 'elemental_fogo', overrides: { behavior: 'defensivo' } }), { sequence: [0.99, 0.5] });
  mh('Corpo Frágil +20%', heroi({ classe: 'ladino', arma: null, debuff: 'corpo_fragil' }), [], esqueleto, { sequence: [0.99, 0] });
  mh('passiva do guerreiro corta 40%', heroi({ classe: 'guerreiro', arma: null }), [], esqueleto, { sequence: [0.99, 0, 0.1] });
  mh('escudo absorve e some', heroi({ classe: 'ladino', arma: null, extra: { buffs: { shield: 0.5 } } }), [], esqueleto, { sequence: [0.99, 0] });
  mh('poisonStrike do Assassino', ladino, [], monstro({ speciesId: 'esqueleto', poisonStrike: true }), { sequence: [0.99, 0] });
  mh('venenoso envenena', ladino, [], monstro({ speciesId: 'aranha' }), { sequence: [0.99, 0, 0.1] });
  mh('venenoso com Sangue Tóxico: 3 × 1,5 = 4,5 → 5', heroi({ classe: 'ladino', arma: null, debuff: 'sangue_toxico' }), [], monstro({ speciesId: 'aranha', dmg: 9 }), { sequence: [0.99, 0, 0.1] });
  mh('mágico drena mana', ladino, [], monstro({ speciesId: 'elemental_fogo' }), { sequence: [0.99, 0, 0.1] });
  mh('mágico não drena mais que há', heroi({ classe: 'ladino', arma: null, extra: { mp: 1 } }), [], monstro({ speciesId: 'espectro_gelado', dmg: 12 }), { sequence: [0.99, 0, 0.1] });
  mh('3º ataque do Brutamontes', ladino, [], monstro({ attackCount: 2 }), { sequence: [0.99, 0.99, 0] });
  mh('3º ataque do Feiticeiro drena', heroi({ classe: 'ladino', arma: null, extra: { mp: 20 } }), [], monstro({ attackCount: 2, enemyClassId: 'feiticeiro' }), { sequence: [0.99, 0.99, 0] });
  mh('3º ataque do Assassino envenena no mesmo golpe', ladino, [], monstro({ attackCount: 2, enemyClassId: 'assassino', speciesId: 'esqueleto' }), { sequence: [0.99, 0.5] });
  mh('zumbi lento bate ×1,7 no 3º ataque', ladino, [], monstro({ speciesId: 'zumbi', attackCount: 2, enemyClassId: 'guardiao' }), { sequence: [0.99, 0.5] });
  mh('chefe principal bate ×1,9 no 3º ataque, por cima do agressivo', ladino, [], monstro({ isBoss: true, isMainBoss: true, attackCount: 5, enemyClassId: 'xama' }), { sequence: [0.1, 0.99, 0.5] });
  mh('pet de esquiva', ladino, [], monstro(), { sequence: [0.99, 0.12] }, { petEsquivaBonus: 8 });
  mh('golpe fatal', heroi({ classe: 'ladino', arma: null, extra: { hp: 3 } }), [], monstro(), { sequence: [0.99, 0.99, 0.99] });
  for (let i = 1; i <= 40; i++) {
    mh(`lote ${i}`, heroiDeLote(), equipeDeLote(), monstroDeLote(), { seed: 3000 + i }, chance(0.15) ? { esquivaCerta: true } : chance(0.15) ? { petEsquivaBonus: 6 } : {});
  }

  // As três partes do golpe, que a luta em tempo real chama em momentos diferentes (sem lote: ver partyMemberAct).
  const inicio = (nome: string, monster: CombatMonsterView, hero: Hero, rng: RngSpec) =>
    caso(`startMonsterAttack: ${nome}`, 'startMonsterAttack', { monster, hero }, (a, ctx) => E.startMonsterAttack(a.monster, a.hero, ctx.rng), { rng });
  inicio('atordoado perde a vez sem sortear', monstro({ status: { atordoado: 2 } }), ladino, { sequence: [] });
  inicio('lento perde a vez', monstro({ status: { lento: { turns: 2, amount: 0.2 } } }), ladino, { sequence: [0.1] });
  inicio('lento não perde', monstro({ status: { lento: { turns: 1, amount: 0.2 } } }), ladino, { sequence: [0.5, 0.99] });
  inicio('enrage do mini-chefe', monstro({ isBoss: true, isMainBoss: false, hp: 40, maxHp: 100 }), ladino, { sequence: [0.99] });
  inicio('enfraquecido', monstro({ status: { enfraquecido: { turns: 2, amount: 0.3 } } }), ladino, { sequence: [0.99] });
  inicio('agressivo bate ×1,45', monstro(), ladino, { sequence: [0.1] });
  inicio('3º ataque do Feiticeiro', monstro({ attackCount: 2, enemyClassId: 'feiticeiro' }), heroi({ classe: 'ladino', arma: null, extra: { mp: 20 } }), { sequence: [0.99] });
  inicio('chefe principal no 3º', monstro({ isBoss: true, isMainBoss: true, attackCount: 5 }), ladino, { sequence: [0.99] });

  const noHeroi = (nome: string, hero: Hero, monster: CombatMonsterView, attackMult: number, rng: RngSpec, petEsquiva?: number) =>
    caso(`landHitOnHero: ${nome}`, 'landHitOnHero', { hero, monster, attackMult, petEsquiva }, (a, ctx) => E.landHitOnHero(a.hero, a.monster, a.attackMult, ctx.rng, a.petEsquiva), { rng });
  noHeroi('acerta', ladino, monstro(), 1, { sequence: [0.99, 0.5] });
  noHeroi('na força 1,7', ladino, monstro(), 1.7, { sequence: [0.99, 0.5] });
  noHeroi('esquiva', heroi({ classe: 'ladino', arma: null, extra: { buffs: { esquivaTurns: 2, esquivaAmount: 40 } } }), monstro(), 1, { sequence: [0.1] });

  // A armadura encantada da Encantadora: só a arena do app passa as defesas (items/encantamentos.ts).
  const encantado = (tipo: EncantamentoId, nivel: number, extra: Partial<Hero> = {}): Hero =>
    heroi({ classe: 'ladino', arma: null, equip: { armadura: { ...item('placas'), equipped: true, encantamento: { tipo, nivel } } }, extra });
  const comDefesas = (nome: string, hero: Hero, monster: CombatMonsterView, rng: RngSpec) =>
    caso(`landHitOnHero: ${nome}`, 'landHitOnHero', { hero, monster, attackMult: 1, petEsquiva: 0, defesas: E.defesasDoHeroi(hero) }, (a, ctx) =>
      E.landHitOnHero(a.hero, a.monster, a.attackMult, ctx.rng, a.petEsquiva, a.defesas),
    { rng });
  comDefesas('robustez III desconta de quem bate de perto', encantado('robustez', 3), monstro({ dmg: 20 }), { sequence: [0.99, 0.5] });
  comDefesas('a robustez não vale contra o mágico', encantado('robustez', 3), monstro({ speciesId: 'elemental_fogo', dmg: 20 }), { sequence: [0.99, 0.5, 0.99] });
  comDefesas('resistência mágica III desconta do mágico e segura o dreno', encantado('resistencia_magica', 3, { mp: 30 }), monstro({ speciesId: 'elemental_fogo', dmg: 20 }), { sequence: [0.99, 0.5, 0.1, 0.5] });
  comDefesas('resistência mágica I não segura o dreno', encantado('resistencia_magica', 1, { mp: 30 }), monstro({ speciesId: 'espectro_gelado', dmg: 20 }), { sequence: [0.99, 0.5, 0.1, 0.5] });
  comDefesas('resistência a veneno III segura a aranha', encantado('resistencia_veneno', 3), monstro({ speciesId: 'aranha', dmg: 20 }), { sequence: [0.99, 0.5, 0.1, 0.5] });
  comDefesas('resistência a veneno I não segura', encantado('resistencia_veneno', 1), monstro({ speciesId: 'aranha', dmg: 20 }), { sequence: [0.99, 0.5, 0.1, 0.5] });
  comDefesas('o golpe envenenado do poder de classe também é segurado', encantado('resistencia_veneno', 3), monstro({ poisonStrike: true }), { sequence: [0.99, 0.5, 0.2] });
  comDefesas('sem encantamento é o golpe de sempre', heroi({ classe: 'ladino', arma: null }), monstro({ speciesId: 'aranha' }), { sequence: [0.99, 0.5, 0.1] });
  comDefesas('esquiva com a armadura encantada', encantado('robustez', 2, { buffs: { esquivaTurns: 2, esquivaAmount: 40 } }), monstro(), { sequence: [0.1] });
  comDefesas('o desconto não passa de 1 de dano', encantado('robustez', 3), monstro({ dmg: 0 }), { sequence: [0.99, 0] });
  noHeroi('pet de esquiva', ladino, monstro(), 1, { sequence: [0.12] }, 8);
  noHeroi('golpe envenenado se gasta', ladino, monstro({ poisonStrike: true }), 1, { sequence: [0.99, 0.5] });
  noHeroi('golpe envenenado fica na esquiva', heroi({ classe: 'ladino', arma: null, extra: { buffs: { esquivaTurns: 1, esquivaAmount: 100 } } }), monstro({ poisonStrike: true }), 1, { sequence: [0.1] });
  noHeroi('guerreiro apara', heroi({ classe: 'guerreiro' }), monstro(), 1, { sequence: [0.99, 0.5, 0.1] });
  noHeroi('escudo arcano', heroi({ classe: 'ladino', arma: null, extra: { buffs: { shield: 0.5 } } }), monstro(), 1, { sequence: [0.99, 0.5] });
  noHeroi('venenoso envenena', ladino, monstro({ speciesId: 'aranha' }), 1, { sequence: [0.99, 0.5, 0.1] });
  noHeroi('mágico drena', heroi({ classe: 'ladino', arma: null, extra: { mp: 20 } }), monstro({ speciesId: 'espectro_gelado' }), 1, { sequence: [0.99, 0.5, 0.1] });
  noHeroi('golpe fatal', heroi({ classe: 'ladino', arma: null, extra: { hp: 2 } }), monstro(), 1, { sequence: [0.99, 0.99] });

  const noCompanheiro = (nome: string, member: Companion, monster: CombatMonsterView, attackMult: number, rng: RngSpec) =>
    caso(`hitPartyMember: ${nome}`, 'hitPartyMember', { member, monster, attackMult }, (a, ctx) => E.hitPartyMember(a.member, a.monster, a.attackMult, ctx.rng), { rng });
  noCompanheiro('acerta', companheiro('guerreiro'), monstro(), 1, { sequence: [0.5] });
  noCompanheiro('na força 1,45', companheiro('mago'), monstro(), 1.45, { sequence: [0.99] });
  noCompanheiro('derruba', companheiro('bardo', { hp: 3 }), monstro(), 1, { sequence: [0.5] });
  noCompanheiro('no mínimo 1', companheiro('guerreiro'), monstro({ dmg: 0 }), 0.1, { sequence: [0] });

  // Em quem o golpe cai, que a luta do app sorteia no começo do aviso (sem lote, pelo mesmo motivo).
  const quemLeva = (nome: string, party: Companion[], rng: RngSpec) =>
    caso(`pickMonsterTarget: ${nome}`, 'pickMonsterTarget', { party }, (a, ctx) => E.pickMonsterTarget(a.party, ctx.rng), { rng });
  quemLeva('sem equipe: o herói, sem sortear', [], { sequence: [] });
  quemLeva('o defensor', [companheiro('mago'), companheiro('guerreiro')], { sequence: [0.1, 0] });
  quemLeva('o defensor escapa, vai num qualquer', [companheiro('mago'), companheiro('guerreiro')], { sequence: [0.9, 0.1, 0.2] });
  quemLeva('sem defensor e sem sorte: o herói', [companheiro('mago'), companheiro('bardo')], { sequence: [0.5] });
  quemLeva('quem caiu não conta', [companheiro('guerreiro', { hp: 0 }), companheiro('mago')], { sequence: [0.1, 0.5] });
  quemLeva('a postura defensiva também defende', [companheiro('mago', { stance: 'defensiva' }), companheiro('bardo')], { sequence: [0.2, 0] });
}

// --- use-power ---

{
  for (const power of E.POWERS) {
    caso(`powerManaCost: ${power.id}`, 'powerManaCost', { hero: heroi(), power }, (a) => E.powerManaCost(a.hero, a.power));
    caso(`powerManaCost: ${power.id} com Mana Instável (ceil de ×1,2)`, 'powerManaCost', { hero: heroi({ debuff: 'mana_instavel' }), power }, (a) => E.powerManaCost(a.hero, a.power));
    for (const desconto of [0.1, 0.15, 0.2]) {
      caso(`powerManaCost: ${power.id} com a Coroa (${desconto})`, 'powerManaCost', { hero: heroi({ debuff: 'mana_instavel' }), power, desconto }, (a) => E.powerManaCost(a.hero, a.power, a.desconto));
    }
  }

  const cp = (nome: string, hero: Hero, party: Companion[], monster: CombatMonsterView, power: Power, rng: RngSpec, options: { petCuraBonus?: number; petManaSaveChance?: number; descontoDeMana?: number } = {}) =>
    caso(`castPower: ${nome}`, 'castPower', { hero, party, monster, power, options }, (a, ctx) => E.castPower(a.hero, a.party, a.monster, a.power, { ...a.options, rng: ctx.rng }), { rng });

  const ferido = heroi({ classe: 'clerigo', extra: { hp: 30 } });
  const equipe = [companheiro('guerreiro', { hp: 5 }), companheiro('mago', { hp: 0 }), companheiro('bardo', { hp: 19 })];
  for (const power of E.POWERS) {
    const dono = E.CLASSES.find((c) => c.signatureId === power.id)?.id ?? power.soDaClasse ?? 'mago';
    cp(`${power.id}, d6 em 0`, heroi({ classe: dono, extra: { hp: 30, buffs: { esquivaTurns: 1, esquivaAmount: 5 } } }), equipe, monstro(), power, { sequence: [0] });
    cp(`${power.id}, d6 no máximo`, heroi({ classe: dono, attrs: { forca: 18, intelecto: 17, sabedoria: 15 }, extra: { hp: 30 } }), equipe, monstro({ status: { atordoado: 1 } }), power, { sequence: [0.99] });
  }
  const golpe = E.powerById('golpe_poderoso')!;
  const bola = E.powerById('bola_de_fogo')!;
  const cura = E.powerById('cura_menor')!;
  const julgamento = E.powerById('julgamento_sagrado')!;
  cp('sem mana não gasta nada', heroi({ extra: { mp: 3 } }), [], monstro(), bola, { sequence: [0] });
  // A Coroa do Arquimago (só a arena passa): o poder custa menos, e a mana justa do custo com desconto já basta.
  const comDesconto = E.powerManaCost(heroi(), bola, 0.2);
  cp('com a Coroa, custa menos', heroi(), [], monstro(), bola, { sequence: [0.5] }, { descontoDeMana: 0.2 });
  cp('com a Coroa, a mana justa do desconto basta', heroi({ extra: { mp: comDesconto } }), [], monstro(), bola, { sequence: [0.5] }, { descontoDeMana: 0.2 });

  // O esqueleto do necromante (combat/invocacao.ts): até 3 de pé, à parte dos recrutas.
  const levantar = E.powerById('levantar_esqueleto')!;
  const necromante = heroi({ classe: 'necromante', level: 7, attrs: { intelecto: 17 } });
  const esqueleto = (o: Partial<Companion> = {}): Companion => ({ ...E.criarEsqueleto(necromante, []), ...o });
  for (const [nome, hero, party] of [
    ['nível 1, Inteligência 14, sem ninguém', heroi({ classe: 'necromante', attrs: { intelecto: 14 } }), []],
    ['nível 7, depois de dois esqueletos', necromante, [esqueleto(), esqueleto({ name: 'Esqueleto 2' })]],
    ['com recrutas na equipe', necromante, [companheiro('guerreiro'), companheiro('mago')]],
  ] as const) {
    caso(`criarEsqueleto: ${nome}`, 'criarEsqueleto', { hero, party }, (a) => E.criarEsqueleto(a.hero, a.party));
  }
  const tresDePe = [esqueleto(), esqueleto({ name: 'Esqueleto 2' }), esqueleto({ name: 'Esqueleto 3' })];
  const umCaido = [esqueleto({ hp: 0 }), esqueleto({ name: 'Esqueleto 2' }), esqueleto({ name: 'Esqueleto 3' })];
  for (const [nome, party] of [
    ['ninguém', []],
    ['recrutas não contam', [companheiro('guerreiro'), companheiro('mago')]],
    ['três de pé', tresDePe],
    ['um caído', umCaido],
  ] as const) {
    caso(`esqueletosDePe: ${nome}`, 'esqueletosDePe', { party }, (a) => E.esqueletosDePe(a.party));
    caso(`semInvocados: ${nome}`, 'semInvocados', { party }, (a) => E.semInvocados(a.party));
  }
  cp('levantar_esqueleto: com 3 de pé, avisa e não gasta', necromante, [companheiro('guerreiro'), ...tresDePe], monstro(), levantar, { sequence: [] });
  cp('levantar_esqueleto: com um caído, levanta outro', necromante, [companheiro('guerreiro'), ...umCaido], monstro(), levantar, { sequence: [] });
  cp('levantar_esqueleto: sem mana', heroi({ classe: 'necromante', extra: { mp: 5 } }), [], monstro(), levantar, { sequence: [] });
  cp('levantar_esqueleto: com o pet que poupa mana', necromante, [], monstro(), levantar, { sequence: [0.1] }, { petManaSaveChance: 20 });
  cp('Mana Instável cobra o custo maior', heroi({ classe: 'mago', debuff: 'mana_instavel', extra: { mp: 17 } }), [], monstro(), bola, { sequence: [0] });
  cp('Mana Instável sem mana pro custo maior', heroi({ classe: 'mago', debuff: 'mana_instavel', extra: { mp: 16 } }), [], monstro(), bola, { sequence: [0] });
  cp('maestria nível 10 no poder', heroi({ classe: 'guerreiro', arma: 'espada', extra: { masteryBattles: 550 } }), [], monstro(), golpe, { sequence: [0] });
  cp('o poder derruba o monstro', heroi(), [], monstro({ hp: 5 }), golpe, { sequence: [0] });
  cp('dreno do Julgamento não passa do máximo', heroi({ classe: 'paladino', extra: { hp: 109 } }), [], monstro(), julgamento, { sequence: [0.5] });
  cp('cura com Cicatrização Lenta', heroi({ classe: 'clerigo', debuff: 'cicatrizacao_lenta', extra: { hp: 30 } }), equipe, monstro(), cura, { sequence: [] });
  cp('cura com pet de +20%', ferido, equipe, monstro(), cura, { sequence: [] }, { petCuraBonus: 20 });
  cp('cura não passa do máximo', heroi({ classe: 'clerigo' }), [companheiro('guerreiro')], monstro(), cura, { sequence: [] });
  cp('pet poupa a mana', ferido, [], monstro(), cura, { sequence: [0.1] }, { petManaSaveChance: 50 });
  cp('pet não poupa a mana', ferido, [], monstro(), cura, { sequence: [0.9] }, { petManaSaveChance: 50 });
  cp('buff mantém os buffs que já havia', heroi({ extra: { buffs: { shield: 0.5, poisonTurns: 2, poisonDmg: 3 } } }), [], monstro(), E.powerById('grito_de_guerra')!, { sequence: [] });
  cp('mágico contra a resistência mágica do esqueleto', heroi({ classe: 'mago' }), [], monstro({ speciesId: 'esqueleto' }), bola, { sequence: [0.5] });
  cp('físico contra a resistência física do lobo', heroi({ classe: 'guerreiro' }), [], monstro({ speciesId: 'lobo_sombras' }), golpe, { sequence: [0.5] });
  for (let i = 1; i <= 30; i++) {
    const options = chance(0.2) ? { petManaSaveChance: 30 } : chance(0.2) ? { petCuraBonus: 15 } : {};
    cp(`lote ${i}`, heroiDeLote(), equipeDeLote(), monstroDeLote(), umDe(E.POWERS), { seed: 4000 + i }, options);
  }
}

// --- flee e dodge ---

{
  const rapido = heroi({ attrs: { destreza: 15 } });
  const igual = heroi({ attrs: { destreza: 10 } });
  const teimoso = heroi({ attrs: { destreza: 10 }, debuff: 'teimoso' });
  for (const [nome, hero] of [
    ['vantagem de 5 (+2)', rapido],
    ['sem vantagem', igual],
    ['Teimoso (−2)', teimoso],
  ] as const) {
    for (const roll of [1, 9, 10, 11, 12, 20]) {
      caso(`attemptFlee: ${nome}, d20 ${roll}`, 'attemptFlee', { hero, monster: { speed: 10 }, roll }, (a) => E.attemptFlee(a.hero, a.monster, a.roll));
      caso(`attemptDodge: ${nome}, d20 ${roll}`, 'attemptDodge', { hero, monster: { speed: 10 }, roll }, (a) => E.attemptDodge(a.hero, a.monster, a.roll));
    }
  }
  for (const roll of [0, 25]) caso(`attemptFlee: rolagem ${roll} não é conferida`, 'attemptFlee', { hero: igual, monster: { speed: 10 }, roll }, (a) => E.attemptFlee(a.hero, a.monster, a.roll));
  for (const roll of [0, 21, 2.5, Number.NaN]) caso(`attemptDodge: rolagem ${roll} lança`, 'attemptDodge', { hero: igual, monster: { speed: 10 }, roll }, (a) => E.attemptDodge(a.hero, a.monster, a.roll));
}

// =====================================================================
// dungeon — graph, dungeons e generate
// =====================================================================

modulo('dungeon');

constante('DIR_VECTORS', E.DIR_VECTORS);
constante('DIR_LABEL', E.DIR_LABEL);
constante('DIR_OPP', E.DIR_OPP);
constante('DIR_ORDER', E.DIR_ORDER);
constante('DUNGEONS', E.DUNGEONS);
constante('DIFFICULTIES', E.DIFFICULTIES);
constante('DUNGEON_FLOORS', E.DUNGEON_FLOORS);
constante('TOTEM_FLOORS', E.TOTEM_FLOORS);
constante('DEFAULT_RUN', E.DEFAULT_RUN);
constante('FLOORS_PER_DUNGEON', E.FLOORS_PER_DUNGEON);

// --- a ordenação que o grafo e o andar usam pra embaralhar ---

for (const [n, seed] of [
  [2, 1],
  [3, 1],
  [4, 1],
  [4, 2],
  [4, 3],
  [5, 7],
  [8, 1],
  [9, 4],
  [13, 1],
  [13, 2],
  [13, 99],
] as const) {
  caso(`Array.prototype.sort com comparador rng() − 0,5: ${n} itens, seed ${seed} (V8)`, 'Array.prototype.sort', { length: n, comparator: 'rng() - 0.5' }, (a, { rng }) => {
    const comparisons: Array<[number, number]> = [];
    const order = Array.from({ length: a.length }, (_, i) => i).sort((x, y) => {
      comparisons.push([x, y]);
      return rng() - 0.5;
    });
    return { order, comparisons };
  }, { rng: { seed } });
}
for (const seed of [1, 2, 3, 4, 5]) {
  caso(`Array.prototype.sort: DIR_ORDER embaralhado como no grafo, seed ${seed}`, 'Array.prototype.sort', { list: E.DIR_ORDER, comparator: 'rng() - 0.5' }, (a, { rng }) => a.list.slice().sort(() => rng() - 0.5), {
    rng: { seed },
  });
}

// --- graph ---

for (const [x, y, cols, rows] of [
  [0, 0, 6, 6],
  [5, 5, 6, 6],
  [6, 0, 6, 6],
  [0, -1, 6, 6],
  [-1, 3, 6, 6],
] as const) {
  caso(`inBounds: (${x}, ${y}) em ${cols}×${rows}`, 'inBounds', { x, y, cols, rows }, (a) => E.inBounds(a.x, a.y, a.cols, a.rows));
}

function grafoCompacto(g: { grid: RoomCell[][]; rooms: RoomCell[]; start: RoomCell }) {
  return { grid: g.grid, rooms: g.rooms.map((c) => [c.x, c.y]), start: [g.start.x, g.start.y] };
}

for (const [rows, cols, roomCount, seed] of [
  [6, 6, 10, 1],
  [6, 6, 10, 2],
  [6, 6, 14, 3],
  [11, 11, 12, 1],
  [11, 11, 16, 42],
  [9, 9, 14, 3],
  [3, 3, 50, 5],
  [1, 1, 5, 1],
  [6, 6, 1, 1],
] as const) {
  caso(`generateRoomGraph: ${rows}×${cols}, ${roomCount} salas, seed ${seed}`, 'generateRoomGraph', { rows, cols, roomCount }, (a, { rng }) =>
    grafoCompacto(E.generateRoomGraph(a.rows, a.cols, a.roomCount, rng)),
  { rng: { seed } });
}

{
  const g = E.generateRoomGraph(6, 6, 12, E.seededRng(8));
  caso('distancesFrom: do início de um grafo 6×6', 'distancesFrom', { grid: g.grid, start: g.start, cols: 6, rows: 6 }, (a) => E.distancesFrom(a.grid, a.start, a.cols, a.rows));
  const outra = g.rooms[g.rooms.length - 1]!;
  caso('distancesFrom: de uma sala da ponta', 'distancesFrom', { grid: g.grid, start: outra, cols: 6, rows: 6 }, (a) => E.distancesFrom(a.grid, a.start, a.cols, a.rows));

  for (const [nome, cell] of [
    ['null', null],
    ['void', { type: 'void', x: 0, y: 0, doors: {} }],
    ['normal', { type: 'normal', x: 0, y: 0, doors: {} }],
  ] as const) {
    caso(`isRoom: ${nome}`, 'isRoom', { cell }, (a) => E.isRoom(a.cell));
  }

  const visitada = (cel: RoomCell) => g.grid.map((linha) => linha.map((c) => (c.x === cel.x && c.y === cel.y ? { ...c, visited: true } : c)));
  const vizinha = g.rooms[1]!;
  const longe = g.rooms[g.rooms.length - 1]!;
  caso('isKnown: sala visitada', 'isKnown', { grid: g.grid, cell: { ...vizinha, visited: true }, cols: 6, rows: 6 }, (a) => E.isKnown(a.grid, a.cell, a.cols, a.rows));
  caso('isKnown: sala revelada', 'isKnown', { grid: g.grid, cell: { ...longe, revealed: true }, cols: 6, rows: 6 }, (a) => E.isKnown(a.grid, a.cell, a.cols, a.rows));
  caso('isKnown: vizinha de uma sala visitada', 'isKnown', { grid: visitada(g.start), cell: vizinha, cols: 6, rows: 6 }, (a) => E.isKnown(a.grid, a.cell, a.cols, a.rows));
  caso('isKnown: longe de tudo que foi visitado', 'isKnown', { grid: visitada(g.start), cell: longe, cols: 6, rows: 6 }, (a) => E.isKnown(a.grid, a.cell, a.cols, a.rows));
}

// --- dungeons ---

const TODAS_AS_MASMORRAS: DungeonRun[] = E.DUNGEONS.flatMap((d) => E.DIFFICULTIES.map((f) => ({ dungeon: d.id, difficulty: f.id })));
for (const run of TODAS_AS_MASMORRAS) {
  caso(`tierOf: ${E.runKey(run)}`, 'tierOf', { run }, (a) => E.tierOf(a.run));
  caso(`tierOffset: ${E.runKey(run)}`, 'tierOffset', { run }, (a) => E.tierOffset(a.run));
  caso(`runName: ${E.runKey(run)}`, 'runName', { run }, (a) => E.runName(a.run));
  caso(`runKey: ${E.runKey(run)}`, 'runKey', { run }, (a) => E.runKey(a.run));
  for (const floor of [1, 4, 100]) caso(`effectiveFloor: ${E.runKey(run)}, andar ${floor}`, 'effectiveFloor', { run, floor }, (a) => E.effectiveFloor(a.run, a.floor));
}
for (const floor of [-3, 0, 1, 2, 9, 10, 11, 78, 100, 155, 331]) caso(`monsterLevel: andar ${floor}`, 'monsterLevel', { floor }, (a) => E.monsterLevel(a.floor));
for (const floor of [1, 19, 20, 40, 60, 80, 100]) caso(`isTotemFloor: ${floor}`, 'isTotemFloor', { floor }, (a) => E.isTotemFloor(a.floor));
for (const [nome, raw] of [
  ['válido', { dungeon: 'torre', difficulty: 'pesadelo' }],
  ['masmorra desconhecida', { dungeon: 'pantano', difficulty: 'pesadelo' }],
  ['dificuldade desconhecida', { dungeon: 'caverna', difficulty: 'insana' }],
  ['número no lugar de texto', { dungeon: 3, difficulty: null }],
  ['null', null],
] as const) {
  caso(`normalizeRun: ${nome}`, 'normalizeRun', { raw }, (a) => E.normalizeRun(a.raw));
}
for (const id of ['caverna', 'nada']) caso(`dungeonById: ${id}`, 'dungeonById', { id }, (a) => E.dungeonById(a.id));
for (const id of ['dificil', 'nada']) caso(`difficultyById: ${id}`, 'difficultyById', { id }, (a) => E.difficultyById(a.id));
caso('emptyProgress', 'emptyProgress', {}, () => E.emptyProgress());
caso(
  'normalizeProgress: tira chave desconhecida, andar que não é totem e repetição, e ordena',
  'normalizeProgress',
  { raw: { cleared: ['floresta:normal', 'floresta:normal', 'pantano:normal', 7], totems: { 'floresta:normal': [60, 20, 20, 33, '40'], 'xyz:normal': [20], 'caverna:dificil': [] } } },
  (a) => E.normalizeProgress(a.raw),
);
caso('normalizeProgress: lixo', 'normalizeProgress', { raw: 'lixo' }, (a) => E.normalizeProgress(a.raw));

const PROGRESSOS: Array<[string, DungeonProgress]> = [
  ['nada zerado', E.emptyProgress()],
  ['Floresta Normal zerada', { cleared: ['floresta:normal'], totems: {} }],
  ['Floresta Normal e Difícil, Caverna Normal', { cleared: ['floresta:normal', 'floresta:dificil', 'caverna:normal'], totems: { 'caverna:normal': [20, 40] } }],
];
for (const [nomeP, progress] of PROGRESSOS) {
  for (const run of TODAS_AS_MASMORRAS) {
    for (const heroLevel of [1, 30]) {
      caso(`lockReason: ${nomeP}, nível ${heroLevel}, ${E.runKey(run)}`, 'lockReason', { progress, heroLevel, run }, (a) => E.lockReason(a.progress, a.heroLevel, a.run));
    }
    caso(`isCleared: ${nomeP}, ${E.runKey(run)}`, 'isCleared', { progress, run }, (a) => E.isCleared(a.progress, a.run));
  }
}
caso('lockReason: masmorra desconhecida abre', 'lockReason', { progress: E.emptyProgress(), heroLevel: 1, run: { dungeon: 'pantano', difficulty: 'normal' } }, (a) =>
  E.lockReason(a.progress, a.heroLevel, a.run as never),
);
{
  const p = PROGRESSOS[2]![1];
  const caverna: DungeonRun = { dungeon: 'caverna', difficulty: 'normal' };
  caso('entryFloors: andar 1 e os totens tocados', 'entryFloors', { progress: p, run: caverna }, (a) => E.entryFloors(a.progress, a.run));
  caso('entryFloors: sem totem', 'entryFloors', { progress: p, run: E.DEFAULT_RUN }, (a) => E.entryFloors(a.progress, a.run));
  for (const floor of [60, 40, 33]) caso(`touchTotem: andar ${floor}`, 'touchTotem', { progress: p, run: caverna, floor }, (a) => E.touchTotem(a.progress, a.run, a.floor));
  caso('markCleared: zera a Caverna Difícil', 'markCleared', { progress: p, run: { dungeon: 'caverna', difficulty: 'dificil' } }, (a) => E.markCleared(a.progress, a.run as DungeonRun));
  caso('markCleared: já zerada devolve igual', 'markCleared', { progress: p, run: caverna }, (a) => E.markCleared(a.progress, a.run));
}
for (const floor of [1, 19, 20, 37, 85, Number.NaN]) caso(`legacyProgress: andar ${floor}`, 'legacyProgress', { floor }, (a) => E.legacyProgress(a.floor));

// --- generate ---

for (const floor of [0, 1, 4, 5, 10, 15, 99, 100, -5]) caso(`isBossFloor: ${floor}`, 'isBossFloor', { floor }, (a) => E.isBossFloor(a.floor));
for (const [floor, sequence] of [
  [10, [0.99, 0.99]],
  [10, [0.1, 0.99]],
  [4, [0.1, 0.1]],
  [3, [0.1, 0.1]],
  [4, [0.99, 0.1]],
] as const) {
  caso(`monsterGroupSize: andar ${floor}, rolos ${sequence.join(' e ')}`, 'monsterGroupSize', { floor }, (a, { rng }) => E.monsterGroupSize(a.floor, rng), { rng: { sequence: [...sequence] } });
}

function andarCompacto(andar: { grid: DungeonCell[][]; rooms: DungeonCell[]; start: DungeonCell }) {
  return { grid: andar.grid, rooms: andar.rooms.map((c) => [c.x, c.y]), start: [andar.start.x, andar.start.y] };
}

const ANDARES: Array<[number, number, number, number, DungeonRun?, { classId: string; number: 1 | 2 }?]> = [
  [1, 6, 6, 1],
  [3, 6, 6, 3],
  [4, 6, 6, 4],
  [5, 6, 6, 5],
  [7, 11, 11, 1],
  [9, 11, 11, 123],
  [10, 6, 6, 2],
  [20, 6, 6, 20],
  [30, 6, 6, 4, undefined, { classId: 'guerreiro', number: 1 }],
  [60, 6, 6, 9],
  [77, 6, 6, 77, undefined, { classId: 'mago', number: 2 }],
  [100, 6, 6, 100],
  [1, 6, 6, 3, { dungeon: 'caverna', difficulty: 'normal' }],
  [10, 6, 6, 5, { dungeon: 'caverna', difficulty: 'pesadelo' }],
  [25, 6, 6, 7, { dungeon: 'torre', difficulty: 'dificil' }],
  [6, 3, 3, 2],
  [8, 4, 4, 11],
];
for (const [floor, rows, cols, seed, run, teacher] of ANDARES) {
  const options = { now: AGORA, ...(run ? { run } : {}), ...(teacher ? { teacher } : {}) };
  const nome = `generateDungeonFloor: andar ${floor}, ${rows}×${cols}, seed ${seed}${run ? `, ${E.runKey(run)}` : ''}${teacher ? `, professor ${teacher.classId} ${teacher.number}` : ''}`;
  caso(nome, 'generateDungeonFloor', { floor, rows, cols, options }, (a, { rng, now }) => andarCompacto(E.generateDungeonFloor(a.floor, a.rows, a.cols, { ...a.options, rng, now })), {
    rng: { seed },
    now: AGORA,
  });
}
// O andar gerado no app: os itens dos baús, das salas e da sala secreta podem vir com material.
for (const [floor, seed, run] of [
  [30, 4, undefined],
  [60, 9, undefined],
  [100, 100, undefined],
  [25, 7, { dungeon: 'torre', difficulty: 'dificil' }],
  [3, 3, undefined],
] as Array<[number, number, DungeonRun | undefined]>) {
  const options = { now: AGORA, app: true, ...(run ? { run } : {}) };
  caso(`generateDungeonFloor: no app, andar ${floor}, seed ${seed}${run ? `, ${E.runKey(run)}` : ''}`, 'generateDungeonFloor', { floor, rows: 6, cols: 6, options }, (a, { rng, now }) =>
    andarCompacto(E.generateDungeonFloor(a.floor, a.rows, a.cols, { ...a.options, rng, now })),
  { rng: { seed }, now: AGORA });
}
{
  // A primeira semente em que um baú do andar 70 gerado no app guarda uma runa (na sala de tesouro ou na secreta).
  const ehRuna = (peca: Item | null | undefined) => !!peca && peca.templateId.startsWith('runa_');
  const temRuna = (grade: DungeonCell[][]) =>
    grade.flat().some((celula) => ehRuna(celula.item) || (celula.extras ?? []).some((extra) => extra.kind === 'crack' && ehRuna(extra.secretItem)));
  let semente = 1;
  while (!temRuna(E.generateDungeonFloor(70, 6, 6, { rng: E.seededRng(semente), now: relogio, app: true }).grid)) {
    if (++semente > 3000) throw new Error('nenhum andar de teste com runa no baú');
  }
  caso(`generateDungeonFloor: no app, andar 70, uma runa no baú, seed ${semente}`, 'generateDungeonFloor', { floor: 70, rows: 6, cols: 6, options: { now: AGORA, app: true } }, (a, { rng, now }) =>
    andarCompacto(E.generateDungeonFloor(a.floor, a.rows, a.cols, { ...a.options, rng, now })),
  { rng: { seed: semente }, now: AGORA });
}

{
  // Um andar com chefe, totem e professor, pra ter todo tipo de sala nos textos.
  const andar = E.generateDungeonFloor(20, 6, 6, { rng: E.seededRng(20), now: relogio, teacher: { classId: 'clerigo', number: 1 } });
  const celulas: Array<[string, DungeonCell]> = andar.rooms.map((c) => [`${c.type} (${c.x}, ${c.y})`, c]);
  const primeira = (tipo: string) => andar.rooms.find((c) => c.type === tipo);
  const variantes: Array<[string, DungeonCell | undefined]> = [
    ['monstro derrotado', primeira('monster') && { ...primeira('monster')!, beaten: true }],
    ['monstro sozinho', primeira('monster') && { ...primeira('monster')!, monsters: primeira('monster')!.monsters!.slice(0, 1) }],
    ['grupo de monstros', primeira('monster') && { ...primeira('monster')!, monsters: [E.generate(5, { rng: E.seededRng(1) }), E.generate(5, { rng: E.seededRng(2) })] }],
    ['tesouro coletado', primeira('treasure') && { ...primeira('treasure')!, collected: true }],
    ['evento resolvido', primeira('event') && { ...primeira('event')!, resolved: true }],
    ['chefe derrotado', primeira('boss') && { ...primeira('boss')!, beaten: true }],
    ['professor que já ensinou', primeira('teacher') && { ...primeira('teacher')!, teacher: { ...primeira('teacher')!.teacher!, taught: true } }],
  ];
  for (const [nome, cell] of [...celulas, ...variantes]) {
    if (!cell) continue;
    caso(`iconFor: ${nome}`, 'iconFor', { cell }, (a) => E.iconFor(a.cell));
    caso(`shortLabel: ${nome}`, 'shortLabel', { cell }, (a) => E.shortLabel(a.cell));
    caso(`roomDesc: ${nome}`, 'roomDesc', { cell }, (a) => E.roomDesc(a.cell));
    caso(`entryText: ${nome}`, 'entryText', { cell }, (a) => E.entryText(a.cell));
  }
}

// --- room-walk: andar solto dentro da sala ---
//
// Sorteio próprio, e não o `lote`: os casos daqui não podem mexer nos
// sorteados dos módulos seguintes.

for (const nome of ['ROOM_COLS', 'ROOM_ROWS', 'TILE_UNITS', 'WALK_TICKS_PER_SECOND', 'HERO_SPEED', 'HERO_HALF', 'TOUCH_REACH', 'STICK_MAX', 'DOOR_ASSIST', 'CONTENT_TILE'] as const) {
  constante(nome, E[nome]);
}

{
  const DIRS = ['N', 'S', 'E', 'W'] as const;
  const conteudo = [{ id: 'content', ...E.CONTENT_TILE }];
  const portasDe = (mascara: number) => Object.fromEntries(DIRS.filter((_, i) => mascara & (1 << i)).map((d) => [d, true]));
  const rotulo = (portas: Record<string, unknown>) => Object.keys(portas).join('') || 'nenhuma';

  for (let mascara = 0; mascara < 16; mascara++) {
    const doors = portasDe(mascara);
    caso(`roomLayout: portas ${rotulo(doors)}, sem objeto`, 'roomLayout', { doors, objects: [] }, (a) => E.roomLayout(a.doors, a.objects));
    caso(`roomLayout: portas ${rotulo(doors)}, com o conteúdo no centro`, 'roomLayout', { doors, objects: conteudo }, (a) => E.roomLayout(a.doors, a.objects));
  }
  caso('roomLayout: dois objetos', 'roomLayout', { doors: { N: true, W: true }, objects: [{ id: 'a', col: 2, row: 2 }, { id: 'b', col: 6, row: 4 }] }, (a) => E.roomLayout(a.doors, a.objects));
  caso('roomLayout: com os cantos da Caverna', 'roomLayout', { doors: { N: true, S: true, E: true, W: true }, objects: conteudo, walls: E.paredesDaSala('caverna') }, (a) =>
    E.roomLayout(a.doors, a.objects, a.walls),
  );

  for (const [x, y] of [
    [0, 0],
    [1, 1],
    [-1, -1],
    [0.5, -0.5],
    [0.999, 0.001],
    [-0.3333, 0.7071],
    [2, -3],
    [0.0078, -0.0079],
  ] as const) {
    caso(`stickInput: (${x}, ${y})`, 'stickInput', { x, y }, (a) => E.stickInput(a.x, a.y));
  }

  for (const d of [null, ...DIRS]) caso(`roomArrival: ${d ?? 'sem direção'}`, 'roomArrival', { movedTowards: d }, (a) => E.roomArrival(a.movedTowards));
  // A sala da Torre (dungeon/arte-da-sala.ts): 11 × 12, vãos de 3, a parede de cima de 2.
  const geometriaDaTorre = E.geometriaDaSala('torre');
  for (const d of [null, ...DIRS]) {
    caso(`roomArrival: na Torre, ${d ?? 'sem direção'}`, 'roomArrival', { movedTowards: d, geometria: geometriaDaTorre }, (a) => E.roomArrival(a.movedTowards, a.geometria));
  }
  for (const d of DIRS) {
    caso(`casasDoVao: na Torre, ${d}`, 'casasDoVao', { geometria: geometriaDaTorre, lado: d }, (a) => E.casasDoVao(a.geometria, a.lado));
    caso(`casasDoVao: na sala de sempre, ${d}`, 'casasDoVao', { geometria: E.GEOMETRIA_PADRAO, lado: d }, (a) => E.casasDoVao(a.geometria, a.lado));
  }
  for (const [nome, doors] of [
    ['sem portas', {}],
    ['norte e oeste', { N: true, W: true }],
    ['todas', { N: true, S: true, E: true, W: true }],
  ] as const) {
    caso(`roomLayout: na Torre, ${nome}`, 'roomLayout', { doors, objects: [{ id: 'content', col: 5, row: 6 }], walls: E.paredesDaSala('torre'), geometria: geometriaDaTorre }, (a) =>
      E.roomLayout(a.doors, a.objects, a.walls, a.geometria));
  }

  /** Vários passos seguidos, segmento por segmento; para no vão. O C# repete o mesmo laço (cola de teste, como o sort). */
  interface Segmento {
    x: number;
    y: number;
    ticks: number;
  }
  const andarVarios = (a: {
    doors: Record<string, unknown>;
    objects: { id: string; col: number; row: number }[];
    walker: Walker;
    inputs: Segmento[];
    walls?: { col: number; row: number }[];
    geometria?: GeometriaDaSala;
  }) => {
    const layout = E.roomLayout(a.doors, a.objects, a.walls ?? [], a.geometria ?? E.GEOMETRIA_PADRAO);
    let walker = a.walker;
    let ticks = 0;
    const trace: WalkStep[] = [];
    const touches: { tick: number; id: string | null }[] = [];
    let tocando: string | null = null;
    for (const segmento of a.inputs) {
      let passo: WalkStep | null = null;
      for (let i = 0; i < segmento.ticks; i++) {
        passo = E.walkTick(layout, walker, segmento);
        walker = passo.walker;
        ticks++;
        if (passo.touching !== tocando) {
          tocando = passo.touching;
          touches.push({ tick: ticks, id: tocando });
        }
        if (passo.exit) break;
      }
      if (passo) trace.push(passo);
      if (passo?.exit) break;
    }
    return { trace, touches, ticks };
  };

  const c = (quadrado: number) => quadrado * E.TILE_UNITS + E.TILE_UNITS / 2;
  const M = E.STICK_MAX;
  const todas = { N: true, S: true, E: true, W: true };
  const cenarios: [string, Record<string, unknown>, boolean, Walker, Segmento[]][] = [
    ['reto pro leste até a parede', { S: true }, false, { x: c(1), y: c(2), facing: 'S' }, [{ x: M, y: 0, ticks: 200 }]],
    ['diagonal escorregando na parede de baixo', { N: true }, false, { x: c(2), y: c(4), facing: 'S' }, [{ x: M, y: M, ticks: 120 }]],
    ['joystick pela metade', todas, true, { x: c(2), y: c(2), facing: 'S' }, [{ x: 63, y: -20, ticks: 40 }]],
    ['contorna o conteúdo e encosta', todas, true, { x: c(1), y: c(3), facing: 'E' }, [{ x: M, y: 0, ticks: 80 }, { x: 0, y: M, ticks: 30 }, { x: M, y: 0, ticks: 60 }]],
    ['sai pelo norte alinhado', todas, true, { x: c(4), y: c(2), facing: 'N' }, [{ x: 0, y: -M, ticks: 100 }]],
    ['ajuda na porta do norte, vindo da direita', todas, true, { x: c(4) + 420, y: c(1), facing: 'N' }, [{ x: 0, y: -M, ticks: 100 }]],
    ['ajuda na porta do sul, vindo da esquerda', todas, true, { x: c(4) - 400, y: c(5), facing: 'S' }, [{ x: 0, y: M, ticks: 100 }]],
    ['ajuda na porta do oeste, vindo de cima', todas, true, { x: c(1), y: c(3) - 450, facing: 'W' }, [{ x: -M, y: 0, ticks: 100 }]],
    ['ajuda na porta do leste, vindo de baixo', todas, true, { x: c(7), y: c(3) + 300, facing: 'E' }, [{ x: M, y: 0, ticks: 100 }]],
    ['longe do vão a ajuda não puxa', todas, true, { x: c(2), y: c(1), facing: 'N' }, [{ x: 0, y: -M, ticks: 60 }]],
    ['porta fechada segura', { S: true }, true, { x: c(4), y: c(2), facing: 'N' }, [{ x: 0, y: -M, ticks: 60 }]],
    ['diagonal para dentro do vão do oeste', todas, false, { x: c(1), y: c(1), facing: 'S' }, [{ x: -M, y: M, ticks: 200 }]],
    ['volta e meia pela sala', todas, true, E.roomArrival('N'), [{ x: M, y: -M, ticks: 50 }, { x: -M, y: -M, ticks: 50 }, { x: -M, y: M, ticks: 50 }, { x: 0, y: -M, ticks: 50 }]],
  ];
  for (const [nome, doors, comConteudo, walker, inputs] of cenarios) {
    caso(`walkTicks: ${nome}`, 'walkTicks', { doors, objects: comConteudo ? conteudo : [], walker, inputs }, andarVarios);
  }
  // Na Torre: atravessar a parede grossa de cima, as beiras do vão largo, os pilares e a porta fechada.
  const naTorre = { walls: E.paredesDaSala('torre'), geometria: geometriaDaTorre };
  const noMeio = [{ id: 'content', col: 5, row: 6 }];
  for (const [nome, doors, walker, inputs] of [
    ['sai pelo norte, pela parede de 2', todas, E.roomArrival('S', geometriaDaTorre), [{ x: 0, y: -M, ticks: 200 }]],
    ['sai pelo leste pela beira do vão', todas, { x: c(8), y: c(5), facing: 'E' }, [{ x: M, y: 0, ticks: 200 }]],
    ['sai pelo oeste pela outra beira', todas, { x: c(2), y: c(7), facing: 'W' }, [{ x: -M, y: 0, ticks: 200 }]],
    ['sai pelo sul', todas, E.roomArrival('N', geometriaDaTorre), [{ x: 0, y: M, ticks: 200 }]],
    ['o pilar ao lado do vão segura', todas, { x: c(3), y: c(3), facing: 'N' }, [{ x: 0, y: -M, ticks: 120 }]],
    ['porta fechada segura', { S: true }, E.roomArrival('S', geometriaDaTorre), [{ x: 0, y: -M, ticks: 120 }]],
    ['volta pela sala, contornando o pentagrama', todas, E.roomArrival(null, geometriaDaTorre), [{ x: M, y: -M, ticks: 60 }, { x: -M, y: -M, ticks: 80 }, { x: -M, y: M, ticks: 80 }, { x: M, y: 0, ticks: 60 }]],
  ] as const) {
    caso(`walkTicks: na Torre, ${nome}`, 'walkTicks', { doors, objects: noMeio, walker, inputs, ...naTorre }, andarVarios);
  }

  const sorteio = E.seededRng(20261011);
  const de = (min: number, max: number) => min + Math.floor(sorteio() * (max - min + 1));
  const eixo = () => [0, 0, M, -M, de(-M, M)][de(0, 4)] as number;
  for (let n = 1; n <= 40; n++) {
    const doors = portasDe(de(0, 15));
    const comConteudo = sorteio() < 0.7;
    const chegou = [null, ...DIRS][de(0, 4)] ?? null;
    const inputs: Segmento[] = Array.from({ length: de(3, 8) }, () => ({ x: eixo(), y: eixo(), ticks: de(1, 45) }));
    caso(`walkTicks: sorteado ${n}`, 'walkTicks', { doors, objects: comConteudo ? conteudo : [], walker: E.roomArrival(chegou), inputs }, andarVarios);
  }

  // walkTick direto, com a planta pronta na entrada (o caminho que o jogo usa).
  const planta = E.roomLayout(todas, conteudo);
  for (const [nome, walker, input] of [
    ['parado', { x: c(2), y: c(2), facing: 'W' }, { x: 0, y: 0 }],
    ['reto', { x: c(2), y: c(2), facing: 'W' }, { x: M, y: 0 }],
    ['diagonal no fim', { x: c(2), y: c(2), facing: 'W' }, { x: -M, y: M }],
    ['entrada fora da faixa', { x: c(2), y: c(2), facing: 'W' }, { x: 900, y: -900 }],
    ['entrada com fração', { x: c(2), y: c(2), facing: 'W' }, { x: 33.9, y: -12.5 }],
    ['encostado no conteúdo', { x: E.CONTENT_TILE.col * E.TILE_UNITS - E.HERO_HALF, y: c(3), facing: 'E' }, { x: M, y: 0 }],
    ['no meio do vão do norte', { x: c(4), y: c(0) + 10, facing: 'N' }, { x: 0, y: -M }],
  ] as const) {
    caso(`walkTick: ${nome}`, 'walkTick', { layout: planta, walker, input }, (a) => E.walkTick(a.layout, a.walker, a.input));
  }
}

// --- extras: baú pequeno, vaso, placa, parede rachada ---
//
// O sorteio dos extras roda dentro de generateDungeonFloor (os casos de
// andar lá em cima já os trazem). Aqui ficam os prêmios e a placa.

for (const nome of ['EXTRA_TILES', 'CRACK_CHANCE', 'EXTRA_CHEST_CHANCE', 'EXTRA_POT_CHANCE', 'EXTRA_POTIONS', 'DOOR_TILE'] as const) {
  constante(nome, E[nome]);
}
for (const [floor, seed] of [
  [1, 1],
  [5, 2],
  [10, 3],
  [40, 4],
  [100, 5],
] as const) {
  caso(`extraChestGold: andar ${floor}, seed ${seed}`, 'extraChestGold', { floor }, (a, { rng }) => E.extraChestGold(a.floor, rng), { rng: { seed } });
}
for (const seed of [1, 2, 3, 4, 5, 6]) {
  caso(`potCoins: seed ${seed}`, 'potCoins', {}, (_a, { rng }) => E.potCoins(rng), { rng: { seed } });
}
// A dica de cada placa depende do andar inteiro (escada, parede oca, chefe):
// o caso gera o andar e lê a placa de todas as salas.
for (const [floor, seed] of [
  [5, 5],
  [10, 2],
  [12, 8],
  [20, 20],
  [35, 3],
] as const) {
  caso(
    `signHint: as placas de todas as salas do andar ${floor}, seed ${seed}`,
    'signHint (andar gerado)',
    { floor, rows: 6, cols: 6 },
    (a, { rng, now }) => {
      const andar = E.generateDungeonFloor(a.floor, a.rows, a.cols, { rng, now });
      return andar.rooms.map((c) => ({ x: c.x, y: c.y, hint: E.signHint(andar.grid, c) }));
    },
    { rng: { seed }, now: AGORA },
  );
}
{
  const vazia = (x: number, y: number): DungeonCell => ({ type: 'void', x, y, doors: {} });
  const grade = Array.from({ length: 4 }, (_, y) => Array.from({ length: 4 }, (_, x) => vazia(x, y)));
  grade[0]![0] = { type: 'normal', x: 0, y: 0, doors: {} };
  grade[3]![1] = { type: 'stairs', x: 1, y: 3, doors: {} };
  grade[1]![3] = { type: 'normal', x: 3, y: 1, doors: {}, extras: [{ kind: 'crack', col: 4, row: 0, side: 'N', used: false }] };
  grade[2]![2] = { type: 'boss', x: 2, y: 2, doors: {}, beaten: false, monsters: [E.generateBoss(5, { rng: E.seededRng(3) })] };
  for (const [x, y] of [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [3, 1],
    [0, 2],
    [1, 3],
  ] as const) {
    caso(`signHint: grade feita à mão, placa em (${x}, ${y})`, 'signHint', { grid: grade, cell: { type: 'normal', x, y, doors: {} } }, (a) => E.signHint(a.grid, a.cell));
  }
  caso('signHint: sem escada, parede oca nem chefe', 'signHint', { grid: [[grade[0]![0]!]], cell: grade[0]![0]! }, (a) => E.signHint(a.grid, a.cell));
}

// O andar 100: o chefe é o chefe final.
{
  for (const run of [{ dungeon: 'floresta', difficulty: 'normal' }, { dungeon: 'caverna', difficulty: 'pesadelo' }] as const) {
    caso(`generateDungeonFloor: o andar 100, ${E.runKey(run)}`, 'generateDungeonFloor', { floor: 100, rows: 6, cols: 6, options: { now: AGORA, run } }, (a, { rng, now }) =>
      andarCompacto(E.generateDungeonFloor(a.floor, a.rows, a.cols, { ...a.options, rng, now })), { rng: { seed: 61 }, now: AGORA });
  }

}

// =====================================================================
// shop
// =====================================================================

modulo('shop');

constante('FORGE_MATERIALS', E.FORGE_MATERIALS);

for (const kind of ['blacksmith', 'shop'] as const) {
  for (const floor of [1, 5, 40]) {
    for (const seed of [1, 2]) {
      caso(`rollStock: ${kind}, andar ${floor}, seed ${seed}`, 'rollStock', { kind, floor, options: { now: AGORA } }, (a, { rng, now }) => E.rollStock(a.kind, a.floor, { rng, now }), {
        rng: { seed },
        now: AGORA,
      });
    }
  }
}

for (const carisma of [0, 7, 10, 20, 200]) {
  for (const discount of [0, 0.1, 0.3, 0.6]) {
    for (const value of [1, 10, 25, 33, 101]) {
      caso(`buyPrice: carisma ${carisma}, pechincha ${discount}, valor ${value}`, 'buyPrice', { hero: heroi({ attrs: { carisma } }), item: { ...item('espada'), value }, discount }, (a) =>
        E.buyPrice(a.hero, a.item, a.discount),
      );
    }
  }
}
caso('buyPrice: sem pechincha (parâmetro ausente)', 'buyPrice', { hero: heroi({ attrs: { carisma: 9 } }), item: item('placas', 'raro') }, (a) => E.buyPrice(a.hero, a.item));
for (const value of [0, 1, 2, 3, 25, 101]) caso(`sellPrice: valor ${value}`, 'sellPrice', { item: { ...item('espada'), value } }, (a) => E.sellPrice(a.item));
for (let roll = 0; roll <= 21; roll++) caso(`discountForRoll: ${roll}`, 'discountForRoll', { roll }, (a) => E.discountForRoll(a.roll));

for (const [materialId, cfg] of Object.entries(E.FORGE_MATERIALS)) {
  for (const valor of [0, 0.049, 0.05, 0.15, 0.2, 0.3, 0.35, 0.7, 0.75, 0.9, 0.95, 0.99]) {
    for (const pity of [0, 4]) {
      caso(`rollForgeOutcome: ${materialId}, rng ${valor}, pity ${pity}`, 'rollForgeOutcome', { cfg, pity }, (a, { rng }) => E.rollForgeOutcome(a.cfg, a.pity, rng), { rng: { sequence: [valor] } });
    }
  }
}
caso('rollForgeOutcome: pity 3 ainda pode piorar', 'rollForgeOutcome', { cfg: E.FORGE_MATERIALS.minerio, pity: 3 }, (a, { rng }) => E.rollForgeOutcome(a.cfg!, a.pity, rng), {
  rng: { sequence: [0] },
});

{
  const ferreiro = heroi({ extra: { gold: 200 } });
  const espada = item('espada', 'raro', 3);
  const minerio = item('minerio', 'comum', 4);
  const minerio2 = item('minerio', 'comum', 5);
  const essencia = item('essencia', 'comum', 6);
  const catalisador = item('catalisador_mitico', 'comum', 7);
  const pedra = item('pedra_protecao', 'comum', 8);
  const mochila = [minerio, espada, essencia, minerio2, catalisador, pedra];
  const rf = (nome: string, hero: Hero, inventory: Item[], it: Item, materialId: string, sequence: number[]) =>
    caso(`resolveForge: ${nome}`, 'resolveForge', { hero, inventory, item: it, materialId }, (a, ctx) => E.resolveForge(a.hero, a.inventory, a.item, a.materialId, { rng: ctx.rng }), {
      rng: { sequence },
    });
  rf('material desconhecido', ferreiro, mochila, espada, 'pedra', [0.5]);
  rf('sem o material na mochila', ferreiro, [espada], espada, 'minerio', [0.5]);
  rf('sem ouro', heroi({ extra: { gold: 10 } }), mochila, espada, 'minerio', [0.5]);
  rf('minério melhora (+1), gasta só o primeiro minério', ferreiro, mochila, espada, 'minerio', [0.99]);
  rf('minério mantém o tier', ferreiro, mochila, espada, 'minerio', [0.5]);
  rf('minério piora (−1)', ferreiro, mochila, espada, 'minerio', [0]);
  rf('pity 4 força o +1', ferreiro, mochila, { ...espada, reforgeFails: 4 }, 'minerio', [0]);
  rf('essência +2', ferreiro, mochila, espada, 'essencia', [0.95]);
  rf('catalisador +3', ferreiro, mochila, espada, 'catalisador_mitico', [0.99]);
  rf('pedra de proteção não piora', ferreiro, mochila, espada, 'pedra_protecao', [0]);
  rf('item no MAX não sobe', ferreiro, [minerio, { ...espada, tierAdjustment: 400 }], { ...espada, tierAdjustment: 400 }, 'minerio', [0.99]);
  {
    // Tier A (o ajuste põe a espada no A), duas runas: o minério que piora derruba pro B, e a segunda runa volta.
    const ajusteProTierA = (peca: Item): number => {
      for (let ajuste = 0; ajuste < 300; ajuste++) if (E.tierFor({ ...peca, tierAdjustment: ajuste }) === 'A') return ajuste + 5;
      throw new Error('nenhum ajuste põe a peça no tier A');
    };
    const noA: Item = { ...espada, tierAdjustment: ajusteProTierA(espada), runas: [{ runa: 'fogo', tier: 1 }, { runa: 'gelo', tier: 2 }] };
    if (E.espacosDeRuna(noA) !== 2) throw new Error('a espada de teste não ficou com dois espaços: ' + E.espacosDeRuna(noA));
    caso('resolveForge: o tier cai e a runa que sobrou volta pra mochila', 'resolveForge', { hero: ferreiro, inventory: [minerio, noA], item: noA, materialId: 'minerio' }, (a, ctx) =>
      E.resolveForge(a.hero, a.inventory, a.item, a.materialId, { rng: ctx.rng, now: ctx.now }),
    { rng: { sequence: [0, 0.3, 0.3] }, now: AGORA });
    const sorteios = [0, 0.3, 0.3];
    let i = 0;
    const resultado = E.resolveForge(ferreiro, [minerio, noA], noA, 'minerio', { rng: () => sorteios[i++] ?? 0, now: relogio });
    if (resultado.outcome.kind !== 'forged' || !resultado.outcome.runasDevolvidas?.length) throw new Error('a reforja de teste não devolveu runa');
  }

  const loja = [item('pot_vida', 'comum', 9), item('placas', 'raro', 10)];
  caso('resolveBuy: sem ouro', 'resolveBuy', { hero: heroi({ extra: { gold: 5 } }), inventory: [minerio], forSale: loja, item: loja[1], discount: 0 }, (a) =>
    E.resolveBuy(a.hero, a.inventory, a.forSale, a.item!, a.discount),
  );
  caso('resolveBuy: compra com pechincha', 'resolveBuy', { hero: heroi({ attrs: { carisma: 14 }, extra: { gold: 500 } }), inventory: [minerio], forSale: loja, item: loja[1], discount: 0.15 }, (a) =>
    E.resolveBuy(a.hero, a.inventory, a.forSale, a.item!, a.discount),
  );
  caso('resolveSell: metade do valor', 'resolveSell', { hero: ferreiro, inventory: mochila, item: espada }, (a) => E.resolveSell(a.hero, a.inventory, a.item));
  caso('resolveRestock: sem ouro', 'resolveRestock', { hero: heroi({ extra: { gold: 20 } }), kind: 'shop', floor: 5, restockCount: 2, options: { now: AGORA } }, (a, { rng, now }) =>
    E.resolveRestock(a.hero, a.kind as 'shop', a.floor, a.restockCount, { rng, now }),
  { rng: { seed: 1 }, now: AGORA });
  caso('resolveRestock: renova o ferreiro', 'resolveRestock', { hero: ferreiro, kind: 'blacksmith', floor: 5, restockCount: 2, options: { now: AGORA } }, (a, { rng, now }) =>
    E.resolveRestock(a.hero, a.kind as 'blacksmith', a.floor, a.restockCount, { rng, now }),
  { rng: { seed: 1 }, now: AGORA });
  caso('resolveRestock: o ferreiro do app, no fundo', 'resolveRestock', { hero: ferreiro, kind: 'blacksmith', floor: 90, restockCount: 0, options: { now: AGORA, app: true } }, (a, { rng, now }) =>
    E.resolveRestock(a.hero, a.kind as 'blacksmith', a.floor, a.restockCount, { rng, now, app: a.options.app }),
  { rng: { seed: 2 }, now: AGORA });
}

// A loja do app: o ferreiro vende peça no degrau 2, nunca no 3; o vendedor itinerante não muda.
for (const kind of ['blacksmith', 'shop'] as const) {
  for (const floor of [3, 40, 90]) {
    for (const seed of [1, 2, 3]) {
      caso(`rollStock: ${kind} do app, andar ${floor}, seed ${seed}`, 'rollStock', { kind, floor, options: { now: AGORA, app: true } }, (a, { rng, now }) =>
        E.rollStock(a.kind, a.floor, { rng, now, app: a.options.app }),
      { rng: { seed }, now: AGORA });
    }
  }
}

// =====================================================================
// inventory
// =====================================================================

modulo('inventory');

{
  const pocao = item('pot_vida', 'comum', 1);
  const mana = item('pot_mana', 'incomum', 2);
  const pergaminho = item('pergaminho', 'comum', 3);
  const espada = item('espada', 'comum', 4);
  const minerio = item('minerio', 'comum', 5);
  const mochila = [espada, pocao, mana, minerio];

  caso('addItem: vai pro fim', 'addItem', { inventory: mochila, item: pergaminho }, (a) => E.addItem(a.inventory, a.item));
  caso('addItem: mochila vazia', 'addItem', { inventory: [], item: pergaminho }, (a) => E.addItem(a.inventory, a.item));
  caso('removeByUid: achou', 'removeByUid', { inventory: mochila, uid: pocao.uid }, (a) => E.removeByUid(a.inventory, a.uid));
  caso('removeByUid: não achou', 'removeByUid', { inventory: mochila, uid: 'nada' }, (a) => E.removeByUid(a.inventory, a.uid));
  caso('removeByUid: uid repetido tira só o primeiro', 'removeByUid', { inventory: [pocao, espada, pocao], uid: pocao.uid }, (a) => E.removeByUid(a.inventory, a.uid));
  caso('findByUid: achou', 'findByUid', { inventory: mochila, uid: mana.uid }, (a) => E.findByUid(a.inventory, a.uid));
  caso('findByUid: não achou', 'findByUid', { inventory: mochila, uid: 'nada' }, (a) => E.findByUid(a.inventory, a.uid));

  const ferido = heroi({ extra: { hp: 50, mp: 20 } });
  const quaseCheio = heroi({ extra: { hp: 105, mp: 60 } });
  const ci = (nome: string, hero: Hero, inventory: Item[], it: Item) => caso(`consumeItem: ${nome}`, 'consumeItem', { hero, inventory, item: it }, (a) => E.consumeItem(a.hero, a.inventory, a.item));
  ci('poção de vida cura e some', ferido, mochila, pocao);
  ci('poção de vida não passa do máximo', quaseCheio, mochila, pocao);
  ci('poção de mana', ferido, mochila, mana);
  ci('pergaminho cura vida e mana', ferido, [...mochila, pergaminho], pergaminho);
  ci('cheio: usa e não ganha nada', heroi(), mochila, pocao);
  ci('material não é gasto', ferido, mochila, minerio);
  ci('espada não é gasta', ferido, mochila, espada);
  ci('item fora da mochila ainda cura', ferido, [espada], pocao);
}

// =====================================================================
// events
// =====================================================================

modulo('events');

constante('EVENT_TEMPLATES', E.EVENT_TEMPLATES);

for (const id of ['ferido', 'altar', 'porta', 'nada']) caso(`eventTemplateById: ${id}`, 'eventTemplateById', { id }, (a) => E.eventTemplateById(a.id as never));
for (let seed = 1; seed <= 6; seed++) caso(`randomEventTemplate: seed ${seed}`, 'randomEventTemplate', {}, (_a, { rng }) => E.randomEventTemplate(rng), { rng: { seed } });
for (const floor of [1, 5, 30, 0, -3, 2.7, Number.NaN]) caso(`eventXp: andar ${floor}`, 'eventXp', { floor }, (a) => E.eventXp(a.floor));

{
  const evento = (attrs: Partial<Attributes> = {}, extra: Partial<Hero> = {}) => heroi({ classe: 'clerigo', attrs, extra: { hp: 60, mp: 30, gold: 100, ...extra } });
  const re = (nome: string, hero: Hero, floor: number, choice: string, seed = 1) =>
    caso(`resolveEvent: ${nome}`, 'resolveEvent', { hero, floor, choice, options: { now: AGORA } }, (a, { rng, now }) => E.resolveEvent(a.hero, a.floor, a.choice as never, { rng, now }), {
      rng: { seed },
      now: AGORA,
    });
  re('ajudar paga 15 e cura 20', evento(), 1, 'ajudar');
  re('ajudar sem ouro não resolve', evento({}, { gold: 10 }), 1, 'ajudar');
  re('ajudar quase cheio não passa do máximo', evento({}, { hp: 120 }), 3, 'ajudar');
  re('curar com sabedoria 12 dá certo', evento({ sabedoria: 12 }), 1, 'curar');
  re('curar com sabedoria 11 falha e ainda ganha XP', evento({ sabedoria: 11 }), 1, 'curar');
  re('estudar com intelecto 13 acha item (andar 1)', evento({ intelecto: 13 }), 1, 'estudar', 1);
  re('estudar com intelecto 13 acha item (andar 30)', evento({ intelecto: 13 }), 30, 'estudar', 2);
  re('examinar usa a mesma regra de estudar', evento({ intelecto: 13 }), 5, 'examinar', 3);
  for (const [floor, seed] of [[60, 4], [90, 5], [90, 6], [1, 7]] as const) {
    caso(`resolveEvent: estudar no app, andar ${floor}, seed ${seed}`, 'resolveEvent', { hero: evento({ intelecto: 13 }), floor, choice: 'estudar', options: { now: AGORA, app: true } }, (a, { rng, now }) =>
      E.resolveEvent(a.hero, a.floor, a.choice as never, { rng, now, app: a.options.app }),
    { rng: { seed }, now: AGORA });
  }
  re('estudar com intelecto 12 falha e perde 8 de mana', evento({ intelecto: 12 }), 1, 'estudar');
  re('estudar falhando com pouca mana para em 0', evento({ intelecto: 12 }, { mp: 3 }), 1, 'estudar');
  re('rezar com sabedoria 13 enche vida e mana', evento({ sabedoria: 13 }), 1, 'rezar');
  re('rezar com sabedoria 12 falha', evento({ sabedoria: 12 }), 1, 'rezar');
  re('sacrificar tira 20% da vida máxima e dá 1 ponto', evento(), 1, 'sacrificar');
  re('sacrificar ferido demais não resolve', evento({}, { hp: 25 }), 1, 'sacrificar');
  re('sacrificar com vida máxima baixa tira no mínimo 10', evento({ constituicao: 1 }, { maxHp: 40, hp: 30 }), 1, 'sacrificar');
  re('forçar com força 13 abre e dá ouro pelo andar', evento({ forca: 13 }), 7, 'forcar');
  re('forçar com força 12 falha e perde 10 de vida', evento({ forca: 12 }), 7, 'forcar');
  re('forçar falhando com pouca vida para em 1', evento({ forca: 12 }, { hp: 5 }), 7, 'forcar');
  re('ignorar não ganha XP', evento(), 1, 'ignorar');
  re('desistir não ganha XP', evento(), 1, 'desistir');
  re('escolha desconhecida', evento(), 1, 'voar');
  re('o XP do evento sobe de nível', evento({ sabedoria: 12 }, { xp: 35 }), 1, 'curar');
}

// =====================================================================
// npc — npc-services
// =====================================================================

modulo('npc');

constante('NPC_SERVICE_INFO', E.NPC_SERVICE_INFO);

for (const service of [...Object.keys(E.NPC_SERVICE_INFO), 'xyz']) caso(`npcServiceInfo: ${service}`, 'npcServiceInfo', { service }, (a) => E.npcServiceInfo(a.service as never));

{
  const rh = (nome: string, hero: Hero, floor: number) => caso(`resolveHeal: ${nome}`, 'resolveHeal', { hero, floor }, (a) => E.resolveHeal(a.hero, a.floor));
  rh('carisma 10, andar 1', heroi({ extra: { hp: 40, mp: 10 } }), 1);
  rh('carisma 30, andar 10 (15% de desconto)', heroi({ attrs: { carisma: 30 }, extra: { hp: 40, mp: 10 } }), 10);
  rh('carisma 100: o desconto para em 40%', heroi({ attrs: { carisma: 100 }, extra: { hp: 40, mp: 10 } }), 50);
  rh('preço mínimo 5', heroi({ attrs: { carisma: 100 }, extra: { hp: 40 } }), -5);
  rh('sem ouro', heroi({ extra: { hp: 40, gold: 3 } }), 1);
  rh('cheio não gasta', heroi(), 1);
  rh('só a mana faltando', heroi({ extra: { mp: 2 } }), 1);
  rh('quase cheio: o ganho é o que cabe', heroi({ extra: { hp: 120, mp: 60 } }), 1);

  caso('resolveBlessing', 'resolveBlessing', { hero: heroi() }, (a) => E.resolveBlessing(a.hero));
  for (const [nome, hero] of [
    ['sem bênção', heroi()],
    ['três combates viram dois', heroi({ extra: { npcBlessing: { combats: 3, dodge: 12 } } })],
    ['o último combate acaba com a bênção', heroi({ extra: { npcBlessing: { combats: 1, dodge: 12 }, buffs: { shield: 0.5 } } })],
    ['bênção zerada não vale', heroi({ extra: { npcBlessing: { combats: 0, dodge: 12 } } })],
  ] as const) {
    caso(`applyNpcBlessing: ${nome}`, 'applyNpcBlessing', { hero }, (a) => E.applyNpcBlessing(a.hero));
  }

  const espada = item('espada', 'comum', 1);
  const minerio = item('minerio', 'comum', 2);
  const essencia = item('essencia', 'comum', 3);
  const rb = (nome: string, inventory: Item[], floor: number, seed: number) =>
    caso(`resolveBarter: ${nome}`, 'resolveBarter', { inventory, floor, options: { now: AGORA } }, (a, { rng, now }) => E.resolveBarter(a.inventory, a.floor, { rng, now }), {
      rng: { seed },
      now: AGORA,
    });
  rb('sem material não troca, sem sortear', [espada, item('pot_vida')], 1, 1);
  rb('troca o primeiro material por uma poção (andar 1)', [espada, minerio, essencia], 1, 1);
  rb('andar 10', [minerio], 10, 2);
  rb('material equipado é pulado', [{ ...minerio, equipped: true }, essencia], 1, 3);

  const andar = E.generateDungeonFloor(5, 6, 6, { rng: E.seededRng(5), now: relogio });
  const revelada = andar.grid.map((linha) => linha.map((c) => (c.x === andar.start.x + 1 && c.type !== 'void' ? { ...c, revealed: true } : c)));
  caso('resolveReveal: do início', 'resolveReveal', { grid: andar.grid, pos: { x: andar.start.x, y: andar.start.y } }, (a) => E.resolveReveal(a.grid, a.pos));
  caso('resolveReveal: num canto', 'resolveReveal', { grid: andar.grid, pos: { x: 0, y: 0 } }, (a) => E.resolveReveal(a.grid, a.pos));
  caso('resolveReveal: o que já estava revelado não conta', 'resolveReveal', { grid: revelada, pos: { x: andar.start.x, y: andar.start.y } }, (a) => E.resolveReveal(a.grid, a.pos));

  for (const [nome, party, seed] of [
    ['equipe vazia', [], 1],
    ['equipe vazia, outra seed', [], 2],
    ['dois na equipe', [companheiro('guerreiro'), companheiro('mago')], 3],
    ['equipe cheia, sem sortear', [companheiro('guerreiro'), companheiro('mago'), companheiro('bardo')], 1],
    ['dois recrutas e dois esqueletos: os esqueletos não ocupam vaga', [companheiro('guerreiro'), companheiro('mago'), { ...companheiro('bardo'), invocado: true }, { ...companheiro('bardo'), invocado: true }], 4],
  ] as const) {
    caso(`resolveRecruit: ${nome}`, 'resolveRecruit', { party }, (a, { rng }) => E.resolveRecruit(a.party, rng), { rng: { seed } });
  }
}

// =====================================================================
// quests
// =====================================================================

modulo('quests');

for (const floor of [1, 5, 20]) {
  for (let seed = 1; seed <= 6; seed++) {
    caso(`generateQuest: andar ${floor}, seed ${seed}`, 'generateQuest', { floor, options: { now: AGORA } }, (a, { rng, now }) => E.generateQuest(a.floor, { rng, now }), {
      rng: { seed },
      now: AGORA,
    });
  }
}

{
  const missao = (id: string, type: Quest['type'], target: number, progress: number, extra: Partial<Quest> = {}): Quest => ({
    id,
    type,
    target,
    progress,
    title: '',
    desc: '',
    rewardXp: 30,
    rewardGold: 25,
    done: progress >= target,
    claimed: false,
    ...extra,
  });
  const quadro = [missao('q_kill', 'kill', 4, 3), missao('q_floor', 'floor', 6, 3), missao('q_collect', 'collect', 2, 1), missao('q_kill_feita', 'kill', 3, 3)];

  caso('ensureQuestBoard: quadro vazio ganha duas', 'ensureQuestBoard', { quests: [], floor: 3, options: { now: AGORA } }, (a, { rng, now }) => E.ensureQuestBoard(a.quests, a.floor, { rng, now }), {
    rng: { seed: 1 },
    now: AGORA,
  });
  caso('ensureQuestBoard: quadro com missão fica igual, sem sortear', 'ensureQuestBoard', { quests: quadro, floor: 3, options: { now: AGORA } }, (a, { rng, now }) =>
    E.ensureQuestBoard(a.quests, a.floor, { rng, now }),
  { rng: { seed: 1 }, now: AGORA });
  caso('onMonsterKilled', 'onMonsterKilled', { quests: quadro }, (a) => E.onMonsterKilled(a.quests));
  for (const floor of [4, 6, 9]) caso(`onFloorReached: andar ${floor}`, 'onFloorReached', { quests: quadro, floor }, (a) => E.onFloorReached(a.quests, a.floor));
  caso('onItemCollected', 'onItemCollected', { quests: quadro }, (a) => E.onItemCollected(a.quests));

  const cq = (nome: string, hero: Hero, quests: Quest[], targetId: string) =>
    caso(`claimQuest: ${nome}`, 'claimQuest', { hero, quests, targetId, floor: 4, options: { now: AGORA } }, (a, { rng, now }) =>
      E.claimQuest(a.hero, a.quests, a.targetId, a.floor, { rng, now }),
    { rng: { seed: 7 }, now: AGORA });
  cq('resgata, sobe de nível e sorteia outra no lugar', heroi({ extra: { xp: 30 } }), quadro, 'q_kill_feita');
  cq('missão que não existe', heroi(), quadro, 'nada');
  cq('missão ainda não pronta', heroi(), quadro, 'q_kill');
  cq('missão já resgatada', heroi(), [missao('q_velha', 'kill', 3, 3, { claimed: true })], 'q_velha');
}

// =====================================================================
// city
// =====================================================================

modulo('city');

constante('GUILD_POS', E.GUILD_POS);
constante('ENCANTADORA_POS', E.ENCANTADORA_POS);

function cidadeCompacta(cidade: { grid: CityCell[][]; rooms: CityCell[]; start: CityCell | undefined }) {
  return { grid: cidade.grid, rooms: cidade.rooms.map((c) => [c.x, c.y]), start: cidade.start ? [cidade.start.x, cidade.start.y] : undefined };
}

for (const [rows, cols] of [
  [6, 6],
  [8, 8],
  [3, 3],
  [0, 0],
] as const) {
  caso(`generateCityLayout: ${rows}×${cols}`, 'generateCityLayout', { rows, cols }, (a) => cidadeCompacta(E.generateCityLayout(a.rows, a.cols)));
}

{
  const cidade = E.generateCityLayout(6, 6);
  const deAntes = cidade.grid.map((linha) => linha.map((c) => (c.type === 'guild' ? { ...c, type: 'normal' as const } : c)));
  caso('withGuild: a cidade de antes ganha a Guilda', 'withGuild', { grid: deAntes }, (a) => E.withGuild(a.grid));
  caso('withGuild: a cidade de hoje fica igual', 'withGuild', { grid: cidade.grid }, (a) => E.withGuild(a.grid));
  caso('withGuild: grade pequena demais fica igual', 'withGuild', { grid: E.generateCityLayout(2, 2).grid }, (a) => E.withGuild(a.grid));
  const semEncantadora = cidade.grid.map((linha) => linha.map((c) => (c.type === 'encantadora' ? { ...c, type: 'normal' as const } : c)));
  caso('withEncantadora: a cidade de antes ganha a Encantadora', 'withEncantadora', { grid: semEncantadora }, (a) => E.withEncantadora(a.grid));
  caso('withEncantadora: a cidade de hoje fica igual', 'withEncantadora', { grid: cidade.grid }, (a) => E.withEncantadora(a.grid));
  caso('withEncantadora: grade pequena demais fica igual', 'withEncantadora', { grid: E.generateCityLayout(2, 2).grid }, (a) => E.withEncantadora(a.grid));
  const ocupada = cidade.grid.map((linha) => linha.map((c) => (c.type === 'encantadora' ? { ...c, type: 'shop' as const } : c)));
  caso('withEncantadora: lugar ocupado por outra sala fica igual', 'withEncantadora', { grid: ocupada }, (a) => E.withEncantadora(a.grid));
  caso('restAtTavern', 'restAtTavern', { hero: heroi({ extra: { hp: 10, mp: 0 } }), party: [companheiro('guerreiro', { hp: 3 }), companheiro('mago', { hp: 0 })] }, (a) =>
    E.restAtTavern(a.hero, a.party),
  );

  const celulas: Array<[string, CityCell]> = [
    ...cidade.rooms.map((c): [string, CityCell] => [`${c.type} (${c.x}, ${c.y})`, c]),
    ['void', { type: 'void', x: 0, y: 0, doors: {} }],
    ['tipo desconhecido', { type: 'xyz' as never, x: 0, y: 0, doors: {} }],
  ];
  for (const [nome, cell] of celulas) {
    caso(`cityIconFor: ${nome}`, 'cityIconFor', { cell }, (a) => E.cityIconFor(a.cell));
    caso(`cityShortLabel: ${nome}`, 'cityShortLabel', { cell }, (a) => E.cityShortLabel(a.cell));
    caso(`cityRoomDesc: ${nome}`, 'cityRoomDesc', { cell }, (a) => E.cityRoomDesc(a.cell));
    caso(`cityEntryText: ${nome}`, 'cityEntryText', { cell }, (a) => E.cityEntryText(a.cell));
  }
}

// =====================================================================
// pets
// =====================================================================

modulo('pets');

constante('PET_ICONS', E.PET_ICONS);
constante('PET_BONUSES', E.PET_BONUSES);

for (const pet of [...Object.keys(E.PET_ICONS), 'dragao', null]) {
  caso(`petBonus: ${pet}`, 'petBonus', { pet }, (a) => E.petBonus(a.pet as never));
  caso(`petIcon: ${pet}`, 'petIcon', { pet }, (a) => E.petIcon(a.pet as never));
}
caso('petBonus: ausente', 'petBonus', {}, () => E.petBonus(undefined));
caso('petIcon: ausente', 'petIcon', {}, () => E.petIcon(undefined));

// =====================================================================
// jogo — o fluxo do jogo (src/jogo, que morava em apps/web/lib/jogo)
// =====================================================================
//
// Os estados de partida são montados aqui com as próprias funções do
// fluxo: a cidade de um herói de teste e andares sorteados a partir dela,
// sempre com semente e relógio fixos. Cada caso grava o estado inteiro na
// entrada e no resultado: ele é o save, e o app tem que devolvê-lo igual.
//
// Onde o resultado seria o próprio estado de entrada (passo que não
// acontece), o caso de cola devolve só se veio a mesma referência — o
// estado inteiro de novo só engordaria o arquivo.

modulo('jogo');

/** Um save como sai da Guilda: guerreiro com uma poção, ainda sem mapa. */
function saveNovo(h: HeroiDeTeste = {}, resto: Partial<SaveCarregado> = {}): SaveCarregado {
  return { hero: heroi({ classe: 'guerreiro', ...h }), floor: 1, inventory: [item('pot_vida')], quests: [], ...resto };
}

function naCidade(save: SaveCarregado): EstadoNaCidade {
  const estado = E.retomarSave(save, E.seededRng(1), relogio);
  if (estado.mapMode !== 'city') throw new Error('o save de teste não caiu na cidade');
  return estado;
}

function naMasmorra(cidade: EstadoNaCidade, semente: number, andar = 1, masmorra: DungeonRun = cidade.masmorra): EstadoNaMasmorra {
  return E.entrarNaMasmorra(cidade, E.seededRng(semente), masmorra, andar, relogio);
}

/** A primeira porta aberta da sala atual, na ordem de `DIR_ORDER`. */
function primeiraPorta(estado: EstadoDoJogo): Direction {
  const direcao = E.DIR_ORDER.find((d) => E.podeAndar(estado, d));
  if (!direcao) throw new Error('sala de teste sem porta');
  return direcao;
}

/** O estado posto na primeira sala da grade que tem parede, e a direção dela. */
function diantedaParede<T extends EstadoDoJogo>(estado: T): { estado: T; direcao: Direction } {
  for (const linha of estado.map) {
    for (const c of linha) {
      if (c.type === 'void') continue;
      const noLugar = { ...estado, pos: { x: c.x, y: c.y } };
      const direcao = E.DIR_ORDER.find((d) => !E.podeAndar(noLugar, d));
      if (direcao) return { estado: noLugar, direcao };
    }
  }
  throw new Error('grade de teste sem parede');
}

function comChefe<T extends EstadoNaMasmorra>(estado: T, beaten: boolean): T {
  return { ...estado, map: estado.map.map((linha) => linha.map((c) => (c.type === 'boss' ? { ...c, beaten } : c))) };
}

/** A primeira semente cujo primeiro sorteio cumpre `cond` — o sorteio do professor é o primeiro do andar. */
function sementeOnde(cond: (primeiro: number) => boolean): number {
  for (let semente = 1; ; semente++) if (cond(E.seededRng(semente)())) return semente;
}

const cidade = naCidade(saveNovo());
const masmorra = naMasmorra(cidade, 7);
const andarDoChefe = naMasmorra(cidade, 5, 5);
const fundo = naMasmorra(cidade, 9, E.DUNGEON_FLOORS);

/**
 * Estados enxutos, pra função que só olha a sala atual: a sala vai sozinha na
 * grade, e a cidade guardada fica de fora. A grade inteira em cada caso só
 * engordaria o arquivo.
 */
const enxuto = (hero: Hero = cidade.hero, inventory: Item[] = cidade.inventory): EstadoNaCidade => ({
  ...cidade,
  map: [[E.celulaAtual(cidade) as CityCell]],
  cityMap: null,
  cityStart: null,
  pos: { x: 0, y: 0 },
  mapRows: 1,
  mapCols: 1,
  hero,
  inventory,
});

/** A cidade enxuta parada numa sala do tipo pedido. */
function naSalaDaCidade(tipo: string, hero: Hero = cidade.hero, inventory: Item[] = []): EstadoNaCidade {
  const sala = cidade.map.flat().find((c) => c.type === tipo);
  if (!sala) throw new Error(`a cidade de teste não tem ${tipo}`);
  return { ...enxuto(hero, inventory), map: [[sala]] };
}

/** A masmorra enxuta numa sala com este conteúdo. */
function naSalaDaMasmorra(celula: Partial<DungeonCell>, hero: Hero = cidade.hero, inventory: Item[] = [], o: Partial<EstadoNaMasmorra> = {}): EstadoNaMasmorra {
  const sala: DungeonCell = { ...(E.celulaAtual(masmorra) as DungeonCell), ...celula };
  return { ...masmorra, map: [[sala]], cityMap: null, cityStart: null, pos: { x: 0, y: 0 }, mapRows: 1, mapCols: 1, hero, inventory, ...o };
}

// ---------- estado ----------

constante('LINHAS_DO_MAPA', E.LINHAS_DO_MAPA);
constante('COLUNAS_DO_MAPA', E.COLUNAS_DO_MAPA);
constante('PRIMEIRO_ANDAR', E.PRIMEIRO_ANDAR);

for (const [dungeon, difficulty, floor] of [
  ['floresta', 'normal', 1],
  ['caverna', 'dificil', 37],
  ['torre', 'pesadelo', 100],
] as const) {
  caso(`andarDeForca: ${dungeon} ${difficulty} ${floor}`, 'andarDeForca', { masmorra: { dungeon, difficulty }, floor }, (a) => E.andarDeForca(a));
}

function retomar(nome: string, save: SaveCarregado, chamada: Chamada = {}): void {
  caso(`retomarSave: ${nome}`, 'retomarSave', { save }, (a, ctx) => E.retomarSave(a.save, ctx.rng, ctx.now), chamada);
}

retomar('save novo cai na cidade', saveNovo());
retomar('na cidade, noutra sala', E.andar(cidade, primeiraPorta(cidade)));
retomar('na cidade sem o ponto de partida', { ...E.andar(cidade, primeiraPorta(cidade)), cityStart: null });
const semGuilda = cidade.map.map((linha) => linha.map((c) => (c.type === 'guild' ? { ...c, type: 'normal' as const } : c)));
retomar('cidade de antes da Guilda', { ...cidade, map: semGuilda, cityMap: semGuilda });
const semAsDuas = semGuilda.map((linha) => linha.map((c) => (c.type === 'encantadora' ? { ...c, type: 'normal' as const } : c)));
retomar('cidade de antes da Guilda e da Encantadora', { ...cidade, map: semAsDuas, cityMap: semAsDuas });
retomar('na masmorra', E.andar(masmorra, primeiraPorta(masmorra)));
retomar('na masmorra sem mapa', saveNovo({}, { mapMode: 'dungeon', floor: 3 }), { rng: { seed: 3 }, now: AGORA });
retomar('na masmorra com o mapa vazio', { ...masmorra, map: [] }, { rng: { seed: 4 }, now: AGORA });
retomar('na masmorra sem posição', { ...masmorra, pos: null }, { rng: { seed: 6 }, now: AGORA });
retomar('save de antes das masmorras e dos ids', {
  hero: heroi({ classe: 'mago', nomeDaClasse: 'Mago' }),
  floor: 23,
  mapMode: 'dungeon',
  map: masmorra.map,
  pos: masmorra.pos,
});
retomar('com tutorial', saveNovo({}, { tutorial: { enabled: true, completed: { move: true }, rewarded: false } }));
retomar(
  'masmorra e progresso estranhos',
  saveNovo({}, {
    masmorra: { dungeon: 'xyz', difficulty: 3 } as never,
    progresso: { cleared: ['floresta:normal', 'nada', 'floresta:normal'], totems: { 'caverna:normal': [40, 20, '60', 20, 7] } } as never,
  }),
);

caso('entrarNaCidade: save novo', 'entrarNaCidade', { save: saveNovo() }, (a) => E.entrarNaCidade(a.save));
caso('entrarNaCidade: vindo da masmorra', 'entrarNaCidade', { save: E.andar(masmorra, primeiraPorta(masmorra)) }, (a) => E.entrarNaCidade(a.save));

function entrar(nome: string, estado: EstadoNaCidade, semente: number, andar?: number, masmorraDaVez?: DungeonRun): void {
  caso(
    `entrarNaMasmorra: ${nome}`,
    'entrarNaMasmorra',
    { estado, masmorra: masmorraDaVez, andar },
    (a, ctx) => E.entrarNaMasmorra(a.estado, ctx.rng, a.masmorra, a.andar, ctx.now),
    { rng: { seed: semente }, now: AGORA },
  );
}

entrar('andar 1', cidade, 7);
entrar('andar 1, outra semente', cidade, 8);
entrar('caverna difícil pelo totem do 20', cidade, 21, 20, { dungeon: 'caverna', difficulty: 'dificil' });

const mestre = naCidade(saveNovo({ extra: { masteryBattles: E.masteryBattlesFor(4) } }));
const comProfessor = sementeOnde((r) => r < 0.1);
if (!naMasmorra(mestre, comProfessor, 30).map.some((l) => l.some((c) => c.type === 'teacher'))) throw new Error('o professor de teste não apareceu');
entrar('professor aparece', mestre, comProfessor, 30);
entrar('professor não aparece', mestre, sementeOnde((r) => r >= 0.1), 30);
entrar('professor garantido no último andar da faixa', mestre, sementeOnde((r) => r >= 0.1), 50);
const veterano = naCidade(saveNovo({ extra: { masteryBattles: E.masteryBattlesFor(8), teachersMet: 1 } }));
entrar('segundo professor', veterano, sementeOnde((r) => r < 0.25), 76);
entrar('aprendiz não encontra professor', naCidade(saveNovo({ classe: null, extra: { masteryBattles: 300 } })), 30, 30);

// No app, o andar de entrada pode ter item com material (pelo totem do 60, que o portão já conferiu).
caso('entrarNaMasmorra: no app, pelo andar 60', 'entrarNaMasmorra', { estado: cidade, andar: 60, app: true }, (a, ctx) =>
  E.entrarNaMasmorra(a.estado, ctx.rng, undefined, a.andar, ctx.now, a.app),
{ rng: { seed: 61 }, now: AGORA });

caso('voltarParaCidade: da masmorra', 'voltarParaCidade', { estado: E.andar(masmorra, primeiraPorta(masmorra)) }, (a) => E.voltarParaCidade(a.estado));

function descer(nome: string, estado: EstadoNaMasmorra, semente: number): void {
  caso(`descerEscada: ${nome}`, 'descerEscada', { estado }, (a, ctx) => E.descerEscada(a.estado, ctx.rng, ctx.now), { rng: { seed: semente }, now: AGORA });
}

descer('andar comum', masmorra, 11);
descer('chefe vivo sela a escada', andarDoChefe, 12);
descer('chefe vencido', comChefe(andarDoChefe, true), 13);
descer('fundo da masmorra com o chefe vivo', fundo, 14);
descer('fundo da masmorra', comChefe(fundo, true), 15);

caso('avancarAndar: depois do chefe', 'avancarAndar', { estado: comChefe(andarDoChefe, true) }, (a, ctx) => E.avancarAndar(a.estado, ctx.rng, ctx.now), {
  rng: { seed: 16 },
  now: AGORA,
});

// No app, o andar de baixo pode ter item com material.
const andar71 = E.entrarNaMasmorra(cidade, E.seededRng(71), undefined, 71, relogio);
for (const semente of [72, 73]) {
  caso(`descerEscada: no app, do andar 71, semente ${semente}`, 'descerEscada', { estado: andar71, app: true }, (a, ctx) => E.descerEscada(a.estado, ctx.rng, ctx.now, a.app), {
    rng: { seed: semente },
    now: AGORA,
  });
}
caso('avancarAndar: no app, depois do chefe', 'avancarAndar', { estado: comChefe(andarDoChefe, true), app: true }, (a, ctx) => E.avancarAndar(a.estado, ctx.rng, ctx.now, a.app), {
  rng: { seed: 16 },
  now: AGORA,
});

caso('temChefeVivo: chefe vivo', 'temChefeVivo', { estado: andarDoChefe }, (a) => E.temChefeVivo(a.estado));
caso('temChefeVivo: chefe vencido', 'temChefeVivo', { estado: comChefe(andarDoChefe, true) }, (a) => E.temChefeVivo(a.estado));
caso('temChefeVivo: andar sem chefe', 'temChefeVivo', { estado: masmorra }, (a) => E.temChefeVivo(a.estado));

// Leituras da grade, todas num caso só por estado (o estado é o que pesa).
for (const [nome, estado] of [
  ['cidade', cidade],
  ['masmorra', masmorra],
] as const) {
  caso(`celulaEm (pontos da grade): ${nome}`, 'celulaEm (pontos da grade)', { estado }, (a) =>
    [a.estado.pos, { x: 0, y: 0 }, { x: 5, y: 5 }, { x: 6, y: 2 }, { x: -1, y: 0 }, { x: 0, y: 9 }, { x: 2.5, y: 1 }].map((p) => E.celulaEm(a.estado, p)),
  );
  caso(`celulaAtual: ${nome}`, 'celulaAtual', { estado }, (a) => E.celulaAtual(a.estado));
  caso(`vizinhaEm e podeAndar (as quatro direções): ${nome}`, 'vizinhaEm e podeAndar (as quatro direções)', { estado }, (a) =>
    E.DIR_ORDER.map((d) => ({ direcao: d, vizinha: E.vizinhaEm(a.estado, d), pode: E.podeAndar(a.estado, d) })),
  );
  caso(`andar: ${nome}`, 'andar', { estado, direcao: primeiraPorta(estado) }, (a) => E.andar(a.estado, a.direcao));
  caso(`andar (parede devolve o mesmo estado): ${nome}`, 'andar (parede devolve o mesmo estado)', diantedaParede(estado), (a) =>
    E.andar(a.estado, a.direcao) === a.estado,
  );
  caso(`revelar: ${nome}`, 'revelar', { estado, posicao: { x: 5, y: 0 } }, (a) => E.revelar(a.estado, a.posicao));
}
caso('vizinhaEm e podeAndar (as quatro direções): sala sem portas', 'vizinhaEm e podeAndar (as quatro direções)', { estado: { ...masmorra, pos: { x: 9, y: 9 } } }, (a) =>
  E.DIR_ORDER.map((d) => ({ direcao: d, vizinha: E.vizinhaEm(a.estado, d), pode: E.podeAndar(a.estado, d) })),
);
caso('substituirCelulaAtual: baú aberto na masmorra', 'substituirCelulaAtual', { estado: masmorra, celula: { ...E.celulaAtual(masmorra)!, collected: true } }, (a) =>
  E.substituirCelulaAtual(a.estado as EstadoNaMasmorra, a.celula as DungeonCell),
);
caso('substituirCelulaAtual: estoque na cidade', 'substituirCelulaAtual', { estado: cidade, celula: { ...E.celulaAtual(cidade)!, forSale: [item('espada')] } }, (a) =>
  E.substituirCelulaAtual(a.estado as EstadoNaCidade, a.celula as CityCell),
);

// ---------- tutorial ----------

constante('PASSOS', E.PASSOS);
constante('GUIAS', E.GUIAS);

const tutorial = (completed: Record<string, boolean>, o: Partial<Tutorial> = {}): Tutorial => ({ enabled: true, completed, rewarded: false, ...o });
const todosMenos = (id: string): Record<string, boolean> => Object.fromEntries(E.PASSOS.filter((p) => p.id !== id).map((p) => [p.id, true]));
const comTutorial = (t: Tutorial): EstadoNaCidade => ({ ...enxuto(), tutorial: t });

caso('tutorialDe: save sem tutorial', 'tutorialDe', { estado: enxuto() }, (a) => E.tutorialDe(a.estado));
caso('tutorialDe: com tutorial', 'tutorialDe', { estado: comTutorial(tutorial({ move: true }, { enabled: false })) }, (a) => E.tutorialDe(a.estado));

for (const [nome, t] of [
  ['nenhum', tutorial({})],
  ['três', tutorial({ move: true, shop: true, npc: true })],
  ['todos', tutorial(todosMenos(''))],
  ['chave desconhecida e falso', tutorial({ xyz: true, move: false, guild: true })],
] as const) {
  caso(`concluidos: ${nome}`, 'concluidos', { tutorial: t }, (a) => E.concluidos(a.tutorial));
}

function marcarPasso(nome: string, estado: EstadoDoJogo, id: string, chamada: Chamada = {}): void {
  caso(`marcar: ${nome}`, 'marcar', { estado, id }, (a, ctx) => E.marcar(a.estado, a.id as PassoDoTutorial, ctx.rng, ctx.now), chamada);
}

marcarPasso('primeiro passo', enxuto(), 'move');
marcarPasso('passo repetido', comTutorial(tutorial({ move: true })), 'move');
marcarPasso('tutorial desligado', comTutorial(tutorial({}, { enabled: false })), 'shop');
marcarPasso('passo desconhecido', comTutorial(tutorial({ move: true })), 'xyz');
marcarPasso('último passo dá o prêmio', comTutorial(tutorial(todosMenos('combat'))), 'combat', { rng: { seed: 17 }, now: AGORA });
marcarPasso('último passo de quem já ganhou o prêmio', comTutorial(tutorial(todosMenos('guild'), { rewarded: true })), 'guild');
marcarPasso('último passo com chave a mais', comTutorial(tutorial({ ...todosMenos('npc'), xyz: true })), 'npc', { rng: { seed: 18 }, now: AGORA });

// ---------- apresentação, narrador e neblina ----------
//
// A apresentação devolve funções; o caso de cola as aplica a todas as salas
// da grade. O narrador e a neblina também vão sala por sala, num caso só
// por estado.

const masmorraGasta: EstadoNaMasmorra = {
  ...masmorra,
  map: masmorra.map.map((linha) =>
    linha.map((c) => {
      if (c.type === 'treasure') return { ...c, collected: true };
      if (c.type === 'monster') return { ...c, beaten: true };
      if (c.type === 'event') return { ...c, resolved: true };
      return c;
    }),
  ),
};

/** Duas salas andadas e uma revelada de longe: visitada, revelada, silhueta e inexplorada na mesma grade. */
const masmorraAndada: EstadoNaMasmorra = (() => {
  const um = E.andar(masmorra, primeiraPorta(masmorra));
  const dois = E.andar(um, primeiraPorta(um));
  const longe = dois.map.flat().find((c) => c.type !== 'void' && !c.visited && !E.isKnown(dois.map, c, dois.mapCols, dois.mapRows));
  return longe ? E.revelar(dois, { x: longe.x, y: longe.y }) : dois;
})();

const salasDe = (estado: EstadoDoJogo): CelulaDoMapa[] => (estado.map as CelulaDoMapa[][]).flat();

for (const [nome, estado] of [
  ['cidade', cidade],
  ['masmorra', masmorra],
  ['masmorra com salas gastas', masmorraGasta],
  ['andar de chefe', andarDoChefe],
  ['caverna difícil', naMasmorra(cidade, 22, 12, { dungeon: 'caverna', difficulty: 'dificil' })],
] as const) {
  caso(`apresentacaoDe (todas as salas): ${nome}`, 'apresentacaoDe (todas as salas)', { estado }, (a) => {
    const visual = E.apresentacaoDe(a.estado);
    return {
      lugar: visual.lugar,
      legenda: visual.legenda,
      salas: salasDe(a.estado).map((c) => ({
        x: c.x,
        y: c.y,
        icone: visual.icone(c),
        descricao: visual.descricao(c),
        textoDeEntrada: visual.textoDeEntrada(c),
        rotulo: visual.rotulo(c),
        gasta: visual.gasta(c),
      })),
    };
  });
}

for (const [nome, estado] of [
  ['cidade', cidade],
  ['masmorra', masmorra],
  ['masmorra andada e revelada', masmorraAndada],
] as const) {
  caso(`narrar (todas as salas): ${nome}`, 'narrar (todas as salas)', { estado }, (a) =>
    salasDe(a.estado).map((c) => ({ x: c.x, y: c.y, narracao: E.narrar({ ...a.estado, pos: { x: c.x, y: c.y } } as EstadoDoJogo) })),
  );
  caso(`estadoDaSala (toda a grade): ${nome}`, 'estadoDaSala (toda a grade)', { estado }, (a) =>
    salasDe(a.estado).map((c) => E.estadoDaSala(a.estado.map as CelulaDoMapa[][], c, a.estado.mapCols, a.estado.mapRows)),
  );
}
caso('narrar: fora da grade', 'narrar', { estado: { ...cidade, pos: { x: 9, y: 9 } } }, (a) => E.narrar(a.estado));

for (const estado of ['vazia', 'inexplorada', 'silhueta', 'revelada', 'visitada'] as const) {
  caso(`sabeOTipo: ${estado}`, 'sabeOTipo', { estado }, (a) => E.sabeOTipo(a.estado));
}

// ---------- cartão, maestria e diário ----------

const [fraquezaA, fraquezaB] = E.DEBUFFS as [Hero['debuff'], Hero['debuff']];
for (const [nome, debuff] of [
  ['pelo id', { ...fraquezaA }],
  ['só o nome (save antigo)', { name: fraquezaB.name, icon: '?', desc: 'texto antigo' }],
  ['id desconhecido, nome do catálogo', { id: 'xyz', name: fraquezaA.name, icon: '?', desc: 'texto antigo' }],
  ['id e nome desconhecidos', { id: 'xyz', name: 'Maldição Velha', icon: '💀', desc: 'algo que mudou' }],
  ['sem ícone nem texto', { id: 'xyz', name: 'Sem Nada' }],
  ['vazia', {}],
] as const) {
  caso(`fraquezaNoCartao: ${nome}`, 'fraquezaNoCartao', { hero: { debuff } }, (a) => E.fraquezaNoCartao(a.hero as never));
}
caso('fraquezaNoCartao: sem fraqueza', 'fraquezaNoCartao', { hero: {} }, (a) => E.fraquezaNoCartao(a.hero as never));

const tresPoderes = E.POWERS.slice(0, 3).map((p) => p.id);
for (const [nome, hero] of [
  ['guerreiro com três poderes', heroi({ classe: 'guerreiro', extra: { powerIds: tresPoderes } })],
  ['mana instável', heroi({ classe: 'mago', debuff: 'mana_instavel', extra: { powerIds: tresPoderes } })],
  ['aprendiz sem poderes', heroi({ classe: null })],
  ['save antigo, só os nomes', heroi({ classe: 'clerigo', extra: { powerIds: undefined, powerNames: E.POWERS.slice(3, 5).map((p) => p.name) } })],
] as const) {
  caso(`poderesNoCartao: ${nome}`, 'poderesNoCartao', { hero }, (a) => E.poderesNoCartao(a.hero));
}

for (const classe of [...CLASSES_IDS, null]) {
  const nomeDaClasse = classe ? E.classById(classe)!.name : E.APPRENTICE.name;
  caso(`armasDaMaestria: ${classe ?? 'aprendiz'}`, 'armasDaMaestria', { hero: { ...(classe ? { classId: classe } : {}), className: nomeDaClasse } }, (a) =>
    E.armasDaMaestria(a.hero),
  );
}
caso('armasDaMaestria: save antigo, só o nome', 'armasDaMaestria', { hero: { className: E.classById('arqueiro')!.name } }, (a) => E.armasDaMaestria(a.hero));

const armaDeOutraClasse = E.templatesByCategory('arma').find((t) => !E.masteryWeapons(E.classById('guerreiro')!).includes(t.id))!.id;
const guerreiroCom = (batalhas: number, o: HeroiDeTeste = {}): Hero => heroi({ classe: 'guerreiro', ...o, extra: { masteryBattles: batalhas } });
for (const [nome, hero] of [
  ['aprendiz', heroi({ classe: null })],
  ['nível 0', guerreiroCom(3)],
  ['nível 3 com a arma da classe', guerreiroCom(E.masteryBattlesFor(3) + 5)],
  ['nível 3 com outra arma', guerreiroCom(E.masteryBattlesFor(3) + 5, { arma: armaDeOutraClasse })],
  ['nível 3 de mãos vazias', guerreiroCom(E.masteryBattlesFor(3) + 5, { arma: null })],
  ['no teto', guerreiroCom(E.masteryBattlesFor(E.MASTERY_MAX_LEVEL) + 100)],
  ['bardo', heroi({ classe: 'bardo', extra: { masteryBattles: 40 } })],
] as const) {
  caso(`maestriaNoCartao: ${nome}`, 'maestriaNoCartao', { hero }, (a) => E.maestriaNoCartao(a.hero));
}
for (const [nome, hero, nivel] of [
  ['guerreiro no 3', guerreiroCom(E.masteryBattlesFor(3)), 3],
  ['bardo no 10', heroi({ classe: 'bardo' }), 10],
  ['save antigo, só o nome', heroi({ classe: 'mago', nomeDaClasse: 'Mago' }), 2],
] as const) {
  caso(`maestriaSubiu: ${nome}`, 'maestriaSubiu', { hero, nivel }, (a) => E.maestriaSubiu(a.hero, a.nivel));
}

constante('LIMITE_DO_DIARIO', E.LIMITE_DO_DIARIO);
const nota = (n: number) => ({ icone: '📜', titulo: `Nota ${n}`, texto: `Aconteceu a coisa ${n}.` });
const diarioCom = (n: number) => Array.from({ length: n }, (_, i) => ({ id: n - i, ...nota(n - i) }));
for (const [nome, diario, entrada] of [
  ['diário vazio', [], nota(1)],
  ['com duas anotações', diarioCom(2), nota(3)],
  ['no limite', diarioCom(E.LIMITE_DO_DIARIO), nota(E.LIMITE_DO_DIARIO + 1)],
  ['id da primeira fora de ordem', [{ id: 7, ...nota(7) }, { id: 9, ...nota(9) }], nota(10)],
] as const) {
  caso(`anotar: ${nome}`, 'anotar', { diario, entrada }, (a) => E.anotar(a.diario as never, a.entrada));
}

// ---------- andar na sala ----------

constante('MS_POR_PASSO', E.MS_POR_PASSO);
constante('MAX_PASSOS_POR_QUADRO', E.MAX_PASSOS_POR_QUADRO);
constante('ID_DO_CONTEUDO', E.ID_DO_CONTEUDO);
constante('PARADO', E.PARADO);

const conteudoDaSala = { id: E.ID_DO_CONTEUDO, ...E.CONTENT_TILE };
for (const [nome, portas, objetos] of [
  ['só o conteúdo', { N: true, S: true }, true],
  ['sala vazia', { E: true }, false],
  ['com extras', { N: true, W: true }, [conteudoDaSala, { id: 'extra-0', col: 1, row: 1 }, { id: 'extra-1', col: 7, row: 5 }]],
  ['lista vazia', { S: true }, []],
] as const) {
  caso(`plantaDaSala: ${nome}`, 'plantaDaSala', { portas, objetos }, (a) => E.plantaDaSala(a.portas, a.objetos as boolean | RoomObject[]));
}
for (const [nome, portas, objetos, masmorra] of [
  ['na Caverna, só o conteúdo', { N: true, S: true, E: true, W: true }, true, 'caverna'],
  ['na Caverna, com extras', { N: true, W: true }, [conteudoDaSala, { id: 'extra-0', col: 1, row: 2 }, { id: 'extra-1', col: 7, row: 6 }], 'caverna'],
  ['na Floresta, sala vazia', { E: true }, false, 'floresta'],
] as const) {
  caso(`plantaDaSala: ${nome}`, 'plantaDaSala', { portas, objetos, masmorra }, (a) => E.plantaDaSala(a.portas, a.objetos as boolean | RoomObject[], a.masmorra));
}

for (const [sobra, decorridoMs] of [
  [0, 16],
  [0, 17],
  [10, 30],
  [5, 500],
  [0, -40],
  [16.5, 0.2],
  [0, 100],
]) {
  caso(`passosDoQuadro: sobra ${sobra}, ${decorridoMs} ms`, 'passosDoQuadro', { sobra, decorridoMs }, (a) => E.passosDoQuadro(a.sobra, a.decorridoMs));
}

for (const teclas of [[], ['N'], ['N', 'E'], ['N', 'S'], ['W', 'W'], ['S', 'E', 'W']] as Direction[][]) {
  caso(`vetorDasTeclas: [${teclas.join(', ')}]`, 'vetorDasTeclas', { teclas }, (a) => E.vetorDasTeclas(a.teclas));
}
caso('entradaCombinada: o joystick manda', 'entradaCombinada', { teclas: ['N'] as Direction[], joystick: { x: 0.5, y: -0.25 } }, (a) =>
  E.entradaCombinada(a.teclas, a.joystick),
);
caso('entradaCombinada: joystick parado, valem as teclas', 'entradaCombinada', { teclas: ['S', 'W'] as Direction[], joystick: { x: 0, y: 0 } }, (a) =>
  E.entradaCombinada(a.teclas, a.joystick),
);

// O extra fica na diagonal que sai do meio da sala, pra o herói encostar nele andando nela.
const plantaDeTeste = E.plantaDaSala({ N: true, S: true, E: true }, [conteudoDaSala, { id: 'extra-0', col: 2, row: 3 }]);
const noMeio = E.roomArrival(null);
const colado = E.andarNoQuadro(plantaDeTeste, noMeio, { x: 0, y: -1 }, 40, null).walker;
for (const [nome, walker, entrada, passos, tocandoAntes] of [
  ['parado', noMeio, E.PARADO, 3, null],
  ['nenhum passo', noMeio, { x: 1, y: 0 }, 0, null],
  ['sobe e encosta no conteúdo', noMeio, { x: 0, y: -1 }, 40, null],
  ['já encostado não encosta de novo', colado, { x: 0, y: -1 }, 5, E.ID_DO_CONTEUDO],
  ['sai de perto e solta o encosto', colado, { x: 0, y: 1 }, 20, E.ID_DO_CONTEUDO],
  ['atravessa a porta do sul', E.roomArrival('N'), { x: 0, y: 1 }, 60, null],
  ['diagonal até a parede', noMeio, { x: 1, y: 1 }, 60, null],
  ['encosta no extra', noMeio, { x: -1, y: -1 }, 80, null],
  ['meio joystick pra leste, a porta puxa pro vão', { x: 6000, y: 3760, facing: 'E' }, { x: 0.5, y: 0 }, 200, null],
] as const) {
  caso(`andarNoQuadro: ${nome}`, 'andarNoQuadro', { planta: plantaDeTeste, walker, entrada, passos, tocandoAntes }, (a) =>
    E.andarNoQuadro(a.planta, a.walker, a.entrada, a.passos, a.tocandoAntes),
  );
}

// ---------- extras da sala (o lado do jogo) ----------

constante('ID_DO_BAU_SECRETO', E.ID_DO_BAU_SECRETO);
for (const indice of [0, 3, 12]) caso(`idDoExtra: ${indice}`, 'idDoExtra', { indice }, (a) => E.idDoExtra(a.indice));
for (const id of ['extra-0', 'extra-3', 'extra-12', 'conteudo', 'bau-secreto', 'extra-x', 'extra-1.5', 'extra-', 'extra- 2', 'extra-1e1']) {
  caso(`indiceDoExtra: ${id}`, 'indiceDoExtra', { id }, (a) => E.indiceDoExtra(a.id));
}

const extrasNovos: DungeonExtra[] = [
  { kind: 'chest', col: 1, row: 1, item: item('pot_vida'), used: false },
  { kind: 'chest', col: 2, row: 1, item: null, used: false },
  { kind: 'pot', col: 6, row: 1, used: false },
  { kind: 'sign', col: 7, row: 1 },
  { kind: 'crack', col: 4, row: 6, side: 'S', used: false, secretItem: item('colar_forca', 'incomum', 3), secretCollected: false },
];
const extrasUsados = extrasNovos.map((e) => ({ ...e, used: true, ...(e.kind === 'crack' ? { secretCollected: true } : {}) }));
const paredeAberta = extrasNovos.map((e) => (e.kind === 'crack' ? { ...e, used: true } : e));
const salaCom = (extras: DungeonExtra[] | undefined, o: Partial<DungeonCell> = {}): DungeonCell => ({ ...(E.celulaAtual(masmorra) as DungeonCell), extras, ...o });
/** A placa lê o andar inteiro (escada, parede oca, chefe); o resto dos extras só olha a sala. */
const naSalaInteira = (celula: DungeonCell): EstadoNaMasmorra => E.substituirCelulaAtual(masmorra, celula);
const naSala = (celula: DungeonCell): EstadoNaMasmorra => naSalaDaMasmorra(celula);

for (const [nome, celula] of [
  ['sala com extras', salaCom(extrasNovos)],
  ['sala sem extras', salaCom(undefined)],
  ['sala da cidade', E.celulaAtual(cidade)],
  ['nenhuma sala', null],
] as const) {
  caso(`extrasDe: ${nome}`, 'extrasDe', { celula }, (a) => E.extrasDe(a.celula));
  caso(`passagemSecreta: ${nome}`, 'passagemSecreta', { celula }, (a) => E.passagemSecreta(a.celula));
  caso(`descricaoDosExtras: ${nome}`, 'descricaoDosExtras', { celula }, (a) => E.descricaoDosExtras(a.celula));
}
for (const [nome, extras] of [
  ['extras usados', extrasUsados],
  ['parede aberta', paredeAberta],
] as const) {
  caso(`passagemSecreta: ${nome}`, 'passagemSecreta', { celula: salaCom(extras) }, (a) => E.passagemSecreta(a.celula));
  caso(`descricaoDosExtras: ${nome}`, 'descricaoDosExtras', { celula: salaCom(extras) }, (a) => E.descricaoDosExtras(a.celula));
}
const doisIguais: [string, DungeonExtra[]][] = [
  ['dois vasos inteiros', [{ kind: 'pot', col: 1, row: 1, used: false }, { kind: 'pot', col: 7, row: 5, used: false }]],
  ['dois vasos quebrados', [{ kind: 'pot', col: 1, row: 1, used: true }, { kind: 'pot', col: 7, row: 5, used: true }]],
  ['duas placas', [{ kind: 'sign', col: 1, row: 1 }, { kind: 'sign', col: 7, row: 5 }]],
  ['vaso inteiro e vaso quebrado', [{ kind: 'pot', col: 1, row: 1, used: false }, { kind: 'pot', col: 7, row: 5, used: true }]],
  ['baú aberto e baú fechado', [{ kind: 'chest', col: 1, row: 1, item: null, used: true }, { kind: 'chest', col: 7, row: 5, item: null, used: false }]],
  ['vaso, placa e outro vaso', [{ kind: 'pot', col: 1, row: 1, used: false }, { kind: 'sign', col: 2, row: 1 }, { kind: 'pot', col: 7, row: 5, used: false }]],
];
for (const [nome, extras] of doisIguais) {
  caso(`descricaoDosExtras: ${nome}`, 'descricaoDosExtras', { celula: salaCom(extras) }, (a) => E.descricaoDosExtras(a.celula));
}
for (const [nome, celula, temConteudo] of [
  ['extras novos, com conteúdo', salaCom(extrasNovos), true],
  ['extras usados, sem conteúdo', salaCom(extrasUsados), false],
  ['parede aberta', salaCom(paredeAberta), true],
  ['sala sem extras', salaCom(undefined), true],
  ['nenhuma sala', null, false],
] as const) {
  caso(`objetosDaSala: ${nome}`, 'objetosDaSala', { celula, temConteudo }, (a) => E.objetosDaSala(a.celula, a.temConteudo));
}
// Os cantos de cima dos extras são parede na Caverna: o baú de (1,1) e a placa de (7,1) descem uma casa.
for (const [nome, celula, masmorra] of [
  ['na Caverna, extras novos', salaCom(extrasNovos), 'caverna'],
  ['na Caverna, extras usados', salaCom(extrasUsados), 'caverna'],
  ['na Floresta, extras novos', salaCom(extrasNovos), 'floresta'],
  ['na Torre, extras novos', salaCom(extrasNovos), 'torre'],
] as const) {
  caso(`objetosDaSala: ${nome}`, 'objetosDaSala', { celula, temConteudo: true, masmorra }, (a) => E.objetosDaSala(a.celula, a.temConteudo, a.masmorra));
}
for (const lado of E.DIR_ORDER) caso(`plantaDaSalaSecreta: parede ${lado}`, 'plantaDaSalaSecreta', { lado }, (a) => E.plantaDaSalaSecreta(a.lado));
for (const lado of ['N', 'W'] as const) {
  caso(`plantaDaSalaSecreta: parede ${lado}, na Torre`, 'plantaDaSalaSecreta', { lado, masmorra: 'torre' }, (a) => E.plantaDaSalaSecreta(a.lado, a.masmorra));
}
caso('objetosDaSala: na Torre, parede aberta', 'objetosDaSala', { celula: salaCom(paredeAberta), temConteudo: true, masmorra: 'torre' }, (a) => E.objetosDaSala(a.celula, a.temConteudo, a.masmorra));
for (const [nome, portas] of [['sem portas', {}], ['norte e leste', { N: true, E: true }]] as const) {
  caso(`plantaDaSala: na Torre, ${nome}`, 'plantaDaSala', { portas, objetos: true, masmorra: 'torre' }, (a) => E.plantaDaSala(a.portas, a.objetos, a.masmorra));
}
for (const lado of ['N', 'E'] as const) {
  caso(`plantaDaSalaSecreta: parede ${lado}, na Caverna`, 'plantaDaSalaSecreta', { lado, masmorra: 'caverna' }, (a) => E.plantaDaSalaSecreta(a.lado, a.masmorra));
}
for (const [nome, celula, indice] of [
  ['baú cheio', salaCom(paredeAberta), 4],
  ['baú vazio', salaCom(extrasUsados), 4],
  ['extra que não é parede', salaCom(extrasNovos), 0],
  ['índice que não existe', salaCom(paredeAberta), 9],
  ['nenhuma sala', null, 0],
] as const) {
  caso(`textoDaSecreta: ${nome}`, 'textoDaSecreta', { celula, indice }, (a) => E.textoDaSecreta(a.celula, a.indice));
}

function tocar(nome: string, estado: EstadoNaMasmorra, indice: number, semente: number): void {
  caso(`tocarExtra: ${nome}`, 'tocarExtra', { estado, indice }, (a, ctx) => E.tocarExtra(a.estado, a.indice, ctx.rng), { rng: { seed: semente } });
}

tocar('baú com poção', naSala(salaCom(extrasNovos)), 0, 31);
tocar('baú com ouro', naSala(salaCom(extrasNovos)), 1, 32);
tocar('baú vazio', naSala(salaCom(extrasUsados)), 0, 33);
tocar('vaso', naSala(salaCom(extrasNovos)), 2, 34);
tocar('cacos', naSala(salaCom(extrasUsados)), 2, 35);
tocar('placa', naSalaInteira(salaCom(extrasNovos)), 3, 36);
tocar('parede rachada', naSala(salaCom(extrasNovos)), 4, 37);
tocar('passagem já aberta', naSala(salaCom(paredeAberta)), 4, 38);
tocar('índice que não existe', naSala(salaCom(extrasNovos)), 9, 39);
tocar('sala de monstro: baú antes de vencer', naSala(salaCom(extrasNovos, { type: 'monster', beaten: false })), 0, 40);
tocar('sala de monstro: placa antes de vencer', naSalaInteira(salaCom(extrasNovos, { type: 'monster', beaten: false })), 3, 41);
tocar('sala de monstro vencida: baú de ouro', naSala(salaCom(extrasNovos, { type: 'monster', beaten: true })), 1, 42);
tocar('sala de chefe: vaso antes de vencer', naSala(salaCom(extrasNovos, { type: 'boss' })), 2, 43);
tocar('baú de ouro na caverna difícil', { ...naSala(salaCom(extrasNovos)), masmorra: { dungeon: 'caverna', difficulty: 'dificil' }, floor: 12 }, 1, 44);

for (const [nome, extras, indice] of [
  ['primeira vez', paredeAberta, 4],
  ['já vazio', extrasUsados, 4],
  ['extra que não é parede', extrasNovos, 0],
  ['parede sem item escondido', extrasNovos.map((e) => (e.kind === 'crack' ? { ...e, used: true, secretItem: undefined } : e)), 4],
] as const) {
  caso(`abrirBauSecreto: ${nome}`, 'abrirBauSecreto', { estado: naSala(salaCom(extras as DungeonExtra[])), indice }, (a) => E.abrirBauSecreto(a.estado, a.indice));
}

// ---------- mochila e impacto ----------

const espadaNova = item('espada', 'raro', 4);
const escudo = item('escudo', 'comum', 5);
const machado = item('machado', 'incomum', 6);
const adaga = item('adaga', 'comum', 7);
const elmo = item('placas_elmo', 'comum', 8);
const anel = item('anel_som', 'raro', 9);
const pocaoDeVida = item('pot_vida', 'comum', 10);
const pocaoDeMana = item('pot_mana', 'comum', 11);
const pergaminho = item('pergaminho', 'comum', 12);
const minerio = item('minerio', 'comum', 13);

const mochilaCom = (hero: Hero, inventory: Item[]): Mochila => ({ estado: enxuto(hero, inventory), log: [] });
const guerreiro = heroi({ classe: 'guerreiro' });
const comMachado = heroi({ classe: 'guerreiro', arma: machado });
const comEscudo = heroi({ classe: 'guerreiro', equip: { secundaria: escudo } });
const ferido = heroi({ classe: 'guerreiro', extra: { hp: 20, mp: 3 } });
const tudoNaMochila = [espadaNova, escudo, machado, adaga, elmo, anel, pocaoDeVida, pocaoDeMana, pergaminho, minerio];

caso(
  'abrirMochila: marcas de equipado desencontradas',
  'abrirMochila',
  { estado: enxuto(guerreiro, [{ ...guerreiro.equip.arma!, equipped: false }, { ...anel, equipped: true }, pocaoDeVida]) },
  (a) => E.abrirMochila(a.estado),
);
caso('abrirMochila: tudo em dia', 'abrirMochila', { estado: enxuto(guerreiro, [pocaoDeVida]) }, (a) => E.abrirMochila(a.estado));

for (const peca of [espadaNova, escudo, anel, elmo, pocaoDeVida, pocaoDeMana, pergaminho, minerio]) {
  caso(`podeEquipar: ${peca.templateId}`, 'podeEquipar', { item: peca }, (a) => E.podeEquipar(a.item));
  caso(`podeUsar: ${peca.templateId}`, 'podeUsar', { item: peca }, (a) => E.podeUsar(a.item));
}
const grimorioNaMochila = item('grimorio', 'incomum', 14);
const deCajado = heroi({ classe: 'mago' });
for (const peca of [escudo, adaga, espadaNova, machado, anel, grimorioNaMochila]) {
  caso(`aceitaMaoSecundaria: ${peca.templateId}`, 'aceitaMaoSecundaria', { item: peca }, (a) => E.aceitaMaoSecundaria(a.item));
}
caso('slotDoItem: a arma na mão', 'slotDoItem', { estado: enxuto(guerreiro), item: guerreiro.equip.arma }, (a) => E.slotDoItem(a.estado, a.item!));
caso('slotDoItem: peça da mochila', 'slotDoItem', { estado: enxuto(guerreiro), item: anel }, (a) => E.slotDoItem(a.estado, a.item));

function naMochila(nome: string, fn: string, mochila: Mochila, extra: Record<string, unknown>, executar: (m: Mochila, a: Record<string, unknown>) => unknown): void {
  caso(`${fn}: ${nome}`, fn, { mochila, ...extra }, (a) => executar(a.mochila, a));
}

naMochila('espada nova na mão', 'equipar', mochilaCom(guerreiro, tudoNaMochila), { item: espadaNova }, (m, a) => E.equipar(m, a.item as Item));
naMochila('escudo na secundária', 'equipar', mochilaCom(guerreiro, tudoNaMochila), { item: escudo }, (m, a) => E.equipar(m, a.item as Item));
naMochila('adaga pedida na secundária', 'equipar', mochilaCom(guerreiro, tudoNaMochila), { item: adaga, slot: 'secundaria' }, (m, a) =>
  E.equipar(m, a.item as Item, a.slot as EquipSlot),
);
naMochila('machado de duas mãos larga o escudo', 'equipar', mochilaCom(comEscudo, tudoNaMochila), { item: machado }, (m, a) => E.equipar(m, a.item as Item));
naMochila('escudo com as duas mãos ocupadas', 'equipar', mochilaCom(comMachado, tudoNaMochila), { item: escudo }, (m, a) => E.equipar(m, a.item as Item));
naMochila('grimório ao lado do cajado', 'equipar', mochilaCom(deCajado, [grimorioNaMochila, escudo]), { item: grimorioNaMochila }, (m, a) => E.equipar(m, a.item as Item));
naMochila('escudo com o cajado nas duas mãos', 'equipar', mochilaCom(deCajado, [grimorioNaMochila, escudo]), { item: escudo }, (m, a) => E.equipar(m, a.item as Item));
naMochila('poção não vai', 'equipar', mochilaCom(guerreiro, tudoNaMochila), { item: pocaoDeVida }, (m, a) => E.equipar(m, a.item as Item));
naMochila('arma inicial fora da mochila volta pra ela', 'equipar', mochilaCom(guerreiro, [machado]), { item: machado }, (m, a) => E.equipar(m, a.item as Item));
naMochila('elmo e anel', 'equipar', mochilaCom(guerreiro, tudoNaMochila), { item: anel }, (m, a) => E.equipar(m, a.item as Item));

naMochila('a arma', 'desequipar', mochilaCom(guerreiro, [pocaoDeVida]), { slot: 'arma' }, (m, a) => E.desequipar(m, a.slot as EquipSlot));
naMochila('slot vazio', 'desequipar', mochilaCom(guerreiro, [pocaoDeVida]), { slot: 'elmo' }, (m, a) => E.desequipar(m, a.slot as EquipSlot));

naMochila('poção de vida ferido', 'usar', mochilaCom(ferido, [pocaoDeVida, pocaoDeMana]), { item: pocaoDeVida }, (m, a) => E.usar(m, a.item as Item));
naMochila('poção de mana', 'usar', mochilaCom(ferido, [pocaoDeVida, pocaoDeMana]), { item: pocaoDeMana }, (m, a) => E.usar(m, a.item as Item));
naMochila('poção de vida com a vida cheia', 'usar', mochilaCom(guerreiro, [pocaoDeVida]), { item: pocaoDeVida }, (m, a) => E.usar(m, a.item as Item));
naMochila('pergaminho', 'usar', mochilaCom(ferido, [pergaminho]), { item: pergaminho }, (m, a) => E.usar(m, a.item as Item));

for (const [nome, hero, peca] of [
  ['escudo com machado na mão', comMachado, escudo],
  ['adaga com machado na mão', comMachado, adaga],
  ['anel com machado na mão', comMachado, anel],
  ['escudo com espada na mão', guerreiro, escudo],
  ['o próprio machado', comMachado, machado],
  ['grimório com o cajado na mão', deCajado, grimorioNaMochila],
  ['grimório com machado na mão', comMachado, grimorioNaMochila],
] as const) {
  caso(`armaQueOcupaAsMaos: ${nome}`, 'armaQueOcupaAsMaos', { estado: enxuto(hero), item: peca }, (a) => E.armaQueOcupaAsMaos(a.estado, a.item));
}
naMochila('guarda o machado e põe o escudo', 'equiparNoLugarDaArma', mochilaCom(comMachado, tudoNaMochila), { item: escudo }, (m, a) =>
  E.equiparNoLugarDaArma(m, a.item as Item),
);
naMochila('sem arma de duas mãos, vai pra secundária', 'equiparNoLugarDaArma', mochilaCom(guerreiro, tudoNaMochila), { item: adaga }, (m, a) =>
  E.equiparNoLugarDaArma(m, a.item as Item),
);
naMochila('machado não vai na secundária', 'equiparNoLugarDaArma', mochilaCom(guerreiro, tudoNaMochila), { item: machado }, (m, a) =>
  E.equiparNoLugarDaArma(m, a.item as Item),
);

naMochila('peça da mochila', 'descartar', mochilaCom(guerreiro, tudoNaMochila), { item: minerio }, (m, a) => E.descartar(m, a.item as Item));
naMochila('peça vestida sai do slot', 'descartar', mochilaCom(comEscudo, [escudo, pocaoDeVida]), { item: escudo }, (m, a) => E.descartar(m, a.item as Item));
naMochila('peça que não está na mochila', 'descartar', mochilaCom(guerreiro, [pocaoDeVida]), { item: anel }, (m, a) => E.descartar(m, a.item as Item));

{
  // As runas na mochila: engastar (de graça) e tirar (com chance de quebrar), na arma guardada ou vestida.
  const fogo = E.criarRuna('fogo', 2, { rng: E.seededRng(5), now: relogio });
  const gelo = E.criarRuna('gelo', 3, { rng: E.seededRng(6), now: relogio });
  const comFogo: Item = { ...espadaNova, runas: [{ runa: 'fogo', tier: 1 }] };
  const vestindo = (arma: Item) => heroi({ classe: 'guerreiro', arma: { ...arma, equipped: true } });
  const engasta = (m: Mochila, a: Record<string, unknown>) => E.engastarRuna(m, a.arma as Item, a.runa as Item, a.indice as number | undefined);
  naMochila('na arma guardada', 'engastarRuna', mochilaCom(guerreiro, [espadaNova, fogo, gelo]), { arma: espadaNova, runa: fogo }, engasta);
  naMochila('na arma vestida', 'engastarRuna', mochilaCom(vestindo(espadaNova), [espadaNova, fogo]), { arma: espadaNova, runa: fogo }, engasta);
  naMochila('arma cheia, troca a do espaço 0', 'engastarRuna', mochilaCom(guerreiro, [comFogo, gelo]), { arma: comFogo, runa: gelo, indice: 0 }, engasta);
  naMochila('arma cheia, sem dizer qual', 'engastarRuna', mochilaCom(guerreiro, [comFogo, gelo]), { arma: comFogo, runa: gelo }, engasta);
  naMochila('a runa fora da mochila', 'engastarRuna', mochilaCom(guerreiro, [espadaNova]), { arma: espadaNova, runa: fogo }, engasta);
  naMochila('a arma que não está com o herói', 'engastarRuna', mochilaCom(guerreiro, [fogo]), { arma: espadaNova, runa: fogo }, engasta);
  naMochila('num escudo', 'engastarRuna', mochilaCom(guerreiro, [escudo, fogo]), { arma: escudo, runa: fogo }, engasta);
  naMochila('uma poção no lugar da runa', 'engastarRuna', mochilaCom(guerreiro, [espadaNova, pocaoDeVida]), { arma: espadaNova, runa: pocaoDeVida }, engasta);
  for (const [nome, mochila, arma, indice, sorteios] of [
    ['volta inteira', mochilaCom(guerreiro, [comFogo]), comFogo, 0, [0.9, 0.3]],
    ['quebra', mochilaCom(guerreiro, [comFogo]), comFogo, 0, [0.1]],
    ['da arma vestida', mochilaCom(vestindo(comFogo), [comFogo]), comFogo, 0, [0.9, 0.3]],
    ['espaço vazio', mochilaCom(guerreiro, [espadaNova]), espadaNova, 0, []],
    ['a arma que não está com o herói', mochilaCom(guerreiro, [pocaoDeVida]), comFogo, 0, []],
  ] as const) {
    caso(`tirarRuna: ${nome}`, 'tirarRuna', { mochila, arma, indice }, (a, ctx) => E.tirarRuna(a.mochila, a.arma, a.indice, ctx.rng, ctx.now), {
      rng: { sequence: [...sorteios] },
      now: AGORA,
    });
  }
  for (const [nome, arma, indice] of [
    ['tier I', comFogo, 0],
    ['tier III', { ...espadaNova, runas: [{ runa: 'gelo' as const, tier: 3 }] }, 0],
    ['espaço vazio', espadaNova, 0],
  ] as const) {
    caso(`chanceDeQuebrar: ${nome}`, 'chanceDeQuebrar', { arma, indice }, (a) => E.chanceDeQuebrar(a.arma as Item, a.indice));
  }
}

naMochila('com pontos', 'gastarPonto', mochilaCom(heroi({ classe: 'guerreiro', extra: { attrPoints: 2 } }), []), { chave: 'forca' }, (m, a) =>
  E.gastarPonto(m, a.chave as AttrKey),
);
naMochila('sem pontos', 'gastarPonto', mochilaCom(guerreiro, []), { chave: 'sabedoria' }, (m, a) => E.gastarPonto(m, a.chave as AttrKey));

const mago = heroi({ classe: 'mago' });
for (const [nome, hero, peca, slot] of [
  ['guardar a arma', guerreiro, guerreiro.equip.arma!, undefined],
  ['espada melhor', guerreiro, espadaNova, undefined],
  ['espada na mão do mago', mago, espadaNova, undefined],
  ['anel', guerreiro, anel, undefined],
  ['elmo', guerreiro, elmo, undefined],
  ['escudo com machado na mão', comMachado, escudo, undefined],
  ['adaga na secundária', guerreiro, adaga, 'secundaria'],
  ['poção', guerreiro, pocaoDeVida, undefined],
  ['minério', guerreiro, minerio, undefined],
] as const) {
  caso(`impactoDaPeca: ${nome}`, 'impactoDaPeca', { hero, item: peca, slotDesejado: slot }, (a) => E.impactoDaPeca(a.hero, a.item, a.slotDesejado));
}

// ---------- loja, quadro de missões, conversa, evento, professor, portão, guilda e totem ----------
//
// Os estados são enxutos sempre que a função só olha a sala atual: a sala do
// tipo pedido vai sozinha na grade.

// --- loja ---

const rico = heroi({ classe: 'guerreiro', extra: { gold: 5000 } });
const pobre = heroi({ classe: 'guerreiro', extra: { gold: 0 } });
const lojaDe = (kind: 'shop' | 'blacksmith', hero: Hero, inventory: Item[] = []) =>
  E.abrirLoja(naSalaDaCidade(kind, hero, inventory), kind, E.seededRng(50), relogio);

for (const [nome, estado, kind, semente] of [
  ['vendedor sem estoque sorteia', naSalaDaCidade('shop'), 'shop', 51],
  ['ferreiro sem estoque sorteia', naSalaDaCidade('blacksmith'), 'blacksmith', 52],
  ['vendedor com estoque guardado', lojaDe('shop', rico).estado, 'shop', 53],
] as const) {
  caso(`abrirLoja: ${nome}`, 'abrirLoja', { estado, kind }, (a, ctx) => E.abrirLoja(a.estado, a.kind, ctx.rng, ctx.now), { rng: { seed: semente }, now: AGORA });
}

const lojaRica = lojaDe('shop', rico, [espadaNova, { ...anel, equipped: true }, minerio]);
const peca0 = E.estoque(lojaRica)[0]!;
caso('estoque: vendedor', 'estoque', { loja: lojaRica }, (a) => E.estoque(a.loja));
caso('vendaveis: o equipado fica', 'vendaveis', { loja: lojaRica }, (a) => E.vendaveis(a.loja));
caso('precoDeCompra: sem desconto', 'precoDeCompra', { loja: lojaRica, item: peca0 }, (a) => E.precoDeCompra(a.loja, a.item));
caso('precoDeCompra: com desconto', 'precoDeCompra', { loja: { ...lojaRica, desconto: 0.2 }, item: peca0 }, (a) => E.precoDeCompra(a.loja, a.item));
caso('precoDeVenda: espada', 'precoDeVenda', { item: espadaNova }, (a) => E.precoDeVenda(a.item));
caso('precoDaRenovacao: primeira', 'precoDaRenovacao', { loja: lojaRica }, (a) => E.precoDaRenovacao(a.loja));
caso('precoDaRenovacao: terceira, na caverna difícil', 'precoDaRenovacao', {
  loja: { ...lojaRica, renovacoes: 2, estado: { ...lojaRica.estado, masmorra: { dungeon: 'caverna', difficulty: 'dificil' }, floor: 9 } },
}, (a) => E.precoDaRenovacao(a.loja));

for (const roll of [1, 10, 15, 20]) caso(`pechinchar: dado ${roll}`, 'pechinchar', { loja: lojaRica, roll }, (a) => E.pechinchar(a.loja, a.roll));
caso('pechinchar: só uma vez por visita', 'pechinchar', { loja: E.pechinchar(lojaRica, 20), roll: 1 }, (a) => E.pechinchar(a.loja, a.roll));

caso('comprar: com ouro', 'comprar', { loja: lojaRica, item: peca0 }, (a) => E.comprar(a.loja, a.item));
caso('comprar: com desconto', 'comprar', { loja: E.pechinchar(lojaRica, 20), item: peca0 }, (a) => E.comprar(a.loja, a.item));
const lojaPobre = lojaDe('shop', pobre);
caso('comprar: sem ouro', 'comprar', { loja: lojaPobre, item: E.estoque(lojaPobre)[0]! }, (a) => E.comprar(a.loja, a.item));
caso('vender: espada', 'vender', { loja: lojaRica, item: espadaNova }, (a) => E.vender(a.loja, a.item));

for (const [nome, loja, semente] of [
  ['com ouro', lojaRica, 54],
  ['a segunda, mais cara', { ...lojaRica, renovacoes: 1 }, 55],
  ['sem ouro', lojaPobre, 56],
  ['ferreiro', lojaDe('blacksmith', rico), 57],
] as const) {
  caso(`renovarEstoque: ${nome}`, 'renovarEstoque', { loja }, (a, ctx) => E.renovarEstoque(a.loja, ctx.rng, ctx.now), { rng: { seed: semente }, now: AGORA });
}

// A loja do app: o ferreiro, no fundo, vende peça no degrau 2 do material (e a renovação também).
for (const [nome, kind, semente] of [
  ['ferreiro do app no andar 80', 'blacksmith', 59],
  ['ferreiro do app no andar 80, outra semente', 'blacksmith', 60],
  ['vendedor do app', 'shop', 61],
] as const) {
  caso(`abrirLoja: ${nome}`, 'abrirLoja', { estado: { ...naSalaDaCidade(kind), floor: 80 }, kind, app: true }, (a, ctx) => E.abrirLoja(a.estado, a.kind, ctx.rng, ctx.now, a.app), {
    rng: { seed: semente },
    now: AGORA,
  });
}
const ferreiroDoApp = E.abrirLoja({ ...naSalaDaCidade('blacksmith', rico), floor: 80 }, 'blacksmith', E.seededRng(62), relogio, true);
caso('renovarEstoque: ferreiro do app', 'renovarEstoque', { loja: ferreiroDoApp }, (a, ctx) => E.renovarEstoque(a.loja, ctx.rng, ctx.now), { rng: { seed: 63 }, now: AGORA });

const ferreiro = lojaDe('blacksmith', rico, [espadaNova, minerio, item('essencia'), item('pedra_protecao')]);
for (const [nome, loja, materialId, semente] of [
  ['com minério', ferreiro, 'minerio', 58],
  ['com essência', ferreiro, 'essencia', 59],
  ['com outra semente', ferreiro, 'minerio', 60],
  ['sem o material', ferreiro, 'catalisador_mitico', 61],
  ['material que não existe', ferreiro, 'xyz', 62],
  ['sem ouro', lojaDe('blacksmith', pobre, [espadaNova, minerio]), 'minerio', 63],
] as const) {
  caso(`reforjar: ${nome}`, 'reforjar', { loja, item: espadaNova, materialId }, (a, ctx) => E.reforjar(a.loja, a.item, a.materialId, ctx.rng), {
    rng: { seed: semente },
  });
}

// --- quadro de missões ---

const quadroVazio = naSalaDaCidade('questboard', guerreiro);
caso('abrirQuadro: quadro vazio ganha missões', 'abrirQuadro', { estado: quadroVazio }, (a, ctx) => E.abrirQuadro(a.estado, ctx.rng, ctx.now), { rng: { seed: 64 }, now: AGORA });
const quadro = E.abrirQuadro(quadroVazio, E.seededRng(64), relogio);
caso('abrirQuadro: com missões, não sorteia', 'abrirQuadro', { estado: quadro.estado }, (a, ctx) => E.abrirQuadro(a.estado, ctx.rng, ctx.now), { rng: { seed: 65 }, now: AGORA });
caso('missoes: as do quadro', 'missoes', { quadro }, (a) => E.missoes(a.quadro));
const [missaoA, missaoB] = quadro.estado.quests as [Quest, Quest];
const concluida = { ...quadro, estado: { ...quadro.estado, quests: [{ ...missaoA, progress: missaoA.target, done: true }, missaoB] } };
const perto = heroi({ classe: 'guerreiro', extra: { xp: E.xpForLevel(1) - 1 } });
for (const [nome, q, id, semente] of [
  ['concluída', concluida, missaoA.id, 66],
  ['concluída, sobe de nível', { ...concluida, estado: { ...concluida.estado, hero: perto } }, missaoA.id, 67],
  ['ainda aberta', concluida, missaoB.id, 68],
  ['que não existe', concluida, 'q_nada', 69],
] as const) {
  caso(`resgatar: ${nome}`, 'resgatar', { quadro: q, questId: id }, (a, ctx) => E.resgatar(a.quadro, a.questId, ctx.rng, ctx.now), { rng: { seed: semente }, now: AGORA });
}

// --- conversa com NPC ---

const npc = (service: string, o: Record<string, unknown> = {}) => ({
  name: 'Erma',
  role: 'Vidente',
  service,
  icon: '🔮',
  lines: ['Bem-vindo, viajante.', 'O caminho adiante é escuro.'],
  serviceUsed: false,
  ...o,
});
const naMasmorraComNpc = (n: unknown, hero: Hero = guerreiro, inventory: Item[] = [], party: Companion[] = []) =>
  naSalaDaMasmorra({ type: 'npc', npc: n as DungeonCell['npc'] }, hero, inventory, { party });

caso('abrirDialogo: NPC da cidade', 'abrirDialogo', { estado: naSalaDaCidade('npc') }, (a) => E.abrirDialogo(a.estado));
caso('abrirDialogo: NPC da masmorra', 'abrirDialogo', { estado: naMasmorraComNpc(npc('heal')) }, (a) => E.abrirDialogo(a.estado));
caso('abrirDialogo: sala sem NPC', 'abrirDialogo', { estado: naSalaDaCidade('shop') }, (a) => E.abrirDialogo(a.estado));

const dialogo = E.abrirDialogo(naMasmorraComNpc(npc('heal')))!;
const naUltimaFala = { ...dialogo, linha: 1 };
caso('falaAtual: a primeira', 'falaAtual', { dialogo }, (a) => E.falaAtual(a.dialogo));
caso('falaAtual: depois da última', 'falaAtual', { dialogo: { ...dialogo, linha: 5 } }, (a) => E.falaAtual(a.dialogo));
caso('temMaisFalas: na primeira', 'temMaisFalas', { dialogo }, (a) => E.temMaisFalas(a.dialogo));
caso('temMaisFalas: na última', 'temMaisFalas', { dialogo: naUltimaFala }, (a) => E.temMaisFalas(a.dialogo));
caso('proximaFala: avança', 'proximaFala', { dialogo }, (a) => E.proximaFala(a.dialogo));
caso('proximaFala: na última fica', 'proximaFala (na última fica)', { dialogo: naUltimaFala }, (a) => E.proximaFala(a.dialogo) === a.dialogo);
for (const servico of ['heal', 'blessing', 'barter', 'reveal', 'recruit', 'xyz']) {
  caso(`rotuloDoServico: ${servico}`, 'rotuloDoServico', { npc: npc(servico) }, (a) => E.rotuloDoServico(a.npc as never));
  caso(`servicoDisponivel: ${servico}`, 'servicoDisponivel', { npc: npc(servico) }, (a) => E.servicoDisponivel(a.npc as never));
}
caso('servicoDisponivel: já usado', 'servicoDisponivel', { npc: npc('heal', { serviceUsed: true }) }, (a) => E.servicoDisponivel(a.npc as never));

const machucado = heroi({ classe: 'guerreiro', extra: { hp: 10, mp: 2, gold: 500 } });
const comTres = [companheiro('guerreiro'), companheiro('mago'), companheiro('clerigo')];
const dialogoNa = (estado: EstadoDoJogo) => E.abrirDialogo(estado)!;
for (const [nome, d, semente] of [
  ['curar ferido com ouro', dialogoNa(naMasmorraComNpc(npc('heal'), machucado)), 70],
  ['curar sem ouro', dialogoNa(naMasmorraComNpc(npc('heal'), heroi({ classe: 'guerreiro', extra: { hp: 10, gold: 0 } }))), 71],
  ['curar quem está inteiro', dialogoNa(naMasmorraComNpc(npc('heal'))), 72],
  ['bênção', dialogoNa(naMasmorraComNpc(npc('blessing'))), 73],
  ['troca com material', dialogoNa(naMasmorraComNpc(npc('barter'), guerreiro, [minerio, pocaoDeVida])), 74],
  ['troca sem material', dialogoNa(naMasmorraComNpc(npc('barter'), guerreiro, [pocaoDeVida])), 75],
  ['revelar na masmorra', E.abrirDialogo(E.substituirCelulaAtual(masmorra, { ...(E.celulaAtual(masmorra) as DungeonCell), npc: npc('reveal') as never }))!, 76],
  ['revelar na cidade', { ...dialogoNa(naSalaDaCidade('npc')), npc: npc('reveal') as never }, 77],
  ['recrutar', dialogoNa(naMasmorraComNpc(npc('recruit'))), 78],
  ['recrutar com a equipe cheia', dialogoNa(naMasmorraComNpc(npc('recruit'), guerreiro, [], comTres)), 79],
  ['serviço já usado', dialogoNa(naMasmorraComNpc(npc('heal', { serviceUsed: true }), machucado)), 80],
  ['serviço que não existe', dialogoNa(naMasmorraComNpc(npc('xyz'))), 81],
  ['NPC da cidade cura', { ...dialogoNa(naSalaDaCidade('npc', machucado)), npc: npc('heal') as never }, 82],
] as const) {
  caso(`usarServico: ${nome}`, 'usarServico', { dialogo: d }, (a, ctx) => E.usarServico(a.dialogo, ctx.rng, ctx.now), { rng: { seed: semente }, now: AGORA });
}

// --- evento ---

const naSalaDoEvento = (templateId: string, o: Partial<DungeonCell> = {}, hero: Hero = guerreiro) =>
  naSalaDaMasmorra({ type: 'event', event: { templateId } as DungeonCell['event'], ...o }, hero);
caso('abrirEvento: aventureiro ferido', 'abrirEvento', { estado: naSalaDoEvento('ferido') }, (a) => E.abrirEvento(a.estado));
caso('abrirEvento: já resolvido', 'abrirEvento', { estado: naSalaDoEvento('altar', { resolved: true }) }, (a) => E.abrirEvento(a.estado));
caso('abrirEvento: sala sem evento', 'abrirEvento', { estado: naSalaDaMasmorra({ type: 'normal' }) }, (a) => E.abrirEvento(a.estado));
caso('abrirEvento: evento desconhecido', 'abrirEvento', { estado: naSalaDoEvento('xyz') }, (a) => E.abrirEvento(a.estado));
caso('abrirEvento: no app', 'abrirEvento', { estado: naSalaDoEvento('altar'), app: true }, (a) => E.abrirEvento(a.estado, a.app));
constante('ESCOLHAS', E.ESCOLHAS);

const fraco = heroi({ classe: 'guerreiro', extra: { hp: 3, gold: 5 } });
for (const [templateId, escolhaId, hero, semente] of [
  ['ferido', 'ajudar', guerreiro, 83],
  ['ferido', 'ajudar', fraco, 84],
  ['ferido', 'curar', guerreiro, 85],
  ['ferido', 'curar', guerreiro, 86],
  ['ferido', 'ignorar', guerreiro, 87],
  ['altar', 'estudar', guerreiro, 88],
  ['altar', 'estudar', heroi({ classe: 'mago', attrs: { intelecto: 25 } }), 89],
  ['altar', 'rezar', guerreiro, 90],
  ['altar', 'sacrificar', guerreiro, 91],
  ['altar', 'sacrificar', fraco, 92],
  ['porta', 'forcar', heroi({ classe: 'guerreiro', attrs: { forca: 25 } }), 93],
  ['porta', 'forcar', guerreiro, 94],
  ['porta', 'examinar', heroi({ classe: 'mago', attrs: { intelecto: 25 } }), 95],
  ['porta', 'desistir', guerreiro, 96],
] as const) {
  const evento = E.abrirEvento(naSalaDoEvento(templateId, {}, hero))!;
  caso(`escolher: ${templateId}, ${escolhaId}, semente ${semente}`, 'escolher', { evento, escolha: escolhaId }, (a, ctx) => E.escolher(a.evento, a.escolha as never, ctx.rng, ctx.now), {
    rng: { seed: semente },
    now: AGORA,
  });
}
caso('escolher: evento já resolvido', 'escolher', { evento: E.abrirEvento(naSalaDoEvento('porta', { resolved: true }))!, escolha: 'forcar' }, (a, ctx) =>
  E.escolher(a.evento, a.escolha as never, ctx.rng, ctx.now),
{ rng: { seed: 97 }, now: AGORA });
caso('escolhas: altar', 'escolhas', { evento: E.abrirEvento(naSalaDoEvento('altar'))! }, (a) => E.escolhas(a.evento));
{
  // No app, o item de estudar pode vir com material.
  const sabio = heroi({ classe: 'mago', attrs: { intelecto: 25 } });
  for (const semente of [98, 99, 100]) {
    const evento = E.abrirEvento({ ...naSalaDoEvento('altar', {}, sabio), floor: 90 }, true)!;
    caso(`escolher: altar, estudar no app no andar 90, semente ${semente}`, 'escolher', { evento, escolha: 'estudar' }, (a, ctx) => E.escolher(a.evento, a.escolha as never, ctx.rng, ctx.now), {
      rng: { seed: semente },
      now: AGORA,
    });
  }
}

// --- professor ---

const aprendizDeMestre = heroi({ classe: 'guerreiro', extra: { masteryBattles: E.masteryBattlesFor(4), powerIds: ['golpe_poderoso'] } });
const comTresPoderes = heroi({ classe: 'guerreiro', extra: { masteryBattles: E.masteryBattlesFor(4), powerIds: ['golpe_poderoso', ...tresPoderes.slice(0, 2)] } });
const naSalaDoMestre = (hero: Hero, teacher: Partial<DungeonTeacher> = {}) =>
  naSalaDaMasmorra({ type: 'teacher', teacher: { classId: 'guerreiro', number: 1, ...teacher } }, hero, [], { floor: 30 });
for (const [nome, estado] of [
  ['ensina quem tem vaga', naSalaDoMestre(aprendizDeMestre)],
  ['troca com quem tem três', naSalaDoMestre(comTresPoderes)],
  ['mestre de outra classe', naSalaDoMestre(aprendizDeMestre, { classId: 'mago' })],
  ['mestre que já passou', naSalaDoMestre(heroi({ classe: 'guerreiro', extra: { masteryBattles: E.masteryBattlesFor(4), teachersMet: 1 } }))],
  ['sala sem mestre', naSalaDaMasmorra({ type: 'normal' })],
] as const) {
  caso(`abrirProfessor: ${nome}`, 'abrirProfessor', { estado }, (a) => E.abrirProfessor(a.estado));
}
const professor = E.abrirProfessor(naSalaDoMestre(aprendizDeMestre))!;
const professorDeTroca = E.abrirProfessor(naSalaDoMestre(comTresPoderes))!;
caso('ofertas: o que ele ensina', 'ofertas', { professor }, (a) => E.ofertas(a.professor));
caso('trocaveis: o que dá pra esquecer', 'trocaveis', { professor: professorDeTroca }, (a) => E.trocaveis(a.professor));
const oferta = E.ofertas(professor)[0]!.id;
caso('aprender: da lista', 'aprender', { professor, powerId: oferta }, (a) => E.aprender(a.professor, a.powerId));
caso('aprender: fora da lista devolve o mesmo', 'aprender (fora da lista devolve o mesmo)', { professor, powerId: 'xyz' }, (a) => E.aprender(a.professor, a.powerId) === a.professor);
const esquecer = E.trocaveis(professorDeTroca)[0]!.id;
const novo = E.ofertas(professorDeTroca)[0]!.id;
caso('trocar: um por um da lista', 'trocar', { professor: professorDeTroca, esquecer, aprenderId: novo }, (a) => E.trocar(a.professor, a.esquecer, a.aprenderId));
caso('trocar: inválida devolve o mesmo', 'trocar (inválida devolve o mesmo)', { professor: professorDeTroca, esquecer: 'golpe_poderoso', aprenderId: novo }, (a) =>
  E.trocar(a.professor, a.esquecer, a.aprenderId) === a.professor,
);

// --- portão ---

for (const [nome, bloqueio] of [
  ['nível', { kind: 'level', minLevel: 15 }],
  ['masmorra anterior', { kind: 'previous_dungeon', dungeon: 'floresta' }],
  ['masmorra anterior desconhecida', { kind: 'previous_dungeon', dungeon: 'xyz' }],
  ['dificuldade anterior', { kind: 'previous_difficulty', difficulty: 'normal' }],
] as const) {
  caso(`motivo: ${nome}`, 'motivo', { bloqueio }, (a) => E.motivo(a.bloqueio as never));
}

const veteranoDoPortao = heroi({ classe: 'guerreiro', level: 20 });
const progressoDeVeterano: DungeonProgress = { cleared: ['floresta:normal'], totems: { 'floresta:normal': [20, 40], 'caverna:normal': [20] } };
const portaoDe = (hero: Hero, progresso: DungeonProgress, masmorraDaVez: DungeonRun = cidade.masmorra) =>
  ({ ...naSalaDaCidade('gate', hero), progresso, masmorra: masmorraDaVez }) as EstadoNaCidade;
const naCidadeDoVeterano = portaoDe(veteranoDoPortao, progressoDeVeterano, { dungeon: 'caverna', difficulty: 'normal' });
for (const [nome, estado] of [
  ['herói novo', portaoDe(guerreiro, { cleared: [], totems: {} })],
  ['veterano volta pra caverna', naCidadeDoVeterano],
  ['última descida fechada', portaoDe(guerreiro, { cleared: [], totems: {} }, { dungeon: 'torre', difficulty: 'pesadelo' })],
] as const) {
  caso(`abrirPortao: ${nome}`, 'abrirPortao', { estado }, (a) => E.abrirPortao(a.estado));
  const portao = E.abrirPortao(estado);
  caso(`masmorras: ${nome}`, 'masmorras', { portao }, (a) => E.masmorras(a.portao));
  caso(`dificuldades: ${nome}`, 'dificuldades', { portao }, (a) => E.dificuldades(a.portao));
  caso(`andares: ${nome}`, 'andares', { portao }, (a) => E.andares(a.portao));
}
const portaoDoVeterano = E.abrirPortao(naCidadeDoVeterano);
caso('escolherMasmorra: aberta', 'escolherMasmorra', { portao: portaoDoVeterano, dungeon: 'floresta' }, (a) => E.escolherMasmorra(a.portao, a.dungeon as never));
caso('escolherMasmorra: fechada devolve o mesmo', 'escolherMasmorra (fechada devolve o mesmo)', { portao: portaoDoVeterano, dungeon: 'torre' }, (a) =>
  E.escolherMasmorra(a.portao, a.dungeon as never) === a.portao,
);
caso('escolherDificuldade: aberta', 'escolherDificuldade', { portao: E.escolherMasmorra(portaoDoVeterano, 'floresta'), difficulty: 'dificil' }, (a) =>
  E.escolherDificuldade(a.portao, a.difficulty as never),
);
caso('escolherDificuldade: fechada devolve o mesmo', 'escolherDificuldade (fechada devolve o mesmo)', { portao: portaoDoVeterano, difficulty: 'pesadelo' }, (a) =>
  E.escolherDificuldade(a.portao, a.difficulty as never) === a.portao,
);
caso('escolherAndar: um totem tocado', 'escolherAndar', { portao: E.escolherMasmorra(portaoDoVeterano, 'floresta'), andar: 40 }, (a) =>
  E.escolherAndar(a.portao, a.andar),
);
caso('escolherAndar: andar sem totem devolve o mesmo', 'escolherAndar (andar sem totem devolve o mesmo)', { portao: portaoDoVeterano, andar: 30 }, (a) =>
  E.escolherAndar(a.portao, a.andar) === a.portao,
);
for (const [nome, portao, semente] of [
  ['pelo andar 1', E.abrirPortao(portaoDe(guerreiro, { cleared: [], totems: {} })), 98],
  ['pelo totem do 20 da caverna', E.escolherAndar(portaoDoVeterano, 20), 99],
  ['escolha fechada', { ...portaoDoVeterano, escolha: { dungeon: 'torre', difficulty: 'normal' } }, 100],
  ['andar que não abre', { ...portaoDoVeterano, andar: 30 }, 101],
] as const) {
  caso(`entrar: ${nome}`, 'entrar', { portao }, (a, ctx) => E.entrar(a.portao as never, ctx.rng, ctx.now), { rng: { seed: semente }, now: AGORA });
}
caso('abrirPortao: no app', 'abrirPortao', { estado: naCidadeDoVeterano, app: true }, (a) => E.abrirPortao(a.estado, a.app));
caso('entrar: no app, pelo totem do 40 da floresta', 'entrar', { portao: E.escolherAndar(E.escolherMasmorra(E.abrirPortao(naCidadeDoVeterano, true), 'floresta'), 40) }, (a, ctx) =>
  E.entrar(a.portao as never, ctx.rng, ctx.now),
{ rng: { seed: 102 }, now: AGORA });
// Pelas entradas da cidade desenhada: a masmorra fica fixa.
for (const [nome, estado, app, dungeon] of [
  ['pela entrada da caverna, onde desceu por último', naCidadeDoVeterano, false, 'caverna'],
  ['pela entrada da floresta, depois de descer na caverna', naCidadeDoVeterano, false, 'floresta'],
  ['pela entrada da floresta, no app', portaoDe(guerreiro, { cleared: [], totems: {} }), true, 'floresta'],
] as const) {
  caso(`abrirPortao: ${nome}`, 'abrirPortao', { estado, app, masmorra: dungeon }, (a) => E.abrirPortao(a.estado, a.app, a.masmorra as never));
}
caso('escolherMasmorra: com a masmorra fixa devolve o mesmo', 'escolherMasmorra (fechada devolve o mesmo)', { portao: E.abrirPortao(naCidadeDoVeterano, false, 'caverna'), dungeon: 'floresta' }, (a) =>
  E.escolherMasmorra(a.portao, a.dungeon as never) === a.portao,
);

// --- a cidade desenhada (city/mapa-da-cidade.ts e jogo/cidade.ts) ---

for (const troncos of [true, false]) {
  caso(`plantaDaCidade: ${troncos ? 'com' : 'sem'} os troncos`, 'plantaDaCidade', { troncosNoCaminho: troncos }, (a) => E.plantaDaCidade(a.troncosNoCaminho));
}
for (const ponto of [...new Set(E.PONTOS_DA_CIDADE.map((p) => p.id)), 'castelo']) {
  caso(`chegadaNoPonto: ${ponto}`, 'chegadaNoPonto', { ponto }, (a) => E.chegadaNoPonto(a.ponto as never));
}
{
  // Quem cobre o herói: cada camada contra lugares atrás, na frente, ao lado e na beirada exata.
  const naCasa = (col: number, row: number) => ({ x: col * E.TILE_UNITS + E.TILE_UNITS / 2, y: row * E.TILE_UNITS + E.TILE_UNITS / 2 });
  for (const [nome, walker] of [
    ['atrás da árvore', naCasa(12, 10)],
    ['na praça', E.chegadaNoPonto('arvore')],
    ['atrás da loja', naCasa(8, 9)],
    ['atrás da guilda', naCasa(16, 13)],
    ['diante dos troncos', naCasa(12, 7)],
    ['com o pé na linha da árvore', { x: 12 * E.TILE_UNITS + E.TILE_UNITS / 2, y: 13 * E.TILE_UNITS - E.HERO_HALF }],
    ['um pouco acima da linha da árvore', { x: 12 * E.TILE_UNITS + E.TILE_UNITS / 2, y: 13 * E.TILE_UNITS - E.HERO_HALF - 1 }],
    ['na beirada esquerda da árvore', { x: ((325 - 13) * E.TILE_UNITS) / E.PIXELS_POR_CASA, y: 10 * E.TILE_UNITS }],
    ['um pixel pra dentro da beirada', { x: ((326 - 13) * E.TILE_UNITS) / E.PIXELS_POR_CASA, y: 10 * E.TILE_UNITS }],
  ] as const) {
    for (const camada of E.CAMADAS_DA_CIDADE) {
      caso(`cobreOHeroi: ${camada.arquivo}, ${nome}`, 'cobreOHeroi', { camada, walker }, (a) => E.cobreOHeroi(a.camada, a.walker));
    }
  }
}

// --- a arte das salas da masmorra (dungeon/arte-da-sala.ts) ---
for (const [dungeon, portas] of [
  ['floresta', []],
  ['floresta', ['N']],
  ['floresta', ['S', 'W']],
  ['floresta', ['N', 'E', 'S', 'W']],
  ['caverna', []],
  ['caverna', ['N', 'S']],
  ['caverna', ['N', 'E', 'S', 'W']],
  ['torre', []],
  ['torre', ['E']],
  ['torre', ['N', 'S']],
  ['torre', ['N', 'E', 'S', 'W']],
] as const) {
  caso(`camadasDaSala: ${dungeon}, ${portas.join('') || 'sem portas'}`, 'camadasDaSala', { dungeon, portas }, (a) => E.camadasDaSala(a.dungeon, a.portas));
}
for (const dungeon of ['floresta', 'caverna', 'torre', null] as const) {
  caso(`geometriaDaSala: ${dungeon ?? 'fora da masmorra'}`, 'geometriaDaSala', { dungeon }, (a) => E.geometriaDaSala(a.dungeon));
  caso(`paredesDaSala: ${dungeon ?? 'fora da masmorra'}`, 'paredesDaSala', { dungeon }, (a) => E.paredesDaSala(a.dungeon));
  caso(`enfeitesDaSala: ${dungeon ?? 'fora da masmorra'}`, 'enfeitesDaSala', { dungeon }, (a) => E.enfeitesDaSala(a.dungeon));
}
{
  const salas = E.generateCityLayout(6, 6).rooms;
  const recrutador = { ...salas.find((s) => s.type === 'npc')!, npc: { ...salas.find((s) => s.type === 'npc')!.npc!, service: 'recruit' as const } };
  for (const celula of [...salas, recrutador, { type: 'void', x: 0, y: 0, doors: {} }]) {
    const nome = celula.type === 'npc' ? `npc ${celula.npc?.service}` : celula.type;
    caso(`pontoDaSala: ${nome}`, 'pontoDaSala', { celula }, (a) => E.pontoDaSala(a.celula as never));
  }
}
{
  // Sem a cópia da cidade (`cityMap`): a porta só olha a grade do mapa, e a cópia dobraria cada caso.
  const naPraca: EstadoNaCidade = { ...cidade, cityMap: null, hero: heroi({ classe: 'guerreiro', level: 5 }) };
  const florestaZerada: DungeonProgress = { cleared: ['floresta:normal'], totems: {} };
  const veteranoNaPraca: EstadoNaCidade = { ...naPraca, hero: heroi({ classe: 'guerreiro', level: 20 }), progresso: florestaZerada };
  const naSala = (tipo: string, base: EstadoNaCidade = naPraca): EstadoNaCidade => {
    const sala = base.map.flat().find((c) => c.type === tipo && (tipo !== 'npc' || c.npc?.service === 'barter'))!;
    return { ...base, pos: { x: sala.x, y: sala.y } };
  };
  for (const [nome, estado] of [
    ['herói novo', naPraca],
    ['floresta zerada', veteranoNaPraca],
  ] as const) {
    caso(`troncosNoCaminho: ${nome}`, 'troncosNoCaminho', { estado }, (a) => E.troncosNoCaminho(a.estado));
    caso(`pistasDaCidade: ${nome}`, 'pistasDaCidade', { estado }, (a) => E.pistasDaCidade(a.estado));
  }
  constante('TEXTO_DA_CIDADE', E.TEXTO_DA_CIDADE);
  caso('plantaDaCidadeAgora: floresta zerada', 'plantaDaCidadeAgora', { estado: veteranoNaPraca }, (a) => E.plantaDaCidadeAgora(a.estado));
  for (const [nome, estado, daMasmorra] of [
    ['na praça', naPraca, false],
    ['na loja', naSala('shop'), false],
    ['com o Bram', naSala('npc'), false],
    ['no portão, depois da caverna', { ...naSala('gate'), masmorra: { dungeon: 'caverna', difficulty: 'normal' } }, false],
    ['de volta da torre', { ...naPraca, masmorra: { dungeon: 'torre', difficulty: 'dificil' } }, true],
  ] as const) {
    caso(`chegadaNaCidade: ${nome}`, 'chegadaNaCidade', { estado, daMasmorra }, (a) => E.chegadaNaCidade(a.estado as EstadoNaCidade, a.daMasmorra));
  }
  const pontos = [...new Set(E.PONTOS_DA_CIDADE.map((p) => p.id))];
  const semTutorial: EstadoNaCidade = { ...naPraca, tutorial: { enabled: false, completed: {}, rewarded: false } };
  const aprendizNaPraca: EstadoNaCidade = { ...naPraca, hero: heroi({ classe: null }) };
  const feridoNaPraca: EstadoNaCidade = { ...semTutorial, hero: heroi({ classe: 'guerreiro', extra: { hp: 5, mp: 1 } }) };
  const casos: Array<[string, EstadoNaCidade, string, boolean]> = [
    ...pontos.map((ponto): [string, EstadoNaCidade, string, boolean] => [ponto, semTutorial, ponto, false]),
    ['loja, fechando "Dê o primeiro passo"', naPraca, 'loja', false],
    ['taverna, ferido', feridoNaPraca, 'taverna', false],
    ['igreja no app', semTutorial, 'igreja', true],
    ['ferreiro no app', semTutorial, 'ferreiro', true],
    ['floresta, Aprendiz', aprendizNaPraca, 'floresta', false],
    ['caverna, veterano', veteranoNaPraca, 'caverna', false],
    ['caverna sem o nível', { ...naPraca, progresso: florestaZerada }, 'caverna', false],
    ['torre sem a caverna', { ...veteranoNaPraca, hero: heroi({ classe: 'guerreiro', level: 40 }) }, 'torre', false],
  ];
  for (const [nome, estado, ponto, app] of casos) {
    caso(`entrarNoPonto: ${nome}`, 'entrarNoPonto', { estado, ponto, pet: null, app }, (a, ctx) => E.entrarNoPonto(a.estado, a.ponto as never, ctx.rng, a.pet, ctx.now, a.app), {
      rng: { seed: 7 },
      now: AGORA,
    });
  }
  caso('falarComOBram: na forja', 'falarComOBram', { estado: naSala('blacksmith', semTutorial), app: false }, (a, ctx) => E.falarComOBram(a.estado, ctx.rng, ctx.now, a.app), {
    rng: { seed: 8 },
    now: AGORA,
  });

  // O andar na planta grande: a regra das salas, com o tamanho do mapa.
  const plantaComTroncos = E.plantaDaCidade(true);
  const plantaAberta = E.plantaDaCidade(false);
  const daArvore = E.chegadaNoPonto('arvore');
  const aoLadoDaArvore = { x: 11 * E.TILE_UNITS + E.TILE_UNITS / 2, y: 10 * E.TILE_UNITS + E.TILE_UNITS / 2, facing: 'N' as const };
  for (const [nome, planta, walker, entrada, passos] of [
    ['da praça pro oeste, pela estrada', plantaComTroncos, daArvore, { x: -1, y: 0 }, 400],
    ['sobe até os troncos e encosta', plantaComTroncos, aoLadoDaArvore, { x: 0, y: -1 }, 400],
    ['sem os troncos, sobe até a caverna', plantaAberta, aoLadoDaArvore, { x: 0, y: -1 }, 600],
    ['diagonal até a borda', plantaAberta, daArvore, { x: 1, y: 1 }, 900],
    ['até a estrada da torre', plantaAberta, { x: 25 * E.TILE_UNITS, y: 14 * E.TILE_UNITS + E.TILE_UNITS / 2, facing: 'E' as const }, { x: 1, y: 0 }, 400],
  ] as const) {
    caso(`andarNoQuadro: cidade, ${nome}`, 'andarNoQuadro', { planta, walker, entrada, passos, tocandoAntes: null }, (a) =>
      E.andarNoQuadro(a.planta, a.walker, a.entrada, a.passos, a.tocandoAntes),
    );
  }
}

// --- guilda ---

const aprendizNovo = E.buildApprentice({ name: 'Novo', race: E.raceById('humano')!, debuff: E.debuffById('orgulhoso')! }, E.seededRng(1));
const naGuilda = (hero: Hero, inventory: Item[] = [], t?: Tutorial) => ({ ...naSalaDaCidade('guild', hero, inventory), ...(t ? { tutorial: t } : {}) });
caso('abrirGuilda: na guilda', 'abrirGuilda', { estado: naGuilda(aprendizNovo) }, (a) => E.abrirGuilda(a.estado));
for (const [nome, estado, classe, semente] of [
  ['aprendiz vira mago', naGuilda(aprendizNovo), 'mago', 102],
  ['aprendiz de espada na mão: o cajado vai pra mochila', naGuilda({ ...aprendizNovo, equip: { ...aprendizNovo.equip, arma: espadaNova } }, [espadaNova]), 'mago', 103],
  ['quem já tem classe não troca', naGuilda(guerreiro), 'mago', 104],
  ['o treino fecha o tutorial', naGuilda(aprendizNovo, [], tutorial(todosMenos('guild'))), 'barbaro', 105],
] as const) {
  caso(`treinar: ${nome}`, 'treinar', { guilda: E.abrirGuilda(estado), classe: E.classById(classe)! }, (a, ctx) => E.treinar(a.guilda, a.classe, ctx.rng, ctx.now), {
    rng: { seed: semente },
    now: AGORA,
  });
}

// --- a Encantadora (só do app) ---

{
  const placas = { ...item('placas', 'raro', 20), equipped: true };
  const elmoGuardado = item('placas_elmo', 'comum', 21);
  const vestido = (gold: number, armadura: Item = placas) => heroi({ classe: 'guerreiro', equip: { armadura }, extra: { gold } });
  const naEncantadora = (hero: Hero, inventory: Item[]): Encantadora => E.abrirEncantadora(naSalaDaCidade('encantadora', hero, inventory));
  caso('abrirEncantadora', 'abrirEncantadora', { estado: naSalaDaCidade('encantadora', vestido(1000), [placas, elmoGuardado]) }, (a) => E.abrirEncantadora(a.estado));
  caso('pecasParaEncantar: as vestidas, depois as guardadas', 'pecasParaEncantar', { estado: enxuto(vestido(1000), [placas, elmoGuardado, espadaNova, anel, pocaoDeVida]) }, (a) =>
    E.pecasParaEncantar(a.estado),
  );
  caso('pecasParaEncantar: nenhuma', 'pecasParaEncantar', { estado: enxuto(guerreiro, [espadaNova]) }, (a) => E.pecasParaEncantar(a.estado));

  const jaTem = { ...placas, encantamento: { tipo: 'robustez' as const, nivel: 2 } };
  for (const [nome, encantadora, peca, tipo, nivel] of [
    ['o peitoral vestido', naEncantadora(vestido(1000), [placas, elmoGuardado]), placas, 'robustez', 2],
    ['o elmo guardado', naEncantadora(vestido(1000), [placas, elmoGuardado]), elmoGuardado, 'vigor', 3],
    ['troca a fortificação', naEncantadora(vestido(1000, jaTem), [jaTem]), jaTem, 'vigor', 1],
    ['a mesma que já tem', naEncantadora(vestido(1000, jaTem), [jaTem]), jaTem, 'robustez', 2],
    ['o mesmo tipo noutro nível', naEncantadora(vestido(1000, jaTem), [jaTem]), jaTem, 'robustez', 3],
    ['sem ouro', naEncantadora(vestido(50), [placas]), placas, 'robustez', 1],
    ['o ouro na conta', naEncantadora(vestido(800), [placas]), placas, 'resistencia_magica', 3],
    ['a arma não', naEncantadora(vestido(1000), [placas]), vestido(1000).equip.arma!, 'robustez', 1],
    ['peça que não está com o herói', naEncantadora(vestido(1000), [placas]), elmoGuardado, 'robustez', 1],
    ['nível fora da régua', naEncantadora(vestido(5000), [placas]), placas, 'resistencia_veneno', 9],
  ] as const) {
    caso(`encantar: ${nome}`, 'encantar', { encantadora, peca, tipo, nivel }, (a) => E.encantar(a.encantadora, a.peca, a.tipo as EncantamentoId, a.nivel));
  }
}

// --- totem ---

const noTotem = (progresso: DungeonProgress, floor = 20) => naSalaDaMasmorra({ type: 'totem' }, guerreiro, [], { floor, progresso });
for (const [nome, estado] of [
  ['primeira vez', noTotem({ cleared: [], totems: {} })],
  ['já tocado', noTotem({ cleared: [], totems: { 'floresta:normal': [20] } })],
  ['outra masmorra', { ...noTotem({ cleared: [], totems: { 'floresta:normal': [20] } }), masmorra: { dungeon: 'caverna', difficulty: 'dificil' } }],
] as const) {
  caso(`tocarTotem: ${nome}`, 'tocarTotem', { estado }, (a) => E.tocarTotem(a.estado));
}
const totem = E.tocarTotem({ ...masmorra, floor: 20, progresso: { cleared: [], totems: {} } });
caso('voltarPeloTotem: de volta pra cidade', 'voltarPeloTotem', { totem }, (a) => E.voltarPeloTotem(a.totem));

// ---------- sala, o começo do encontro, criação e save inicial ----------
//
// Do combate por turnos só vem o começo do encontro (decisão do usuário,
// 2026-10-16: no app a luta é em tempo real); a sala o devolve quando a
// luta começa.

/** A primeira sala, nos andares 3 de várias sementes, que cumpre o predicado. */
function salaGerada(predicado: (c: DungeonCell) => boolean): DungeonCell {
  for (let semente = 1; semente < 200; semente++) {
    const achada = naMasmorra(cidade, semente, 3).map.flat().find(predicado);
    if (achada) return achada;
  }
  throw new Error('nenhuma sala de teste com isso');
}
const umMonstro = salaGerada((c) => c.type === 'monster' && c.monsters?.length === 1);
const grupo = salaGerada((c) => c.type === 'monster' && (c.monsters?.length ?? 0) > 1);
const chefe = andarDoChefe.map.flat().find((c) => c.type === 'boss')!;
const petDeTeste = Object.keys(E.PET_ICONS)[0]!;
/** Estado enxuto que gera andar ou cidade: a grade de verdade é 6×6, mesmo com uma sala só no mapa. */
const comGradeInteira = (estado: EstadoNaMasmorra): EstadoNaMasmorra => ({ ...estado, mapRows: 6, mapCols: 6 });

for (const [nome, celula] of [
  ['monstro', umMonstro],
  ['monstro vencido', { ...umMonstro, beaten: true }],
  ['chefe', chefe],
  ['escada', { ...umMonstro, type: 'stairs' }],
  ['saída', { ...umMonstro, type: 'exit' }],
  ['baú', { ...umMonstro, type: 'treasure' }],
  ['sala da cidade', E.celulaAtual(cidade)],
  ['nenhuma sala', null],
] as const) {
  caso(`lutaAoEntrar: ${nome}`, 'lutaAoEntrar', { celula }, (a) => E.lutaAoEntrar(a.celula as never));
  caso(`confirmaAoTocar: ${nome}`, 'confirmaAoTocar', { celula }, (a) => E.confirmaAoTocar(a.celula as never));
}

const comBencao = heroi({ classe: 'guerreiro', extra: { npcBlessing: { dodge: 15, combats: 2 } } });
for (const [nome, estado] of [
  ['um monstro', naSalaDaMasmorra(umMonstro)],
  ['grupo', naSalaDaMasmorra(grupo)],
  ['grupo, no segundo', naSalaDaMasmorra({ ...grupo, monsterIndex: 1 })],
  ['sala sem monstro', naSalaDaMasmorra({ type: 'normal' })],
  ['sala de monstro vazia', naSalaDaMasmorra({ type: 'monster', monsters: [] })],
  ['cidade', enxuto()],
] as const) {
  caso(`salaDeCombate: ${nome}`, 'salaDeCombate', { estado }, (a) => E.salaDeCombate(a.estado));
  caso(`monstroAtual: ${nome}`, 'monstroAtual', { estado }, (a) => E.monstroAtual(a.estado));
  caso(`inimigosRestantes: ${nome}`, 'inimigosRestantes', { estado }, (a) => E.inimigosRestantes(a.estado));
  caso(`inimigosDaLuta: ${nome}`, 'inimigosDaLuta', { estado }, (a) => E.inimigosDaLuta(a.estado));
  caso(`vezDoMonstro: ${nome}`, 'vezDoMonstro', { estado }, (a) => E.vezDoMonstro(a.estado));
}

// A luta em grupo: quem caiu fica de fora, a vez dá a volta, o alvo caído passa pro primeiro de pé.
const grupoComUmCaido = { ...grupo, monsters: (grupo.monsters ?? []).map((m, i) => (i === 0 ? { ...m, hp: 0 } : m)) };
for (const [nome, sala] of [
  ['vez no segundo', { ...grupo, monsterTurn: 1 }],
  ['vez depois do último dá a volta', { ...grupo, monsterTurn: 9 }],
  ['vez num caído passa pro seguinte', { ...grupoComUmCaido, monsterTurn: 0 }],
  ['um caído fora da ordem', grupoComUmCaido],
] as const) {
  const estado = naSalaDaMasmorra(sala);
  caso(`inimigosDaLuta: ${nome}`, 'inimigosDaLuta', { estado }, (a) => E.inimigosDaLuta(a.estado));
  caso(`vezDoMonstro: ${nome}`, 'vezDoMonstro', { estado }, (a) => E.vezDoMonstro(a.estado));
  caso(`inimigosRestantes: ${nome}`, 'inimigosRestantes', { estado }, (a) => E.inimigosRestantes(a.estado));
}
const combateDoGrupo = (sala: DungeonCell, alvo: number) => ({
  estado: naSalaDaMasmorra(sala),
  fase: 'combate',
  log: [],
  dado: null,
  loot: null,
  pet: null,
  som: null,
  flutuantes: [],
  alvo,
});
for (const [nome, combate] of [
  ['alvo de pé', combateDoGrupo(grupo, 1)],
  ['alvo caído', combateDoGrupo(grupoComUmCaido, 0)],
  ['alvo que não existe', combateDoGrupo(grupo, 9)],
  ['na cidade', { ...combateDoGrupo(grupo, 0), estado: enxuto() }],
] as const) {
  caso(`alvoDaLuta: ${nome}`, 'alvoDaLuta', { combate }, (a) => E.alvoDaLuta(a.combate as never));
}
for (const [nome, combate, indice] of [
  ['de pé', combateDoGrupo(grupo, 0), 1],
  ['caído', combateDoGrupo(grupoComUmCaido, 1), 0],
  ['que não existe', combateDoGrupo(grupo, 0), 9],
] as const) {
  caso(`escolherAlvo: ${nome}`, 'escolherAlvo', { combate, indice }, (a) => E.escolherAlvo(a.combate as never, a.indice));
}
for (const [nome, estado, pet] of [
  ['um monstro', naSalaDaMasmorra(umMonstro), null],
  ['grupo', naSalaDaMasmorra(grupo), null],
  ['com a bênção do NPC', naSalaDaMasmorra(umMonstro, comBencao), null],
  ['com pet', naSalaDaMasmorra(umMonstro), petDeTeste],
  ['sala vazia', naSalaDaMasmorra({ type: 'monster', monsters: [] }), null],
] as const) {
  caso(`iniciarEncontro: ${nome}`, 'iniciarEncontro', { estado, pet }, (a) => E.iniciarEncontro(a.estado, a.pet as never));
}
const combateVazio = { estado: naSalaDaMasmorra({ type: 'monster', monsters: [] }), fase: 'combate', log: [], dado: null, loot: null, pet: null, som: null, flutuantes: [], alvo: 0 };
caso('comecarCombate: o grupo inteiro se prepara', 'comecarCombate', { combate: { ...combateDoGrupo(grupoComUmCaido, 1) } }, (a) => E.comecarCombate(a.combate as never));
caso('comecarCombate: sala vazia vira vitória', 'comecarCombate', { combate: combateVazio }, (a) => E.comecarCombate(a.combate as never));
caso('comecarCombate: na cidade não há combate', 'comecarCombate', { combate: { ...combateVazio, estado: enxuto() } }, (a) => E.comecarCombate(a.combate as never));

// ---------- o começo e o fim da luta (fim-da-luta.ts), que as duas lutas chamam ----------

{
  const salas: Array<[string, DungeonCell]> = [
    ['um monstro', umMonstro],
    ['grupo', grupo],
    ['grupo com um caído', grupoComUmCaido],
    ['fila que já andou', { ...grupo, monsterIndex: 1 }],
    ['sem monstros', { ...umMonstro, monsters: [] }],
  ];
  for (const [nome, sala] of salas) {
    for (const indice of [0, 1, 2, 5]) caso(`vivoNaSala: ${nome}, ${indice}`, 'vivoNaSala', { sala, indice }, (a) => E.vivoNaSala(a.sala, a.indice));
    caso(`indicesDePe: ${nome}`, 'indicesDePe', { sala }, (a) => E.indicesDePe(a.sala));
  }

  const vista = E.monsterView(E.freshCombatMonster((grupo.monsters ?? [])[1] as MonsterInstance));
  caso('gravarMonstro: a visão volta crua pra sala', 'gravarMonstro', { estado: naSalaDaMasmorra(grupo), indice: 1, monstro: { ...vista, hp: 3 } }, (a) =>
    E.gravarMonstro(a.estado, a.indice, a.monstro));
  caso('gravarMonstro: monstro já cru', 'gravarMonstro', { estado: naSalaDaMasmorra(grupo), indice: 0, monstro: { ...E.freshCombatMonster((grupo.monsters ?? [])[0] as MonsterInstance), hp: 0 } }, (a) =>
    E.gravarMonstro(a.estado, a.indice, a.monstro));

  for (const [nome, estado] of [
    ['um monstro', naSalaDaMasmorra(umMonstro)],
    ['grupo com um caído', naSalaDaMasmorra(grupoComUmCaido)],
    ['com a bênção do NPC', naSalaDaMasmorra(umMonstro, comBencao)],
    ['com buffs da luta anterior', naSalaDaMasmorra(umMonstro, heroi({ classe: 'guerreiro', extra: { buffs: { forcaTurns: 2, forcaAmount: 0.3, critNext: true } } }))],
  ] as const) {
    caso(`prepararLuta: ${nome}`, 'prepararLuta', { estado }, (a) => E.prepararLuta(a.estado));
  }

  /** A sala com o monstro `indice` já caído (a vida zerada gravada), e a visão dele, como quem chama entrega. */
  const caiu = (sala: DungeonCell, indice: number, hero: Hero = cidade.hero, o: Partial<EstadoNaMasmorra> = {}) => {
    const monsters = (sala.monsters ?? []).map((m, i) => (i === indice ? { ...E.freshCombatMonster(m), hp: 0 } : m));
    const abatido = E.monsterView((monsters[indice] as CombatMonster));
    return { estado: naSalaDaMasmorra({ ...sala, monsters }, hero, [], o), abatido };
  };

  const quaseSobe = heroi({ classe: 'guerreiro', extra: { xp: 39 } });
  const missao = (type: Quest['type']): Quest => ({ id: `q_${type}`, type, target: 3, progress: 1, title: type, desc: type, rewardXp: 10, rewardGold: 10, done: false, claimed: false });
  for (const [nome, { estado, abatido }] of [
    ['o primeiro de um grupo', caiu(grupo, 0)],
    ['o do meio de um grupo', caiu(grupo, 1)],
    ['o único', caiu(umMonstro, 0)],
    ['sobe de nível', caiu(umMonstro, 0, quaseSobe)],
    ['com missão de caça e de coleta', caiu(grupo, 0, cidade.hero, { quests: [missao('kill'), missao('collect')] })],
  ] as const) {
    caso(`pagarAbate: ${nome}`, 'pagarAbate', { estado, abatido }, (a) => E.pagarAbate(a.estado, a.abatido));
  }

  const temporario = companheiro('guerreiro', { temporary: true, combatsLeft: 1 });
  const fiel = companheiro('mago');
  const veterano = heroi({ classe: 'guerreiro', arma: 'espada', extra: { masteryBattles: 9 } });
  const limpa = (nome: string, estado: EstadoNaMasmorra, abatido: CombatMonsterView, rng: RngSpec) =>
    caso(`limparSala: ${nome}`, 'limparSala', { estado, abatido }, (a, ctx) => E.limparSala(a.estado, a.abatido, ctx.rng, ctx.now), { rng, now: AGORA });
  const ultimo = caiu(umMonstro, 0);
  limpa('sem item', ultimo.estado, ultimo.abatido, { sequence: [0.99] });
  limpa('com item', ultimo.estado, ultimo.abatido, { seed: sementeOnde((primeiro) => primeiro < 0.25) });
  limpa('com ouro escondido', { ...ultimo.estado, map: [[{ ...(E.celulaAtual(ultimo.estado) as DungeonCell), bonusTreasure: { gold: 35 } }]] }, ultimo.abatido, { sequence: [0.99] });
  limpa(
    'com item escondido',
    { ...ultimo.estado, map: [[{ ...(E.celulaAtual(ultimo.estado) as DungeonCell), bonusTreasure: { item: item('botas', 'raro') } }]] },
    ultimo.abatido,
    { sequence: [0.99] },
  );
  limpa('o temporário se despede, o fiel fica', { ...ultimo.estado, party: [temporario, fiel] }, ultimo.abatido, { sequence: [0.99] });
  limpa('a maestria sobe', caiu(umMonstro, 0, veterano).estado, ultimo.abatido, { sequence: [0.99] });
  const noChefe = caiu(chefe, 0);
  limpa('o chefe leva ao andar seguinte', comGradeInteira(noChefe.estado), noChefe.abatido, { seed: 42 });
  const noFundo = caiu(chefe, 0, cidade.hero, { floor: E.DUNGEON_FLOORS });
  limpa('o chefe do último andar zera a masmorra', comGradeInteira(noFundo.estado), noFundo.abatido, { seed: 43 });
  limpa('zera no Difícil da Caverna', comGradeInteira({ ...noFundo.estado, masmorra: { dungeon: 'caverna', difficulty: 'dificil' } }), noFundo.abatido, { seed: 44 });

  // A luta do app: o item achado pode vir com material, o do chefe com mais chance, e o andar de depois do chefe também.
  const limpaNoApp = (nome: string, estado: EstadoNaMasmorra, abatido: CombatMonsterView, rng: RngSpec) =>
    caso(`limparSala: no app, ${nome}`, 'limparSala', { estado, abatido, app: true }, (a, ctx) => E.limparSala(a.estado, a.abatido, ctx.rng, ctx.now, a.app), { rng, now: AGORA });
  const fundoComum = caiu(umMonstro, 0, cidade.hero, { floor: 90 });
  // As três primeiras sementes em que o item cai (o primeiro sorteio abaixo da chance de loot).
  const comItem = Array.from({ length: 200 }, (_, i) => i + 1).filter((semente) => E.seededRng(semente)() < 0.25).slice(0, 3);
  for (const semente of comItem) {
    limpaNoApp(`no andar 90, com item, semente ${semente}`, fundoComum.estado, fundoComum.abatido, { seed: semente });
  }
  limpaNoApp('sem item', fundoComum.estado, fundoComum.abatido, { sequence: [0.99] });
  limpaNoApp('o chefe leva ao andar seguinte', comGradeInteira(noChefe.estado), noChefe.abatido, { seed: 42 });
  const chefeFundo = caiu(chefe, 0, cidade.hero, { floor: 85 });
  for (const semente of [45, 46]) limpaNoApp(`o chefe do andar 85, semente ${semente}`, comGradeInteira(chefeFundo.estado), chefeFundo.abatido, { seed: semente });
  // A primeira semente em que o item achado vem com material: no chefe (com a chance dobrada) e num monstro comum.
  const sementeComMaterial = (estado: EstadoNaMasmorra, abatido: CombatMonsterView): number => {
    for (let semente = 1; semente < 2000; semente++) {
      if ((E.limparSala(estado, abatido, E.seededRng(semente), relogio, true).loot?.degrau ?? 1) > 1) return semente;
    }
    throw new Error('nenhuma semente deu item com material');
  };
  limpaNoApp('o item do chefe vem com material', comGradeInteira(chefeFundo.estado), chefeFundo.abatido, { seed: sementeComMaterial(comGradeInteira(chefeFundo.estado), chefeFundo.abatido) });
  limpaNoApp('o item do monstro vem com material', fundoComum.estado, fundoComum.abatido, { seed: sementeComMaterial(fundoComum.estado, fundoComum.abatido) });
  // A primeira semente em que o chefe do app deixa uma runa.
  const sementeComRuna = (): number => {
    for (let semente = 1; semente < 3000; semente++) {
      const limpa = E.limparSala(comGradeInteira(chefeFundo.estado), chefeFundo.abatido, E.seededRng(semente), relogio, true);
      if (limpa.log.some((linha) => linha.startsWith('O chefe deixa cair'))) return semente;
    }
    throw new Error('o chefe de teste nunca deixou runa');
  };
  limpaNoApp('o chefe deixa uma runa', comGradeInteira(chefeFundo.estado), chefeFundo.abatido, { seed: sementeComRuna() });

  const perde = (nome: string, estado: EstadoNaMasmorra, rng: RngSpec) => caso(`perderLuta: ${nome}`, 'perderLuta', { estado }, (a, ctx) => E.perderLuta(a.estado, ctx.rng), { rng });
  const nivel = (level: number, gold: number) => heroi({ classe: 'guerreiro', level, extra: { gold, hp: 0 } });
  const mochila = [item('pot_vida'), item('espada', 'raro'), item('couro', 'incomum'), { ...item('adaga'), equipped: true }];
  perde('iniciante não perde nada', comGradeInteira(naSalaDaMasmorra(umMonstro, nivel(5, 300), mochila)), { sequence: [] });
  perde('perde 10% do ouro e um item comum ou incomum', comGradeInteira(naSalaDaMasmorra(umMonstro, nivel(6, 300), mochila)), { sequence: [0.6] });
  perde('o ouro perdido para em 500', comGradeInteira(naSalaDaMasmorra(umMonstro, nivel(20, 9000), [])), { sequence: [0] });
  perde('a equipe volta com 30%', comGradeInteira({ ...naSalaDaMasmorra(umMonstro, nivel(2, 0)), party: [companheiro('guerreiro', { hp: 0 }), fiel] }), { sequence: [] });
  const ossos = { ...companheiro('bardo', { name: 'Esqueleto' }), invocado: true };
  perde('os esqueletos ficam pra trás', comGradeInteira({ ...naSalaDaMasmorra(umMonstro, nivel(2, 0)), party: [ossos, fiel] }), { sequence: [] });
  limpa('os esqueletos voltam ao pó, o fiel fica', { ...ultimo.estado, party: [ossos, temporario, fiel] }, ultimo.abatido, { sequence: [0.99] });
}

function naSalaInterage(nome: string, estado: EstadoDoJogo, semente: number, pet: string | null = null): void {
  caso(`interagir: ${nome}`, 'interagir', { estado, pet }, (a, ctx) => E.interagir(a.estado, ctx.rng, a.pet as never, ctx.now), { rng: { seed: semente }, now: AGORA });
}

naSalaInterage('portão de aprendiz', naSalaDaCidade('gate', aprendizNovo), 110);
naSalaInterage('portão com classe', naSalaDaCidade('gate', guerreiro), 111);
naSalaInterage('taverna', { ...naSalaDaCidade('tavern', machucado), party: [companheiro('guerreiro', { hp: 5 })] }, 112);
naSalaInterage('vendedor', naSalaDaCidade('shop'), 113);
naSalaInterage('ferreiro', naSalaDaCidade('blacksmith'), 114);
naSalaInterage('quadro de missões', naSalaDaCidade('questboard'), 115);
naSalaInterage('guilda de aprendiz', naSalaDaCidade('guild', aprendizNovo), 116);
naSalaInterage('guilda de quem tem classe', naSalaDaCidade('guild', guerreiro), 117);
naSalaInterage('NPC da cidade', naSalaDaCidade('npc'), 118);
naSalaInterage('ponto de partida da cidade', naSalaDaCidade('start'), 119);
naSalaInterage('a loja fecha o tutorial', { ...naSalaDaCidade('shop'), tutorial: tutorial(todosMenos('shop')) }, 120);
naSalaInterage('encantadora (no site, a porta fechada)', naSalaDaCidade('encantadora'), 152);

const bau = (o: Partial<DungeonCell>) => naSalaDaMasmorra({ type: 'treasure', isMimic: false, giveGold: false, collected: false, ...o });
naSalaInterage('baú de ouro', bau({ giveGold: true, item: null }), 121);
naSalaInterage('baú com item', bau({ item: espadaNova }), 122);
naSalaInterage('baú vazio', bau({ item: espadaNova, collected: true }), 123);
naSalaInterage('mímico de ouro', bau({ isMimic: true, giveGold: true, item: null }), 124);
naSalaInterage('mímico de item', bau({ isMimic: true, item: anel }), 125);
naSalaInterage('mímico na caverna', { ...bau({ isMimic: true, giveGold: true, item: null }), masmorra: { dungeon: 'caverna', difficulty: 'normal' } }, 126);
naSalaInterage('monstro', naSalaDaMasmorra(umMonstro), 127);
naSalaInterage('monstro com pet', naSalaDaMasmorra(umMonstro), 128, petDeTeste);
naSalaInterage('monstro vencido', naSalaDaMasmorra({ ...umMonstro, beaten: true }), 129);
naSalaInterage('chefe', naSalaDaMasmorra(chefe), 130);
naSalaInterage('o primeiro combate fecha a etapa', { ...naSalaDaMasmorra(umMonstro), tutorial: tutorial({ move: true }) }, 131);
naSalaInterage('escada', comGradeInteira(naSalaDaMasmorra({ type: 'stairs' })), 132);
naSalaInterage('escada selada pelo chefe', {
  ...naSalaDaMasmorra({ type: 'stairs' }, guerreiro, [], { floor: 5 }),
  map: [[{ ...(E.celulaAtual(masmorra) as DungeonCell), type: 'stairs' }, chefe]],
  mapCols: 2,
}, 133);
naSalaInterage('escada no fundo', naSalaDaMasmorra({ type: 'stairs' }, guerreiro, [], { floor: E.DUNGEON_FLOORS }), 134);
naSalaInterage('saída', comGradeInteira(naSalaDaMasmorra({ type: 'exit' })), 135);
naSalaInterage('NPC da masmorra', naSalaDaMasmorra({ type: 'npc', npc: npc('heal') as DungeonCell['npc'] }), 136);
naSalaInterage('totem', naSalaDaMasmorra({ type: 'totem' }, guerreiro, [], { floor: 20 }), 137);
naSalaInterage('mestre que já ensinou', naSalaDaMasmorra({ type: 'teacher', teacher: { classId: 'guerreiro', number: 1, taught: true } }), 138);
naSalaInterage('mestre', naSalaDoMestre(aprendizDeMestre), 139);
naSalaInterage('mestre de outra classe', naSalaDoMestre(aprendizDeMestre, { classId: 'mago' }), 140);
naSalaInterage('evento', naSalaDoEvento('altar'), 141);
naSalaInterage('evento resolvido', naSalaDoEvento('altar', { resolved: true }), 142);
naSalaInterage('evento desconhecido', naSalaDoEvento('xyz'), 143);
naSalaInterage('ponto de partida da masmorra', naSalaDaMasmorra({ type: 'start' }), 144);
naSalaInterage('sala vazia', naSalaDaMasmorra({ type: 'normal' }), 145);

// No app: o ferreiro vende peça com material, a escada e o portão geram andar com material, e o evento guarda que é do app.
function naSalaInterageNoApp(nome: string, estado: EstadoDoJogo, semente: number): void {
  caso(`interagir: no app, ${nome}`, 'interagir', { estado, pet: null, app: true }, (a, ctx) => E.interagir(a.estado, ctx.rng, a.pet as never, ctx.now, a.app), {
    rng: { seed: semente },
    now: AGORA,
  });
}
naSalaInterageNoApp('ferreiro no andar 80', { ...naSalaDaCidade('blacksmith'), floor: 80 }, 146);
naSalaInterageNoApp('vendedor', naSalaDaCidade('shop'), 147);
naSalaInterageNoApp('portão com classe', naSalaDaCidade('gate', guerreiro), 148);
naSalaInterageNoApp('escada no andar 71', comGradeInteira(naSalaDaMasmorra({ type: 'stairs' }, guerreiro, [], { floor: 71 })), 149);
naSalaInterageNoApp('evento', naSalaDoEvento('altar'), 150);
naSalaInterageNoApp('baú com item', bau({ item: espadaNova }), 151);
naSalaInterageNoApp('encantadora', naSalaDaCidade('encantadora'), 153);

const humano = E.raceById('humano')!;
caso('criacaoVazia: com nome', 'criacaoVazia', { nome: 'Lia' }, (a) => E.criacaoVazia(a.nome));
for (const [nome, criacao] of [
  ['sem nome', { nome: '   ', raca: humano, cabelo: null }],
  ['sem raça', { nome: 'Lia', raca: null, cabelo: null }],
  ['pronta', { nome: 'Lia', raca: humano, cabelo: 'longo' }],
] as const) {
  caso(`faltaParaComecar: ${nome}`, 'faltaParaComecar', { criacao }, (a) => E.faltaParaComecar(a.criacao));
}
for (const [nome, criacao, semente] of [
  ['humano', { nome: ' Lia ', raca: humano, cabelo: null }, 150],
  ['elfo de cabelo escolhido', { nome: 'Ilen', raca: E.raceById('elfo')!, cabelo: 'curto' }, 151],
  ['outra semente', { nome: 'Lia', raca: humano, cabelo: null }, 152],
  ['sem raça', { nome: 'Lia', raca: null, cabelo: null }, 153],
] as const) {
  caso(`montarSaveInicial: ${nome}`, 'montarSaveInicial', { criacao }, (a, ctx) => E.montarSaveInicial(a.criacao, ctx.rng, ctx.now), {
    rng: { seed: semente },
    now: AGORA,
  });
}

// ---------- o chefe final (jogo/chefe-final.ts) e o prêmio de quem zera (jogo/conquista.ts) ----------

{
  const DA_FLORESTA = ['goblin', 'lobo_sombras', 'aranha', 'slime'];
  const final = (o: Partial<CombatMonster> = {}): CombatMonster => ({
    ...E.freshCombatMonster(E.generateBoss(100, { rng: E.seededRng(9), species: DA_FLORESTA, main: true, final: true })),
    ...o,
  });
  for (const [nome, monstro] of [
    ['primeiro golpe', final()],
    ['o terceiro golpe é o Golpe Devastador', final({ attackCount: 2 })],
    ['o sexto é o Rugido', final({ attackCount: 5, poderes: 1 })],
    ['na fúria, a cada 2', final({ attackCount: 1, furia: true })],
    ['na fúria, golpe comum', final({ attackCount: 2, furia: true, poderes: 1 })],
    ['chefe que não é o final', { ...final({ attackCount: 2 }), chefeFinal: undefined }],
  ] as const) {
    caso(`poderDaVez: ${nome}`, 'poderDaVez', { monstro }, (a) => E.poderDaVez(a.monstro));
  }

  const noFundo = (monsters: MonsterInstance[], o: Partial<EstadoNaMasmorra> = {}) =>
    naSalaDaMasmorra({ ...chefe, monsters, monsterIndex: 0, beaten: false }, cidade.hero, [], { floor: E.DUNGEON_FLOORS, ...o });
  const salaDo = (estado: EstadoNaMasmorra) => E.celulaAtual(estado) as DungeonCell;
  const fresco = final();
  const sozinho = noFundo([fresco]);
  const chamou = E.ferirMonstro(sozinho, 0, { ...fresco, hp: 0 }, E.seededRng(3)).estado;
  const comLacaios = salaDo(chamou).monsters as CombatMonster[];
  const semLacaios = noFundo(comLacaios.map((m, i) => (i === 0 ? m : { ...m, hp: 0 })));
  const furioso = E.enfurecer(semLacaios).estado;
  const comum = E.freshCombatMonster((umMonstro.monsters ?? [])[0] as MonsterInstance);
  for (const [nome, estado, indice, depois, seed] of [
    ['monstro comum', naSalaDaMasmorra(umMonstro), 0, { ...comum, hp: 1 }, 1],
    ['o chefe perde vida, longe da metade', sozinho, 0, { ...fresco, hp: fresco.hp - 7 }, 2],
    ['o chefe passaria da metade: para nela e chama os lacaios', sozinho, 0, { ...fresco, hp: -5 }, 3],
    ['no Pesadelo da Caverna, os lacaios são de lá', noFundo([fresco], { masmorra: { dungeon: 'caverna', difficulty: 'pesadelo' } }), 0, { ...fresco, hp: 0 }, 4],
    ['protegido pelos lacaios', chamou, 0, { ...(comLacaios[0] as CombatMonster), hp: 1 }, 5],
    ['golpe num lacaio', chamou, 2, { ...(comLacaios[2] as CombatMonster), hp: 0 }, 6],
    ['sem dano, nada muda', chamou, 0, comLacaios[0] as CombatMonster, 7],
    ['depois dos lacaios, abaixo da metade, cai de verdade', furioso, 0, { ...(salaDo(furioso).monsters?.[0] as CombatMonster), hp: 0 }, 8],
  ] as const) {
    caso(`ferirMonstro: ${nome}`, 'ferirMonstro', { estado, indice, depois }, (a, ctx) => E.ferirMonstro(a.estado, a.indice, a.depois as CombatMonster, ctx.rng), { rng: { seed } });
  }
  for (const [nome, estado] of [
    ['sozinho', sozinho],
    ['com os lacaios', chamou],
    ['lacaios caídos', semLacaios],
    ['sala comum', naSalaDaMasmorra(grupo)],
  ] as const) {
    const sala = salaDo(estado);
    caso(`lacaiosDePe: ${nome}`, 'lacaiosDePe', { sala }, (a) => E.lacaiosDePe(a.sala));
    for (const indice of [0, 1]) caso(`protegido: ${nome}, ${indice}`, 'protegido', { sala, indice }, (a) => E.protegido(a.sala, a.indice));
    caso(`inimigosDaLuta: chefe final, ${nome}`, 'inimigosDaLuta', { estado }, (a) => E.inimigosDaLuta(a.estado));
    caso(`enfurecer: ${nome}`, 'enfurecer', { estado }, (a) => E.enfurecer(a.estado));
  }
  caso('enfurecer: já furioso', 'enfurecer', { estado: furioso }, (a) => E.enfurecer(a.estado));
  caso('inimigosDaLuta: o chefe final avisa o Golpe Devastador', 'inimigosDaLuta', { estado: noFundo([final({ attackCount: 2 })]) }, (a) => E.inimigosDaLuta(a.estado));

  const lacaioCaido = { ...(comLacaios[1] as CombatMonster), hp: 0 };
  caso('pagarAbate: um lacaio do chefe final, sem ouro', 'pagarAbate', { estado: chamou, abatido: E.monsterView(lacaioCaido) }, (a) => E.pagarAbate(a.estado, a.abatido));
  const ultimoGolpe = noFundo([{ ...(salaDo(furioso).monsters?.[0] as CombatMonster), hp: 0 }]);
  caso('limparSala: no app, o chefe final zera a masmorra', 'limparSala', { estado: { ...ultimoGolpe, mapRows: 6, mapCols: 6 }, abatido: E.monsterView({ ...fresco, hp: 0 }), app: true }, (a, ctx) =>
    E.limparSala(a.estado, a.abatido, ctx.rng, ctx.now, a.app), { rng: { seed: 71 }, now: AGORA });
  // Zerar de novo a mesma dificuldade: o baú e o ouro, sem o acessório único.
  const jaZerada = { ...ultimoGolpe, mapRows: 6, mapCols: 6, progresso: { cleared: [E.runKey(ultimoGolpe.masmorra)], totems: {} } };
  caso('limparSala: no app, zerar de novo não dá o acessório único', 'limparSala', { estado: jaZerada, abatido: E.monsterView({ ...fresco, hp: 0 }), app: true }, (a, ctx) =>
    E.limparSala(a.estado, a.abatido, ctx.rng, ctx.now, a.app), { rng: { seed: 71 }, now: AGORA });

  for (const masmorra of E.DUNGEONS) {
    for (const dificuldade of E.DIFFICULTIES) {
      const run = { dungeon: masmorra.id, difficulty: dificuldade.id };
      caso(`tituloDe: ${E.runKey(run)}`, 'tituloDe', { run }, (a) => E.tituloDe(a.run));
    }
  }
  for (const [nome, cleared] of [
    ['nada zerado', []],
    ['a Floresta no Normal', ['floresta:normal']],
    ['Normal e Difícil', ['floresta:normal', 'floresta:dificil']],
    ['empate de degrau: a masmorra mais adiante', ['floresta:normal', 'floresta:dificil', 'floresta:pesadelo', 'caverna:normal']],
    ['a Torre no Pesadelo', ['torre:pesadelo', 'floresta:normal']],
  ] as const) {
    caso(`tituloDoHeroi: ${nome}`, 'tituloDoHeroi', { progresso: { cleared, totems: {} } }, (a) => E.tituloDoHeroi(a.progresso as DungeonProgress));
  }
  for (const andar of [1, 100, 177, 331]) caso(`ouroDoBau: força ${andar}`, 'ouroDoBau', { andar }, (a) => E.ouroDoBau(a.andar));
  for (const [nome, estado, app, seed] of [
    ['no site, Floresta Normal', noFundo([fresco]), false, 81],
    ['no app, Caverna Normal', noFundo([fresco], { masmorra: { dungeon: 'caverna', difficulty: 'normal' } }), true, 82],
  ] as const) {
    caso(`abrirBauDoChefe: ${nome}`, 'abrirBauDoChefe', { estado, app }, (a, ctx) => E.abrirBauDoChefe(a.estado, ctx.rng, ctx.now, a.app), { rng: { seed }, now: AGORA });
  }

}

// =====================================================================
// luta — a luta em tempo real do app (etapa 5)
// =====================================================================

modulo('luta');

// ---------- o evento de cada arma ----------

for (const arma of [...E.templatesByCategory('arma').map((t) => t.id), null, 'constructor', 'escudo']) {
  caso(`eventoDaArma: ${arma}`, 'eventoDaArma', { templateId: arma }, (a) => E.eventoDaArma(a.templateId));
  caso(`eventoDaArma: ${arma} no teclado`, 'eventoDaArma', { templateId: arma, teclado: true }, (a) => E.eventoDaArma(a.templateId, a.teclado));
}

{
  const SEM_SORTEIO: RngSpec = { sequence: [] };
  for (const [nome, hero, estilo] of [
    ['bárbaro de espada', heroi({ arma: 'espada' }), 'normal'],
    ['guerreiro de espada, zona da classe', heroi({ classe: 'guerreiro', arma: 'espada' }), 'normal'],
    ['clérigo de maça', heroi({ classe: 'clerigo' }), 'normal'],
    ['maça com Precisão 25', heroi({ arma: 'maca', extra: { buffs: { precisaoTurns: 2, precisaoAmount: 25 } } }), 'normal'],
    ['arqueiro de arco, tiro', heroi({ classe: 'arqueiro' }), 'ranged'],
    ['arco com Visão Fraca', heroi({ arma: 'arco', debuff: 'visao_fraca' }), 'normal'],
    ['bárbaro de machado', heroi({ arma: 'machado' }), 'normal'],
    ['marreta', heroi({ arma: 'marreta' }), 'normal'],
    ['bardo de violão', heroi({ classe: 'bardo', arma: 'violao' }), 'normal'],
    ['ladino de adaga', heroi({ classe: 'ladino' }), 'normal'],
    ['mão vazia', heroi({ arma: null }), 'normal'],
  ] as const) {
    caso(`eventoDoAtaque: ${nome}`, 'eventoDoAtaque', { hero, estilo }, (a, ctx) => E.eventoDoAtaque(a.hero, a.estilo, ctx.rng), { rng: SEM_SORTEIO });
  }
  const mago = heroi({ classe: 'mago' });
  for (const sorteio of [0, 0.2, 0.4, 0.6, 0.99]) {
    caso(`eventoDoAtaque: mago de cajado, sorteio ${sorteio}`, 'eventoDoAtaque', { hero: mago, estilo: 'magic' }, (a, ctx) => E.eventoDoAtaque(a.hero, a.estilo as AttackStyle, ctx.rng), {
      rng: { sequence: [sorteio] },
    });
  }
  caso('eventoDoAtaque: necromante de cajado, golpe físico', 'eventoDoAtaque', { hero: heroi({ classe: 'necromante' }), estilo: 'normal' }, (a, ctx) =>
    E.eventoDoAtaque(a.hero, a.estilo as AttackStyle, ctx.rng), { rng: { seed: 77 } });

  // No teclado: o cajado sorteia uma letra por nota, sem repetir a de antes; as outras armas não mudam.
  const noTeclado = (nome: string, hero: Hero, estilo: AttackStyle, rng: RngSpec) =>
    caso(`eventoDoAtaque: ${nome} no teclado`, 'eventoDoAtaque', { hero, estilo, teclado: true }, (a, ctx) => E.eventoDoAtaque(a.hero, a.estilo, ctx.rng, a.teclado), { rng });
  for (const sorteios of [[0, 0, 0], [0.99, 0.99, 0.99], [0.3, 0.5, 0.8], [0.6, 0.1, 0.9], [0.25, 0.34, 0.67]]) {
    noTeclado(`mago de cajado, sorteios ${sorteios.join(' ')}`, mago, 'magic', { sequence: sorteios });
  }
  noTeclado('necromante de cajado, golpe físico', heroi({ classe: 'necromante' }), 'normal', { seed: 78 });
  noTeclado('bárbaro de espada', heroi({ arma: 'espada' }), 'normal', SEM_SORTEIO);
  noTeclado('bardo de violão', heroi({ classe: 'bardo', arma: 'violao' }), 'normal', SEM_SORTEIO);
  noTeclado('mão vazia', heroi({ arma: null }), 'normal', SEM_SORTEIO);
}

// ---------- a leitura ----------

{
  const le = (nome: string, evento: EventoDeArma, jogada: JogadaDoEvento) => caso(`lerEvento: ${nome}`, 'lerEvento', { evento, jogada }, (a) => E.lerEvento(a.evento, a.jogada));

  const barra = (zona: number): EventoDeArma => ({ tipo: 'barra', zona, duracao: E.DURACAO_DA_BARRA });
  for (const zona of [0.5, 2 / 3, 0.85, 0.1]) {
    for (const toque of [0, 10, 21, 30, 41, 42, 43, 55, 63, 70, 83, 84]) le(`barra, zona ${zona}, toque ${toque}`, barra(zona), { toque });
    le(`barra, zona ${zona}, sem toque`, barra(zona), {});
  }
  for (const toque of [85, -1, 1.5, Number.NaN]) le(`barra, toque ${toque} lança`, barra(0.5), { toque });

  const circulo: EventoDeArma = { tipo: 'circulo', zona: 0.5, duracao: E.DURACAO_DO_CIRCULO };
  for (const toque of [0, 30, 42, 50, 84]) le(`bolinha, toque ${toque}`, circulo, { toque });
  le('bolinha, sem toque', circulo, {});
  le('bolinha com o campo da carga não conta', circulo, { soltou: 42 });

  const carga = (zona: number): EventoDeArma => ({ tipo: 'carga', zona, duracao: E.DURACAO_DA_CARGA });
  for (const soltou of [0, 20, 33, 42, 51, 60, 83, 84]) le(`carga, soltou ${soltou}`, carga(0.5), { soltou });
  le('carga da classe, soltou 64', carga(2 / 3), { soltou: 64 });
  le('carga, não soltou', carga(0.5), {});
  le('carga, soltou 90 lança', carga(0.5), { soltou: 90 });

  const ritmo = (zona: number): EventoDeArma => ({ tipo: 'ritmo', zona, duracao: 114, notas: [...E.NOTAS_DO_RITMO], janela: E.JANELA_DO_RITMO });
  for (const [nome, toques] of [
    ['em cima das três', [30, 60, 90]],
    ['um passo fora em cada', [31, 59, 91]],
    ['dois passos fora', [32, 62, 88]],
    ['a primeira atrasada 6', [36, 60, 90]],
    ['só a do meio', [60]],
    ['nenhuma na janela', [0, 1, 2, 113]],
    ['cedo demais em todas', [6, 36, 66]],
    ['bate sem parar', Array.from({ length: 115 }, (_, i) => i)],
    ['dois toques na mesma janela', [29, 31, 60, 90]],
    ['toques repetidos no mesmo passo', [30, 30, 60, 90]],
    ['nenhum toque', []],
  ] as const) {
    le(`ritmo, ${nome}`, ritmo(0.5), { toques: [...toques] });
  }
  le('ritmo da classe, um pouco fora', ritmo(2 / 3), { toques: [34, 55, 95] });
  le('ritmo, sem o campo dos toques', ritmo(0.5), {});
  le('ritmo, toque voltando lança', ritmo(0.5), { toques: [60, 30] });
  le('ritmo, toque depois do fim lança', ritmo(0.5), { toques: [30, 115] });

  const duplo: EventoDeArma = { tipo: 'toque_duplo', zona: 0.5, duracao: 58, notas: [...E.NOTAS_DO_TOQUE_DUPLO], janela: E.JANELA_DO_TOQUE_DUPLO };
  for (const [nome, toques] of [
    ['em cima', [24, 42]],
    ['um fora em cada', [25, 41]],
    ['o segundo atrasado', [24, 50]],
    ['só o primeiro', [24]],
    ['os dois cedo demais', [8, 26]],
    ['bate sem parar', Array.from({ length: 59 }, (_, i) => i)],
  ] as const) {
    le(`toque duplo, ${nome}`, duplo, { toques: [...toques] });
  }

  const desenho = (simbolo: string, zona = 0.5): EventoDeArma => ({ tipo: 'desenho', zona, duracao: E.DURACAO_DO_DESENHO, simbolo });
  const tracar = (simbolo: string, passos: number, desloca = 0): PontoDoTraco[] => {
    const pontos = E.SIMBOLOS[simbolo] as readonly (readonly [number, number])[];
    return pontos.map(([x, y], i) => ({ x: Math.min(1000, x + desloca), y, t: Math.floor((passos * i) / (pontos.length - 1)) }));
  };
  for (const simbolo of Object.keys(E.SIMBOLOS)) {
    le(`desenho, ${simbolo} em cima, rápido`, desenho(simbolo), { traco: tracar(simbolo, 30) });
    le(`desenho, ${simbolo} deslocado 40`, desenho(simbolo), { traco: tracar(simbolo, 30, 40) });
    le(`desenho, ${simbolo} devagar`, desenho(simbolo), { traco: tracar(simbolo, 100) });
    le(`desenho, ${simbolo} pela metade`, desenho(simbolo), { traco: tracar(simbolo, 20).slice(0, Math.ceil((E.SIMBOLOS[simbolo] as unknown[]).length / 2)) });
  }
  const raio = tracar('raio', 30);
  le('desenho, raio ao contrário', desenho('raio'), { traco: raio.map((p, i) => ({ ...(raio[raio.length - 1 - i] as PontoDoTraco), t: p.t })) });
  le('desenho, raio no círculo', desenho('circulo'), { traco: tracar('raio', 30) });
  le('desenho, onda no triângulo, zona da classe', desenho('triangulo', 2 / 3), { traco: tracar('onda', 30) });
  le('desenho, quatro cantos do círculo', desenho('circulo'), { traco: [{ x: 500, y: 160, t: 0 }, { x: 840, y: 500, t: 8 }, { x: 500, y: 840, t: 16 }, { x: 160, y: 500, t: 24 }, { x: 500, y: 160, t: 32 }] });
  le('desenho, um ponto só', desenho('circulo'), { traco: [{ x: 500, y: 500, t: 0 }] });
  le('desenho, pontos repetidos', desenho('raio'), { traco: [{ x: 620, y: 120, t: 0 }, { x: 620, y: 120, t: 5 }, { x: 380, y: 880, t: 10 }] });
  le('desenho, sem traço', desenho('espiral'), {});
  le('desenho, ponto fora da caixa lança', desenho('circulo'), { traco: [{ x: 1001, y: 0, t: 0 }, { x: 0, y: 0, t: 1 }] });
  le('desenho, coordenada quebrada lança', desenho('circulo'), { traco: [{ x: 10.5, y: 0, t: 0 }, { x: 0, y: 0, t: 1 }] });
  le('desenho, passo depois do fim lança', desenho('circulo'), { traco: [{ x: 0, y: 0, t: 0 }, { x: 0, y: 0, t: 121 }] });
  le('desenho, passo voltando lança', desenho('circulo'), { traco: [{ x: 0, y: 0, t: 5 }, { x: 0, y: 0, t: 4 }] });
  le('desenho, símbolo herdado do objeto lança', desenho('constructor'), { traco: [] });
  le('desenho, traço comprido demais lança', desenho('circulo'), {
    traco: Array.from({ length: E.PONTOS_MAXIMOS_DO_TRACO + 1 }, (_, i) => ({ x: i % 1000, y: 500, t: Math.floor(i / 6) })),
  });

  // Traços de dedo: o símbolo com tremida, pontos pulados e tempo de sobra ou de falta.
  for (let i = 1; i <= 24; i++) {
    const simbolo = umDe(Object.keys(E.SIMBOLOS));
    const alvo = chance(0.8) ? simbolo : umDe(Object.keys(E.SIMBOLOS));
    const passos = entre(10, E.DURACAO_DO_DESENHO);
    const tremida = entre(0, 90);
    const base = E.SIMBOLOS[simbolo] as readonly (readonly [number, number])[];
    const traco: PontoDoTraco[] = [];
    for (let k = 0; k < base.length; k++) {
      if (k > 0 && k < base.length - 1 && chance(0.3)) continue;
      const [x, y] = base[k] as readonly [number, number];
      traco.push({
        x: Math.max(0, Math.min(1000, x + entre(-tremida, tremida))),
        y: Math.max(0, Math.min(1000, y + entre(-tremida, tremida))),
        t: Math.floor((passos * k) / (base.length - 1)),
      });
    }
    le(`desenho, lote ${i}`, desenho(alvo, umDe([0.5, 2 / 3, 0.4, 0.85])), { traco });
  }

  // A leitura com uma régua de números fixos: os da tabela podem mudar sem mexer nestes casos.
  const letras = (zona: number, quais = ['U', 'O', 'I']): EventoDeArma => ({
    tipo: 'letras',
    zona,
    duracao: 144,
    notas: [24, 72, 120],
    janela: 24,
    letras: quais,
  });
  const teclas = (...lista: Array<[string, number]>) => lista.map(([letra, t]) => ({ letra, t }));
  for (const [nome, lista] of [
    ['as três em cima', teclas(['U', 24], ['O', 72], ['I', 120])],
    ['um passo fora em cada', teclas(['U', 25], ['O', 71], ['I', 121])],
    ['a primeira atrasada 6', teclas(['U', 30], ['O', 72], ['I', 120])],
    ['a segunda errada', teclas(['U', 24], ['P', 72], ['I', 120])],
    ['a errada antes da certa na mesma janela', teclas(['U', 24], ['P', 70], ['O', 72], ['I', 120])],
    ['o passo em que a letra some já é da próxima', teclas(['U', 24], ['O', 48], ['O', 72], ['I', 120])],
    ['a última no último passo da janela', teclas(['U', 24], ['O', 72], ['I', 143])],
    ['tecla no fim do evento não conta', teclas(['U', 24], ['O', 72], ['I', 144])],
    ['só a do meio', teclas(['O', 72])],
    ['duas no mesmo passo', teclas(['U', 24], ['O', 72], ['P', 72], ['I', 120])],
    ['letra minúscula não é a mesma', teclas(['u', 24], ['o', 72], ['i', 120])],
    ['aperta todas sem parar', Array.from({ length: 145 }, (_, t) => ({ letra: ['U', 'I', 'O', 'P'][t % 4] as string, t }))],
    ['nenhuma tecla', []],
  ] as const) {
    le(`letras, ${nome}`, letras(0.5), { teclas: [...lista] });
  }
  le('letras da classe, um pouco fora', letras(2 / 3, ['P', 'U', 'O']), { teclas: teclas(['P', 28], ['U', 66], ['O', 126]) });
  le('letras com zona apertada', letras(0.4, ['I', 'P', 'U']), { teclas: teclas(['I', 26], ['P', 72], ['U', 117]) });
  le('letras, sem o campo das teclas', letras(0.5), {});
  le('letras, sem as letras no evento', { tipo: 'letras', zona: 0.5, duracao: 144, notas: [24, 72, 120], janela: 24 }, { teclas: teclas(['U', 24]) });
  le('letras, tecla voltando lança', letras(0.5), { teclas: teclas(['O', 72], ['U', 24]) });
  le('letras, tecla depois do fim lança', letras(0.5), { teclas: teclas(['U', 24], ['O', 145]) });
  le('letras, passo quebrado lança', letras(0.5), { teclas: teclas(['U', 24.5]) });

  le('evento desconhecido lança', { tipo: 'flauta' as never, zona: 0.5, duracao: 10 }, {});
}

// ---------- o golpe com a leitura feita ----------

{
  const LISO: RngSpec = { sequence: [0.99, 0.99] };
  const rg = (nome: string, hero: Hero, monster: CombatMonsterView, dado: number, leitura: LeituraDaMira, attackStyle: AttackStyle, rng: RngSpec) =>
    caso(`resolverGolpe: ${nome}`, 'resolverGolpe', { hero, monster, dado, leitura, attackStyle, options: {} }, (a, ctx) =>
      E.resolverGolpe(a.hero, a.monster, a.dado, a.leitura, a.attackStyle, { ...a.options, rng: ctx.rng }), { rng });

  const guerreiro = heroi({ classe: 'guerreiro', arma: 'espada' });
  const mago = heroi({ classe: 'mago' });
  rg('força 1×', guerreiro, monstro(), 1, { acerto: true, forca: 1, critico: false }, 'normal', LISO);
  rg('centro do evento: 1,5× e crítico', guerreiro, monstro(), 12, { acerto: true, forca: 1.5, critico: true }, 'normal', LISO);
  rg('a média do ritmo, 0,83×', heroi({ classe: 'bardo', arma: 'violao' }), monstro(), 9, { acerto: true, forca: 0.83, critico: false }, 'normal', LISO);
  rg('erro do evento', guerreiro, monstro(), 20, { acerto: false, forca: 0, critico: false }, 'normal', LISO);
  rg('desenho do mago, golpe mágico', mago, monstro(), 7, { acerto: true, forca: 1.2, critico: false }, 'magic', LISO);
  rg('mago sem mana', heroi({ classe: 'mago', extra: { mp: 1 } }), monstro(), 7, { acerto: true, forca: 1.2, critico: false }, 'magic', LISO);
  rg('o ágil esquiva fora do crítico', heroi({ arma: 'machado' }), monstro({ speciesId: 'lobo_sombras' }), 5, { acerto: true, forca: 1.1, critico: false }, 'normal', { sequence: [0.05] });
  rg('o crítico do evento fura a esquiva do ágil', heroi({ arma: 'machado' }), monstro({ speciesId: 'lobo_sombras' }), 5, { acerto: true, forca: 1.5, critico: true }, 'normal', { sequence: [0.05, 0.99, 0.99] });
  rg('critNext com o evento errado', heroi({ arma: 'adaga', extra: { buffs: { critNext: true } } }), monstro(), 3, { acerto: false, forca: 0, critico: false }, 'normal', LISO);
  rg('derruba o monstro', guerreiro, monstro({ hp: 4 }), 20, { acerto: true, forca: 1.5, critico: true }, 'normal', LISO);
  rg('força 1,6 lança', guerreiro, monstro(), 10, { acerto: true, forca: 1.6, critico: false }, 'normal', LISO);
  rg('força negativa lança', guerreiro, monstro(), 10, { acerto: true, forca: -0.1, critico: false }, 'normal', LISO);
  rg('força NaN lança', guerreiro, monstro(), 10, { acerto: true, forca: Number.NaN, critico: false }, 'normal', LISO);
  rg('dado 0 lança antes da força', guerreiro, monstro(), 0, { acerto: true, forca: 9, critico: false }, 'normal', LISO);

  for (let i = 1; i <= 30; i++) {
    const hero = heroiDeLote();
    const estilo = umDe(E.ataquesDisponiveis(hero)).estilo;
    const evento = E.eventoDoAtaque(hero, estilo, () => lote());
    const leitura = chance(0.15) ? E.lerMira(evento.zona, null) : E.lerMira(evento.zona, lote());
    rg(`lote ${i}`, hero, monstroDeLote(), entre(1, 20), leitura, estilo, { seed: 3000 + i });
  }
}

// ---------- a arena ----------

{
  const base = (grupo.monsters ?? [])[0] as MonsterInstance;
  const bicho = (speciesId: string, o: Partial<MonsterInstance> = {}): MonsterInstance => ({ ...base, speciesId, ...o });
  const forte = (o: HeroiDeTeste = {}) => {
    const h = heroi({ classe: 'guerreiro', level: 6, ...o });
    return { ...h, hp: 400, maxHp: 400, ...o.extra };
  };
  const salaCom = (monsters: MonsterInstance[], hero: Hero = forte(), o: Partial<EstadoNaMasmorra> = {}): EstadoNaMasmorra =>
    naSalaDaMasmorra({ ...umMonstro, monsters, monsterIndex: 0, beaten: false, bonusTreasure: undefined }, hero, [], o);

  for (const [nome, estado, chegada, pet] of [
    ['um monstro, entrando pelo sul', salaCom([bicho('goblin')]), 'N', null],
    ['grupo de três, entrando pelo norte', salaCom([bicho('goblin'), bicho('aranha'), bicho('slime')]), 'S', null],
    ['grupo com um caído', salaCom([bicho('goblin', { hp: 0 }), bicho('aranha'), bicho('slime')], forte(), {}), 'W', null],
    ['save da fila: quem ficou antes do monsterIndex já caiu', naSalaDaMasmorra({ ...umMonstro, monsters: [bicho('goblin'), bicho('aranha')], monsterIndex: 1, beaten: false, bonusTreasure: undefined }, forte(), []), 'W', null],
    ['com companheiros, um caído', { ...salaCom([bicho('zumbi')]), party: [companheiro('guerreiro'), companheiro('mago', { hp: 0 }), companheiro('clerigo')] }, 'E', null],
    ['com a bênção do NPC', salaCom([bicho('zumbi')], forte({ extra: { npcBlessing: { dodge: 15, combats: 2 } } })), null, null],
    ['com pet', salaCom([bicho('zumbi')]), null, petDeTeste],
  ] as const) {
    caso(`abrirLuta: ${nome}`, 'abrirLuta', { estado, chegada: E.roomArrival(chegada as Direction | null), pet }, (a) => E.abrirLuta(a.estado, a.chegada, a.pet as never));
  }
  caso('abrirLuta: no PC (teclado)', 'abrirLuta', { estado: salaCom([bicho('zumbi')]), chegada: E.roomArrival(null), pet: null, teclado: true }, (a) =>
    E.abrirLuta(a.estado, a.chegada, a.pet, a.teclado));

  const simula = (nome: string, luta: LutaEmTempoReal, entradas: EntradaDaLuta[], rng: RngSpec) =>
    caso(`simularLuta: ${nome}`, 'simularLuta', { luta, entradas }, (a, ctx) => E.simularLuta(a.luta, a.entradas, ctx.rng, ctx.now), { rng, now: AGORA });
  const parado = (n: number): EntradaDaLuta[] => Array.from({ length: n }, () => ({ x: 0, y: 0 }));
  /** O coração rodando pela caixa, 35 passos pra cada lado. */
  const rodando = (n: number): EntradaDaLuta[] =>
    parado(n).map((_, i) => {
      const fase = Math.floor(i / 35) % 4;
      return { x: fase === 0 ? 127 : fase === 2 ? -127 : 0, y: fase === 1 ? 127 : fase === 3 ? -127 : 0 };
    });
  const abrir = (estado: EstadoNaMasmorra, chegada: Direction | null = null) => E.abrirLuta(estado, E.roomArrival(chegada)).luta;
  /** Aperta o ataque no passo 0 e responde ao evento com `resposta`; o resto, parado. */
  const golpe = (passos: number, resposta: Record<number, EntradaDaLuta>): EntradaDaLuta[] =>
    parado(passos).map((e, i) => (i === 0 ? { ...e, atacar: true } : (resposta[i] ?? e)));

  // Cada jeito de lutar, com o coração parado (depois rodando pela caixa).
  for (const [nome, especie] of [
    ['agressivo investe', 'goblin'],
    ['ágil', 'lobo_sombras'],
    ['defensivo', 'esqueleto'],
    ['venenoso', 'aranha'],
    ['lento', 'zumbi'],
    ['mágico atira', 'elemental_fogo'],
    ['mágico de gelo', 'espectro_gelado'],
  ] as const) {
    simula(`${nome}, coração parado`, abrir(salaCom([bicho(especie, { hp: 900, maxHp: 900 })]), 'N'), parado(420), { seed: 500 + nome.length });
    simula(`${nome}, coração rodando`, abrir(salaCom([bicho(especie, { hp: 900, maxHp: 900 })]), 'S'), rodando(420), { seed: 600 + nome.length });
  }
  simula('grupo de três revezando os golpes', abrir(salaCom([bicho('goblin', { hp: 900 }), bicho('aranha', { hp: 900 }), bicho('lobo_sombras', { hp: 900 })]), 'N'), parado(600), { seed: 700 });
  simula('grupo de três, coração rodando', abrir(salaCom([bicho('elemental_fogo', { hp: 900 }), bicho('zumbi', { hp: 900 }), bicho('goblin', { hp: 900 })]), 'N'), rodando(600), { seed: 701 });

  // O evento de cada arma, contra um zumbi forte.
  const zumbi = () => salaCom([bicho('zumbi', { hp: 600, maxHp: 600 })]);
  const comArma = (classe: string | null, arma: string | null) => forte({ classe, arma });
  simula('espada: toque no meio da barra', abrir({ ...zumbi(), hero: comArma('guerreiro', 'espada') }), golpe(50, { 42: { x: 0, y: 0, tocar: true } }), { seed: 801 });
  simula('espada: barra sem toque', abrir({ ...zumbi(), hero: comArma('guerreiro', 'espada') }), golpe(100, {}), { seed: 802 });
  simula('arco: toque na bolinha, e o golpe cai no fim do evento', abrir({ ...zumbi(), hero: comArma('arqueiro', 'arco') }), golpe(90, { 40: { x: 0, y: 0, tocar: true } }), { seed: 803 });
  simula('machado: solta no meio', abrir({ ...zumbi(), hero: comArma('barbaro', 'machado') }), golpe(50, { 42: { x: 0, y: 0, soltar: true } }), { seed: 804 });
  simula('marreta: estoura', abrir({ ...zumbi(), hero: comArma('barbaro', 'marreta') }), golpe(100, {}), { seed: 805 });
  simula('violão: três batidas', abrir({ ...zumbi(), hero: comArma('bardo', 'violao') }), golpe(130, { 30: { x: 0, y: 0, tocar: true }, 61: { x: 0, y: 0, tocar: true }, 89: { x: 0, y: 0, tocar: true } }), { seed: 806 });
  simula('adaga: dois toques', abrir({ ...zumbi(), hero: comArma('ladino', 'adaga') }), golpe(70, { 24: { x: 0, y: 0, tocar: true }, 43: { x: 0, y: 0, tocar: true } }), { seed: 807 });
  simula('mão vazia: a barra', abrir({ ...zumbi(), hero: comArma(null, null) }), golpe(50, { 40: { x: 0, y: 0, tocar: true } }), { seed: 808 });
  for (const [semente, classe] of [
    [809, 'mago'],
    [810, 'necromante'],
  ] as const) {
    // O símbolo sai do primeiro sorteio da luta: o do aperto.
    const nomes = Object.keys(E.SIMBOLOS);
    const simbolo = nomes[Math.floor(E.seededRng(semente)() * nomes.length)] as string;
    const pontos = E.SIMBOLOS[simbolo] as readonly (readonly [number, number])[];
    const resposta: Record<number, EntradaDaLuta> = {};
    pontos.forEach(([x, y], i) => (resposta[i + 1] = { x: 0, y: 0, dedo: { x, y } }));
    simula(`cajado do ${classe}: o símbolo ${simbolo}`, abrir({ ...zumbi(), hero: comArma(classe, 'cajado') }), golpe(pontos.length + 60, resposta), { seed: semente });
  }
  simula('mago sem mana abre o desenho do golpe físico', abrir({ ...zumbi(), hero: { ...comArma('mago', 'cajado'), mp: 0 } }), golpe(60, { 40: { x: 0, y: 0, tocar: true } }), { seed: 812 });

  // O cajado no PC: as letras saem dos primeiros sorteios da luta, os do aperto; a tecla da última fecha o evento.
  {
    const noPc = (classe: string) => E.abrirLuta({ ...zumbi(), hero: comArma(classe, 'cajado') }, E.roomArrival(null), null, true).luta;
    const letrasDe = (luta: LutaEmTempoReal, semente: number) => E.passoDaLuta(luta, { x: 0, y: 0, atacar: true }, E.seededRng(semente)).luta.arena.evento?.evento.letras ?? [];
    const nasTeclas = (lista: Array<[number, string | undefined]>): Record<number, EntradaDaLuta> => Object.fromEntries(lista.map(([passo, tecla]) => [passo, { x: 0, y: 0, tecla }]));
    const outra = (letra: string | undefined) => E.LETRAS_DO_TECLADO.find((l) => l !== letra);
    const [b0, b1, b2] = E.NOTAS_DAS_LETRAS as [number, number, number];
    const ateOFim = b2 + E.JANELA_DAS_LETRAS + 40;
    const mago = noPc('mago');
    const naHora = letrasDe(mago, 840);
    simula('cajado no PC: as três letras na hora', mago, golpe(ateOFim, nasTeclas([[b0, naHora[0]], [b1, naHora[1]], [b2, naHora[2]]])), { seed: 840 });
    const comErro = letrasDe(mago, 841);
    simula('cajado no PC: a segunda errada, a terceira atrasada', mago, golpe(ateOFim, nasTeclas([[b0, comErro[0]], [b1 - 2, outra(comErro[1])], [b1, comErro[1]], [b2 + 8, comErro[2]]])), { seed: 841 });
    simula('cajado no PC: sem apertar, o evento vai até o fim e erra', mago, golpe(ateOFim, {}), { seed: 842 });
    simula('cajado no PC: o ataque e o toque não são letra', mago, golpe(ateOFim, { 10: { x: 0, y: 0, atacar: true }, [b0]: { x: 0, y: 0, tocar: true } }), { seed: 843 });
    const necromante = noPc('necromante');
    const doNecromante = letrasDe(necromante, 844);
    simula('cajado do necromante no PC', necromante, golpe(ateOFim, nasTeclas([[b0 + 6, doNecromante[0]], [b1 - 6, doNecromante[1]], [b2, doNecromante[2]]])), { seed: 844 });
    simula('espada no PC: a barra de sempre', E.abrirLuta({ ...zumbi(), hero: comArma('guerreiro', 'espada') }, E.roomArrival(null), null, true).luta, golpe(50, { 42: { x: 0, y: 0, tocar: true } }), { seed: 845 });
  }

  // O alvo: tocar no monstro, e quem cai passa a vez de alvo.
  const tres = (hero: Hero) => salaCom([bicho('zumbi', { hp: 600, maxHp: 600 }), bicho('slime', { hp: 600, maxHp: 600 }), bicho('aranha', { hp: 0 })], hero);
  simula('mirar no segundo, e o golpe cai nele', abrir(tres(comArma('guerreiro', 'espada'))), golpe(50, { 42: { x: 0, y: 0, tocar: true } }).map((e, i) => (i === 0 ? { ...e, mirar: 1 } : e)), { seed: 813 });
  simula('mirar num caído, ou num que não existe, não muda o alvo', abrir(tres(comArma('guerreiro', 'espada'))), parado(10).map((e, i) => (i === 1 ? { ...e, mirar: 2 } : i === 2 ? { ...e, mirar: 5 } : i === 3 ? { ...e, mirar: -1 } : e)), { seed: 814 });
  simula('derrubar o alvo passa pro próximo de pé', abrir({ ...salaCom([bicho('zumbi', { hp: 1 }), bicho('slime', { hp: 600, maxHp: 600 })]), hero: comArma('guerreiro', 'espada') }), golpe(80, { 42: { x: 0, y: 0, tocar: true } }), { seed: 815 });

  // Poderes, itens e a rodada.
  const pocao = item('pot_vida');
  const clerigo = { ...forte({ classe: 'clerigo' }), hp: 100, mp: 60, powerIds: ['cura_menor'] };
  simula('poder de dano e a espera dele', abrir({ ...zumbi(), hero: { ...forte(), mp: 60, powerIds: ['golpe_poderoso'] } }), parado(200).map((e, i) => (i === 0 || i === 5 || i === 190 ? { ...e, poder: 'golpe_poderoso' } : e)), { seed: 820 });
  simula('poder de cura', abrir({ ...zumbi(), hero: clerigo }), parado(30).map((e, i) => (i === 3 ? { ...e, poder: 'cura_menor' } : e)), { seed: 821 });
  simula('poder que o herói não tem', abrir({ ...zumbi(), hero: forte() }), parado(10).map((e, i) => (i === 1 ? { ...e, poder: 'bola_de_fogo' } : e)), { seed: 822 });
  simula('poder sem mana', abrir({ ...zumbi(), hero: { ...forte(), mp: 0, powerIds: ['golpe_poderoso'] } }), parado(10).map((e, i) => (i === 1 ? { ...e, poder: 'golpe_poderoso' } : e)), { seed: 823 });
  simula('poção, e o menu aberto deixa lento', abrir({ ...zumbi(), hero: { ...forte(), hp: 50 }, inventory: [pocao] }), parado(80).map((e, i) => (i < 40 ? { ...e, menu: true, ...(i === 39 ? { item: pocao.uid } : {}) } : e)), { seed: 824 });
  simula('item que não está na mochila', abrir({ ...zumbi(), hero: forte() }), parado(5).map((e) => ({ ...e, item: 'nao_existe' })), { seed: 825 });
  // A grade inteira: morrer leva pra cidade, e a cidade precisa do tamanho do mapa pra se montar.
  const envenenado = abrir(comGradeInteira({ ...zumbi(), hero: forte() }));
  const estadoEnvenenado = envenenado.estado as EstadoNaMasmorra;
  simula('o veneno da rodada', { ...envenenado, estado: { ...estadoEnvenenado, hero: { ...estadoEnvenenado.hero, hp: 4, buffs: { poisonTurns: 5, poisonDmg: 4 } } } }, rodando(E.RODADA * 3 + 5), { seed: 826 });

  // Companheiros, vitória, chefe e derrota.
  simula(
    'companheiros batem no alvo',
    abrir({ ...salaCom([bicho('zumbi', { hp: 300, maxHp: 300 }), bicho('slime', { hp: 300, maxHp: 300 })]), party: [companheiro('guerreiro', { stance: 'agressiva' }), companheiro('clerigo', { stance: 'suporte' })] }, 'S'),
    parado(600).map((e, i) => (i === 0 ? { ...e, mirar: 1 } : e)),
    { seed: 830 },
  );
  simula('o golpe vai no defensor, fora da caixa', abrir({ ...salaCom([bicho('goblin', { hp: 900 })]), party: [companheiro('guerreiro', { hp: 200, maxHp: 200 }), companheiro('mago', { hp: 200, maxHp: 200 })] }), parado(400), { seed: 831 });
  simula('o defensor cai, e os golpes voltam pro coração', abrir({ ...salaCom([bicho('aranha', { hp: 900 })]), party: [companheiro('guerreiro', { hp: 1, maxHp: 200, stance: 'defensiva' })] }), parado(500), { seed: 832 });
  // A primeira semente em que o item cai mesmo (o sorteio do item vem depois dos do golpe).
  const vitoria = abrir({ ...salaCom([bicho('zumbi', { hp: 1 })]), hero: comArma('guerreiro', 'espada') });
  const toqueNoMeio = golpe(50, { 42: { x: 0, y: 0, tocar: true } });
  let comItem = 1;
  while (E.simularLuta(vitoria, toqueNoMeio, E.seededRng(comItem), () => AGORA).luta.loot === null) comItem++;
  simula('vitória com item', vitoria, toqueNoMeio, { seed: comItem });
  // A arena é do app: no fundo da masmorra, o item da vitória pode vir com material.
  const vitoriaFunda = abrir({ ...salaCom([bicho('zumbi', { hp: 1 })]), hero: comArma('guerreiro', 'espada'), floor: 90 });
  let comMaterial = 1;
  while ((E.simularLuta(vitoriaFunda, toqueNoMeio, E.seededRng(comMaterial), () => AGORA).luta.loot?.degrau ?? 1) < 2) {
    if (++comMaterial > 3000) throw new Error('nenhuma semente deu item com material na arena');
  }
  simula('vitória no andar 90, com item de material', vitoriaFunda, toqueNoMeio, { seed: comMaterial });

  // As runas na arena (só o app as aplica): golpes seguidos no meio da barra, com a espada carregada de runas.
  {
    const golpesSeguidos = (vezes: number): EntradaDaLuta[] => {
      const entradas: EntradaDaLuta[] = [];
      for (let i = 0; i < vezes; i++) {
        entradas.push({ x: 0, y: 0, atacar: true });
        for (let k = 1; k <= 60; k++) entradas.push(k === 42 ? { x: 0, y: 0, tocar: true } : { x: 0, y: 0 });
      }
      return entradas;
    };
    const comRunas = (runas: RunaNaArma[], o: Partial<Hero> = {}): Hero => {
      const h = comArma('guerreiro', 'espada');
      return { ...h, ...o, equip: { ...h.equip, arma: { ...(h.equip.arma as Item), runas } } };
    };
    const tres = (runa: RunaId): RunaNaArma => ({ runa, tier: 3 });
    simula('runas: uma de cada, em seis golpes', abrir({ ...zumbi(), hero: comRunas([tres('eletrica'), tres('fogo'), tres('gelo'), tres('vampirica')]) }), golpesSeguidos(6), { seed: 860 });
    simula('runas: quatro elétricas, o choque derruba', abrir({ ...salaCom([bicho('zumbi', { hp: 100, maxHp: 100 })]), hero: comRunas([tres('eletrica'), tres('eletrica'), tres('eletrica'), tres('eletrica')]) }), golpesSeguidos(4), { seed: 861 });
    simula('runas: a vampírica cura o herói ferido', abrir({ ...zumbi(), hero: comRunas([tres('vampirica'), tres('vampirica')], { hp: 100 }) }), golpesSeguidos(5), { seed: 862 });
  }

  // O esqueleto do necromante na arena: o poder ergue, ele bate no tempo dele, e o quarto avisa.
  {
    const necromante = forte({ classe: 'necromante', attrs: { intelecto: 16 }, extra: { mp: 200, maxMp: 200 } });
    const levantar = (passo: number): EntradaDaLuta[] => parado(passo).map((e, i) => (i === 0 ? { ...e, poder: 'levantar_esqueleto' } : e));
    const tresVezes: EntradaDaLuta[] = [];
    for (let vez = 0; vez < 4; vez++) tresVezes.push(...levantar(E.RECARGA_DO_PODER + 2));
    simula('esqueleto: o necromante levanta um e ele bate no zumbi', abrir({ ...zumbi(), hero: necromante }), [...levantar(1), ...parado(400)], { seed: 880 });
    simula('esqueleto: três de pé, e o quarto avisa', abrir({ ...zumbi(), hero: necromante }), tresVezes, { seed: 881 });
    simula('esqueleto: a aranha também mira nele', abrir({ ...salaCom([bicho('aranha', { hp: 900, maxHp: 900 })], necromante) }), [...levantar(1), ...parado(500)], { seed: 882 });
    const comOssos = { ...zumbi(), hero: necromante, party: [{ ...E.criarEsqueleto(necromante, []), hp: 12 }] };
    caso('abrirLuta: retomada com um esqueleto na equipe', 'abrirLuta', { estado: comOssos, chegada: E.roomArrival(null), pet: null }, (a) => E.abrirLuta(a.estado, a.chegada, a.pet as never));
  }

  // A armadura encantada (a Encantadora, só do app): o escudo do vigor, a robustez e as resistências.
  {
    const vestindo = (tipo: EncantamentoId, nivel: number, o: Partial<Hero> = {}): Hero => {
      const h = forte();
      return { ...h, ...o, equip: { ...h.equip, armadura: { ...item('placas'), equipped: true, encantamento: { tipo, nivel } } } };
    };
    /** A primeira semente, de `desde` em diante, em que a luta mostra o aviso. */
    const sementeCom = (luta: LutaEmTempoReal, entradas: EntradaDaLuta[], aviso: string, desde: number): number => {
      for (let semente = desde; semente < desde + 500; semente++) {
        if (E.simularLuta(luta, entradas, E.seededRng(semente), () => AGORA).acontecimentos.some((a) => a.tipo === 'aviso' && a.texto === aviso)) return semente;
      }
      throw new Error(`nenhuma semente mostrou "${aviso}"`);
    };
    caso('abrirLuta: com o escudo do vigor', 'abrirLuta', { estado: salaCom([bicho('zumbi')], vestindo('vigor', 3)), chegada: E.roomArrival(null), pet: null }, (a) =>
      E.abrirLuta(a.estado, a.chegada, a.pet as never));
    simula('vigor: o escudo aguenta a aranha antes da vida', abrir(salaCom([bicho('aranha', { hp: 900, maxHp: 900 })], vestindo('vigor', 3)), 'N'), parado(420), { seed: 870 });
    simula('vigor I: o escudo acaba e a vida volta a apanhar', abrir(salaCom([bicho('orc', { hp: 900, maxHp: 900, dmg: 30 })], vestindo('vigor', 1)), 'N'), parado(700), { seed: 871 });
    const comVigor = abrir(salaCom([bicho('zumbi', { hp: 900, maxHp: 900 })], vestindo('vigor', 1)), 'N');
    const estadoComVigor = comVigor.estado as EstadoNaMasmorra;
    const envenenada = { ...comVigor, estado: { ...estadoComVigor, hero: { ...estadoComVigor.hero, buffs: { poisonTurns: 3, poisonDmg: 6 } } } };
    simula('vigor: o veneno também passa pelo escudo', envenenada, parado(E.RODADA + 5), { seed: 872 });
    simula('robustez III: o goblin bate menos', abrir(salaCom([bicho('goblin', { hp: 900, maxHp: 900 })], vestindo('robustez', 3)), 'N'), parado(420), { seed: 873 });
    const magica = abrir(salaCom([bicho('elemental_fogo', { hp: 900, maxHp: 900 })], vestindo('resistencia_magica', 3, { mp: 60 })), 'N');
    simula('resistência mágica III: o elemental atira e a armadura segura o dreno', magica, parado(700), {
      seed: sementeCom(magica, parado(700), 'Sua armadura segura o dreno de mana', 874),
    });
    const veneno = abrir(salaCom([bicho('aranha', { hp: 900, maxHp: 900 })], vestindo('resistencia_veneno', 3)), 'N');
    simula('resistência a veneno III: a armadura segura a aranha', veneno, parado(700), { seed: sementeCom(veneno, parado(700), 'Sua armadura segura o veneno', 875) });
  }
  simula('vitória com ouro escondido', abrir({ ...naSalaDaMasmorra({ ...umMonstro, monsters: [bicho('zumbi', { hp: 1 })], monsterIndex: 0, beaten: false, bonusTreasure: { gold: 25 } }, forte({ arma: 'espada' }), []) }), golpe(50, { 42: { x: 0, y: 0, tocar: true } }), { seed: 833 });
  simula('o chefe leva ao andar seguinte', abrir(comGradeInteira(naSalaDaMasmorra({ ...chefe, monsters: [{ ...(chefe.monsters ?? [])[0]!, hp: 1 }], monsterIndex: 0, beaten: false }, forte({ arma: 'espada' }), []))), golpe(50, { 42: { x: 0, y: 0, tocar: true } }), { seed: 834 });
  simula('derrota', abrir(comGradeInteira(salaCom([bicho('aranha', { dmg: 60 })], { ...forte({ level: 8 }), hp: 5, gold: 300 })), null), parado(400), { seed: 835 });

  // Robôs: mexem o coração, miram e apertam tudo ao acaso, com grupos e classes variados. Os dois
  // últimos jogam no PC, de cajado, apertando letras também.
  const especies = ['goblin', 'lobo_sombras', 'esqueleto', 'aranha', 'slime', 'orc', 'morcego', 'zumbi', 'elemental_fogo', 'espectro_gelado'];
  for (let i = 1; i <= 10; i++) {
    const noPc = i > 8;
    const r = E.seededRng(900 + i);
    const classe = CLASSES_IDS[Math.floor(r() * CLASSES_IDS.length)] as string;
    const tamanho = 1 + Math.floor(r() * 3);
    const monsters = Array.from({ length: tamanho }, () => bicho(especies[Math.floor(r() * especies.length)] as string, { hp: 40 + Math.floor(r() * 80) }));
    const hero = { ...forte(noPc ? { classe, arma: 'cajado' } : { classe }), mp: 80, powerIds: [E.classById(classe)!.signatureId] };
    const party = r() < 0.5 ? [companheiro(CLASSES_IDS[Math.floor(r() * CLASSES_IDS.length)] as string)] : [];
    const estado = { ...comGradeInteira(salaCom(monsters, hero)), party, inventory: [item('pot_vida')] };
    let x = 0;
    let y = 0;
    const entradas: EntradaDaLuta[] = Array.from({ length: 900 }, (_, k) => {
      if (k % 30 === 0) {
        x = Math.floor(r() * 255) - 127;
        y = Math.floor(r() * 255) - 127;
      }
      const e: EntradaDaLuta = { x, y };
      const sorteio = r();
      if (sorteio < 0.04) e.atacar = true;
      else if (sorteio < 0.09) e.tocar = true;
      else if (sorteio < 0.13) e.soltar = true;
      else if (sorteio < 0.135) e.poder = hero.powerIds[0];
      else if (sorteio < 0.137) e.item = estado.inventory[0]!.uid;
      else if (sorteio < 0.15) e.mirar = Math.floor(r() * 4);
      else if (sorteio < 0.3) e.dedo = { x: Math.floor(r() * 1001), y: Math.floor(r() * 1001) };
      else if (noPc && sorteio < 0.38) e.tecla = E.LETRAS_DO_TECLADO[Math.floor(r() * E.LETRAS_DO_TECLADO.length)];
      return e;
    });
    const luta = noPc ? E.abrirLuta(estado, E.roomArrival(E.DIR_ORDER[i % 4] as Direction), null, true).luta : abrir(estado, E.DIR_ORDER[i % 4] as Direction);
    simula(`robô ${i}${noPc ? ' no PC' : ''}: ${classe} contra ${monsters.map((m) => m.speciesId).join(', ')}`, luta, entradas, { seed: 950 + i });
  }
}

// ---------- o chefe final na arena (jogo/chefe-final.ts) ----------

{
  const DA_FLORESTA = ['goblin', 'lobo_sombras', 'aranha', 'slime'];

  const final = (o: Partial<CombatMonster> = {}): CombatMonster => ({
    ...E.freshCombatMonster(E.generateBoss(100, { rng: E.seededRng(9), species: DA_FLORESTA, main: true, final: true })),
    ...o,
  });
  const noFundo = (monsters: MonsterInstance[], o: Partial<EstadoNaMasmorra> = {}) =>
    naSalaDaMasmorra({ ...chefe, monsters, monsterIndex: 0, beaten: false }, cidade.hero, [], { floor: E.DUNGEON_FLOORS, ...o });
  const salaDo = (estado: EstadoNaMasmorra) => E.celulaAtual(estado) as DungeonCell;
  const fresco = final();
  const chamou = E.ferirMonstro(noFundo([fresco]), 0, { ...fresco, hp: 0 }, E.seededRng(3)).estado;
  const semLacaios = noFundo((salaDo(chamou).monsters as CombatMonster[]).map((m, i) => (i === 0 ? m : { ...m, hp: 0 })));
  const furioso = E.enfurecer(semLacaios).estado;
  // A arena: o chefe final de verdade, contra um herói forte, com e sem companheiros.
  const forte = { ...heroi({ classe: 'guerreiro', level: 90 }), hp: 5000, maxHp: 5000 };
  const simula = (nome: string, luta: LutaEmTempoReal, entradas: EntradaDaLuta[], seed: number) =>
    caso(`simularLuta: ${nome}`, 'simularLuta', { luta, entradas }, (a, ctx) => E.simularLuta(a.luta, a.entradas, ctx.rng, ctx.now), { rng: { seed }, now: AGORA });
  const rodando = (n: number): EntradaDaLuta[] =>
    Array.from({ length: n }, (_, i) => {
      const fase = Math.floor(i / 35) % 4;
      return { x: fase === 0 ? 127 : fase === 2 ? -127 : 0, y: fase === 1 ? 127 : fase === 3 ? -127 : 0 };
    });
  const abrir = (estado: EstadoNaMasmorra) => E.abrirLuta(estado, E.roomArrival('N')).luta;
  const naArena = (monsters: MonsterInstance[], party: Companion[] = []) => ({ ...noFundo(monsters), hero: forte, party });

  simula('chefe final: os poderes, com companheiros', abrir(naArena([final()], [companheiro('guerreiro', { hp: 900, maxHp: 900 }), companheiro('clerigo', { hp: 900, maxHp: 900 })])), rodando(1400), 91);
  simula('chefe final: furioso, depois dos lacaios', abrir(naArena([{ ...(salaDo(furioso).monsters?.[0] as CombatMonster) }])), rodando(600), 92);
  // O dano contínuo que passa da metade: os lacaios entram no palco.
  const queimando = abrir(naArena([final()]));
  const salaQueimando = salaDo(queimando.estado as EstadoNaMasmorra);
  const bossQueimando = { ...(salaQueimando.monsters?.[0] as CombatMonster), hp: Math.floor(fresco.maxHp / 2) + 3, status: { queimadura: { turns: 3, dmg: 6 } } };
  const lutaQueimando = { ...queimando, estado: E.substituirCelulaAtual(queimando.estado as EstadoNaMasmorra, { ...salaQueimando, monsters: [bossQueimando] }) };
  simula('chefe final: o dano contínuo chama os lacaios', lutaQueimando, rodando(E.RODADA + 240), 93);
  // Com os lacaios de pé: ataques no chefe protegido e nos lacaios.
  const atacando = (n: number): EntradaDaLuta[] =>
    rodando(n).map((e, i) => (i % 40 === 0 ? { ...e, atacar: true, mirar: Math.floor(i / 40) % 5 } : i % 7 === 3 ? { ...e, tocar: true } : e));
  simula('chefe final: protegido pelos lacaios', abrir({ ...chamou, hero: forte }), atacando(900), 94);

  // Os acessórios únicos (items/acessorios-unicos.ts): só a arena aplica o efeito.
  const usando = (dungeon: 'floresta' | 'caverna' | 'torre', base: Hero = forte) => {
    const peca = E.acessorioUnico({ dungeon, difficulty: 'pesadelo' }, E.seededRng(7), () => AGORA);
    return { ...base, hp: 2000, maxHp: 5000, mp: 300, maxMp: 300, equip: { ...base.equip, acessorio: { ...peca, equipped: true } } };
  };
  const maga = usando('torre', { ...heroi({ classe: 'mago', level: 90 }), powerIds: ['bola_de_fogo'], powerNames: ['Bola de Fogo'] });
  const comum = (heroiDaLuta: Hero) => ({ ...naSalaDaMasmorra({ ...chefe, monsters: [{ ...final(), hp: 3000, maxHp: 3000, chefeFinal: undefined, isMainBoss: false }], monsterIndex: 0, beaten: false }, heroiDaLuta, []), party: [] });
  simula('acessório único: o Amuleto da Floresta Antiga, a cada rodada', abrir(comum(usando('floresta'))), rodando(600), 95);
  // O toque no meio da barra: o golpe acerta, e a Presa cura.
  const meioDaBarra = E.DURACAO_DA_BARRA / 2;
  const golpeando = rodando(600).map((e, i) => (i % 60 === 0 ? { ...e, atacar: true } : i % 60 === meioDaBarra ? { ...e, tocar: true } : e));
  simula('acessório único: a Presa do Morcego, no golpe', abrir(comum(usando('caverna'))), golpeando, 96);
  const poderDaCoroa = E.heroPowers(maga).find((p) => p.cost > 0)!.id;
  simula('acessório único: a Coroa do Arquimago, no poder', abrir(comum(maga)), rodando(400).map((e, i) => (i % 200 === 5 ? { ...e, poder: poderDaCoroa } : e)), 97);
}

// =====================================================================
// tabelas — fixtures/data
// =====================================================================

class NaoETabela extends Error {}

/**
 * Lê o valor de uma constante direto do código-fonte, sem rodar nada: só
 * literal (número, texto, lista, objeto), conta entre números, `as const`,
 * espalhamento de outra constante do mesmo arquivo e `new Set([...])`.
 * Qualquer outra coisa — chamada de função, `new Map`, `Math.random` — quer
 * dizer que aquilo não é tabela.
 */
function lerLiteral(no: ts.Expression, locais: ReadonlyMap<string, unknown>): unknown {
  if (ts.isParenthesizedExpression(no) || ts.isAsExpression(no) || ts.isSatisfiesExpression(no) || ts.isTypeAssertionExpression(no) || ts.isNonNullExpression(no)) {
    return lerLiteral(no.expression, locais);
  }
  if (ts.isNumericLiteral(no)) return Number(no.text.replace(/_/g, ''));
  if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) return no.text;
  if (no.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (no.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (no.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(no) && (no.operator === ts.SyntaxKind.MinusToken || no.operator === ts.SyntaxKind.PlusToken)) {
    const valor = lerLiteral(no.operand, locais);
    if (typeof valor !== 'number') throw new NaoETabela('sinal em algo que não é número');
    return no.operator === ts.SyntaxKind.MinusToken ? -valor : valor;
  }
  if (ts.isBinaryExpression(no)) {
    const esquerda = lerLiteral(no.left, locais);
    const direita = lerLiteral(no.right, locais);
    if (typeof esquerda !== 'number' || typeof direita !== 'number') throw new NaoETabela('conta com algo que não é número');
    switch (no.operatorToken.kind) {
      case ts.SyntaxKind.PlusToken:
        return esquerda + direita;
      case ts.SyntaxKind.MinusToken:
        return esquerda - direita;
      case ts.SyntaxKind.AsteriskToken:
        return esquerda * direita;
      case ts.SyntaxKind.SlashToken:
        return esquerda / direita;
      case ts.SyntaxKind.AsteriskAsteriskToken:
        return esquerda ** direita;
      default:
        throw new NaoETabela(`operador ${ts.SyntaxKind[no.operatorToken.kind]}`);
    }
  }
  if (ts.isArrayLiteralExpression(no)) {
    const lista: unknown[] = [];
    for (const elemento of no.elements) {
      if (ts.isSpreadElement(elemento)) lista.push(...(lerLiteral(elemento.expression, locais) as unknown[]));
      else lista.push(lerLiteral(elemento, locais));
    }
    return lista;
  }
  if (ts.isObjectLiteralExpression(no)) {
    const objeto: Record<string, unknown> = {};
    for (const propriedade of no.properties) {
      if (ts.isSpreadAssignment(propriedade)) Object.assign(objeto, lerLiteral(propriedade.expression, locais));
      else if (ts.isShorthandPropertyAssignment(propriedade)) objeto[propriedade.name.text] = lerLiteral(propriedade.name, locais);
      else if (ts.isPropertyAssignment(propriedade) && (ts.isIdentifier(propriedade.name) || ts.isStringLiteral(propriedade.name) || ts.isNumericLiteral(propriedade.name))) {
        objeto[propriedade.name.text] = lerLiteral(propriedade.initializer, locais);
      } else throw new NaoETabela('propriedade calculada ou método');
    }
    return objeto;
  }
  if (ts.isIdentifier(no)) {
    if (locais.has(no.text)) return locais.get(no.text);
    throw new NaoETabela(`referência a ${no.text}`);
  }
  if (ts.isNewExpression(no) && ts.isIdentifier(no.expression) && no.expression.text === 'Set' && no.arguments?.length === 1) {
    return new Set(lerLiteral(no.arguments[0]!, locais) as unknown[]);
  }
  throw new NaoETabela(ts.SyntaxKind[no.kind]);
}

const comoJson = (valor: unknown, recuo?: number): string => JSON.stringify(valor, (_chave, v: unknown) => (v instanceof Set ? [...v] : v), recuo);

function arquivosDaEngine(pasta: string): string[] {
  return readdirSync(pasta)
    .sort()
    .flatMap((nome) => {
      const caminho = join(pasta, nome);
      if (statSync(caminho).isDirectory()) return arquivosDaEngine(caminho);
      return nome.endsWith('.ts') && !nome.endsWith('.test.ts') && nome !== 'index.ts' ? [caminho] : [];
    });
}

const tabelasPorArquivo = new Map<string, Record<string, unknown>>();
const naoSaoTabela: string[] = [];
const FONTE = join(PACOTE, 'src');

for (const caminho of arquivosDaEngine(FONTE)) {
  const fonte = ts.createSourceFile(caminho, readFileSync(caminho, 'utf8'), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const relativo = relative(FONTE, caminho).replace(/\\/g, '/').replace(/\.ts$/, '');
  const locais = new Map<string, unknown>();
  const tabelas: Record<string, unknown> = {};
  const privadas: string[] = [];
  const conjuntos: string[] = [];

  for (const declaracao of fonte.statements) {
    if (!ts.isVariableStatement(declaracao) || !(declaracao.declarationList.flags & ts.NodeFlags.Const)) continue;
    const exportada = declaracao.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    for (const variavel of declaracao.declarationList.declarations) {
      if (!ts.isIdentifier(variavel.name) || !variavel.initializer) continue;
      const nome = variavel.name.text;
      let valor: unknown;
      try {
        valor = lerLiteral(variavel.initializer, locais);
      } catch (erro) {
        if (!(erro instanceof NaoETabela)) throw erro;
        naoSaoTabela.push(`${relativo}.${nome} (${erro.message})`);
        continue;
      }
      locais.set(nome, valor);
      if (exportada) {
        // A exportada sai do módulo de verdade; a leitura do código-fonte
        // tem que bater com ela, e é isso que dá confiança nas privadas.
        const viva = (E as Record<string, unknown>)[nome];
        if (comoJson(viva) !== comoJson(valor)) throw new Error(`a leitura de ${relativo}.${nome} no código-fonte não bate com o valor exportado`);
        valor = viva;
      } else {
        privadas.push(nome);
      }
      if (valor instanceof Set) conjuntos.push(nome);
      tabelas[nome] = valor;
    }
  }

  if (Object.keys(tabelas).length === 0) continue;
  if (privadas.length) tabelas.$privadas = privadas;
  if (conjuntos.length) tabelas.$conjuntos = conjuntos;
  tabelasPorArquivo.set(relativo, tabelas);
}

// ---------- gravação ----------

mkdirSync(DESTINO, { recursive: true });
for (const [nome, casos] of arquivos) {
  const conteudo = `${JSON.stringify(casos, null, 2)}\n`;
  writeFileSync(join(DESTINO, `${nome}.json`), conteudo);
  console.log(`${`${nome}.json`.padEnd(22)} ${String(casos.length).padStart(5)} casos   ${(conteudo.length / 1024).toFixed(0).padStart(6)} KB`);
}
for (const [relativo, tabelas] of tabelasPorArquivo) {
  const destino = join(DESTINO, 'data', `${relativo}.json`);
  mkdirSync(dirname(destino), { recursive: true });
  const conteudo = `${comoJson(tabelas, 2)}\n`;
  writeFileSync(destino, conteudo);
  const quantas = Object.keys(tabelas).filter((k) => !k.startsWith('$')).length;
  console.log(`${`data/${relativo}.json`.padEnd(22)} ${String(quantas).padStart(5)} tabelas ${(conteudo.length / 1024).toFixed(0).padStart(6)} KB`);
}
console.log(`\nNão são tabela (ficaram fora de data/): ${naoSaoTabela.join(', ')}`);
if (pulados.length) console.log(`\nPulados, porque ainda sorteiam por dentro:\n- ${pulados.join('\n- ')}`);
