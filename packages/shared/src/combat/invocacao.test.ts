import { describe, expect, it } from 'vitest';

import type { DungeonCell } from '../dungeon/generate.js';
import { roomArrival } from '../dungeon/room-walk.js';
import { powerById } from '../hero/catalog.js';
import { generateCompanion, heroPowers, type Companion, type Hero } from '../hero/hero.js';
import { iniciarEncontro, fugir, usarPoder } from '../jogo/combate.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from '../jogo/estado.js';
import { limparSala, perderLuta } from '../jogo/fim-da-luta.js';
import { saveSorteado } from '../jogo/heroi-sorteado.js';
import { abrirLuta, passoDaLuta } from '../luta/arena.js';
import { monsterView, type MonsterInstance } from '../monsters/generate.js';
import { resolveRecruit } from '../npc/npc-services.js';
import { seededRng, type Rng } from '../rng.js';
import { criarEsqueleto, esqueletosDePe, FIM_DOS_ESQUELETOS, MAX_ESQUELETOS, semInvocados } from './invocacao.js';
import { freshCombatMonster } from './monster-state.js';
import { castPower } from './use-power.js';

const NUNCA: Rng = () => 0.99;
const agora = () => 1_700_000_000_000;
const levantar = powerById('levantar_esqueleto')!;

function monstro(overrides: Partial<MonsterInstance> = {}): MonsterInstance {
  return { speciesId: 'zumbi', enemyClassId: 'brutamontes', floor: 2, hp: 400, maxHp: 400, dmg: 3, speed: 5, xp: 12, gold: 7, isBoss: false, ...overrides };
}

/** Uma sala de monstro com um necromante de nível 1 e Inteligência 14, com mana sobrando. */
function naSala(hero: Partial<Hero> = {}, party: Companion[] = []): EstadoNaMasmorra {
  const save = saveSorteado('Aria', seededRng(11), seededRng(11));
  const base = retomarSave({ ...save, floor: 2, mapMode: 'dungeon' }, seededRng(11));
  if (base.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
  const celula = base.map.flat().find((c) => c.type === 'monster')!;
  const necromante: Hero = {
    ...base.hero,
    classId: 'necromante',
    className: 'Necromante',
    level: 1,
    attrs: { ...base.hero.attrs, intelecto: 14 },
    hp: 999,
    maxHp: 999,
    mp: 100,
    maxMp: 100,
    buffs: {},
    ...hero,
  };
  const posicionado: EstadoNaMasmorra = { ...base, pos: { x: celula.x, y: celula.y }, party, hero: necromante };
  return substituirCelulaAtual(posicionado, { ...celula, monsters: [monstro()], monsterIndex: 0, beaten: false, bonusTreasure: undefined } as DungeonCell);
}

const alvo = () => monsterView(freshCombatMonster(monstro()));

describe('o esqueleto', () => {
  it('nasce na força do necromante e conta os irmãos no nome', () => {
    const hero = naSala().hero;
    const primeiro = criarEsqueleto(hero, []);
    expect(primeiro).toMatchObject({ name: 'Esqueleto', hp: 52, maxHp: 52, attack: 11, stance: 'agressiva', invocado: true, classIcon: '💀' });
    expect(criarEsqueleto({ ...hero, level: 20, attrs: { ...hero.attrs, intelecto: 30 } }, [primeiro]).name).toBe('Esqueleto 2');
    expect(criarEsqueleto({ ...hero, level: 20, attrs: { ...hero.attrs, intelecto: 30 } }, [primeiro])).toMatchObject({ maxHp: 160, attack: 38 });
  });

  it('é poder do necromante, e só dele', () => {
    expect(heroPowers(naSala().hero).some((p) => p.id === 'levantar_esqueleto')).toBe(true);
    expect(heroPowers(naSala({ classId: 'guerreiro', className: 'Guerreiro' }).hero).some((p) => p.id === 'levantar_esqueleto')).toBe(false);
  });

  it('gasta a mana e entra no fim da equipe; com 3 de pé, avisa sem gastar', () => {
    const recruta = generateCompanion(seededRng(3));
    const hero = naSala().hero;
    const uso = castPower(hero, [recruta], alvo(), levantar, { rng: NUNCA });
    expect(uso.outcome).toBe('summon');
    expect(uso.hero.mp).toBe(hero.mp - 14);
    expect(uso.party.map((m) => m.name)).toEqual([recruta.name, 'Esqueleto']);
    expect(uso.summoned).toEqual(uso.party[1]);

    const tres = [criarEsqueleto(hero, []), criarEsqueleto(hero, []), criarEsqueleto(hero, [])];
    const cheio = castPower(hero, [recruta, ...tres], alvo(), levantar, { rng: NUNCA });
    expect(cheio).toMatchObject({ outcome: 'summon_full', hero });
    expect(cheio.party).toHaveLength(4);

    const umCaido = [{ ...tres[0]!, hp: 0 }, tres[1]!, tres[2]!];
    expect(esqueletosDePe(umCaido)).toBe(MAX_ESQUELETOS - 1);
    expect(castPower(hero, umCaido, alvo(), levantar, { rng: NUNCA }).outcome).toBe('summon');
  });

  it('não ocupa a vaga de recruta', () => {
    const hero = naSala().hero;
    const doisRecrutas = [generateCompanion(seededRng(3)), generateCompanion(seededRng(4))];
    const comEsqueletos = [...doisRecrutas, criarEsqueleto(hero, []), criarEsqueleto(hero, [])];
    expect(resolveRecruit(comEsqueletos, seededRng(5)).outcome.kind).toBe('recruited');
  });

  it('no site: levanta, luta no turno da equipe e some quando o herói foge', () => {
    const combate = iniciarEncontro(naSala());
    const { combate: depois } = usarPoder(combate, levantar, NUNCA);
    expect(depois.log[0]).toBe('Você usa Levantar Esqueleto: Esqueleto se ergue para lutar ao seu lado!');
    expect((depois.estado as EstadoNaMasmorra).party.filter((m) => m.invocado)).toHaveLength(1);
    expect(depois.log.some((linha) => linha.includes('Esqueleto') && linha !== depois.log[0])).toBe(true);

    const fuga = fugir(depois, 20, NUNCA);
    expect(fuga.fase).toBe('fuga');
    expect((fuga.estado as EstadoNaMasmorra).party).toEqual([]);
    expect(fuga.log).toContain(FIM_DOS_ESQUELETOS);
  });

  it('some no fim da luta, vencendo ou perdendo; os recrutas ficam', () => {
    const recruta = generateCompanion(seededRng(3));
    const estado = naSala({}, [recruta, criarEsqueleto(naSala().hero, [recruta])]);
    const vitoria = limparSala(estado, alvo(), NUNCA, agora);
    expect(vitoria.estado.party.map((m) => m.name)).toEqual([recruta.name]);
    expect(vitoria.log).toContain(FIM_DOS_ESQUELETOS);
    expect(perderLuta(estado, NUNCA).estado.party.map((m) => m.name)).toEqual([recruta.name]);
    expect(semInvocados(estado.party)).toEqual([recruta]);
  });

  it('no app: entra na arena como companheiro e bate no monstro', () => {
    const { luta } = abrirLuta(naSala(), roomArrival(null));
    expect(luta.arena.companheiros).toEqual([]);
    const levantou = passoDaLuta(luta, { x: 0, y: 0, poder: 'levantar_esqueleto' }, NUNCA);
    expect(levantou.luta.arena.companheiros).toEqual([{ indice: 0, tempo: expect.any(Number) }]);
    expect(levantou.acontecimentos).toContainEqual({ tipo: 'aviso', texto: '💀 Esqueleto se ergue' });

    // O herói não ataca: quem tira vida do zumbi é o esqueleto (o sorteio fixo de cima erraria sempre).
    let atual = levantou.luta;
    const sorteio = seededRng(9);
    for (let i = 0; i < 400; i++) atual = passoDaLuta(atual, { x: 127, y: 0 }, sorteio).luta;
    const zumbi = ((celulaAtual(atual.estado) as DungeonCell).monsters ?? [])[0]!;
    expect(zumbi.hp).toBeLessThan(400);
  });
});
