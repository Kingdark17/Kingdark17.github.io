import { describe, expect, it } from 'vitest';

import type { DungeonCell } from '../dungeon/generate.js';
import { TILE_UNITS, type Walker } from '../dungeon/room-walk.js';
import type { Hero } from '../hero/hero.js';
import {
  alcanceDoHeroi,
  atordoaNoChute,
  bonusDoAtaque,
  criticoDaArma,
  empurraoDoEmpurrao,
  escudoDoRevestimento,
  explosaoDaArma,
  passosDoCanal,
  passosPorCargaDaConcentracao,
  podeLancarChapeu,
  textosDaClasse,
  velocidadeDaArma,
} from '../hero/classes-de-luta.js';
import { instantiate } from '../items/item.js';
import { REGRAS_DAS_ARMAS_NOVAS } from '../items/pecas-secretas.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import type { MonsterInstance } from '../monsters/generate.js';
import { seededRng, type Rng } from '../rng.js';
import { FAIXA_CRITICA } from '../combat/resolve-attack.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from '../jogo/estado.js';
import { saveSorteado } from '../jogo/heroi-sorteado.js';
import { abrirLuta, extrasDaLuta, memoriaDaLuta, passoDaLuta, RECARGA_DO_ATAQUE, type Acontecimento, type EntradaDaLuta, type LutaEmTempoReal } from './arena.js';
import { DURACAO_DA_BARRA } from './eventos-de-arma.js';

// As armas novas (rodada 6c, 2026-11-18): bastão, leque e kusarigama do Monge, a lança do Guerreiro e o chapéu.

const R = REGRAS_DAS_ARMAS_NOVAS;
const T = TILE_UNITS;
const PARADO: EntradaDaLuta = { x: 0, y: 0 };
const NUNCA: Rng = () => 0.99;
const AGORA = () => 1_700_000_000_000;
const EMBAIXO: Walker = { x: 4.5 * T, y: 7.5 * T, facing: 'N' };

/** Quem luta, só com a identidade e as peças (pros números da classe). */
function quem(classId: string, pecas: { arma?: string; secundaria?: string; acessorio?: string } = {}, estilo?: string) {
  const t = (id?: string) => (id ? { templateId: id } : null);
  return { classId, ...(estilo ? { estilos: [estilo], estilo } : {}), equip: { arma: t(pecas.arma), secundaria: t(pecas.secundaria), acessorio: t(pecas.acessorio) } };
}

function monstro(overrides: Partial<MonsterInstance> = {}): MonsterInstance {
  return { speciesId: 'zumbi', enemyClassId: 'brutamontes', floor: 2, hp: 4000, maxHp: 4000, dmg: 3, speed: 5, xp: 12, gold: 7, isBoss: false, ...overrides };
}

function peca(id: string) {
  return { ...instantiate(templateById(id)!, RARITIES[0]!), equipped: true };
}

function naSala(classId: string, className: string, pecas: { arma?: string; secundaria?: string; acessorio?: string }, monsters: MonsterInstance[], hero: Partial<Hero> = {}): EstadoNaMasmorra {
  const save = saveSorteado('Aria', seededRng(11), seededRng(11));
  const base = retomarSave({ ...save, floor: 2, mapMode: 'dungeon' }, seededRng(11));
  if (base.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
  const celula = base.map.flat().find((c) => c.type === 'monster')!;
  const equip = {
    ...base.hero.equip,
    arma: pecas.arma ? peca(pecas.arma) : null,
    secundaria: pecas.secundaria ? peca(pecas.secundaria) : null,
    acessorio: pecas.acessorio ? peca(pecas.acessorio) : null,
  };
  const posicionado: EstadoNaMasmorra = {
    ...base,
    pos: { x: celula.x, y: celula.y },
    party: [],
    hero: { ...base.hero, className, classId, hp: 999, maxHp: 999, mp: 50, maxMp: 50, level: 1, gold: 100, buffs: {}, equip, ...hero },
  };
  return substituirCelulaAtual(posicionado, { ...celula, monsters, monsterIndex: 0, beaten: false, bonusTreasure: undefined });
}

function montar(estado: EstadoNaMasmorra, corpos: Array<[number, number]>, arena: Partial<LutaEmTempoReal['arena']> = {}, heroi: Walker = EMBAIXO): LutaEmTempoReal {
  const aberta = abrirLuta(estado, heroi).luta;
  return {
    ...aberta,
    arena: { ...aberta.arena, ...arena, monstros: aberta.arena.monstros.map((m, i) => ({ ...m, corpoX: corpos[i]![0] * T, corpoY: corpos[i]![1] * T })) },
  };
}

interface Rodada {
  luta: LutaEmTempoReal;
  acontecimentos: Acontecimento[];
}

function rodar(luta: LutaEmTempoReal, passos: number, rng: Rng = NUNCA, entrada: (i: number) => EntradaDaLuta = () => PARADO): Rodada {
  let atual = luta;
  const tudo: Acontecimento[] = [];
  for (let i = 0; i < passos && !atual.fim; i++) {
    const quadro = passoDaLuta(atual, entrada(i), rng, AGORA);
    atual = quadro.luta;
    tudo.push(...quadro.acontecimentos);
  }
  return { luta: atual, acontecimentos: tudo };
}

/** Um golpe com o toque no meio da barra; depois espera a recarga. */
function golpeNoMeio(luta: LutaEmTempoReal, cursor: { x: number; y: number }, rng: Rng = NUNCA): Rodada {
  const aberto = passoDaLuta(luta, { ...PARADO, atacar: true, cursor }, rng, AGORA);
  const meio = DURACAO_DA_BARRA / 2;
  const fim = rodar(aberto.luta, meio + RECARGA_DO_ATAQUE, rng, (i) => (i === meio - 1 ? { ...PARADO, tocar: true } : PARADO));
  return { luta: fim.luta, acontecimentos: [...aberto.acontecimentos, ...fim.acontecimentos] };
}

function vida(luta: LutaEmTempoReal, indice = 0): number {
  return ((celulaAtual(luta.estado) as DungeonCell).monsters ?? [])[indice]!.hp;
}

function avisos(r: Rodada): string[] {
  return r.acontecimentos.filter((a) => a.tipo === 'aviso' && a.texto).map((a) => a.texto as string);
}

describe('as armas novas nos números da classe', () => {
  it('o alcance da arma soma ao do estilo, só pra classe dona dela', () => {
    expect(alcanceDoHeroi(quem('monge', { arma: 'bastao' }))).toBe(alcanceDoHeroi(quem('monge')) + R.alcanceDoBastao);
    expect(alcanceDoHeroi(quem('monge', { arma: 'kusarigama' }))).toBe(alcanceDoHeroi(quem('monge')) + R.alcanceDaKusarigama);
    expect(alcanceDoHeroi(quem('monge', { arma: 'bastao' }, 'chute'))).toBe(alcanceDoHeroi(quem('monge', {}, 'chute')) + R.alcanceDoBastao);
    expect(alcanceDoHeroi(quem('monge', { arma: 'kusarigama' }, 'concentracao'))).toBe(alcanceDoHeroi(quem('monge', {}, 'concentracao')) + R.alcanceDaKusarigama);
    expect(alcanceDoHeroi(quem('guerreiro', { arma: 'lanca' }))).toBe(alcanceDoHeroi(quem('guerreiro', { arma: 'espada' })) + R.alcanceDaLanca);
    expect(alcanceDoHeroi(quem('guerreiro', { arma: 'bastao' }))).toBe(alcanceDoHeroi(quem('guerreiro', { arma: 'espada' })));
  });

  it('o bastão: ki e cargas mais rápidos, e o chute que atordoa', () => {
    expect(passosDoCanal(quem('monge', { arma: 'bastao' }))).toBe(Math.trunc(60 / R.kiComOBastao));
    expect(passosDoCanal(quem('monge'))).toBeGreaterThan(passosDoCanal(quem('monge', { arma: 'bastao' })));
    expect(passosPorCargaDaConcentracao(quem('monge', { arma: 'bastao' }, 'concentracao'))).toBe(R.passosPorCargaComOBastao);
    expect(atordoaNoChute(quem('monge', { arma: 'bastao' }, 'chute'))).toBe(R.atordoaNoChute);
    expect(atordoaNoChute(quem('monge', { arma: 'bastao' }))).toBe(0);
  });

  it('o leque: crítico, empurrão do estilo; dois leques: velocidade e a explosão', () => {
    expect(criticoDaArma(quem('monge', { secundaria: 'leque' }))).toBe(R.criticoDoLeque);
    expect(criticoDaArma(quem('monge', { arma: 'leque', secundaria: 'leque' }))).toBe(R.criticoDoLeque);
    expect(criticoDaArma(quem('guerreiro', { arma: 'leque' }))).toBe(0);
    expect(empurraoDoEmpurrao(quem('monge', { arma: 'leque' }, 'empurrao'))).toBe(1 + R.empurraoDoLeque);
    expect(empurraoDoEmpurrao(quem('monge', {}, 'empurrao'))).toBe(1);
    expect(velocidadeDaArma(quem('monge', { arma: 'leque' }))).toBe(0);
    expect(velocidadeDaArma(quem('monge', { arma: 'leque', secundaria: 'leque' }))).toBe(R.velocidadeComDoisLeques);
    expect(explosaoDaArma(quem('monge', { arma: 'leque', secundaria: 'leque' }))).toEqual({ empurra: 2, dano: 30 });
    expect(explosaoDaArma(quem('monge', { arma: 'leque' }))).toEqual({ empurra: 1, dano: 0 });
  });

  it('a kusarigama segura 50% no revestimento; o Guerreiro de lança ou chapéu bate +10%, sem somar', () => {
    expect(escudoDoRevestimento(quem('monge', { arma: 'kusarigama' }))).toBe(50);
    expect(escudoDoRevestimento(quem('monge'))).toBe(30);
    const alvo = { colado: false, chefe: false };
    expect(bonusDoAtaque(quem('guerreiro', { arma: 'lanca' }), {}, alvo)).toBe(10);
    expect(bonusDoAtaque(quem('guerreiro', { arma: 'espada', acessorio: 'chapeu_espadachim' }), {}, alvo)).toBe(10);
    expect(bonusDoAtaque(quem('guerreiro', { arma: 'lanca', acessorio: 'chapeu_espadachim' }), {}, alvo)).toBe(10);
    expect(bonusDoAtaque(quem('guerreiro', { arma: 'espada' }), {}, alvo)).toBe(0);
  });

  it('o chapéu é de quem junta ki, e a linha da classe conta a espera dele', () => {
    expect(podeLancarChapeu(quem('monge', { acessorio: 'chapeu_espadachim' }))).toBe(true);
    expect(podeLancarChapeu(quem('guerreiro', { acessorio: 'chapeu_espadachim' }, 'espadachim'))).toBe(true);
    expect(podeLancarChapeu(quem('guerreiro', { acessorio: 'chapeu_espadachim' }))).toBe(false);
    expect(podeLancarChapeu(quem('mago', { acessorio: 'chapeu_espadachim' }))).toBe(false);
    const monge = { ...quem('monge', { acessorio: 'chapeu_espadachim' }), hp: 10, maxHp: 10 };
    expect(textosDaClasse(monge, {}, { chapeu: 600 })).toContain('🎩 Chapéu em 10 s');
    expect(textosDaClasse(monge, {}, { chapeu: 0 })).toContain('🎩 Chapéu pronto');
  });
});

describe('as armas novas na luta', () => {
  it('a kusarigama pega a área 3 × 2 no alvo: ele, a fileira atrás e o do lado; quem está na frente escapa', () => {
    const estado = naSala('monge', 'Monge', { arma: 'kusarigama' }, [monstro(), monstro(), monstro(), monstro()]);
    const luta = montar(estado, [[4.5, 3.5], [4.5, 2.5], [5.5, 3.5], [4.5, 4.5]], {}, { x: 4.5 * T, y: 7.5 * T, facing: 'N' });
    const r = golpeNoMeio(luta, { x: 4.5 * T, y: 3.5 * T });
    const dano = 4000 - vida(r.luta, 0);
    expect(dano).toBeGreaterThan(0);
    expect(vida(r.luta, 1)).toBe(4000 - dano);
    expect(vida(r.luta, 2)).toBe(4000 - dano);
    expect(vida(r.luta, 3)).toBe(4000);
  });

  it('a lança às vezes deixa o próximo golpe com a faixa do crítico maior', () => {
    const estado = naSala('guerreiro', 'Guerreiro', { arma: 'lanca' }, [monstro()]);
    const luta = montar(estado, [[4.5, 4.5]], {}, { x: 4.5 * T, y: 5.5 * T, facing: 'N' });
    const sorte: Rng = () => 0.05;
    const r = golpeNoMeio(luta, { x: 4.5 * T, y: 4.5 * T }, sorte);
    expect(r.luta.arena.classe?.criticoMaior).toBe(true);
    expect(avisos(r)).toContain('🔱 Crítico maior no próximo golpe');
    const aberto = passoDaLuta(r.luta, { ...PARADO, atacar: true, cursor: { x: 4.5 * T, y: 4.5 * T } }, NUNCA, AGORA).luta;
    expect(aberto.arena.evento?.evento.faixa).toBeCloseTo((FAIXA_CRITICA * (100 + R.faixaDaLanca)) / 100, 9);
    const sem = golpeNoMeio(luta, { x: 4.5 * T, y: 4.5 * T });
    expect(sem.luta.arena.classe?.criticoMaior).toBeUndefined();
  });

  it('o chapéu gasta 50 de ki, vai até a parede e volta, acertando na ida e na volta', () => {
    const estado = naSala('monge', 'Monge', { acessorio: 'chapeu_espadachim' }, [monstro()]);
    const luta = montar(estado, [[4.5, 3.5]], { ki: 120 }, { x: 4.5 * T, y: 7.5 * T, facing: 'N' });
    const lancou = passoDaLuta(luta, { ...PARADO, chapeu: true, cursor: { x: 4.5 * T, y: 3.5 * T } }, NUNCA, AGORA);
    expect(lancou.luta.arena.ki).toBe(70);
    expect(lancou.luta.arena.recargaDoChapeu).toBe(R.recargaDoChapeu);
    expect(lancou.luta.arena.chapeu).toBeDefined();
    expect(lancou.acontecimentos.some((a) => a.texto === '🎩 Chapéu!')).toBe(true);
    const voou = rodar(lancou.luta, 300);
    expect(voou.luta.arena.chapeu).toBeUndefined();
    const voltas = voou.acontecimentos.filter((a) => a.tipo === 'numero' && (a.texto ?? '').startsWith('🎩-'));
    expect(voltas.length).toBe(1);
    const dano = Number((voltas[0]!.texto ?? '').slice('🎩-'.length));
    expect(vida(voou.luta)).toBe(4000 - 2 * dano);
    // A espera vai pra memória do app, e não lança de novo antes dela.
    expect(memoriaDaLuta(voou.luta).recargaDoChapeu).toBeGreaterThan(0);
    expect(extrasDaLuta(voou.luta).chapeu).toBeGreaterThan(0);
    const deNovo = passoDaLuta(voou.luta, { ...PARADO, chapeu: true }, NUNCA, AGORA);
    expect(deNovo.luta.arena.chapeu).toBeUndefined();
  });

  it('sem ki, ou sem poder juntar ki, o chapéu não sai', () => {
    const pouco = montar(naSala('monge', 'Monge', { acessorio: 'chapeu_espadachim' }, [monstro()]), [[4.5, 3.5]], { ki: 30 });
    expect(passoDaLuta(pouco, { ...PARADO, chapeu: true }, NUNCA, AGORA).luta.arena.chapeu).toBeUndefined();
    const guerreiro = montar(naSala('guerreiro', 'Guerreiro', { arma: 'espada', acessorio: 'chapeu_espadachim' }, [monstro()]), [[4.5, 3.5]], { ki: 300 });
    expect(passoDaLuta(guerreiro, { ...PARADO, chapeu: true }, NUNCA, AGORA).luta.arena.chapeu).toBeUndefined();
    const espadachim = montar(
      naSala('guerreiro', 'Guerreiro', { arma: 'espada', acessorio: 'chapeu_espadachim' }, [monstro()], { estilos: ['espadachim'], estilo: 'espadachim' }),
      [[4.5, 3.5]],
      { ki: 300 },
    );
    expect(passoDaLuta(espadachim, { ...PARADO, chapeu: true }, NUNCA, AGORA).luta.arena.chapeu).toBeDefined();
  });
});
