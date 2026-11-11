import { describe, expect, it } from 'vitest';

import type { DungeonCell } from '../dungeon/generate.js';
import { HERO_HALF, HERO_SPEED, TILE_UNITS, roomArrival, type Walker } from '../dungeon/room-walk.js';
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
  ALCANCE_CORPO_A_CORPO,
  golpeDePerto,
  JEITOS_DE_LUTAR,
  LENTIDAO,
  lugarDoMonstro,
  passoDaLuta,
  RECARGA_DO_PODER,
  RODADA,
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

const T = TILE_UNITS;
/** O meio da sala, onde fica o monstro sozinho. */
const MEIO = { x: 4.5 * T, y: 4.5 * T };
/** Uma casa abaixo do meio: a arma de perto alcança o monstro sozinho e os dois da dupla. */
const PERTO: Walker = { x: 4.5 * T, y: 5.5 * T, facing: 'N' };

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
    expect(luta.arena.heroi).toEqual(roomArrival('N'));
  });

  it('quem abre a luta ainda no vão da porta dá um passo pra dentro', () => {
    const { luta } = abrirLuta(naSala(), { x: 4.5 * T, y: 9 * T - 10, facing: 'N' });
    expect(luta.arena.heroi).toEqual(roomArrival('N'));
    expect(luta.arena.chegada).toEqual({ x: 4.5 * T, y: 9 * T - 10, facing: 'N' });
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

describe('o herói na sala', () => {
  it('anda com o joystick, e a parede da sala segura (a porta está fechada)', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'zumbi' })] }), roomArrival('S'));
    const noCanto = rodar(luta, 200, NUNCA, () => ({ x: 127, y: -127 }));
    expect(noCanto.luta.arena.heroi).toMatchObject({ x: 8 * T - HERO_HALF, y: T + HERO_HALF });
    // Em frente à porta de cima, por onde entrou: ela não deixa sair.
    const naPorta = rodar(luta, 200, NUNCA, () => ({ x: 0, y: -127 }));
    expect(naPorta.luta.arena.heroi).toMatchObject({ x: 4.5 * T, y: T + HERO_HALF });
    expect(naPorta.luta.fim).toBeNull();
  });

  it('na diagonal não anda mais rápido que reto', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'zumbi' })] }), roomArrival('S'));
    const reto = passoDaLuta(luta, { x: 127, y: 0 }, NUNCA).luta.arena.heroi;
    const diagonal = passoDaLuta(luta, { x: 127, y: 127 }, NUNCA).luta.arena.heroi;
    expect(reto.x - luta.arena.heroi.x).toBe(HERO_SPEED);
    const dx = diagonal.x - luta.arena.heroi.x;
    expect(dx).toBe(diagonal.y - luta.arena.heroi.y);
    expect(dx * dx * 2).toBeLessThanOrEqual(HERO_SPEED * HERO_SPEED);
  });

  it('o monstro de pé toma a casa dele; caído, dá pra passar', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'zumbi' })] }), roomArrival(null));
    const barrado = rodar(luta, 100, NUNCA, () => ({ x: 0, y: -127 }));
    expect(barrado.luta.arena.heroi).toMatchObject({ x: 4.5 * T, y: 5 * T + HERO_HALF });
    const caido = { ...luta, arena: { ...luta.arena, monstros: [{ ...luta.arena.monstros[0]!, fase: 'caido' as const }] } };
    expect(rodar(caido, 100, NUNCA, () => ({ x: 0, y: -127 })).luta.arena.heroi.y).toBe(T + HERO_HALF);
  });

  it('quem começa em cima de um monstro sai andando, e aí a casa fecha', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'zumbi' })] }), { ...MEIO, facing: 'S' });
    const saiu = rodar(luta, 40, NUNCA, () => ({ x: 0, y: 127 }));
    expect(saiu.luta.arena.heroi.y).toBe(MEIO.y + 40 * HERO_SPEED);
    const voltando = rodar(saiu.luta, 100, NUNCA, () => ({ x: 0, y: -127 }));
    expect(voltando.luta.arena.heroi.y).toBe(5 * T + HERO_HALF);
  });
});

describe('o golpe do monstro', () => {
  it('vem com aviso, e acerta o herói parado', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'aranha' })] }), roomArrival(null));
    let avisou = false;
    const fim = rodar(luta, 400, NUNCA, (_i, l) => {
      if (l.arena.monstros[0]!.fase === 'avisando') avisou = true;
      return PARADO;
    });
    expect(avisou).toBe(true);
    expect(fim.acontecimentos.some((a) => a.tipo === 'numero' && a.onde === 'heroi' && a.texto?.startsWith('-'))).toBe(true);
  });

  it('o círculo cai onde o herói estava: quem sai dele durante o aviso não leva', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'aranha' })] }), roomArrival(null));
    const avisando = ateOAviso(luta, NUNCA);
    expect(avisando.arena.monstros[0]).toMatchObject({ x: avisando.arena.heroi.x, y: avisando.arena.heroi.y, alvo: -1 });
    const fim = rodar(avisando, JEITOS_DE_LUTAR.venenoso.aviso + 2, NUNCA, () => ({ x: 127, y: 0 }));
    expect(vidaDoHeroi(fim.luta)).toBe(vidaDoHeroi(avisando));
    expect(fim.acontecimentos.some((a) => a.tipo === 'numero' && a.texto === 'Errou')).toBe(true);
  });

  it('a investida sai da casa do monstro mirando o herói: parado leva, de lado escapa', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'goblin' })] }), roomArrival(null));
    const avisando = ateOAviso(luta, NUNCA);
    const m = avisando.arena.monstros[0]!;
    expect(m).toMatchObject(MEIO);
    expect(m.rumoX).toBe(0);
    expect(m.rumoY).toBe(JEITOS_DE_LUTAR.agressivo.velocidade);

    const parado = rodar(avisando, 120, NUNCA);
    expect(vidaDoHeroi(parado.luta)).toBeLessThan(vidaDoHeroi(avisando));

    const deLado = rodar(avisando, 120, NUNCA, () => ({ x: 127, y: 0 }));
    expect(vidaDoHeroi(deLado.luta)).toBe(vidaDoHeroi(avisando));
    expect(deLado.acontecimentos.some((a) => a.tipo === 'numero' && a.texto === 'Errou')).toBe(true);
  });

  it('o mágico atira uma bola de onde está, na direção do herói', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'elemental_fogo' })] }), roomArrival('N'));
    let tiro = null as LutaEmTempoReal['arena']['tiros'][number] | null;
    rodar(luta, 300, NUNCA, (_i, l) => {
      tiro ??= l.arena.tiros[0] ?? null;
      return PARADO;
    });
    expect(tiro).not.toBeNull();
    expect(tiro!.x).toBe(MEIO.x);
    expect(tiro!.y).toBe(MEIO.y + JEITOS_DE_LUTAR.magico.velocidade);
    expect(tiro!.vy).toBe(JEITOS_DE_LUTAR.magico.velocidade);
  });

  it('o golpe pode ir no companheiro, como no site, e aí não passa pelo chão', () => {
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
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'zumbi', hp: 200, maxHp: 200 })] }, comArma('espada')), PERTO);
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
    const { luta } = abrirLuta(naSala({ monsters: dois }, comArma('espada')), PERTO);
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
    const { luta } = abrirLuta(naSala({ monsters: dois }, comArma('espada')), PERTO);
    const aberto = passoDaLuta(luta, { ...PARADO, atacar: true }, NUNCA).luta;
    const fim = rodar(aberto, 42, NUNCA, (i) => (i === 41 ? { ...PARADO, tocar: true } : PARADO));
    expect(fim.luta.arena.monstros[0]!.fase).toBe('caido');
    expect(fim.luta.arena.alvo).toBe(1);
    expect(fim.luta.fim).toBeNull();
  });

  it('derrubar o último vence a luta e marca a sala', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'zumbi', hp: 1 })] }, comArma('espada')), PERTO);
    const aberto = passoDaLuta(luta, { ...PARADO, atacar: true }, NUNCA).luta;
    const fim = rodar(aberto, 42, NUNCA, (i) => (i === 41 ? { ...PARADO, tocar: true } : PARADO));
    expect(fim.luta.fim).toBe('vitoria');
    expect((celulaAtual(fim.luta.estado) as DungeonCell).beaten).toBe(true);
    expect(fim.acontecimentos.some((a) => a.tipo === 'som' && a.som === 'victory')).toBe(true);
  });
});

describe('o alcance da arma de perto', () => {
  const comArma = (id: string, hero: Partial<Hero> = {}) => ({ equip: { ...naSala().hero.equip, arma: arma(id) }, ...hero });
  const zumbi = (hp = 200) => monstro({ speciesId: 'zumbi', hp, maxHp: 200 });
  const toqueNoMeio = (i: number): EntradaDaLuta => (i === 41 ? { ...PARADO, tocar: true } : PARADO);

  it('espada, machado e mão vazia são de perto; arco, cajado e magia, de longe', () => {
    const hero = naSala().hero;
    const com = (id: string | null) => ({ ...hero, equip: { ...hero.equip, arma: id ? arma(id) : null } });
    expect(golpeDePerto(com('espada'), 'normal')).toBe(true);
    expect(golpeDePerto(com('machado'), 'physical')).toBe(true);
    expect(golpeDePerto(com(null), 'normal')).toBe(true);
    expect(golpeDePerto(com('arco'), 'normal')).toBe(false);
    expect(golpeDePerto(com('arco'), 'ranged')).toBe(false);
    expect(golpeDePerto(com('cajado'), 'physical')).toBe(false);
    expect(golpeDePerto(com('espada'), 'magic')).toBe(false);
  });

  it('longe do alvo, o botão não abre o evento e avisa', () => {
    const { luta } = abrirLuta(naSala({ monsters: [zumbi()] }, comArma('espada')), roomArrival(null));
    const quadro = passoDaLuta(luta, { ...PARADO, atacar: true }, NUNCA);
    expect(quadro.luta.arena.evento).toBeNull();
    expect(quadro.acontecimentos).toContainEqual({ tipo: 'aviso', texto: 'Chegue mais perto' });
  });

  it('o alcance é uma casa e meia, do pé do herói ao meio da casa do monstro', () => {
    const noLimite = { x: MEIO.x, y: MEIO.y + ALCANCE_CORPO_A_CORPO, facing: 'N' as const };
    const abre = (heroi: Walker) => passoDaLuta(abrirLuta(naSala({ monsters: [zumbi()] }, comArma('espada')), heroi).luta, { ...PARADO, atacar: true }, NUNCA).luta.arena.evento;
    expect(abre(noLimite)).not.toBeNull();
    expect(abre({ ...noLimite, y: noLimite.y + 1 })).toBeNull();
    expect(lugarDoMonstro(1, 0, { cols: 9, rows: 9, conteudo: { col: 4, row: 4 }, portas: {} as never })).toEqual(MEIO);
  });

  it('o arco e o cajado abrem de qualquer lugar', () => {
    for (const id of ['arco', 'cajado']) {
      const { luta } = abrirLuta(naSala({ monsters: [zumbi()] }, comArma(id)), roomArrival('N'));
      expect(passoDaLuta(luta, { ...PARADO, atacar: true }, NUNCA).luta.arena.evento).not.toBeNull();
    }
  });

  it('com o alvo escolhido longe, o golpe vai no de pé mais perto que a arma alcança, e ele vira o alvo', () => {
    const tres = [zumbi(), zumbi(), zumbi()];
    // Ao lado do da direita (a casa 6,4): o do meio fica a duas casas, o da esquerda a quatro.
    const { luta } = abrirLuta(naSala({ monsters: tres }, comArma('espada')), { x: 6.5 * T, y: 5.5 * T, facing: 'N' });
    expect(luta.arena.alvo).toBe(0);
    const aberto = passoDaLuta(luta, { ...PARADO, atacar: true }, NUNCA).luta;
    expect(aberto.arena.evento?.alvo).toBe(2);
    expect(aberto.arena.alvo).toBe(2);
  });

  it('quem se afasta do alvo durante o evento erra, sem gastar o dado', () => {
    const { luta } = abrirLuta(naSala({ monsters: [zumbi()] }, comArma('espada')), PERTO);
    const aberto = passoDaLuta(luta, { ...PARADO, atacar: true }, NUNCA).luta;
    let sorteios = 0;
    const contando: Rng = () => {
      sorteios += 1;
      return 0.99;
    };
    // Na câmera lenta o herói anda meio passo por passo: em 41, sai do alcance e da folga.
    const fim = rodar(aberto, 42, contando, (i) => (i === 41 ? { x: 0, y: 127, tocar: true } : { x: 0, y: 127 }));
    expect(fim.luta.arena.evento).toBeNull();
    expect(vidaDoMonstro(fim.luta)).toBe(200);
    expect(fim.acontecimentos).toContainEqual({ tipo: 'numero', onde: 'monstro', indice: 0, texto: 'Longe', tom: 'erro' });
    expect(sorteios).toBe(0);
  });

  it('meio passo pra trás durante o evento ainda acerta (a folga)', () => {
    const noLimite = { x: MEIO.x, y: MEIO.y + ALCANCE_CORPO_A_CORPO, facing: 'N' as const };
    const { luta } = abrirLuta(naSala({ monsters: [zumbi()] }, comArma('espada')), noLimite);
    const aberto = passoDaLuta(luta, { ...PARADO, atacar: true }, NUNCA).luta;
    const fim = rodar(aberto, 42, NUNCA, (i) => (i < 8 ? { x: 0, y: 127 } : toqueNoMeio(i)));
    expect(vidaDoMonstro(fim.luta)).toBeLessThan(200);
  });

  it('o poder acerta de qualquer lugar', () => {
    const estado = naSala({ monsters: [zumbi(300)] }, { className: 'Guerreiro', classId: 'guerreiro', powerIds: ['golpe_poderoso'], mp: 50 });
    const { luta } = abrirLuta(estado, roomArrival('N'));
    expect(vidaDoMonstro(passoDaLuta(luta, { ...PARADO, poder: 'golpe_poderoso' }, NUNCA).luta)).toBeLessThan(300);
  });
});

describe('os outros eventos dentro da arena', () => {
  function contraOZumbi(hero: Partial<Hero>) {
    return abrirLuta(naSala({ monsters: [monstro({ speciesId: 'zumbi', hp: 300, maxHp: 300 })] }, hero), PERTO).luta;
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

  it('o cajado no PC: uma letra por vez, a tecla quando o aro encosta; a da última fecha o evento', () => {
    const estado = naSala({ monsters: [monstro({ speciesId: 'zumbi', hp: 300, maxHp: 300 })] }, { equip: { ...naSala().hero.equip, arma: arma('cajado') } });
    const luta = abrirLuta(estado, roomArrival(null), null, true).luta;
    expect(luta.teclado).toBe(true);
    const aberto = passoDaLuta(luta, { ...PARADO, atacar: true }, NUNCA).luta;
    const evento = aberto.arena.evento!.evento;
    expect(evento.tipo).toBe('letras');
    const naBatida = new Map(evento.notas!.map((batida, k) => [batida, evento.letras![k]!]));
    // O passo i de `rodar` é o passo i + 1 do evento. O ataque no meio não conta como letra.
    const fim = rodar(aberto, evento.notas![2]!, NUNCA, (i) => (i === 5 ? { ...PARADO, atacar: true } : { ...PARADO, tecla: naBatida.get(i + 1) }));
    expect(fim.luta.arena.evento).toBeNull();
    expect(fim.acontecimentos.some((a) => a.tipo === 'numero' && a.tom === 'critico')).toBe(true);
  });

  it('a runa da arma dispara no acerto: o choque tira mais e aparece no número', () => {
    const espada = { ...arma('espada'), runas: [{ runa: 'eletrica' as const, tier: 3 }] };
    const luta = contraOZumbi({ equip: { ...naSala().hero.equip, arma: espada } });
    const sempreDispara: Rng = () => 0;
    const aberto = passoDaLuta(luta, { ...PARADO, atacar: true }, sempreDispara).luta;
    const fim = rodar(aberto, 42, sempreDispara, (i) => (i === 41 ? { ...PARADO, tocar: true } : PARADO));
    expect(fim.acontecimentos.some((a) => a.tipo === 'numero' && a.texto?.startsWith('⚡-'))).toBe(true);
    const zumbi = ((celulaAtual(fim.luta.estado) as DungeonCell).monsters ?? [])[0] as { status?: { atordoado?: number } };
    expect(zumbi.status?.atordoado).toBe(1);
  });

  it('o defensivo descansando se protege: o golpe chega com metade da força', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'esqueleto', hp: 300, maxHp: 300 })] }, { equip: { ...naSala().hero.equip, arma: arma('espada') } }), PERTO);
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

describe('o vigor da armadura encantada', () => {
  function comVigor(nivel: number): Partial<Hero> {
    const placas = { ...instantiate(templateById('placas')!, RARITIES[0]!), equipped: true, encantamento: { tipo: 'vigor' as const, nivel } };
    return { equip: { ...naSala().hero.equip, armadura: placas } };
  }

  it('ergue o escudo na entrada, e o golpe bate nele antes da vida', () => {
    const estado = naSala({ monsters: [monstro({ speciesId: 'aranha' })] }, comVigor(3));
    const { luta, acontecimentos } = abrirLuta(estado, roomArrival(null));
    const escudo = Math.round(estado.hero.maxHp * 0.2);
    expect(luta.arena.escudo).toBe(escudo);
    expect(acontecimentos).toContainEqual({ tipo: 'aviso', texto: `💪 Vigor: escudo de ${escudo}` });

    const fim = rodar(luta, 400, NUNCA);
    const noEscudo = fim.acontecimentos.filter((a) => a.tipo === 'numero' && a.tom === 'escudo').map((a) => Number(a.texto!.slice('💪-'.length)));
    expect(noEscudo.length).toBeGreaterThan(0);
    expect(vidaDoHeroi(fim.luta)).toBe(estado.hero.hp);
    expect(fim.luta.arena.escudo).toBe(escudo - noEscudo.reduce((a, b) => a + b, 0));
  });

  it('o veneno também passa primeiro pelo escudo', () => {
    // A preparação da luta limpa os buffs: o veneno entra depois de abrir, como no teste do veneno de cima.
    const { luta } = abrirLuta(naSala({}, comVigor(1)), roomArrival(null));
    const estado = luta.estado as EstadoNaMasmorra;
    const envenenado = { ...luta, estado: { ...estado, hero: { ...estado.hero, buffs: { poisonTurns: 3, poisonDmg: 5 } } } };
    const fim = rodar(envenenado, RODADA, NUNCA, () => ({ x: 127, y: 0 }));
    expect(fim.acontecimentos).toContainEqual({ tipo: 'numero', onde: 'heroi', indice: 0, texto: '💪-5', tom: 'escudo' });
    expect(vidaDoHeroi(fim.luta)).toBe(estado.hero.hp);
  });

  it('sem vigor, a luta não tem escudo', () => {
    const { luta, acontecimentos } = abrirLuta(naSala(), roomArrival(null));
    expect(luta.arena.escudo).toBeUndefined();
    expect(acontecimentos.some((a) => a.tipo === 'aviso')).toBe(false);
  });
});
