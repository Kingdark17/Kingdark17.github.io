import { describe, expect, it } from 'vitest';

import type { DungeonCell } from '../dungeon/generate.js';
import { roomArrival } from '../dungeon/room-walk.js';
import { generateCompanion, type Hero } from '../hero/hero.js';
import { instantiate } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import type { MonsterInstance } from '../monsters/generate.js';
import { seededRng, type Rng } from '../rng.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from '../jogo/estado.js';
import { saveSorteado } from '../jogo/heroi-sorteado.js';
import {
  abrirLuta,
  ALTURA_DA_CAIXA,
  JEITOS_DE_LUTAR,
  LARGURA_DA_CAIXA,
  LENTIDAO,
  passoDaLuta,
  RAIO_DO_CORACAO,
  RECARGA_DO_PODER,
  RODADA,
  VELOCIDADE_DO_CORACAO,
  type Acontecimento,
  type EntradaDaLuta,
  type LutaEmTempoReal,
} from './arena.js';
import { DURACAO_DA_BARRA, SIMBOLOS } from './eventos-de-arma.js';

function monstro(overrides: Partial<MonsterInstance> = {}): MonsterInstance {
  return { speciesId: 'goblin', enemyClassId: 'brutamontes', floor: 2, hp: 40, maxHp: 40, dmg: 3, speed: 5, xp: 12, gold: 7, isBoss: false, ...overrides };
}

function arma(id: string) {
  return { ...instantiate(templateById(id)!, RARITIES[0]!), equipped: true };
}

/** Uma sala de monstro montada à mão, com um herói robusto (pra não morrer em teste que não é sobre morrer). */
function naSala(sala: Partial<DungeonCell> = {}, hero: Partial<Hero> = {}): EstadoNaMasmorra {
  const save = saveSorteado('Aria', seededRng(11), seededRng(11));
  const base = retomarSave({ ...save, floor: 2, mapMode: 'dungeon' }, seededRng(11));
  if (base.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
  const celula = base.map.flat().find((c) => c.type === 'monster')!;
  const posicionado: EstadoNaMasmorra = { ...base, pos: { x: celula.x, y: celula.y }, party: [], hero: { ...base.hero, hp: 999, maxHp: 999, level: 1, gold: 100, buffs: {}, ...hero } };
  return substituirCelulaAtual(posicionado, { ...celula, monsters: [monstro()], monsterIndex: 0, beaten: false, bonusTreasure: undefined, ...sala });
}

const PARADO: EntradaDaLuta = { x: 0, y: 0 };

/** Roda `passos` passos, com a entrada que `entrada(i)` der, e junta o que aconteceu. */
function rodar(luta: LutaEmTempoReal, passos: number, rng: Rng, entrada: (i: number, l: LutaEmTempoReal) => EntradaDaLuta = () => PARADO) {
  let atual = luta;
  const tudo: Acontecimento[] = [];
  for (let i = 0; i < passos && !atual.fim; i++) {
    const quadro = passoDaLuta(atual, entrada(i, atual), rng, () => 1_700_000_000_000);
    atual = quadro.luta;
    tudo.push(...quadro.acontecimentos);
  }
  return { luta: atual, acontecimentos: tudo };
}

/** Anda passo a passo, parado, até o monstro `indice` começar o aviso. */
function ateOAviso(luta: LutaEmTempoReal, rng: Rng, indice = 0): LutaEmTempoReal {
  let atual = luta;
  for (let i = 0; i < 1000 && atual.arena.monstros[indice]!.fase !== 'avisando'; i++) atual = passoDaLuta(atual, PARADO, rng).luta;
  expect(atual.arena.monstros[indice]!.fase).toBe('avisando');
  return atual;
}

function vidaDoMonstro(luta: LutaEmTempoReal, indice = 0): number {
  return ((celulaAtual(luta.estado) as DungeonCell).monsters ?? [])[indice]!.hp;
}

function vidaDoHeroi(luta: LutaEmTempoReal): number {
  return (luta.estado as EstadoNaMasmorra).hero.hp;
}

const NUNCA: Rng = () => 0.99;

describe('abrirLuta', () => {
  it('põe os monstros no palco, o caído fica caído, e o alvo é o primeiro de pé', () => {
    const estado = naSala({ monsters: [monstro({ hp: 0 }), monstro(), monstro()], monsterIndex: 0 });
    const { luta } = abrirLuta(estado, roomArrival('N'));
    expect(luta.arena.monstros.map((m) => m.fase)).toEqual(['caido', 'esperando', 'esperando']);
    expect(luta.arena.alvo).toBe(1);
    expect(luta.arena.coracao).toEqual({ x: LARGURA_DA_CAIXA / 2, y: ALTURA_DA_CAIXA / 2 });
  });

  it('quem ficou antes do monsterIndex (os saves da fila) já caiu', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro(), monstro()], monsterIndex: 1 }), roomArrival('N'));
    expect(luta.arena.monstros.map((m) => m.fase)).toEqual(['caido', 'esperando']);
    expect(luta.arena.alvo).toBe(1);
  });

  it('guarda por onde o herói entrou', () => {
    const { luta } = abrirLuta(naSala(), roomArrival('W'));
    expect(luta.arena.chegada).toEqual(roomArrival('W'));
  });

  it('consome a bênção do NPC e conta no diário', () => {
    const { acontecimentos } = abrirLuta(naSala({}, { npcBlessing: { dodge: 15, combats: 2 } }), roomArrival('N'));
    expect(acontecimentos.some((a) => a.tipo === 'diario' && a.texto?.includes('bênção'))).toBe(true);
  });

  it('os companheiros vivos entram na luta', () => {
    const vivo = generateCompanion(seededRng(3));
    const caido = { ...generateCompanion(seededRng(4)), hp: 0 };
    const { luta } = abrirLuta({ ...naSala(), party: [vivo, caido] }, roomArrival('N'));
    expect(luta.arena.companheiros.map((c) => c.indice)).toEqual([0]);
  });
});

describe('o coração', () => {
  it('anda com o joystick, e a parede da caixa segura', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'zumbi' })] }), roomArrival('S'));
    const fim = rodar(luta, 200, NUNCA, () => ({ x: 127, y: -127 }));
    expect(fim.luta.arena.coracao).toEqual({ x: LARGURA_DA_CAIXA - RAIO_DO_CORACAO, y: RAIO_DO_CORACAO });
  });

  it('na diagonal não anda mais rápido que reto', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'zumbi' })] }), roomArrival('S'));
    const reto = passoDaLuta(luta, { x: 127, y: 0 }, NUNCA).luta.arena.coracao;
    const diagonal = passoDaLuta(luta, { x: 127, y: 127 }, NUNCA).luta.arena.coracao;
    expect(reto.x - luta.arena.coracao.x).toBe(VELOCIDADE_DO_CORACAO);
    const dx = diagonal.x - luta.arena.coracao.x;
    expect(dx).toBe(diagonal.y - luta.arena.coracao.y);
    expect(dx * dx * 2).toBeLessThanOrEqual(VELOCIDADE_DO_CORACAO * VELOCIDADE_DO_CORACAO);
  });
});

describe('o golpe do monstro', () => {
  it('vem com aviso, e acerta o coração parado', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'aranha' })] }), roomArrival(null));
    let avisou = false;
    const fim = rodar(luta, 400, NUNCA, (_i, l) => {
      if (l.arena.monstros[0]!.fase === 'avisando') avisou = true;
      return PARADO;
    });
    expect(avisou).toBe(true);
    expect(fim.acontecimentos.some((a) => a.tipo === 'numero' && a.onde === 'heroi' && a.texto?.startsWith('-'))).toBe(true);
  });

  it('o círculo cai onde o coração estava: quem sai dele durante o aviso não leva', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'aranha' })] }), roomArrival(null));
    const avisando = ateOAviso(luta, NUNCA);
    expect(avisando.arena.monstros[0]).toMatchObject({ x: avisando.arena.coracao.x, y: avisando.arena.coracao.y, alvo: -1 });
    const fim = rodar(avisando, JEITOS_DE_LUTAR.venenoso.aviso + 2, NUNCA, () => ({ x: 127, y: 0 }));
    expect(vidaDoHeroi(fim.luta)).toBe(vidaDoHeroi(avisando));
    expect(fim.acontecimentos.some((a) => a.tipo === 'numero' && a.texto === 'Errou')).toBe(true);
  });

  it('a investida mergulha de cima mirando o coração: parado leva, de lado escapa', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'goblin' })] }), roomArrival(null));
    const avisando = ateOAviso(luta, NUNCA);
    const m = avisando.arena.monstros[0]!;
    expect(m.y).toBeLessThan(0);
    expect(m.rumoY).toBeGreaterThan(0);

    const parado = rodar(avisando, 120, NUNCA);
    expect(vidaDoHeroi(parado.luta)).toBeLessThan(vidaDoHeroi(avisando));

    const deLado = rodar(avisando, 120, NUNCA, () => ({ x: 127, y: 0 }));
    expect(vidaDoHeroi(deLado.luta)).toBe(vidaDoHeroi(avisando));
    expect(deLado.acontecimentos.some((a) => a.tipo === 'numero' && a.texto === 'Errou')).toBe(true);
  });

  it('o mágico atira uma bola de cima, na direção do coração', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'elemental_fogo' })] }), roomArrival('N'));
    let tiro = null as LutaEmTempoReal['arena']['tiros'][number] | null;
    rodar(luta, 300, NUNCA, (_i, l) => {
      tiro ??= l.arena.tiros[0] ?? null;
      return PARADO;
    });
    expect(tiro).not.toBeNull();
    expect(tiro!.y).toBeLessThan(ALTURA_DA_CAIXA / 2);
    expect(tiro!.vy).toBeGreaterThan(0);
  });

  it('o golpe pode ir no companheiro, como no site, e aí não passa pela caixa', () => {
    const defensor = { ...generateCompanion(seededRng(3)), stance: 'defensiva' as const, hp: 999, maxHp: 999 };
    const { luta } = abrirLuta({ ...naSala({ monsters: [monstro({ speciesId: 'aranha' })] }), party: [defensor] }, roomArrival(null));
    const sempre: Rng = () => 0;
    const avisando = ateOAviso(luta, sempre);
    expect(avisando.arena.monstros[0]!.alvo).toBe(0);
    const fim = rodar(avisando, 60, sempre);
    expect(fim.acontecimentos.some((a) => a.tipo === 'numero' && a.onde === 'companheiro' && a.texto?.startsWith('-'))).toBe(true);
    expect(vidaDoHeroi(fim.luta)).toBe(vidaDoHeroi(avisando));
  });

  it('um golpe por vez, revezando entre os de pé', () => {
    const grupo = [monstro({ speciesId: 'goblin', hp: 900 }), monstro({ speciesId: 'aranha', hp: 900 }), monstro({ speciesId: 'zumbi', hp: 900 })];
    const { luta } = abrirLuta(naSala({ monsters: grupo }), roomArrival(null));
    const ordem: number[] = [];
    rodar(luta, 900, NUNCA, (_i, l) => {
      const golpeando = l.arena.monstros.filter((m) => m.fase === 'avisando' || m.fase === 'investindo');
      expect(golpeando.length).toBeLessThanOrEqual(1);
      if (golpeando[0] && ordem[ordem.length - 1] !== golpeando[0].indice) ordem.push(golpeando[0].indice);
      return { x: 0, y: 127 };
    });
    expect(ordem.slice(0, 4)).toEqual([0, 1, 2, 0]);
  });

  it('o herói que cai perde a luta e volta pra cidade', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'aranha', dmg: 50 })] }, { hp: 1 }), roomArrival(null));
    const fim = rodar(luta, 600, NUNCA);
    expect(fim.luta.fim).toBe('derrota');
    expect(fim.luta.estado.mapMode).toBe('city');
  });
});

describe('o ataque do herói', () => {
  const comArma = (id: string, hero: Partial<Hero> = {}) => ({ equip: { ...naSala().hero.equip, arma: arma(id) }, ...hero });

  it('a espada abre a barra no alvo, o mundo fica lento, e o toque no meio crita', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'zumbi', hp: 200, maxHp: 200 })] }, comArma('espada')), roomArrival('S'));
    const aberto = passoDaLuta(luta, { ...PARADO, atacar: true }, NUNCA).luta;
    expect(aberto.arena.evento?.evento.tipo).toBe('barra');
    // Câmera lenta: em LENTIDAO passos de verdade, o mundo anda um.
    const lento = rodar(aberto, LENTIDAO, NUNCA);
    expect(lento.luta.arena.passo - aberto.arena.passo).toBe(1);
    const antes = vidaDoMonstro(aberto);
    const meio = DURACAO_DA_BARRA / 2;
    const fim = rodar(aberto, meio, NUNCA, (i) => (i === meio - 1 ? { ...PARADO, tocar: true } : PARADO));
    expect(fim.luta.arena.evento).toBeNull();
    expect(vidaDoMonstro(fim.luta)).toBeLessThan(antes);
    expect(fim.acontecimentos.some((a) => a.tipo === 'numero' && a.tom === 'critico')).toBe(true);
  });

  it('tocar num monstro de pé muda o alvo; num caído, ou num que não existe, não', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ hp: 0 }), monstro({ speciesId: 'zumbi' }), monstro({ speciesId: 'zumbi' })], monsterIndex: 1 }), roomArrival('S'));
    const mirado = passoDaLuta(luta, { ...PARADO, mirar: 2 }, NUNCA).luta;
    expect(mirado.arena.alvo).toBe(2);
    expect(passoDaLuta(mirado, { ...PARADO, mirar: 0 }, NUNCA).luta.arena.alvo).toBe(2);
    expect(passoDaLuta(mirado, { ...PARADO, mirar: 7 }, NUNCA).luta.arena.alvo).toBe(2);
  });

  it('o golpe cai no alvo escolhido', () => {
    const dois = [monstro({ speciesId: 'zumbi', hp: 200, maxHp: 200 }), monstro({ speciesId: 'zumbi', hp: 200, maxHp: 200 })];
    const { luta } = abrirLuta(naSala({ monsters: dois }, comArma('espada')), roomArrival('S'));
    const aberto = passoDaLuta(luta, { ...PARADO, mirar: 1, atacar: true }, NUNCA).luta;
    expect(aberto.arena.evento?.alvo).toBe(1);
    const meio = DURACAO_DA_BARRA / 2;
    const fim = rodar(aberto, meio, NUNCA, (i) => (i === meio - 1 ? { ...PARADO, tocar: true } : PARADO));
    expect(vidaDoMonstro(fim.luta, 1)).toBeLessThan(200);
    expect(vidaDoMonstro(fim.luta, 0)).toBe(200);
  });

  it('o arco acerta no fim do evento, sem bola voando', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'zumbi', hp: 200, maxHp: 200 })] }, comArma('arco', { className: 'Arqueiro', classId: 'arqueiro' })), roomArrival('S'));
    const aberto = passoDaLuta(luta, { ...PARADO, atacar: true }, NUNCA).luta;
    expect(aberto.arena.evento?.evento.tipo).toBe('circulo');
    const fim = rodar(aberto, 42, NUNCA, (i) => (i === 41 ? { ...PARADO, tocar: true } : PARADO));
    expect(vidaDoMonstro(fim.luta)).toBeLessThan(200);
    expect(fim.luta.arena.tiros).toHaveLength(0);
  });

  it('derrubar o alvo passa o alvo pro próximo de pé', () => {
    const dois = [monstro({ speciesId: 'zumbi', hp: 1 }), monstro({ speciesId: 'zumbi', hp: 200, maxHp: 200 })];
    const { luta } = abrirLuta(naSala({ monsters: dois }, comArma('espada')), roomArrival('S'));
    const aberto = passoDaLuta(luta, { ...PARADO, atacar: true }, NUNCA).luta;
    const fim = rodar(aberto, 42, NUNCA, (i) => (i === 41 ? { ...PARADO, tocar: true } : PARADO));
    expect(fim.luta.arena.monstros[0]!.fase).toBe('caido');
    expect(fim.luta.arena.alvo).toBe(1);
    expect(fim.luta.fim).toBeNull();
  });

  it('derrubar o último vence a luta e marca a sala', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'zumbi', hp: 1 })] }, comArma('espada')), roomArrival('S'));
    const aberto = passoDaLuta(luta, { ...PARADO, atacar: true }, NUNCA).luta;
    const fim = rodar(aberto, 42, NUNCA, (i) => (i === 41 ? { ...PARADO, tocar: true } : PARADO));
    expect(fim.luta.fim).toBe('vitoria');
    expect((celulaAtual(fim.luta.estado) as DungeonCell).beaten).toBe(true);
    expect(fim.acontecimentos.some((a) => a.tipo === 'som' && a.som === 'victory')).toBe(true);
  });
});

describe('os outros eventos dentro da arena', () => {
  function contraOZumbi(hero: Partial<Hero>) {
    return abrirLuta(naSala({ monsters: [monstro({ speciesId: 'zumbi', hp: 300, maxHp: 300 })] }, hero), roomArrival(null)).luta;
  }

  it('o machado: o aperto já começa a encher, e soltar no meio acerta', () => {
    const luta = contraOZumbi({ equip: { ...naSala().hero.equip, arma: arma('machado') } });
    const aberto = passoDaLuta(luta, { ...PARADO, atacar: true }, NUNCA).luta;
    expect(aberto.arena.evento?.evento.tipo).toBe('carga');
    const fim = rodar(aberto, 42, NUNCA, (i) => (i === 41 ? { ...PARADO, soltar: true } : PARADO));
    expect(vidaDoMonstro(fim.luta)).toBeLessThan(300);
  });

  it('o cajado: o traço em cima do símbolo, levantando o dedo, acerta', () => {
    const luta = contraOZumbi({ equip: { ...naSala().hero.equip, arma: arma('cajado') } });
    const aberto = passoDaLuta(luta, { ...PARADO, atacar: true }, NUNCA).luta;
    const evento = aberto.arena.evento!.evento;
    expect(evento.tipo).toBe('desenho');
    const pontos = SIMBOLOS[evento.simbolo!]!;
    const fim = rodar(aberto, pontos.length + 1, NUNCA, (i) => (i < pontos.length ? { ...PARADO, dedo: { x: pontos[i]![0], y: pontos[i]![1] } } : PARADO));
    expect(fim.luta.arena.evento).toBeNull();
    expect(vidaDoMonstro(fim.luta)).toBeLessThan(300);
  });

  it('o defensivo descansando se protege: o golpe chega com metade da força', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'esqueleto', hp: 300, maxHp: 300 })] }, { equip: { ...naSala().hero.equip, arma: arma('espada') } }), roomArrival(null));
    const guardando = { ...luta, arena: { ...luta.arena, monstros: [{ ...luta.arena.monstros[0]!, fase: 'descansando' as const, tempo: 500 }] } };
    const aberto = passoDaLuta(guardando, { ...PARADO, atacar: true }, NUNCA).luta;
    const fim = rodar(aberto, 42, NUNCA, (i) => (i === 41 ? { ...PARADO, tocar: true } : PARADO));
    expect(fim.acontecimentos.some((a) => a.tipo === 'aviso' && a.texto?.includes('se protege'))).toBe(true);
    expect(fim.acontecimentos.some((a) => a.tipo === 'numero' && a.tom === 'critico')).toBe(false);
  });
});

describe('os companheiros', () => {
  it('batem no alvo do jogador', () => {
    const companheiro = { ...generateCompanion(seededRng(3)), stance: 'agressiva' as const };
    const dois = [monstro({ speciesId: 'zumbi', hp: 500, maxHp: 500 }), monstro({ speciesId: 'zumbi', hp: 500, maxHp: 500 })];
    const { luta } = abrirLuta({ ...naSala({ monsters: dois }), party: [companheiro] }, roomArrival('S'));
    const fim = rodar(luta, 400, seededRng(9), (i) => (i === 0 ? { ...PARADO, mirar: 1 } : { x: 0, y: 127 }));
    expect(vidaDoMonstro(fim.luta, 1)).toBeLessThan(500);
    expect(vidaDoMonstro(fim.luta, 0)).toBe(500);
  });
});

describe('poderes, itens e a rodada', () => {
  it('o poder de dano acerta o alvo e espera pra voltar', () => {
    const estado = naSala({ monsters: [monstro({ speciesId: 'zumbi', hp: 300, maxHp: 300 })] }, { className: 'Guerreiro', classId: 'guerreiro', powerIds: ['golpe_poderoso'], mp: 50 });
    const { luta } = abrirLuta(estado, roomArrival(null));
    const usado = passoDaLuta(luta, { ...PARADO, poder: 'golpe_poderoso' }, NUNCA).luta;
    expect(vidaDoMonstro(usado)).toBeLessThan(300);
    expect(usado.arena.recargaDosPoderes.golpe_poderoso).toBe(RECARGA_DO_PODER - 1);
    const deNovo = passoDaLuta(usado, { ...PARADO, poder: 'golpe_poderoso' }, NUNCA).luta;
    expect(vidaDoMonstro(deNovo)).toBe(vidaDoMonstro(usado));
  });

  it('a poção cura', () => {
    const pocao = instantiate(templateById('pot_vida')!, RARITIES[0]!);
    const estado = { ...naSala({ monsters: [monstro({ speciesId: 'zumbi' })] }, { hp: 100 }), inventory: [pocao] };
    const { luta } = abrirLuta(estado, roomArrival(null));
    const usado = passoDaLuta(luta, { ...PARADO, item: pocao.uid }, NUNCA).luta;
    expect((usado.estado as EstadoNaMasmorra).hero.hp).toBeGreaterThan(100);
    expect((usado.estado as EstadoNaMasmorra).inventory).toHaveLength(0);
  });

  it('o veneno no herói corre a cada rodada', () => {
    // Abrir a luta zera os buffs (como no site): o veneno vem de um golpe já dentro dela.
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'zumbi' })] }, { hp: 500 }), roomArrival('S'));
    const estado = luta.estado as EstadoNaMasmorra;
    const envenenado = { ...luta, estado: { ...estado, hero: { ...estado.hero, buffs: { poisonTurns: 3, poisonDmg: 4 } } } };
    const fim = rodar(envenenado, RODADA, NUNCA, () => ({ x: 127, y: 0 }));
    expect(vidaDoHeroi(fim.luta)).toBe(496);
  });
});

describe('a mesma entrada dá a mesma luta', () => {
  it('passo a passo, com a mesma semente', () => {
    const estado = naSala({ monsters: [monstro(), monstro({ speciesId: 'elemental_fogo' }), monstro({ speciesId: 'aranha' })] }, { equip: { ...naSala().hero.equip, arma: arma('machado') } });
    const entrada = (i: number): EntradaDaLuta => ({ x: (i % 50) - 25, y: 30 - (i % 40), atacar: i % 70 === 0, soltar: i % 70 === 40, ...(i % 200 === 100 ? { mirar: (i / 100) % 3 } : {}) });
    const a = rodar(abrirLuta(estado, roomArrival('W')).luta, 900, seededRng(5), entrada);
    const b = rodar(abrirLuta(estado, roomArrival('W')).luta, 900, seededRng(5), entrada);
    expect(b).toEqual(a);
  });
});
