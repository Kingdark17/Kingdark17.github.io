import { describe, expect, it } from 'vitest';

import type { DungeonCell } from '../dungeon/generate.js';
import { TILE_UNITS, type Walker } from '../dungeon/room-walk.js';
import type { Hero } from '../hero/hero.js';
import { criarLacaio, liberarMagia, mudarEstadoDoLacaio, REGRAS_DO_NECROMANTE, trocarPeloCristal } from '../combat/invocacao.js';
import type { Companion } from '../hero/hero.js';
import { instantiate } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import type { CombatMonster } from '../combat/monster-state.js';
import type { MonsterInstance } from '../monsters/generate.js';
import { seededRng, type Rng } from '../rng.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from '../jogo/estado.js';
import { saveSorteado } from '../jogo/heroi-sorteado.js';
import {
  abrirLuta,
  danoLevadoNaJanela,
  extrasDaLuta,
  memoriaDaLuta,
  passoDaLuta,
  RECARGA_DO_ATAQUE,
  type Acontecimento,
  type ApoioDoParceiro,
  type EntradaDaLuta,
  type LutaEmTempoReal,
} from './arena.js';
import { DURACAO_DA_BARRA } from './eventos-de-arma.js';

// O Necromante na luta do app (rodada 4b, 2026-11-17): os lacaios com corpo, os cristais e a Magia Proibida.

function monstro(overrides: Partial<MonsterInstance> = {}): MonsterInstance {
  return { speciesId: 'zumbi', enemyClassId: 'brutamontes', floor: 2, hp: 4000, maxHp: 4000, dmg: 3, speed: 5, xp: 12, gold: 7, isBoss: false, ...overrides };
}

function arma(id: string) {
  return { ...instantiate(templateById(id)!, RARITIES[0]!), equipped: true };
}

/** Uma sala de monstro montada à mão, com um herói da classe pedida (de espada: o evento é a barra) e vida de sobra. */
function naSala(classId: string, className: string, monsters: MonsterInstance[], hero: Partial<Hero> = {}): EstadoNaMasmorra {
  const save = saveSorteado('Aria', seededRng(11), seededRng(11));
  const base = retomarSave({ ...save, floor: 2, mapMode: 'dungeon' }, seededRng(11));
  if (base.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
  const celula = base.map.flat().find((c) => c.type === 'monster')!;
  const posicionado: EstadoNaMasmorra = {
    ...base,
    pos: { x: celula.x, y: celula.y },
    party: [],
    hero: { ...base.hero, className, classId, hp: 999, maxHp: 999, mp: 50, maxMp: 50, level: 1, gold: 100, buffs: {}, equip: { ...base.hero.equip, arma: arma('espada') }, ...hero },
  };
  return substituirCelulaAtual(posicionado, { ...celula, monsters, monsterIndex: 0, beaten: false, bonusTreasure: undefined });
}

const PARADO: EntradaDaLuta = { x: 0, y: 0 };
const T = TILE_UNITS;
const NUNCA: Rng = () => 0.99;
const AGORA = () => 1_700_000_000_000;

interface Rodada {
  luta: LutaEmTempoReal;
  acontecimentos: Acontecimento[];
  apoios: ApoioDoParceiro[];
  moral?: number;
}

function rodar(luta: LutaEmTempoReal, passos: number, rng: Rng, entrada: (i: number) => EntradaDaLuta = () => PARADO): Rodada {
  let atual = luta;
  const tudo: Acontecimento[] = [];
  const apoios: ApoioDoParceiro[] = [];
  let moral: number | undefined;
  for (let i = 0; i < passos && !atual.fim; i++) {
    const quadro = passoDaLuta(atual, entrada(i), rng, AGORA);
    atual = quadro.luta;
    tudo.push(...quadro.acontecimentos);
    apoios.push(...(quadro.apoios ?? []));
    if (quadro.moral !== undefined) moral = quadro.moral;
  }
  return { luta: atual, acontecimentos: tudo, apoios, ...(moral !== undefined ? { moral } : {}) };
}

/** Um golpe com o toque no meio da barra (crita); depois espera a recarga. */
function golpeNoMeio(luta: LutaEmTempoReal, entrada: Partial<EntradaDaLuta> = {}, rng: Rng = NUNCA): Rodada {
  const aberto = passoDaLuta(luta, { ...PARADO, ...entrada, atacar: true }, rng, AGORA);
  const meio = DURACAO_DA_BARRA / 2;
  const fim = rodar(aberto.luta, meio + RECARGA_DO_ATAQUE, rng, (i) => (i === meio - 1 ? { ...PARADO, tocar: true } : PARADO));
  return {
    luta: fim.luta,
    acontecimentos: [...aberto.acontecimentos, ...fim.acontecimentos],
    apoios: [...(aberto.apoios ?? []), ...fim.apoios],
    ...(fim.moral !== undefined ? { moral: fim.moral } : {}),
  };
}

function vidaDoMonstro(luta: LutaEmTempoReal, indice = 0): number {
  return ((celulaAtual(luta.estado) as DungeonCell).monsters ?? [])[indice]!.hp;
}

function heroi(luta: LutaEmTempoReal): Hero {
  return luta.estado.hero;
}

function avisos(r: Rodada): string[] {
  return r.acontecimentos.filter((a) => a.tipo === 'aviso' && a.texto).map((a) => a.texto as string);
}

/** O herói uma casa abaixo do meio da sala (onde o monstro sozinho fica). */
const PERTO: Walker = { x: 4.5 * T, y: 5.5 * T, facing: 'N' };
/** O monstro sozinho fica no meio da sala. */
const MEIO = { x: 4.5 * T, y: 4.5 * T };
/** No canto de baixo à esquerda: longe do monstro do meio (4 blocos). */
const CANTO: Walker = { x: 1.5 * T, y: 7.5 * T, facing: 'N' };

/** Um lacaio pronto (os números do Breno sobre um herói de 999 de vida e Inteligência 10), na retaguarda ou no ofensivo. */
function lacaio(estado: 'retaguarda' | 'ofensivo' = 'retaguarda', hp = 500): Companion {
  return { ...criarLacaio({ maxHp: 999, attrs: { forca: 1, destreza: 1, constituicao: 1, intelecto: 10, sabedoria: 1, carisma: 1 } }, []), hp, maxHp: 1998, estadoDoLacaio: estado };
}

function comEquipe(estado: EstadoNaMasmorra, party: Companion[]): EstadoNaMasmorra {
  return { ...estado, party };
}

describe('o lacaio do app', () => {
  it('invocar custa 65% da mana máxima e tem os números do Breno (2× Inteligência, 2× a vida do herói), com corpo ao lado dele', () => {
    const sala = naSala('necromante', 'Necromante', [monstro()], { mp: 100, maxMp: 100, attrs: { forca: 5, destreza: 5, constituicao: 5, intelecto: 12, sabedoria: 5, carisma: 5 }, powerIds: ['levantar_esqueleto'] });
    const luta = abrirLuta(sala, CANTO).luta;
    const r = rodar(luta, 1, NUNCA, () => ({ ...PARADO, poder: 'levantar_esqueleto' }));
    const party = r.luta.estado.party;
    expect(party).toHaveLength(1);
    expect(party[0]).toMatchObject({ invocado: true, especie: 'esqueleto', estadoDoLacaio: 'retaguarda', attack: 24, maxHp: 1998, hp: 1998 });
    expect(heroi(r.luta).mp).toBe(100 - 65);
    const corpo = r.luta.arena.companheiros[0]!;
    expect(Math.abs(corpo.x! - CANTO.x) + Math.abs(corpo.y! - CANTO.y)).toBeLessThanOrEqual(T + 64);
    // Sem os 65%, avisa e não gasta.
    const pobre = abrirLuta({ ...sala, hero: { ...sala.hero, mp: 60 } }, CANTO).luta;
    const nada = rodar(pobre, 1, NUNCA, () => ({ ...PARADO, poder: 'levantar_esqueleto' }));
    expect(nada.luta.estado.party).toHaveLength(0);
    expect(avisos(nada).some((t) => t.startsWith('Mana insuficiente'))).toBe(true);
  });

  it('na retaguarda só vai em quem chega a 3 blocos do dono; no ofensivo, atrás de qualquer um', () => {
    // O herói no canto de baixo à esquerda, o monstro parado no canto de cima à direita (bem longe).
    const montar = (estado: 'retaguarda' | 'ofensivo') => {
      const aberta = abrirLuta(comEquipe(naSala('necromante', 'Necromante', [monstro()]), [lacaio(estado)]), CANTO).luta;
      return { ...aberta, arena: { ...aberta.arena, monstros: aberta.arena.monstros.map((m) => ({ ...m, corpoX: 7.5 * T, corpoY: 1.5 * T, fase: 'descansando' as const, tempo: 9999 })) } };
    };
    const atras = rodar(montar('retaguarda'), 400, seededRng(3));
    const corpo = atras.luta.arena.companheiros[0]!;
    expect(Math.hypot(corpo.x! - CANTO.x, corpo.y! - CANTO.y)).toBeLessThanOrEqual(1.5 * T + 64);
    expect(vidaDoMonstro(atras.luta)).toBe(4000);
    // O golpe do companheiro tem sorteio de acerto: com o sorteio fixo no alto, ele erraria sempre.
    const ofensivo = rodar(montar('ofensivo'), 400, seededRng(3));
    expect(vidaDoMonstro(ofensivo.luta)).toBeLessThan(4000);
  });

  it('o monstro vai atrás do lacaio que está mais perto dele, e o golpe cai no lacaio', () => {
    const aberta = abrirLuta(comEquipe(naSala('necromante', 'Necromante', [monstro({ speciesId: 'goblin', dmg: 20 })]), [lacaio()]), CANTO).luta;
    // O lacaio colado no monstro do meio; o herói no canto.
    const montada = { ...aberta, arena: { ...aberta.arena, companheiros: aberta.arena.companheiros.map((c) => ({ ...c, x: MEIO.x, y: MEIO.y + T })) } };
    const r = rodar(montada, 200, NUNCA);
    expect(r.acontecimentos.some((a) => a.tipo === 'numero' && a.onde === 'companheiro' && a.tom === 'dano')).toBe(true);
    expect(r.luta.estado.party[0]!.hp).toBeLessThan(500);
  });

  it('no ofensivo o lacaio leva 10% a menos', () => {
    const levou = (estado: 'retaguarda' | 'ofensivo') => {
      const aberta = abrirLuta(comEquipe(naSala('necromante', 'Necromante', [monstro({ speciesId: 'goblin', dmg: 60 })]), [lacaio(estado)]), CANTO).luta;
      const montada = { ...aberta, arena: { ...aberta.arena, companheiros: aberta.arena.companheiros.map((c) => ({ ...c, x: MEIO.x, y: MEIO.y + T })) } };
      const golpe = rodar(montada, 300, NUNCA).acontecimentos.find((a) => a.tipo === 'numero' && a.onde === 'companheiro' && a.tom === 'dano');
      return Number((golpe?.texto ?? '-0').slice(1));
    };
    const normal = levou('retaguarda');
    expect(normal).toBeGreaterThan(0);
    expect(levou('ofensivo')).toBe(Math.max(1, normal - Math.floor((normal * 10) / 100)));
  });
});

describe('o cristal', () => {
  it('na luta do Necromante, quem cai deixa um cristal com a espécie e o nível; nas outras classes, não', () => {
    const fraco = [monstro({ hp: 1, maxHp: 1, speciesId: 'goblin' })];
    const necro = golpeNoMeio(abrirLuta(naSala('necromante', 'Necromante', fraco), PERTO).luta, { cursor: MEIO });
    expect(necro.luta.fim).toBe('vitoria');
    expect(necro.luta.arena.cristais).toEqual([{ x: expect.any(Number), y: expect.any(Number), especie: 'goblin', nivel: expect.any(Number) }]);
    const guerreiro = golpeNoMeio(abrirLuta(naSala('guerreiro', 'Guerreiro', fraco), PERTO).luta, { cursor: MEIO });
    expect(guerreiro.luta.arena.cristais).toBeUndefined();
  });

  it('trocar um lacaio: vira a espécie do cristal, com a mesma vida e o mesmo dano', () => {
    const party = [lacaio(), { ...lacaio(), name: 'Esqueleto 2' }];
    const uso = trocarPeloCristal({ level: 5 }, party, 1, { especie: 'goblin', nivel: 3 });
    expect(uso).toMatchObject({ trocou: true, gasto: true, texto: 'Esqueleto 2 agora é Goblin.' });
    expect(uso.party[1]).toMatchObject({ especie: 'goblin', name: 'Goblin', classIcon: '👹', hp: 500, attack: party[1]!.attack });
    expect(uso.party[0]).toBe(party[0]);
  });

  it('o do chefe: abaixo do nível dele nada acontece (e ele fica); acima, falha 65% das vezes (e se parte)', () => {
    const party = [lacaio()];
    const chefe = { especie: 'orc', nivel: 10, chefe: true };
    expect(trocarPeloCristal({ level: 10 }, party, 0, chefe)).toMatchObject({ trocou: false, gasto: false });
    expect(trocarPeloCristal({ level: 11 }, party, 0, chefe, () => 0.1)).toMatchObject({ trocou: false, gasto: true, texto: 'O cristal se parte: a alma do chefe resiste.' });
    expect(trocarPeloCristal({ level: 11 }, party, 0, chefe, () => 0.9)).toMatchObject({ trocou: true, gasto: true });
  });

  it('o estado do lacaio muda pela janela do K; quem não é lacaio fica como está', () => {
    const recruta = { ...lacaio(), invocado: undefined } as Companion;
    const party = mudarEstadoDoLacaio([lacaio(), recruta], 0, 'ofensivo');
    expect(party[0]!.estadoDoLacaio).toBe('ofensivo');
    expect(mudarEstadoDoLacaio(party, 1, 'ofensivo')[1]).toBe(party[1]);
  });
});

describe('a Magia Proibida', () => {
  const parceiro = { x: 2.5 * T, y: 7.5 * T };

  it('com 90% de vida e de mana, levanta o parceiro caído com 50% (vai pela rede) e espera 14 min', () => {
    const sala = naSala('necromante', 'Necromante', [monstro()], { hp: 999, maxHp: 999, mp: 100, maxMp: 100 });
    const luta = abrirLuta(sala, CANTO, null, false, 'anfitriao').luta;
    const r = rodar(luta, 1, NUNCA, () => ({ ...PARADO, magia: true, parceiro: { ...parceiro, caido: true } }));
    expect(r.luta.arena.recargaDaMagia).toBe(REGRAS_DO_NECROMANTE.recargaDaMagia);
    expect(avisos(r)).toContain('☠️ Magia Proibida: seu parceiro se levanta!');
    const quadro = passoDaLuta(luta, { ...PARADO, magia: true, parceiro: { ...parceiro, caido: true } }, NUNCA);
    expect(quadro.reviver).toBe(50);
    expect(extrasDaLuta(r.luta).recargaDaMagia).toBeGreaterThan(0);
  });

  it('sem os 90%, sem ninguém caído ou selada, não sai', () => {
    const sala = naSala('necromante', 'Necromante', [monstro()], { hp: 800, maxHp: 999, mp: 100, maxMp: 100 });
    const aberta = abrirLuta(sala, CANTO, null, false, 'anfitriao').luta;
    const ferido = rodar(aberta, 1, NUNCA, () => ({ ...PARADO, magia: true, parceiro: { ...parceiro, caido: true } }));
    expect(avisos(ferido)).toContain('A Magia Proibida pede 90% de vida e de mana');
    expect(ferido.luta.arena.recargaDaMagia).toBeUndefined();
    const ninguem = rodar(aberta, 1, NUNCA, () => ({ ...PARADO, magia: true, parceiro }));
    expect(avisos(ninguem)).toContain('Ninguém caído pra levantar');
    const selada = abrirLuta({ ...sala, hero: { ...sala.hero, hp: 999, bloqueioDaMagia: 'floresta' } }, CANTO, null, false, 'anfitriao').luta;
    expect(avisos(rodar(selada, 1, NUNCA, () => ({ ...PARADO, magia: true, parceiro: { ...parceiro, caido: true } })))).toContain('A Magia Proibida está selada até zerar a masmorra');
    expect(extrasDaLuta(selada).magiaSelada).toBe(true);
  });

  it('o Necromante que cai se levanta com 50% e a magia fica selada nesta masmorra; caindo de novo, perde', () => {
    const sala = naSala('necromante', 'Necromante', [monstro({ speciesId: 'goblin', dmg: 4000 })], { hp: 10, maxHp: 999 });
    const luta = abrirLuta(sala, PERTO).luta;
    const levantou = rodar(luta, 300, NUNCA);
    expect(avisos(levantou)).toContain('☠️ A Magia Proibida levanta o Necromante! Ela fica selada até zerar a masmorra.');
    expect(heroi(levantou.luta).bloqueioDaMagia).toBe(sala.masmorra.dungeon);
    const caiu = rodar(levantou.luta, 600, NUNCA);
    expect(caiu.luta.fim).toBe('derrota');
  });

  it('zerar a masmorra devolve a magia, se era essa que ele devia', () => {
    const selado = { bloqueioDaMagia: 'caverna', hp: 1 };
    expect(liberarMagia(selado, 'caverna')).toEqual({ hp: 1 });
    expect(liberarMagia(selado, 'floresta')).toBe(selado);
  });
});
