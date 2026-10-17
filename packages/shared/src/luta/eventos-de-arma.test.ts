import { describe, expect, it } from 'vitest';

import { freshCombatMonster } from '../combat/monster-state.js';
import { lerMira, resolveAttack, resolverGolpe, zonaDoAtaque } from '../combat/resolve-attack.js';
import { DEBUFFS } from '../hero/catalog.js';
import { derivedStats } from '../hero/derived.js';
import type { Hero, HeroEquipment } from '../hero/hero.js';
import { instantiate } from '../items/item.js';
import { RARITIES } from '../items/rarity.js';
import { templateById } from '../items/templates.js';
import { monsterView } from '../monsters/generate.js';
import type { Rng } from '../rng.js';
import {
  DURACAO_DA_BARRA,
  DURACAO_DA_CARGA,
  DURACAO_DO_DESENHO,
  ERRO_NA_PONTA,
  ERRO_POR_PASSO,
  JANELA_DAS_LETRAS,
  JANELA_DO_RITMO,
  NOTAS_DAS_LETRAS,
  NOTAS_DO_RITMO,
  NOTAS_DO_TOQUE_DUPLO,
  SIMBOLOS,
  TEMPO_LIVRE_DO_DESENHO,
  eventoDaArma,
  eventoDoAtaque,
  lerEvento,
  type EventoDeArma,
  type PontoDoTraco,
} from './eventos-de-arma.js';

const SEM_DEBUFF = DEBUFFS.find((d) => !d.effect)!;

/** Bárbaro (zona comum, sem passiva que sorteie) com a arma pedida. */
function heroi(arma: string | null, className = 'Bárbaro'): Hero {
  const attrs = { forca: 10, destreza: 10, constituicao: 10, intelecto: 10, sabedoria: 10, carisma: 10 };
  const equip: HeroEquipment = { arma: arma ? instantiate(templateById(arma)!, RARITIES[0]!) : null, secundaria: null, armadura: null, acessorio: null };
  const derived = derivedStats({ level: 1, attrs, equip });
  return {
    level: 1, attrs, equip, name: 'T', race: 'Humano', raceIcon: '', className, classIcon: '', xp: 0, xpNext: 40, attrPoints: 0, gold: 0,
    powerNames: [], debuff: SEM_DEBUFF, killCount: 0, derived, maxHp: derived.maxHp, hp: derived.maxHp, maxMp: derived.maxMp, mp: derived.maxMp, buffs: {},
  };
}

function sequencia(valores: number[]): Rng {
  let i = 0;
  return () => (i < valores.length ? (valores[i++] as number) : (valores[valores.length - 1] ?? 0));
}

const nuncaSorteia: Rng = () => {
  throw new Error('sorteou');
};

/** O símbolo, ponto a ponto, gastando `passos` do primeiro ao último. */
function tracar(simbolo: string, passos: number, inicio = 0, desvio = 0): PontoDoTraco[] {
  const pontos = SIMBOLOS[simbolo]!;
  return pontos.map(([x, y], i) => ({ x: Math.min(1000, x + desvio), y, t: inicio + Math.floor((passos * i) / (pontos.length - 1)) }));
}

describe('eventoDaArma', () => {
  it('cada arma com o seu evento', () => {
    expect(eventoDaArma('espada')).toBe('barra');
    expect(eventoDaArma('maca')).toBe('barra');
    expect(eventoDaArma('arco')).toBe('circulo');
    expect(eventoDaArma('machado')).toBe('carga');
    expect(eventoDaArma('marreta')).toBe('carga');
    expect(eventoDaArma('cajado')).toBe('desenho');
    expect(eventoDaArma('violao')).toBe('ritmo');
    expect(eventoDaArma('adaga')).toBe('toque_duplo');
  });

  it('sem arma, ou com o nome de algo herdado do objeto, a barra', () => {
    expect(eventoDaArma(null)).toBe('barra');
    expect(eventoDaArma(undefined)).toBe('barra');
    expect(eventoDaArma('constructor')).toBe('barra');
  });

  it('no teclado, o cajado pede letras e as outras armas ficam iguais', () => {
    expect(eventoDaArma('cajado', true)).toBe('letras');
    for (const arma of ['espada', 'maca', 'arco', 'machado', 'marreta', 'violao', 'adaga', null, 'constructor']) {
      expect(eventoDaArma(arma, true)).toBe(eventoDaArma(arma));
    }
  });
});

describe('eventoDoAtaque', () => {
  it('leva a zona do ataque e não sorteia fora do desenho', () => {
    const hero = heroi('espada');
    expect(eventoDoAtaque(hero, 'normal', nuncaSorteia)).toEqual({ tipo: 'barra', zona: zonaDoAtaque(hero, 'normal'), duracao: DURACAO_DA_BARRA });
  });

  it('o ritmo traz as batidas e dura até a janela da última', () => {
    const evento = eventoDoAtaque(heroi('violao'), 'normal', nuncaSorteia);
    expect(evento.notas).toEqual([...NOTAS_DO_RITMO]);
    expect(evento.duracao).toBe(NOTAS_DO_RITMO[NOTAS_DO_RITMO.length - 1]! + JANELA_DO_RITMO);
  });

  it('o desenho sorteia o símbolo, um número só', () => {
    const nomes = Object.keys(SIMBOLOS);
    expect(eventoDoAtaque(heroi('cajado'), 'normal', sequencia([0])).simbolo).toBe(nomes[0]);
    expect(eventoDoAtaque(heroi('cajado'), 'normal', sequencia([0.99])).simbolo).toBe(nomes[nomes.length - 1]);
  });

  it('as letras: uma por nota, das quatro do teclado, sem repetir a de antes', () => {
    const hero = heroi('cajado');
    expect(eventoDoAtaque(hero, 'normal', sequencia([0, 0, 0]), true)).toEqual({
      tipo: 'letras',
      zona: zonaDoAtaque(hero, 'normal'),
      duracao: NOTAS_DAS_LETRAS[NOTAS_DAS_LETRAS.length - 1]! + JANELA_DAS_LETRAS,
      notas: [...NOTAS_DAS_LETRAS],
      janela: JANELA_DAS_LETRAS,
      letras: ['U', 'I', 'U'],
    });
    expect(eventoDoAtaque(hero, 'normal', sequencia([0.99, 0.99, 0.99]), true).letras).toEqual(['P', 'O', 'P']);
  });

  it('fora do teclado, o cajado continua no desenho', () => {
    expect(eventoDoAtaque(heroi('cajado'), 'normal', sequencia([0]), false).tipo).toBe('desenho');
  });
});

describe('lerEvento — barra, bolinha e carga são a mesma régua no tempo', () => {
  const barra: EventoDeArma = { tipo: 'barra', zona: 0.5, duracao: 84 };

  it('o meio do tempo é o centro: 1,5× e crítico', () => {
    expect(lerEvento(barra, { toque: 42 })).toEqual({ acerto: true, forca: 1.5, critico: true });
    expect(lerEvento({ ...barra, tipo: 'circulo' }, { toque: 42 })).toEqual({ acerto: true, forca: 1.5, critico: true });
    expect(lerEvento({ tipo: 'carga', zona: 0.5, duracao: DURACAO_DA_CARGA }, { soltou: 42 })).toEqual({ acerto: true, forca: 1.5, critico: true });
  });

  it('é a lerMira com o passo dividido pela duração', () => {
    for (const toque of [0, 10, 21, 30, 55, 63, 70, 83]) expect(lerEvento(barra, { toque })).toEqual(lerMira(0.5, toque / 84));
  });

  it('sem gesto, ou no último passo, erra (a barra acabou, a carga estourou)', () => {
    expect(lerEvento(barra, {}).acerto).toBe(false);
    expect(lerEvento(barra, { toque: 84 }).acerto).toBe(false);
    expect(lerEvento({ tipo: 'carga', zona: 0.5, duracao: 84 }, { soltou: 84 }).acerto).toBe(false);
  });

  it('passo fora do evento lança', () => {
    expect(() => lerEvento(barra, { toque: 85 })).toThrow(RangeError);
    expect(() => lerEvento(barra, { toque: -1 })).toThrow(RangeError);
    expect(() => lerEvento(barra, { toque: 1.5 })).toThrow(RangeError);
  });
});

describe('lerEvento — ritmo e toque duplo', () => {
  const ritmo: EventoDeArma = { tipo: 'ritmo', zona: 0.5, duracao: 114, notas: [30, 60, 90], janela: 24 };

  it('as três batidas em cima: 1,5× e crítico', () => {
    expect(lerEvento(ritmo, { toques: [30, 60, 90] })).toEqual({ acerto: true, forca: 1.5, critico: true });
  });

  it('a força é a média das notas', () => {
    // 6 passos de atraso = 1/8 da régua da nota: 1,5 − 1 × (0,125 / 0,25) = 1.
    expect(lerEvento(ritmo, { toques: [36, 60, 90] })).toEqual({ acerto: true, forca: Math.round(((1 + 1.5 + 1.5) / 3) * 100) / 100, critico: false });
  });

  it('nota perdida vale zero, mas quem acertou alguma não fica abaixo da borda', () => {
    expect(lerEvento(ritmo, { toques: [60] })).toEqual({ acerto: true, forca: 0.5, critico: false });
  });

  it('cada nota fica com o primeiro toque da janela: bater sem parar não compensa', () => {
    const semParar = Array.from({ length: 115 }, (_, i) => i);
    const leitura = lerEvento(ritmo, { toques: semParar });
    expect(leitura.forca).toBeLessThan(1);
  });

  it('nenhum toque, erra', () => {
    expect(lerEvento(ritmo, {}).acerto).toBe(false);
  });

  it('toque voltando no tempo lança', () => {
    expect(() => lerEvento(ritmo, { toques: [60, 30] })).toThrow(RangeError);
  });

  it('a adaga usa as duas notas dela', () => {
    const adaga = eventoDoAtaque(heroi('adaga'), 'normal', nuncaSorteia);
    expect(lerEvento(adaga, { toques: [...NOTAS_DO_TOQUE_DUPLO] })).toEqual({ acerto: true, forca: 1.5, critico: true });
  });
});

describe('lerEvento — letras', () => {
  const letras: EventoDeArma = { tipo: 'letras', zona: 0.5, duracao: 144, notas: [24, 72, 120], janela: 24, letras: ['U', 'O', 'I'] };
  const apertou = (...teclas: Array<[string, number]>) => ({ teclas: teclas.map(([letra, t]) => ({ letra, t })) });

  it('as três letras certas quando o aro encosta: 1,5× e crítico', () => {
    expect(lerEvento(letras, apertou(['U', 24], ['O', 72], ['I', 120]))).toEqual({ acerto: true, forca: 1.5, critico: true });
  });

  it('cada letra é uma régua pequena, como as notas do ritmo', () => {
    const ritmo: EventoDeArma = { tipo: 'ritmo', zona: 0.5, duracao: 144, notas: [24, 72, 120], janela: 24 };
    expect(lerEvento(letras, apertou(['U', 30], ['O', 66], ['I', 120]))).toEqual(lerEvento(ritmo, { toques: [30, 66, 120] }));
  });

  it('a letra errada perde a nota, mesmo com a certa logo depois', () => {
    expect(lerEvento(letras, apertou(['U', 24], ['P', 70], ['O', 72], ['I', 120]))).toEqual({ acerto: true, forca: 1, critico: false });
  });

  it('o passo em que a letra some já é da próxima', () => {
    // O O no 48 é a primeira tecla da janela da segunda letra (48 a 95): cedo demais, e o do 72 não conta mais.
    expect(lerEvento(letras, apertou(['U', 24], ['O', 48], ['O', 72], ['I', 120]))).toEqual({ acerto: true, forca: 1, critico: false });
  });

  it('apertar todas sem parar não compensa', () => {
    const todas = Array.from({ length: 144 }, (_, t) => ({ letra: ['U', 'I', 'O', 'P'][t % 4]!, t }));
    expect(lerEvento(letras, { teclas: todas }).acerto).toBe(false);
  });

  it('nenhuma tecla erra; tecla fora do tempo, ou voltando, lança', () => {
    expect(lerEvento(letras, {}).acerto).toBe(false);
    expect(() => lerEvento(letras, apertou(['U', 145]))).toThrow(RangeError);
    expect(() => lerEvento(letras, apertou(['U', 30], ['O', 20]))).toThrow(RangeError);
  });
});

describe('lerEvento — desenho', () => {
  const evento = (simbolo: string): EventoDeArma => ({ tipo: 'desenho', zona: 0.5, duracao: DURACAO_DO_DESENHO, simbolo });

  it('passar exatamente por cima, rápido: 1,5× e crítico', () => {
    for (const simbolo of Object.keys(SIMBOLOS)) {
      expect(lerEvento(evento(simbolo), { traco: tracar(simbolo, 30) })).toEqual({ acerto: true, forca: 1.5, critico: true });
    }
  });

  it('tanto faz o sentido do traço', () => {
    const traco = tracar('raio', 30);
    const ao = traco.map((p, i) => ({ ...p, t: traco[traco.length - 1 - i]!.t })).reverse();
    expect(lerEvento(evento('raio'), { traco: ao.map((p, i) => ({ ...p, t: traco[i]!.t })) })).toEqual({ acerto: true, forca: 1.5, critico: true });
  });

  it('desenhar outro símbolo erra', () => {
    expect(lerEvento(evento('circulo'), { traco: tracar('raio', 30) }).acerto).toBe(false);
  });

  it('meio traço perde força: o pedaço que faltou conta', () => {
    const metade = tracar('triangulo', 20).slice(0, 24);
    const leitura = lerEvento(evento('triangulo'), { traco: metade });
    expect(leitura.forca).toBeLessThan(1.5);
  });

  it('a demora além do tempo livre soma erro', () => {
    const rapido = lerEvento(evento('onda'), { traco: tracar('onda', TEMPO_LIVRE_DO_DESENHO) });
    const devagar = lerEvento(evento('onda'), { traco: tracar('onda', TEMPO_LIVRE_DO_DESENHO + 40) });
    expect(rapido.forca).toBe(1.5);
    // Traço em cima da linha: o erro é só a demora, 40 passos a mais.
    expect(devagar).toEqual(lerMira(0.5, 0.5 + (40 * ERRO_POR_PASSO) / (2 * ERRO_NA_PONTA)));
    expect(devagar.forca).toBe(1.17);
  });

  it('um ponto só não é desenho', () => {
    expect(lerEvento(evento('circulo'), { traco: [{ x: 500, y: 500, t: 0 }] }).acerto).toBe(false);
  });

  it('ponto fora da caixa, passo fora do tempo e símbolo que não existe lançam', () => {
    expect(() => lerEvento(evento('circulo'), { traco: [{ x: 1001, y: 0, t: 0 }, { x: 0, y: 0, t: 1 }] })).toThrow(RangeError);
    expect(() => lerEvento(evento('circulo'), { traco: [{ x: 0, y: 0, t: 0 }, { x: 0, y: 0, t: DURACAO_DO_DESENHO + 1 }] })).toThrow(RangeError);
    expect(() => lerEvento(evento('constructor'), { traco: [] })).toThrow(RangeError);
  });
});

describe('resolverGolpe', () => {
  const monstro = () =>
    monsterView(freshCombatMonster({ speciesId: 'goblin', enemyClassId: 'brutamontes', floor: 5, hp: 100, maxHp: 100, dmg: 5, speed: 8, xp: 10, gold: 10, isBoss: false }));

  it('é a resolveAttack com a leitura já feita, sorteio por sorteio', () => {
    const hero = heroi('espada');
    const mira = 0.6;
    const antes = resolveAttack(hero, monstro(), { dado: 12, mira }, 'normal', { rng: sequencia([0.99, 0.99]) });
    const agora = resolverGolpe(hero, monstro(), 12, lerMira(zonaDoAtaque(hero, 'normal'), mira), 'normal', { rng: sequencia([0.99, 0.99]) });
    expect(agora).toEqual(antes);
  });

  it('força fora da régua e dado fora do d20 lançam', () => {
    const hero = heroi('espada');
    expect(() => resolverGolpe(hero, monstro(), 10, { acerto: true, forca: 1.6, critico: false }, 'normal')).toThrow(RangeError);
    expect(() => resolverGolpe(hero, monstro(), 21, { acerto: true, forca: 1, critico: false }, 'normal')).toThrow(RangeError);
  });
});
