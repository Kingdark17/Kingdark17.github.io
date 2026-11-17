import { describe, expect, it } from 'vitest';

import type { DungeonCell } from '../dungeon/generate.js';
import { TILE_UNITS, type Walker } from '../dungeon/room-walk.js';
import type { Hero } from '../hero/hero.js';
import { alcanceDoHeroi } from '../hero/classes-de-luta.js';
import { derivedStats } from '../hero/derived.js';
import { aprenderEstilo, chanceDoMestre, estiloAtivo, estilosQueFaltam, sortearEstilo, trocarEstilo, vidaComOEstilo } from '../hero/estilos.js';
import { abrirMestreDeEstilo, aprenderComMestre } from '../jogo/mestre-de-estilo.js';
import { interagir } from '../jogo/sala.js';
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

// Os estilos de luta (rodada 5a, 2026-11-17): Espadachim, Cavaleiro, Empurrão, Dash/chute, Concentração e o mestre.

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

const COM = (classId: string, estilo: string) => ({ classId, estilos: [estilo], estilo });

describe('os estilos', () => {
  it('aprender, trocar e o sorteio do mestre', () => {
    const guerreiro = { classId: 'guerreiro' };
    expect(estilosQueFaltam(guerreiro).map((e) => e.id)).toEqual(['espadachim', 'cavaleiro']);
    const aprendeu = aprenderEstilo(guerreiro, 'cavaleiro');
    expect(aprendeu).toEqual({ classId: 'guerreiro', estilos: ['cavaleiro'], estilo: 'cavaleiro' });
    expect(aprenderEstilo(aprendeu, 'chute')).toBe(aprendeu);
    expect(trocarEstilo(aprendeu, 'espadachim')).toBe(aprendeu);
    expect(trocarEstilo(aprendeu, undefined)).toEqual({ classId: 'guerreiro', estilos: ['cavaleiro'] });
    expect(sortearEstilo(aprendeu, () => 0.5)).toBe('espadachim');
    expect(sortearEstilo(aprenderEstilo(aprendeu, 'espadachim'), () => 0.5)).toBeNull();
    expect(chanceDoMestre(guerreiro)).toBe(15);
    expect(chanceDoMestre({ classId: 'ladino' })).toBe(0);
    expect(estiloAtivo({ classId: 'monge', estilos: ['cavaleiro'], estilo: 'cavaleiro' })).toBeNull();
  });

  it('o Cavaleiro tem 40% a mais de vida em todo lugar', () => {
    expect(vidaComOEstilo(100, COM('guerreiro', 'cavaleiro'))).toBe(140);
    expect(vidaComOEstilo(100, COM('guerreiro', 'espadachim'))).toBe(100);
  });

  it('o alcance do Monge: o chute vai a 5 blocos, a concentração dá +1', () => {
    expect(alcanceDoHeroi(COM('monge', 'chute'))).toBe(5);
    expect(alcanceDoHeroi(COM('monge', 'concentracao'))).toBe(2);
    expect(alcanceDoHeroi({ classId: 'monge' })).toBe(1);
  });
});

describe('os estilos na arena', () => {
  it('o Espadachim avança até 3 blocos, fica imune e espera 5 s pro próximo avanço', () => {
    const sala = naSala('guerreiro', 'Guerreiro', [monstro()], { estilos: ['espadachim'], estilo: 'espadachim' });
    const luta = abrirLuta(sala, CANTO).luta;
    // A 4 blocos do monstro: o alcance de 2 mais o avanço de 3 alcança.
    const r = golpeNoMeio(luta, { cursor: MEIO });
    expect(vidaDoMonstro(r.luta)).toBeLessThan(4000);
    expect(r.luta.arena.classe?.recargaDoEstilo).toBeGreaterThan(0);
    expect(Math.hypot(r.luta.arena.heroi.x - CANTO.x, r.luta.arena.heroi.y - CANTO.y)).toBeGreaterThan(T);
    // Sem o estilo, a 4 blocos o Guerreiro não alcança.
    const comum = abrirLuta(naSala('guerreiro', 'Guerreiro', [monstro()]), CANTO).luta;
    expect(avisos(rodar(comum, 1, NUNCA, () => ({ ...PARADO, atacar: true, cursor: MEIO })))).toContain('Chegue mais perto');
  });

  it('imune, o Espadachim não leva o golpe', () => {
    const sala = naSala('guerreiro', 'Guerreiro', [monstro({ speciesId: 'goblin', dmg: 60 })], { estilos: ['espadachim'], estilo: 'espadachim' });
    const luta = abrirLuta(sala, PERTO).luta;
    const imune = { ...luta, arena: { ...luta.arena, classe: { imune: 9999 } } };
    const r = rodar(imune, 300, NUNCA);
    expect(r.acontecimentos.some((a) => a.tipo === 'numero' && a.onde === 'heroi' && a.texto === 'Imune')).toBe(true);
    expect(heroi(r.luta).hp).toBe(999);
  });

  it('o Corte Invernal gasta 300 de ki e acerta todo mundo na faixa rumo ao alvo', () => {
    const sala = naSala('guerreiro', 'Guerreiro', [monstro(), monstro()], { estilos: ['espadachim'], estilo: 'espadachim' });
    const aberta = abrirLuta(sala, PERTO).luta;
    const montada = {
      ...aberta,
      arena: {
        ...aberta.arena,
        ki: 300,
        heroi: { x: 4.5 * T, y: 7.5 * T, facing: 'N' as const },
        monstros: aberta.arena.monstros.map((m, i) => ({ ...m, corpoX: 4.5 * T, corpoY: (i === 0 ? 5.5 : 3.5) * T })),
      },
    };
    const r = rodar(montada, 1, NUNCA, () => ({ ...PARADO, corte: true }));
    expect(avisos(r)).toContain('❄️ Corte Invernal');
    expect(r.luta.arena.ki).toBeUndefined();
    expect(vidaDoMonstro(r.luta, 0)).toBeLessThan(4000);
    expect(vidaDoMonstro(r.luta, 1)).toBe(vidaDoMonstro(r.luta, 0));
  });

  it('o Cavaleiro crita +30%', () => {
    const dano = (estilos: Partial<Hero>) => {
      const luta = abrirLuta(naSala('guerreiro', 'Guerreiro', [monstro()], estilos), PERTO).luta;
      return 4000 - vidaDoMonstro(golpeNoMeio(luta, { cursor: MEIO }).luta);
    };
    const sem = dano({});
    const com = dano({ estilos: ['cavaleiro'], estilo: 'cavaleiro' });
    expect(Math.abs(com / sem - (1.6 + 0.3) / 1.6)).toBeLessThan(0.05);
  });

  it('o Empurrão pega quem está a 1 bloco do alvo, com o mesmo dano', () => {
    const sala = naSala('monge', 'Monge', [monstro(), monstro()], { estilos: ['empurrao'], estilo: 'empurrao' });
    const aberta = abrirLuta(sala, PERTO).luta;
    const juntos = { ...aberta, arena: { ...aberta.arena, monstros: aberta.arena.monstros.map((m, i) => ({ ...m, corpoX: (4.5 + i) * T, corpoY: 4.5 * T })) } };
    const r = golpeNoMeio(juntos, { cursor: MEIO });
    expect(vidaDoMonstro(r.luta, 0)).toBeLessThan(4000);
    expect(vidaDoMonstro(r.luta, 1)).toBe(vidaDoMonstro(r.luta, 0));
  });

  it('a Concentração junta uma carga a cada 3 s sem golpear (até 3), e o golpe gasta', () => {
    const sala = naSala('monge', 'Monge', [monstro()], { estilos: ['concentracao'], estilo: 'concentracao' });
    const luta = abrirLuta(sala, PERTO).luta;
    const juntou = rodar(luta, 600, NUNCA).luta;
    expect(juntou.arena.classe?.cargas).toBe(3);
    const golpe = golpeNoMeio(juntou, { cursor: MEIO });
    expect(golpe.luta.arena.classe?.cargas ?? 0).toBeLessThanOrEqual(1);
  });
});

describe('o mestre de estilo', () => {
  it('só o app o ouve; ensina o estilo da sala e vira só uma sala', () => {
    const base = naSala('guerreiro', 'Guerreiro', [monstro()]);
    const celula = celulaAtual(base) as DungeonCell;
    const naSalaDoMestre = substituirCelulaAtual(base, { ...celula, type: 'estilo', monsters: [], mestreDeEstilo: { estilo: 'cavaleiro' } });
    expect(interagir(naSalaDoMestre, NUNCA).aviso?.texto).toBe('No meio da sala, um mestre de estilo medita de olhos fechados.');
    const tela = interagir(naSalaDoMestre, NUNCA, null, undefined, true).tela;
    expect(tela?.tipo).toBe('mestreDeEstilo');
    const aprendeu = aprenderComMestre(naSalaDoMestre);
    expect(aprendeu.estado.hero.estilo).toBe('cavaleiro');
    // A vida máxima acompanha o estilo na hora (o Cavaleiro tem 40% a mais).
    const semEstilo = derivedStats(naSalaDoMestre.hero).maxHp;
    expect(aprendeu.estado.hero.maxHp).toBe(Math.round((semEstilo * 140) / 100));
    expect((celulaAtual(aprendeu.estado) as DungeonCell).mestreDeEstilo?.ensinado).toBe(true);
    expect(abrirMestreDeEstilo(aprendeu.estado)).toBeNull();
  });
});

// Os estilos do Druida (rodada 5b, 2026-11-17): Metamorfose, Florescimento, Raízes Ocultas.

function statusDoMonstro(luta: LutaEmTempoReal, indice = 0): CombatMonster['status'] {
  return (((celulaAtual(luta.estado) as DungeonCell).monsters ?? [])[indice] as CombatMonster).status;
}

function numeros(r: Rodada): string[] {
  return r.acontecimentos.filter((a) => a.tipo === 'numero' && a.texto).map((a) => a.texto as string);
}

describe('os estilos do Druida', () => {
  it('a garra da Metamorfose pega a até 2 blocos do herói e acende a aura de fera no 15º golpe da luta', () => {
    const longe = abrirLuta(naSala('druida', 'Druida', [monstro()], COM('druida', 'metamorfose')), CANTO).luta;
    expect(avisos(rodar(longe, 1, NUNCA, () => ({ ...PARADO, atacar: true, cursor: MEIO })))).toContain('Chegue mais perto');
    const perto = abrirLuta(naSala('druida', 'Druida', [monstro()], COM('druida', 'metamorfose')), PERTO).luta;
    const quase = { ...perto, arena: { ...perto.arena, classe: { golpes: 14 } } };
    const r = golpeNoMeio(quase, { cursor: MEIO });
    expect(avisos(r)).toContain('🐾 Aura de fera!');
    expect(r.luta.arena.classe?.golpes).toBe(15);
    expect(numeros(r)).toContain('🐾');
  });

  it('a Purificação da Metamorfose cura 20%', () => {
    const cura = (estilo: Partial<Hero>) => {
      const luta = abrirLuta(naSala('druida', 'Druida', [monstro()], { hp: 500, ...estilo }), PERTO).luta;
      return heroi(golpeNoMeio(luta, { cursor: { x: PERTO.x, y: PERTO.y } }).luta).hp - 500;
    };
    expect(cura({})).toBe(99);
    expect(cura(COM('druida', 'metamorfose'))).toBe(199);
  });

  it('o Florescimento planta no chão vazio (a até 4 blocos, no máximo 2) e o shuriken alcança 3 blocos', () => {
    const luta = abrirLuta(naSala('druida', 'Druida', [monstro()], COM('druida', 'florescimento')), CANTO).luta;
    // Longe do monstro e a 2 blocos do herói (perto dele, o cursor mira nele: é a Purificação): duas flores; a terceira tira a mais antiga.
    const uma = rodar(luta, RECARGA_DO_ATAQUE + 1, NUNCA, (i) => (i === 0 ? { ...PARADO, atacar: true, cursor: { x: 3.5 * T, y: 7.5 * T } } : PARADO)).luta;
    expect(uma.arena.flores).toEqual([{ x: 3.5 * T, y: 7.5 * T }]);
    const tres = rodar(uma, 2 * (RECARGA_DO_ATAQUE + 1), NUNCA, (i) =>
      i === 0 ? { ...PARADO, atacar: true, cursor: { x: 1.5 * T, y: 5.5 * T } } : i === RECARGA_DO_ATAQUE + 1 ? { ...PARADO, florescer: true } : PARADO,
    ).luta;
    expect(tres.arena.flores).toEqual([{ x: 1.5 * T, y: 5.5 * T }, { x: CANTO.x, y: CANTO.y }]);
    // A 6 blocos do herói, não planta.
    expect(avisos(rodar(luta, 1, NUNCA, () => ({ ...PARADO, atacar: true, cursor: { x: 7.5 * T, y: 7.5 * T } })))).toContain('Chegue mais perto');
    // O monstro do meio está a mais de 3 blocos: o shuriken não alcança.
    expect(avisos(rodar(luta, 1, NUNCA, () => ({ ...PARADO, atacar: true, cursor: MEIO })))).toContain('Chegue mais perto');
  });

  it('dentro da flor, o veneno e o sangramento saem (o osso não) e a cada segundo cura 3% da vida máxima', () => {
    const sala = naSala('druida', 'Druida', [monstro()], { ...COM('druida', 'florescimento'), hp: 500, ferimentos: { veneno: 3, sangramento: 2, braco: true } });
    const luta = abrirLuta(sala, CANTO).luta;
    const r = rodar(luta, 62, NUNCA, (i) => (i === 0 ? { ...PARADO, florescer: true } : PARADO));
    expect(heroi(r.luta).ferimentos).toEqual({ braco: true });
    expect(numeros(r)).toContain('🌸 Imune');
    expect(numeros(r)).toContain('🌸+29');
  });

  it('as Raízes pegam de qualquer lugar; o 3º golpe deixa mais lento, o 9º prende (o chefe não) e o 18º envenena forte', () => {
    const comum = abrirLuta(naSala('druida', 'Druida', [monstro()]), CANTO).luta;
    expect(avisos(rodar(comum, 1, NUNCA, () => ({ ...PARADO, atacar: true, cursor: MEIO })))).toContain('Chegue mais perto');
    const raizes = (golpes: number, chefe = false) => {
      const luta = abrirLuta(naSala('druida', 'Druida', [monstro({ isBoss: chefe })], COM('druida', 'raizes')), CANTO).luta;
      return golpeNoMeio({ ...luta, arena: { ...luta.arena, classe: { golpes } } }, { cursor: MEIO });
    };
    const terceiro = raizes(2);
    expect(vidaDoMonstro(terceiro.luta)).toBeLessThan(4000);
    expect(statusDoMonstro(terceiro.luta)?.lento?.amount).toBe(0.2);
    expect(statusDoMonstro(raizes(3).luta)?.lento?.amount).toBe(0.1);
    const nono = raizes(8);
    expect(nono.luta.arena.monstros[0]?.preso).toBeGreaterThan(0);
    expect(numeros(nono)).toContain('🌱 Preso');
    expect(raizes(8, true).luta.arena.monstros[0]?.preso).toBeUndefined();
    const fundo = raizes(17);
    expect(avisos(fundo)).toContain('🌱 Raízes fundas!');
    const hp = vidaDoMonstro(fundo.luta);
    expect(statusDoMonstro(fundo.luta)?.veneno?.dmg).toBeGreaterThan(Math.trunc((4000 * 5) / 100));
    expect(statusDoMonstro(fundo.luta)?.veneno?.dmg).toBeLessThanOrEqual(Math.trunc((hp * 15) / 100) + Math.trunc((4000 * 15) / 100));
  });

  it('preso, o monstro não sai do lugar', () => {
    const luta = abrirLuta(naSala('druida', 'Druida', [monstro()], COM('druida', 'raizes')), CANTO).luta;
    const m = luta.arena.monstros[0]!;
    const preso = { ...luta, arena: { ...luta.arena, monstros: [{ ...m, preso: 200 }] } };
    const r = rodar(preso, 100, NUNCA);
    expect(r.luta.arena.monstros[0]?.corpoX).toBe(m.corpoX);
    expect(r.luta.arena.monstros[0]?.corpoY).toBe(m.corpoY);
    expect(rodar(luta, 100, NUNCA).luta.arena.monstros[0]?.corpoY).not.toBe(m.corpoY);
  });
});
