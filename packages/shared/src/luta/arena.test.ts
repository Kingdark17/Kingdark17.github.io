import { describe, expect, it } from 'vitest';

import type { DungeonCell } from '../dungeon/generate.js';
import { HERO_HALF, roomArrival, TILE_UNITS } from '../dungeon/room-walk.js';
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
  JEITOS_DE_LUTAR,
  LENTIDAO,
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

function vidaDoMonstro(luta: LutaEmTempoReal, indice = 0): number {
  return ((celulaAtual(luta.estado) as DungeonCell).monsters ?? [])[indice]!.hp;
}

const NUNCA: Rng = () => 0.99;

describe('abrirLuta', () => {
  it('põe cada monstro de pé no lugar do grupo e o caído fica caído', () => {
    const estado = naSala({ monsters: [monstro({ hp: 0 }), monstro(), monstro()], monsterIndex: 1 });
    const { luta } = abrirLuta(estado, roomArrival('N'));
    expect(luta.arena.monstros.map((m) => m.fase)).toEqual(['caido', 'andando', 'andando']);
    expect(luta.arena.monstros[1]!.x).not.toBe(luta.arena.monstros[2]!.x);
    expect(luta.arena.monstros[2]!.tempo).toBeGreaterThan(luta.arena.monstros[1]!.tempo);
  });

  it('consome a bênção do NPC e conta no diário', () => {
    const { acontecimentos } = abrirLuta(naSala({}, { npcBlessing: { dodge: 15, combats: 2 } }), roomArrival('N'));
    expect(acontecimentos.some((a) => a.tipo === 'diario' && a.texto?.includes('bênção'))).toBe(true);
  });

  it('os companheiros vivos aparecem em volta do herói', () => {
    const vivo = generateCompanion(seededRng(3));
    const caido = { ...generateCompanion(seededRng(4)), hp: 0 };
    const { luta } = abrirLuta({ ...naSala(), party: [vivo, caido] }, roomArrival('N'));
    expect(luta.arena.companheiros.map((c) => c.indice)).toEqual([0]);
  });
});

describe('a sala trancada', () => {
  it('andar contra a porta não sai da sala', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'zumbi' })] }), roomArrival('S'));
    const fim = rodar(luta, 120, NUNCA, () => ({ x: 0, y: -127 }));
    expect(fim.luta.arena.heroi.y).toBeGreaterThanOrEqual(TILE_UNITS + HERO_HALF);
  });
});

describe('o golpe do monstro', () => {
  it('vem com aviso, e acerta quem fica parado', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'aranha' })] }), roomArrival(null));
    let avisou = false;
    const fim = rodar(luta, 400, NUNCA, (_i, l) => {
      if (l.arena.monstros[0]!.fase === 'avisando') avisou = true;
      return PARADO;
    });
    expect(avisou).toBe(true);
    expect(fim.acontecimentos.some((a) => a.tipo === 'numero' && a.onde === 'heroi' && a.texto?.startsWith('-'))).toBe(true);
  });

  it('quem sai do alcance durante o aviso não leva', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'aranha' })] }), roomArrival(null));
    let atual = luta;
    // Espera o primeiro aviso.
    while (atual.arena.monstros[0]!.fase !== 'avisando') atual = passoDaLuta(atual, PARADO, NUNCA).luta;
    const vidaAntes = (atual.estado as EstadoNaMasmorra).hero.hp;
    const m = atual.arena.monstros[0]!;
    // De lado, perpendicular a quem vem: de costas, a parede de baixo seguraria o herói.
    const fuga = { x: -Math.sign(atual.arena.heroi.y - m.y) * 127 || 127, y: Math.sign(atual.arena.heroi.x - m.x) * 127 };
    const fim = rodar(atual, JEITOS_DE_LUTAR.venenoso.aviso + 2, NUNCA, () => fuga);
    expect((fim.luta.estado as EstadoNaMasmorra).hero.hp).toBe(vidaAntes);
    expect(fim.acontecimentos.some((a) => a.tipo === 'numero' && a.texto === 'Errou')).toBe(true);
  });

  it('o mágico atira de longe', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'elemental_fogo' })] }), roomArrival('N'));
    let atirou = false;
    rodar(luta, 300, NUNCA, (_i, l) => {
      if (l.arena.tiros.some((t) => t.de === 'monstro')) atirou = true;
      return PARADO;
    });
    expect(atirou).toBe(true);
  });

  it('o herói que cai perde a luta e volta pra cidade', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'aranha', dmg: 50 })] }, { hp: 1 }), roomArrival(null));
    const fim = rodar(luta, 600, NUNCA);
    expect(fim.luta.fim).toBe('derrota');
    expect(fim.luta.estado.mapMode).toBe('city');
  });
});

describe('o ataque do herói', () => {
  /** Encosta o herói no monstro antes de atacar. */
  function encostado(hero: Partial<Hero>, sala: Partial<DungeonCell> = {}) {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'zumbi', hp: 200, maxHp: 200 })], ...sala }, hero), roomArrival(null));
    const m = luta.arena.monstros[0]!;
    return { ...luta, arena: { ...luta.arena, heroi: { ...luta.arena.heroi, x: m.x, y: m.y + TILE_UNITS } } };
  }

  it('longe demais com arma de perto: avisa e não abre o evento', () => {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'zumbi' })] }, { equip: { ...naSala().hero.equip, arma: arma('espada') } }), roomArrival('S'));
    const quadro = passoDaLuta(luta, { ...PARADO, atacar: true }, NUNCA);
    expect(quadro.luta.arena.evento).toBeNull();
    expect(quadro.acontecimentos).toContainEqual({ tipo: 'aviso', texto: 'Longe demais' });
  });

  it('a espada abre a barra, o mundo fica lento, e o toque no meio crita', () => {
    const luta = encostado({ equip: { ...naSala().hero.equip, arma: arma('espada') } });
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

  it('o arco atira, e o tiro acerta', () => {
    const luta = encostado({ className: 'Arqueiro', classId: 'arqueiro', equip: { ...naSala().hero.equip, arma: arma('arco') } });
    const aberto = passoDaLuta(luta, { ...PARADO, atacar: true }, NUNCA).luta;
    expect(aberto.arena.evento?.tiro).toBe(true);
    const antes = vidaDoMonstro(aberto);
    const solto = rodar(aberto, 42, NUNCA, (i) => (i === 41 ? { ...PARADO, tocar: true } : PARADO));
    expect(solto.luta.arena.tiros.length + (vidaDoMonstro(solto.luta) < antes ? 1 : 0)).toBeGreaterThan(0);
    const fim = rodar(solto.luta, 30, NUNCA);
    expect(vidaDoMonstro(fim.luta)).toBeLessThan(antes);
  });

  it('derrubar o último vence a luta e marca a sala', () => {
    const luta = encostado({ equip: { ...naSala().hero.equip, arma: arma('espada') } }, { monsters: [monstro({ speciesId: 'zumbi', hp: 1 })] });
    const aberto = passoDaLuta(luta, { ...PARADO, atacar: true }, NUNCA).luta;
    const fim = rodar(aberto, 42, NUNCA, (i) => (i === 41 ? { ...PARADO, tocar: true } : PARADO));
    expect(fim.luta.fim).toBe('vitoria');
    expect((celulaAtual(fim.luta.estado) as DungeonCell).beaten).toBe(true);
    expect(fim.acontecimentos.some((a) => a.tipo === 'som' && a.som === 'victory')).toBe(true);
  });
});

describe('os outros eventos dentro da arena', () => {
  function pertoDoZumbi(hero: Partial<Hero>) {
    const { luta } = abrirLuta(naSala({ monsters: [monstro({ speciesId: 'zumbi', hp: 300, maxHp: 300 })] }, hero), roomArrival(null));
    const m = luta.arena.monstros[0]!;
    return { ...luta, arena: { ...luta.arena, heroi: { ...luta.arena.heroi, x: m.x, y: m.y + TILE_UNITS } } };
  }

  it('o machado: o aperto já começa a encher, e soltar no meio acerta', () => {
    const luta = pertoDoZumbi({ equip: { ...naSala().hero.equip, arma: arma('machado') } });
    const aberto = passoDaLuta(luta, { ...PARADO, atacar: true }, NUNCA).luta;
    expect(aberto.arena.evento?.evento.tipo).toBe('carga');
    const fim = rodar(aberto, 42, NUNCA, (i) => (i === 41 ? { ...PARADO, soltar: true } : PARADO));
    expect(vidaDoMonstro(fim.luta)).toBeLessThan(300);
  });

  it('o cajado: o traço em cima do símbolo, levantando o dedo, acerta', () => {
    const luta = pertoDoZumbi({ equip: { ...naSala().hero.equip, arma: arma('cajado') } });
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
    const m = luta.arena.monstros[0]!;
    const guardando = { ...luta, arena: { ...luta.arena, heroi: { ...luta.arena.heroi, x: m.x, y: m.y + TILE_UNITS }, monstros: [{ ...m, fase: 'descansando' as const, tempo: 500 }] } };
    const aberto = passoDaLuta(guardando, { ...PARADO, atacar: true }, NUNCA).luta;
    const fim = rodar(aberto, 42, NUNCA, (i) => (i === 41 ? { ...PARADO, tocar: true } : PARADO));
    expect(fim.acontecimentos.some((a) => a.tipo === 'aviso' && a.texto?.includes('se protege'))).toBe(true);
    expect(fim.acontecimentos.some((a) => a.tipo === 'numero' && a.tom === 'critico')).toBe(false);
  });
});

describe('os companheiros', () => {
  it('vão até o monstro e batem nele', () => {
    const companheiro = { ...generateCompanion(seededRng(3)), stance: 'agressiva' as const };
    const { luta } = abrirLuta({ ...naSala({ monsters: [monstro({ speciesId: 'zumbi', hp: 500, maxHp: 500 })] }), party: [companheiro] }, roomArrival('S'));
    const fim = rodar(luta, 400, seededRng(9), () => ({ x: 0, y: 127 }));
    expect(vidaDoMonstro(fim.luta)).toBeLessThan(500);
  });
});

describe('poderes, itens e a rodada', () => {
  it('o poder de dano acerta o mais perto e espera pra voltar', () => {
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
    const fim = rodar(envenenado, RODADA, NUNCA, () => ({ x: 0, y: 127 }));
    expect((fim.luta.estado as EstadoNaMasmorra).hero.hp).toBe(496);
  });
});

describe('a mesma entrada dá a mesma luta', () => {
  it('passo a passo, com a mesma semente', () => {
    const estado = naSala({ monsters: [monstro(), monstro({ speciesId: 'elemental_fogo' }), monstro({ speciesId: 'aranha' })] }, { equip: { ...naSala().hero.equip, arma: arma('machado') } });
    const entrada = (i: number): EntradaDaLuta => ({ x: (i % 50) - 25, y: 30 - (i % 40), atacar: i % 70 === 0, soltar: i % 70 === 40 });
    const a = rodar(abrirLuta(estado, roomArrival('W')).luta, 900, seededRng(5), entrada);
    const b = rodar(abrirLuta(estado, roomArrival('W')).luta, 900, seededRng(5), entrada);
    expect(b).toEqual(a);
  });
});
