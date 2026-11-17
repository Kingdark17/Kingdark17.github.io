import { describe, expect, it } from 'vitest';

import type { DungeonCell } from '../dungeon/generate.js';
import { TILE_UNITS, type Walker } from '../dungeon/room-walk.js';
import type { Hero } from '../hero/hero.js';
import { REGRAS_DO_BARBARO, REGRAS_DO_PALADINO } from '../hero/classes-de-luta.js';
import { instantiate } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import type { CombatMonster } from '../combat/monster-state.js';
import { resolverGolpe } from '../combat/resolve-attack.js';
import { monsterView, type MonsterInstance } from '../monsters/generate.js';
import { seededRng, type Rng } from '../rng.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from '../jogo/estado.js';
import { saveSorteado } from '../jogo/heroi-sorteado.js';
import { abrirLuta, passoDaLuta, RECARGA_DO_ATAQUE, type Acontecimento, type EntradaDaLuta, type LutaEmTempoReal } from './arena.js';
import { DURACAO_DA_BARRA } from './eventos-de-arma.js';

// As classes refeitas pelo doc do Breno na luta do app (rodada 3a, 2026-11-17).

function monstro(overrides: Partial<MonsterInstance> = {}): MonsterInstance {
  return { speciesId: 'zumbi', enemyClassId: 'brutamontes', floor: 2, hp: 400, maxHp: 400, dmg: 3, speed: 5, xp: 12, gold: 7, isBoss: false, ...overrides };
}

function arma(id: string) {
  return { ...instantiate(templateById(id)!, RARITIES[0]!), equipped: true };
}

/** Uma sala de monstro montada à mão, com um herói da classe e da arma pedidas e vida de sobra. */
function naSala(classId: string, className: string, armaId: string, monsters: MonsterInstance[], hero: Partial<Hero> = {}): EstadoNaMasmorra {
  const save = saveSorteado('Aria', seededRng(11), seededRng(11));
  const base = retomarSave({ ...save, floor: 2, mapMode: 'dungeon' }, seededRng(11));
  if (base.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
  const celula = base.map.flat().find((c) => c.type === 'monster')!;
  const posicionado: EstadoNaMasmorra = {
    ...base,
    pos: { x: celula.x, y: celula.y },
    party: [],
    hero: { ...base.hero, className, classId, hp: 999, maxHp: 999, level: 1, gold: 100, buffs: {}, equip: { ...base.hero.equip, arma: arma(armaId) }, ...hero },
  };
  return substituirCelulaAtual(posicionado, { ...celula, monsters, monsterIndex: 0, beaten: false, bonusTreasure: undefined });
}

const PARADO: EntradaDaLuta = { x: 0, y: 0 };
const T = TILE_UNITS;
const NUNCA: Rng = () => 0.99;

function rodar(luta: LutaEmTempoReal, passos: number, rng: Rng, entrada: (i: number) => EntradaDaLuta = () => PARADO) {
  let atual = luta;
  const tudo: Acontecimento[] = [];
  for (let i = 0; i < passos && !atual.fim; i++) {
    const quadro = passoDaLuta(atual, entrada(i), rng, () => 1_700_000_000_000);
    atual = quadro.luta;
    tudo.push(...quadro.acontecimentos);
  }
  return { luta: atual, acontecimentos: tudo };
}

/** Um golpe de espada (ou maça) com o toque no meio da barra, que crita; depois espera a recarga. */
function golpeNoMeio(luta: LutaEmTempoReal, rng: Rng = NUNCA, entrada: Partial<EntradaDaLuta> = {}) {
  const aberto = passoDaLuta(luta, { ...PARADO, ...entrada, atacar: true }, rng, () => 1_700_000_000_000);
  const meio = DURACAO_DA_BARRA / 2;
  const fim = rodar(aberto.luta, meio + RECARGA_DO_ATAQUE, rng, (i) => (i === meio - 1 ? { ...PARADO, tocar: true } : PARADO));
  return { luta: fim.luta, acontecimentos: [...aberto.acontecimentos, ...fim.acontecimentos] };
}

function vidaDoMonstro(luta: LutaEmTempoReal, indice = 0): number {
  return ((celulaAtual(luta.estado) as DungeonCell).monsters ?? [])[indice]!.hp;
}

/** O herói uma casa abaixo do meio da sala (onde o monstro sozinho fica). */
const PERTO: Walker = { x: 4.5 * T, y: 5.5 * T, facing: 'N' };

describe('o Guerreiro', () => {
  it('três críticos seguidos fecham um combo de +20% (avisa), e ele fica até o fim da luta', () => {
    let luta = abrirLuta(naSala('guerreiro', 'Guerreiro', 'espada', [monstro()]), PERTO).luta;
    const avisos: string[] = [];
    for (let i = 0; i < 3; i++) {
      const golpe = golpeNoMeio(luta);
      luta = golpe.luta;
      for (const a of golpe.acontecimentos) if (a.tipo === 'aviso' && a.texto) avisos.push(a.texto);
    }
    expect(luta.arena.classe).toEqual({ seguidos: 0, combo: 20 });
    expect(avisos).toContain('⚔️ Combo! +20% de dano');
  });
});

describe('o Ladino', () => {
  it('a cada 5 críticos ganha uma furtividade', () => {
    let luta = abrirLuta(naSala('ladino', 'Ladino', 'espada', [monstro({ hp: 4000, maxHp: 4000 })]), PERTO).luta;
    for (let i = 0; i < 5; i++) luta = golpeNoMeio(luta).luta;
    expect(luta.arena.classe).toEqual({ criticos: 0, furtividade: 1 });
  });

  it('o crítico dele é 2,25× (o de sempre é 1,6×), com o mesmo herói e o mesmo golpe', () => {
    const hero = naSala('ladino', 'Ladino', 'espada', [monstro()]).hero;
    const alvo = monsterView(monstro() as CombatMonster);
    const leitura = { acerto: true, forca: 1, critico: true };
    const comum = resolverGolpe(hero, alvo, 10, leitura, 'physical', { rng: seededRng(5), semPassivaDaClasse: true }).damage!;
    const doLadino = resolverGolpe(hero, alvo, 10, leitura, 'physical', { rng: seededRng(5), semPassivaDaClasse: true, multiplicadorDoCritico: 2.25 }).damage!;
    const semCritico = Math.round(comum / 1.6);
    expect(Math.abs(doLadino - semCritico * 2.25)).toBeLessThanOrEqual(2);
    expect(doLadino).toBeGreaterThan(comum);
  });
});

describe('o Bárbaro', () => {
  it('cada golpe levado sobe a fúria, e ela esfria depois de 15 s sem apanhar', () => {
    const luta = abrirLuta(naSala('barbaro', 'Bárbaro', 'espada', [monstro({ dmg: 1 })]), PERTO).luta;
    const fim = rodar(luta, 600, NUNCA);
    const golpes = fim.acontecimentos.filter((a) => a.tipo === 'numero' && a.onde === 'heroi' && a.tom === 'dano').length;
    expect(golpes).toBeGreaterThan(0);
    expect(fim.luta.arena.classe?.furia).toBe(Math.min(REGRAS_DO_BARBARO.tetoDaFuria, golpes));

    const quase = { ...luta, arena: { ...luta.arena, classe: { furia: 3, calmo: REGRAS_DO_BARBARO.calma - 1 } } };
    expect(passoDaLuta(quase, PARADO, NUNCA).luta.arena.classe).toEqual({ furia: 1, calmo: 0 });
  });

  it('a bola da maça bate cheio no alvo e metade em quem está no quadrado em volta dele', () => {
    // Dois monstros lado a lado: o 0 à esquerda e o 1 à direita; o herói embaixo do 0.
    const dois = [monstro(), monstro()];
    const aberta = abrirLuta(naSala('barbaro', 'Bárbaro', 'maca', dois), PERTO).luta;
    const lugar0 = { x: aberta.arena.monstros[0]!.corpoX, y: aberta.arena.monstros[0]!.corpoY };
    const luta = {
      ...aberta,
      arena: {
        ...aberta.arena,
        heroi: { x: lugar0.x, y: lugar0.y + T, facing: 'N' as const },
        monstros: [
          { ...aberta.arena.monstros[0]! },
          { ...aberta.arena.monstros[1]!, corpoX: lugar0.x + T, corpoY: lugar0.y },
        ],
      },
    };
    const fim = golpeNoMeio(luta, NUNCA, { mirar: 0 }).luta;
    const noAlvo = 400 - vidaDoMonstro(fim, 0);
    expect(noAlvo).toBeGreaterThan(0);
    expect(400 - vidaDoMonstro(fim, 1)).toBe(Math.max(1, Math.trunc((noAlvo * REGRAS_DO_BARBARO.nosOutros) / 100)));
  });

  it('sem arma pesada, só o alvo apanha', () => {
    const dois = [monstro(), monstro()];
    const aberta = abrirLuta(naSala('barbaro', 'Bárbaro', 'espada', dois), PERTO).luta;
    const lugar0 = { x: aberta.arena.monstros[0]!.corpoX, y: aberta.arena.monstros[0]!.corpoY };
    const luta = {
      ...aberta,
      arena: {
        ...aberta.arena,
        heroi: { x: lugar0.x, y: lugar0.y + T, facing: 'N' as const },
        monstros: [{ ...aberta.arena.monstros[0]! }, { ...aberta.arena.monstros[1]!, corpoX: lugar0.x + T, corpoY: lugar0.y }],
      },
    };
    const fim = golpeNoMeio(luta, NUNCA, { mirar: 0 }).luta;
    expect(vidaDoMonstro(fim, 0)).toBeLessThan(400);
    expect(vidaDoMonstro(fim, 1)).toBe(400);
  });
});

describe('o Paladino', () => {
  it('o golpe é um avanço: ele para a 1 bloco do alvo, e o alvo de pé vai 1 bloco pra trás', () => {
    const aberta = abrirLuta(naSala('paladino', 'Paladino', 'espada', [monstro()]), PERTO).luta;
    const alvo = { x: aberta.arena.monstros[0]!.corpoX, y: aberta.arena.monstros[0]!.corpoY };
    // A 2 blocos, embaixo dele: o alcance do Paladino.
    const luta = { ...aberta, arena: { ...aberta.arena, heroi: { x: alvo.x, y: alvo.y + 2 * T, facing: 'N' as const } } };
    // Durante a barra o monstro anda rumo ao herói: o avanço conta de onde ele está na hora do golpe.
    const meio = DURACAO_DA_BARRA / 2;
    const aberto = passoDaLuta(luta, { ...PARADO, atacar: true }, NUNCA).luta;
    const antes = rodar(aberto, meio - 1, NUNCA).luta;
    const ali = antes.arena.monstros[0]!.corpoY;
    const depois = passoDaLuta(antes, { ...PARADO, tocar: true }, NUNCA).luta;
    expect(depois.arena.heroi.x).toBe(alvo.x);
    expect(depois.arena.heroi.y).toBe(ali + T);
    // Empurrado 1 bloco; no mesmo passo ele já volta a andar um passo rumo ao herói.
    const empurrado = depois.arena.monstros[0]!.corpoY;
    expect(empurrado).toBeLessThan(ali - REGRAS_DO_PALADINO.empurrao * T + 100);
    expect(empurrado).toBeGreaterThanOrEqual(ali - REGRAS_DO_PALADINO.empurrao * T);
  });

  it('o golpe que leva devolve 20% a quem bateu, e a absorção junta', () => {
    const luta = abrirLuta(naSala('paladino', 'Paladino', 'espada', [monstro({ dmg: 10 })]), PERTO).luta;
    const fim = rodar(luta, 600, NUNCA);
    const levados = fim.acontecimentos.filter((a) => a.tipo === 'numero' && a.onde === 'heroi' && a.tom === 'dano');
    expect(levados.length).toBeGreaterThan(0);
    const devolvidos = fim.acontecimentos.filter((a) => a.tipo === 'numero' && a.onde === 'monstro' && a.texto?.startsWith('↩️-'));
    expect(devolvidos).toHaveLength(levados.length);
    const primeiro = Number(levados[0]!.texto!.slice(1));
    expect(devolvidos[0]!.texto).toBe(`↩️-${Math.max(1, Math.trunc((primeiro * REGRAS_DO_PALADINO.devolve) / 100))}`);
    expect(fim.luta.arena.classe?.absorcao).toBe(levados.length * REGRAS_DO_PALADINO.absorvePorGolpe);
  });

  it('em dupla, os monstros o escolhem como se ele estivesse 30% mais perto', () => {
    const escolha = (classId: string, className: string): boolean | undefined => {
      const aberta = abrirLuta(naSala(classId, className, 'espada', [monstro()]), PERTO, null, false, 'anfitriao').luta;
      const m = aberta.arena.monstros[0]!;
      // O herói daqui a 2,4 blocos do monstro; o parceiro a 2.
      const luta = { ...aberta, arena: { ...aberta.arena, heroi: { x: m.corpoX, y: m.corpoY + 2.4 * T, facing: 'N' as const } } };
      return passoDaLuta(luta, { ...PARADO, parceiro: { x: m.corpoX, y: m.corpoY - 2 * T } }, NUNCA).luta.arena.monstros[0]!.noParceiro;
    };
    expect(escolha('monge', 'Monge')).toBe(true);
    expect(escolha('paladino', 'Paladino')).toBeUndefined();
  });
});

describe('a passiva antiga do site fica de fora na arena', () => {
  it('o Ladino refeito não dá o golpe extra de metade do dano', () => {
    // Com o rng sempre em 0, a passiva antiga (25%) dispararia em todo golpe.
    const zero: Rng = () => 0;
    const luta = abrirLuta(naSala('ladino', 'Ladino', 'espada', [monstro({ hp: 4000, maxHp: 4000 })]), PERTO).luta;
    const golpe = golpeNoMeio(luta, zero);
    const numeros = golpe.acontecimentos.filter((a) => a.tipo === 'numero' && a.onde === 'monstro' && a.texto?.startsWith('-'));
    const dano = 4000 - vidaDoMonstro(golpe.luta);
    expect(numeros.reduce((soma, a) => soma + Number(a.texto!.slice(1)), 0)).toBe(dano);
  });
});
