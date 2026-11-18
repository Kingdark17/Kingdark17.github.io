import { describe, expect, it } from 'vitest';

import type { DungeonCell } from '../dungeon/generate.js';
import { TILE_UNITS, type Walker } from '../dungeon/room-walk.js';
import { alcanceDoHeroi, textosDaClasse } from '../hero/classes-de-luta.js';
import { instantiate } from '../items/item.js';
import { aljavaNoArco, REGRAS_DAS_ALJAVAS } from '../items/pecas-secretas.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import type { MonsterInstance } from '../monsters/generate.js';
import { seededRng, type Rng } from '../rng.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from '../jogo/estado.js';
import { saveSorteado } from '../jogo/heroi-sorteado.js';
import { abrirLuta, passoDaLuta, RECARGA_DO_ATAQUE, type Acontecimento, type EntradaDaLuta, type LutaEmTempoReal } from './arena.js';

// As aljavas do Arqueiro (rodada 6b, 2026-11-18): paralisante, flamejante e explosiva.

function monstro(overrides: Partial<MonsterInstance> = {}): MonsterInstance {
  return { speciesId: 'zumbi', enemyClassId: 'brutamontes', floor: 2, hp: 4000, maxHp: 4000, dmg: 3, speed: 5, xp: 12, gold: 7, isBoss: false, ...overrides };
}

function peca(id: string) {
  return { ...instantiate(templateById(id)!, RARITIES[0]!), equipped: true };
}

/** O Arqueiro de arco, com a aljava pedida (ou sem nenhuma), numa sala de monstro montada à mão. */
function naSala(aljava: string | null, monsters: MonsterInstance[]): EstadoNaMasmorra {
  const save = saveSorteado('Aria', seededRng(11), seededRng(11));
  const base = retomarSave({ ...save, floor: 2, mapMode: 'dungeon' }, seededRng(11));
  if (base.mapMode !== 'dungeon') throw new Error('esperava a masmorra');
  const celula = base.map.flat().find((c) => c.type === 'monster')!;
  const equip = { ...base.hero.equip, arma: peca('arco'), secundaria: aljava ? peca(aljava) : null };
  const posicionado: EstadoNaMasmorra = {
    ...base,
    pos: { x: celula.x, y: celula.y },
    party: [],
    hero: { ...base.hero, className: 'Arqueiro', classId: 'arqueiro', hp: 999, maxHp: 999, mp: 50, maxMp: 50, level: 1, gold: 100, buffs: {}, equip },
  };
  return substituirCelulaAtual(posicionado, { ...celula, monsters, monsterIndex: 0, beaten: false, bonusTreasure: undefined });
}

const PARADO: EntradaDaLuta = { x: 0, y: 0 };
const T = TILE_UNITS;
const NUNCA: Rng = () => 0.99;
const AGORA = () => 1_700_000_000_000;
/** Embaixo, no meio da sala: longe dos monstros da fileira de cima. */
const EMBAIXO: Walker = { x: 4.5 * T, y: 7.5 * T, facing: 'N' };

interface Rodada {
  luta: LutaEmTempoReal;
  acontecimentos: Acontecimento[];
}

function rodar(luta: LutaEmTempoReal, passos: number, entrada: (i: number) => EntradaDaLuta = () => PARADO): Rodada {
  let atual = luta;
  const tudo: Acontecimento[] = [];
  for (let i = 0; i < passos && !atual.fim; i++) {
    const quadro = passoDaLuta(atual, entrada(i), NUNCA, AGORA);
    atual = quadro.luta;
    tudo.push(...quadro.acontecimentos);
  }
  return { luta: atual, acontecimentos: tudo };
}

/** Uma flechada com o cursor em `cursor`, tocando quando a bolinha bate no aro; depois espera a recarga. */
function flechada(luta: LutaEmTempoReal, cursor: { x: number; y: number }): Rodada {
  const aberto = passoDaLuta(luta, { ...PARADO, atacar: true, cursor }, NUNCA, AGORA);
  const fim = rodar(aberto.luta, 90 + RECARGA_DO_ATAQUE, (i) => (i === 39 ? { ...PARADO, tocar: true } : PARADO));
  return { luta: fim.luta, acontecimentos: [...aberto.acontecimentos, ...fim.acontecimentos] };
}

/** A luta aberta com os monstros nestes lugares (em casas) e as flechadas que já acertaram. */
function montar(aljava: string | null, monstros: MonsterInstance[], corpos: Array<[number, number]>, flechadas = 0): LutaEmTempoReal {
  const aberta = abrirLuta(naSala(aljava, monstros), EMBAIXO).luta;
  return {
    ...aberta,
    arena: {
      ...aberta.arena,
      ...(flechadas ? { classe: { flechadas } } : {}),
      monstros: aberta.arena.monstros.map((m, i) => ({ ...m, corpoX: corpos[i]![0] * T, corpoY: corpos[i]![1] * T })),
    },
  };
}

function vidaDoMonstro(luta: LutaEmTempoReal, indice = 0): number {
  return ((celulaAtual(luta.estado) as DungeonCell).monsters ?? [])[indice]!.hp;
}

function numeros(r: Rodada): string[] {
  return r.acontecimentos.filter((a) => a.tipo === 'numero' && a.texto).map((a) => a.texto as string);
}

function avisos(r: Rodada): string[] {
  return r.acontecimentos.filter((a) => a.tipo === 'aviso' && a.texto).map((a) => a.texto as string);
}

const ALVO = { x: 4.5 * T, y: 3.5 * T };

describe('as aljavas', () => {
  it('a aljava só vale ao lado do arco, e dá 1 bloco de alcance', () => {
    const arqueiro = (secundaria: string | null, arma = 'arco') => ({ classId: 'arqueiro', equip: { arma: { templateId: arma }, secundaria: secundaria ? { templateId: secundaria } : null } });
    expect(aljavaNoArco(arqueiro('aljava_explosiva'))).toBe('aljava_explosiva');
    expect(aljavaNoArco(arqueiro('aljava_explosiva', 'cajado'))).toBeNull();
    expect(aljavaNoArco(arqueiro('escudo'))).toBeNull();
    expect(alcanceDoHeroi(arqueiro('aljava_paralisante'))).toBe(alcanceDoHeroi(arqueiro(null)) + REGRAS_DAS_ALJAVAS.alcance);
  });

  it('a linha da classe conta a flechada da vez', () => {
    const quem = { classId: 'arqueiro', hp: 10, maxHp: 10, equip: { arma: { templateId: 'arco' }, secundaria: { templateId: 'aljava_flamejante' } } };
    expect(textosDaClasse(quem, { flechadas: 4 })).toContain('🔥 Incêndio em 2');
    expect(textosDaClasse({ ...quem, equip: { ...quem.equip, secundaria: { templateId: 'aljava_explosiva' } } }, { flechadas: 10 })).toContain('💥 Cadeia em 10');
  });

  it('sem aljava, a flecha não conta nem faz nada a mais', () => {
    const r = flechada(montar(null, [monstro()], [[4.5, 3.5]]), ALVO);
    expect(vidaDoMonstro(r.luta)).toBeLessThan(4000);
    expect(r.luta.arena.classe?.flechadas).toBeUndefined();
    expect(r.luta.arena.monstros[0]?.encurtado).toBeUndefined();
  });

  it('a paralisante encurta o monstro e, no 5º acerto, o paralisa 5 s (o chefe não)', () => {
    const r = flechada(montar('aljava_paralisante', [monstro()], [[4.5, 3.5]]), ALVO);
    expect(r.luta.arena.classe?.flechadas).toBe(1);
    expect(r.luta.arena.monstros[0]?.encurtado).toBe(true);
    expect(numeros(r)).toContain('🕸️');
    const quinta = flechada(montar('aljava_paralisante', [monstro()], [[4.5, 3.5]], 4), ALVO);
    expect(avisos(quinta)).toContain('🕸️ Paralisia');
    expect(quinta.luta.arena.monstros[0]?.fase).toBe('atordoado');
    expect(quinta.luta.arena.monstros[0]?.tempo).toBeGreaterThan(REGRAS_DAS_ALJAVAS.paralisia - 90 - RECARGA_DO_ATAQUE);
    const chefe = flechada(montar('aljava_paralisante', [monstro({ isBoss: true })], [[4.5, 3.5]], 4), ALVO);
    expect(avisos(chefe)).not.toContain('🕸️ Paralisia');
    expect(chefe.luta.arena.monstros[0]?.fase).not.toBe('atordoado');
  });

  it('a flamejante deixa o monstro fraco por 3 golpes e, na 6ª flechada, o incendeia 10 s', () => {
    const r = flechada(montar('aljava_flamejante', [monstro()], [[4.5, 3.5]]), ALVO);
    expect(r.luta.arena.monstros[0]?.fraco).toBe(REGRAS_DAS_ALJAVAS.golpesFracos);
    expect(numeros(r)).toContain('Fraco');
    const sexta = flechada(montar('aljava_flamejante', [monstro()], [[4.5, 3.5]], 5), ALVO);
    expect(avisos(sexta)).toContain('🔥 Incêndio');
    const dano = 4000 - vidaDoMonstro(r.luta);
    const incendio = sexta.luta.arena.monstros[0]?.incendio;
    expect(incendio?.dano).toBe(Math.max(1, Math.trunc((dano * REGRAS_DAS_ALJAVAS.incendioPorSegundo) / 100)));
    // O incêndio queima a cada segundo até acabar: 10 vezes, contando as que já passaram.
    const queimou = rodar(sexta.luta, REGRAS_DAS_ALJAVAS.incendio);
    const jaQueimou = numeros(sexta).filter((n) => n.startsWith('🔥-')).length;
    expect(jaQueimou + numeros(queimou).filter((n) => n.startsWith('🔥-')).length).toBe(10);
    expect(queimou.luta.arena.monstros[0]?.incendio).toBeUndefined();
  });

  it('o monstro fraco golpeia 20% mais fraco, e cada golpe gasta um', () => {
    const forte = montar(null, [monstro()], [[4.5, 6.5]]);
    const fraco = { ...forte, arena: { ...forte.arena, monstros: forte.arena.monstros.map((m) => ({ ...m, fraco: 3 })) } };
    const comecou = (luta: LutaEmTempoReal) => rodar(luta, 400, () => PARADO);
    const a = comecou(forte).luta.arena.monstros[0]!;
    const b = comecou(fraco).luta.arena.monstros[0]!;
    expect(b.fraco ?? 0).toBeLessThan(3);
    expect(b.forca).toBeCloseTo((a.forca * (100 - REGRAS_DAS_ALJAVAS.fraqueza)) / 100, 6);
  });

  it('a explosiva estoura no alvo: quem está a até 2 blocos leva o mesmo dano e é empurrado', () => {
    const r = flechada(montar('aljava_explosiva', [monstro(), monstro(), monstro()], [[4.5, 3.5], [6.5, 3.5], [4.5, 1.5]]), ALVO);
    const dano = 4000 - vidaDoMonstro(r.luta, 0);
    expect(dano).toBeGreaterThan(0);
    expect(vidaDoMonstro(r.luta, 1)).toBe(4000 - dano);
    expect(vidaDoMonstro(r.luta, 2)).toBe(4000 - dano);
    expect(numeros(r)).toContain(`💥-${dano}`);
    expect(r.luta.arena.monstros[1]!.corpoX).toBeGreaterThan(6.5 * T);
  });

  it('na 10ª, a explosão vai em cadeia: cada um explode uma vez e leva no máximo 2 estouros', () => {
    const fila = (flechadas: number) => montar('aljava_explosiva', [monstro(), monstro(), monstro()], [[2.5, 3.5], [4.5, 3.5], [6.5, 3.5]], flechadas);
    const sozinha = flechada(fila(0), { x: 2.5 * T, y: 3.5 * T });
    const dano = 4000 - vidaDoMonstro(sozinha.luta, 0);
    expect(vidaDoMonstro(sozinha.luta, 1)).toBe(4000 - dano);
    expect(vidaDoMonstro(sozinha.luta, 2)).toBe(4000);
    const cadeia = flechada(fila(9), { x: 2.5 * T, y: 3.5 * T });
    expect(avisos(cadeia)).toContain('💥 Explosão em cadeia');
    const d = 4000 - vidaDoMonstro(cadeia.luta, 0);
    // O do meio leva o estouro do primeiro e o do último; o último, o do meio.
    expect(vidaDoMonstro(cadeia.luta, 1)).toBe(4000 - 2 * d);
    expect(vidaDoMonstro(cadeia.luta, 2)).toBe(4000 - d);
    expect(numeros(cadeia).filter((n) => n === '💥').length).toBe(3);
  });
});
