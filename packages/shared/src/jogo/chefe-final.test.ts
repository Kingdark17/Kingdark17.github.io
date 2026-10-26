import { describe, expect, it } from 'vitest';

import type { CombatMonster } from '../combat/monster-state.js';
import type { JogadaDeAtaque } from '../combat/resolve-attack.js';
import { generateDungeonFloor, type DungeonCell } from '../dungeon/generate.js';
import { roomArrival } from '../dungeon/room-walk.js';
import { generateCompanion } from '../hero/hero.js';
import { itemTemplate } from '../items/item.js';
import { isEquippable } from '../items/templates.js';
import { FORCA_DO_CHEFE_FINAL, generateBoss, type MonsterInstance } from '../monsters/generate.js';
import { seededRng, type Rng } from '../rng.js';
import { abrirLuta, passoDaLuta, RODADA, type LutaEmTempoReal } from '../luta/arena.js';
import {
  enfurecer,
  ferirMonstro,
  LACAIOS_DO_CHEFE,
  lacaiosDePe,
  poderDaVez,
  protegido,
  soltarPoder,
  VELOCIDADE_NA_FURIA,
} from './chefe-final.js';
import { atacar, escolherAlvo, iniciarEncontro, inimigosDaLuta, type Combate } from './combate.js';
import { ouroDoBau, tituloDe, tituloDoHeroi } from './conquista.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from './estado.js';
import { saveSorteado } from './heroi-sorteado.js';

const NUNCA: Rng = () => 0.99;
const EM_CHEIO: JogadaDeAtaque = { dado: 20, mira: 0.5 };

function chefe(overrides: Partial<CombatMonster> = {}): CombatMonster {
  return {
    speciesId: 'goblin',
    enemyClassId: 'brutamontes',
    floor: 100,
    hp: 10,
    maxHp: 10,
    dmg: 5,
    speed: 10,
    xp: 600,
    gold: 680,
    isBoss: true,
    isMainBoss: true,
    chefeFinal: true,
    status: {},
    attackCount: 0,
    ...overrides,
  };
}

/** O herói diante do chefe do andar 100 da Floresta Normal, com o chefe montado à mão. */
function noChefeFinal(monstros: MonsterInstance[] = [chefe()]): EstadoNaMasmorra {
  const save = saveSorteado('Aria', seededRng(11), seededRng(11));
  const estado = retomarSave({ ...save, floor: 100, mapMode: 'dungeon', masmorra: { dungeon: 'floresta', difficulty: 'normal' }, progresso: { cleared: [], totems: {} } }, seededRng(11));
  if (estado.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
  const sala = estado.map.flat().find((celula) => celula.type === 'boss');
  if (!sala) throw new Error('andar sem chefe');
  const posicionado: EstadoNaMasmorra = { ...estado, pos: { x: sala.x, y: sala.y }, party: [], hero: { ...estado.hero, hp: 999, maxHp: 999, level: 90, gold: 100, buffs: {} } };
  return substituirCelulaAtual(posicionado, { ...sala, monsters: monstros, monsterIndex: 0, beaten: false });
}

function salaDe(estado: EstadoNaMasmorra | Combate['estado']): DungeonCell {
  return celulaAtual(estado) as DungeonCell;
}

describe('o chefe final nasce no andar 100', () => {
  it('é um chefe principal 30% mais forte, marcado, e o sorteio anda o mesmo tanto', () => {
    const comum = generateBoss(100, { rng: seededRng(4), main: true });
    const final = generateBoss(100, { rng: seededRng(4), main: true, final: true });
    expect(final.chefeFinal).toBe(true);
    expect(final.maxHp).toBe(Math.round(comum.maxHp * FORCA_DO_CHEFE_FINAL));
    expect(final.hp).toBe(final.maxHp);
    expect(final.dmg).toBe(Math.round(comum.dmg * FORCA_DO_CHEFE_FINAL));
    expect(final.speciesId).toBe(comum.speciesId);
    expect(final.bossTitle).toBe(comum.bossTitle);
    expect(comum.chefeFinal).toBeUndefined();
  });

  it('só o andar 100 tem o chefe final; o 90 continua com o chefe de sempre', () => {
    const chefeDo = (andar: number) => generateDungeonFloor(andar, 6, 6, { rng: seededRng(7) }).rooms.find((r) => r.type === 'boss')?.monsters?.[0];
    expect(chefeDo(100)?.chefeFinal).toBe(true);
    expect(chefeDo(90)?.chefeFinal).toBeUndefined();
  });
});

describe('os poderes', () => {
  it('um a cada 3 golpes, alternando o Golpe Devastador e o Rugido; na fúria, a cada 2', () => {
    expect(poderDaVez(chefe({ attackCount: 0 }))).toBeNull();
    expect(poderDaVez(chefe({ attackCount: 2 }))).toBe('devastador');
    expect(poderDaVez(chefe({ attackCount: 5, poderes: 1 }))).toBe('rugido');
    expect(poderDaVez(chefe({ attackCount: 1, furia: true }))).toBe('devastador');
    expect(poderDaVez(chefe({ attackCount: 2, furia: true }))).toBeNull();
    expect(poderDaVez({ ...chefe({ attackCount: 2 }), chefeFinal: undefined })).toBeNull();
  });

  it('o Golpe Devastador vai no herói com o dobro da força; o Rugido pega cada companheiro e o herói', () => {
    const estado = noChefeFinal();
    const companheiro = { ...generateCompanion(seededRng(3)), hp: 500, maxHp: 500 };
    const devastador = soltarPoder(estado.hero, [companheiro], { ...chefe(), name: 'Rei', icon: '👹', behavior: 'lento' } as never, 'devastador', { rng: NUNCA });
    expect(devastador.outcome).toBe('hit_hero');
    expect(devastador.companheiros).toEqual([]);
    expect(devastador.monster.poderes).toBe(1);

    const rugido = soltarPoder(estado.hero, [companheiro], { ...chefe(), name: 'Rei', icon: '👹', behavior: 'lento' } as never, 'rugido', { rng: NUNCA });
    expect(rugido.companheiros).toHaveLength(1);
    expect(rugido.party[0]!.hp).toBeLessThan(500);
    expect(rugido.outcome).toBe('hit_hero');
    expect(devastador.damage).toBeGreaterThan(rugido.damage);
  });
});

describe('a segunda fase', () => {
  it('um golpe que passaria da metade para nela, e ele chama os lacaios: comuns da masmorra, da força do andar, sem ouro', () => {
    const estado = noChefeFinal();
    const ferida = ferirMonstro(estado, 0, { ...chefe(), hp: -40 }, seededRng(2));
    expect(ferida.caiu).toBe(false);
    expect(ferida.monstro.hp).toBe(5);
    expect(ferida.lacaios).toEqual([1, 2, 3, 4]);
    const sala = salaDe(ferida.estado);
    expect(sala.monsters).toHaveLength(1 + LACAIOS_DO_CHEFE);
    expect(sala.monsters![0]!.chamou).toBe(true);
    for (const lacaio of sala.monsters!.slice(1)) {
      expect(lacaio.lacaio).toBe(true);
      expect(lacaio.gold).toBe(0);
      expect(lacaio.floor).toBe(100);
      expect(['goblin', 'lobo_sombras', 'aranha', 'slime']).toContain(lacaio.speciesId);
    }
  });

  it('com lacaio de pé, golpe nenhum fere o chefe; o dano contínuo que não correu não conta como golpe', () => {
    const estado = ferirMonstro(noChefeFinal(), 0, { ...chefe(), hp: 0 }, seededRng(2)).estado;
    expect(protegido(salaDe(estado), 0)).toBe(true);
    const golpe = ferirMonstro(estado, 0, { ...(salaDe(estado).monsters![0] as CombatMonster), hp: 1 }, seededRng(2));
    expect(golpe.protegido).toBe(true);
    expect(golpe.monstro.hp).toBe(5);
    expect(ferirMonstro(estado, 0, salaDe(estado).monsters![0] as CombatMonster, seededRng(2)).protegido).toBe(false);
  });

  it('caído o último lacaio, ele fica furioso e mais rápido; antes disso, nada', () => {
    const chamou = ferirMonstro(noChefeFinal(), 0, { ...chefe(), hp: 0 }, seededRng(2)).estado;
    expect(enfurecer(chamou).log).toEqual([]);
    const sala = salaDe(chamou);
    const semLacaios = substituirCelulaAtual(chamou, { ...sala, monsters: sala.monsters!.map((m, i) => (i === 0 ? m : { ...m, hp: 0 })) });
    expect(lacaiosDePe(salaDe(semLacaios))).toEqual([]);
    const furia = enfurecer(semLacaios);
    expect(furia.log).toHaveLength(1);
    const furioso = salaDe(furia.estado).monsters![0]!;
    expect(furioso.furia).toBe(true);
    expect(furioso.speed).toBe(Math.round(10 * VELOCIDADE_NA_FURIA));
    expect(enfurecer(furia.estado).log).toEqual([]);
  });
});

describe('a luta inteira, no site', () => {
  it('chama os lacaios, fica protegido, enfurece e, vencido, zera com o baú e o título', () => {
    let combate = atacar(iniciarEncontro(noChefeFinal()), EM_CHEIO, 'normal', NUNCA);
    expect(combate.fase).toBe('combate');
    expect(combate.log.some((linha) => linha.includes('chama 4 lacaios'))).toBe(true);
    expect(combate.alvo).toBe(1);
    expect(inimigosDaLuta(combate.estado).map((i) => i.protegido)).toEqual([true, false, false, false, false]);

    // Golpe no chefe protegido: não faz nada.
    combate = atacar(escolherAlvo(combate, 0), EM_CHEIO, 'normal', NUNCA);
    expect(salaDe(combate.estado).monsters![0]!.hp).toBe(5);
    expect(combate.log.some((linha) => linha.includes('protegido pelos lacaios'))).toBe(true);

    // Os lacaios ficam com 1 de vida, pra cair num golpe cada.
    const estado = combate.estado as EstadoNaMasmorra;
    const sala = salaDe(estado);
    combate = { ...combate, estado: substituirCelulaAtual(estado, { ...sala, monsters: sala.monsters!.map((m, i) => (i === 0 ? m : { ...m, hp: 1 })) }) };
    for (const indice of [1, 2, 3, 4]) combate = atacar(escolherAlvo(combate, indice), EM_CHEIO, 'normal', NUNCA);
    expect(combate.log.some((linha) => linha.includes('fica furioso'))).toBe(true);
    expect(salaDe(combate.estado).monsters![0]!.furia).toBe(true);

    combate = atacar(escolherAlvo(combate, 0), EM_CHEIO, 'normal', NUNCA);
    expect(combate.fase).toBe('vitoria');
    expect(combate.estado.mapMode).toBe('city');
    expect(combate.conquista?.titulo).toBe('Sobrevivente da Floresta');
    expect(combate.conquista?.item.rarity).toBe('lendario');
    // O baú só dá peça de equipar: nada de material nem poção pra quem zera.
    expect(isEquippable(itemTemplate(combate.conquista!.item).category)).toBe(true);
    expect(combate.conquista?.ouro).toBe(ouroDoBau(100));
    expect(combate.estado.inventory.some((item) => item.uid === combate.conquista?.item.uid)).toBe(true);
  });
});

describe('a luta inteira, no app', () => {
  it('o dano contínuo que passa da metade chama os lacaios, que entram no palco, e o alvo vai pro primeiro', () => {
    let luta: LutaEmTempoReal = abrirLuta(noChefeFinal([chefe({ hp: 8, maxHp: 10 })]), roomArrival('N')).luta;
    const estado = luta.estado as EstadoNaMasmorra;
    const sala = salaDe(estado);
    luta = { ...luta, estado: substituirCelulaAtual(estado, { ...sala, monsters: [{ ...sala.monsters![0]!, status: { queimadura: { turns: 3, dmg: 6 } } } as MonsterInstance] }) };
    for (let i = 0; i < RODADA + 1 && luta.arena.monstros.length === 1; i++) luta = passoDaLuta(luta, { x: 0, y: 0 }, seededRng(i)).luta;
    expect(luta.arena.monstros).toHaveLength(1 + LACAIOS_DO_CHEFE);
    expect(luta.arena.monstros.slice(1).every((m) => m.fase === 'esperando')).toBe(true);
    expect(luta.arena.alvo).toBe(1);
    expect(salaDe(luta.estado).monsters![0]!.hp).toBe(5);
  });
});

describe('o título', () => {
  it('a primeira palavra vem da dificuldade, e o cartão mostra a conquista mais difícil', () => {
    expect(tituloDe({ dungeon: 'caverna', difficulty: 'pesadelo' })).toBe('Lenda da Caverna');
    expect(tituloDoHeroi({ cleared: [], totems: {} })).toBeNull();
    expect(tituloDoHeroi({ cleared: ['floresta:normal', 'floresta:dificil'], totems: {} })).toBe('Terror da Floresta');
    // Empate de degrau (Floresta Pesadelo e Caverna Normal): a masmorra mais adiante.
    expect(tituloDoHeroi({ cleared: ['floresta:pesadelo', 'caverna:normal'], totems: {} })).toBe('Sobrevivente da Caverna');
  });

  it('o ouro do baú, somado ao do chefe, cabe no teto de +5000 por gravação mesmo no fim da Torre no Pesadelo', () => {
    const chefeDaTorre = generateBoss(331, { rng: seededRng(1), main: true, final: true });
    expect(chefeDaTorre.gold + ouroDoBau(331)).toBeLessThan(5000);
  });
});
