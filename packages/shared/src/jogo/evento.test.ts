import { describe, expect, it } from 'vitest';

import type { DungeonCell } from '../dungeon/generate.js';
import { eventXp, type EventTemplateId } from '../events/events.js';
import { seededRng } from '../rng.js';
import { celulaAtual, retomarSave, substituirCelulaAtual, type EstadoNaMasmorra } from './estado.js';
import { abrirEvento, escolher, escolhas, ESCOLHAS, type Evento } from './evento.js';
import { saveSorteado } from './heroi-sorteado.js';

function masmorra(): EstadoNaMasmorra {
  const rng = seededRng(4);
  const estado = retomarSave({ ...saveSorteado('Aria', rng), floor: 2, mapMode: 'dungeon' }, seededRng(11));
  if (estado.mapMode !== 'dungeon') throw new Error('esperava masmorra');
  return estado;
}

function emCimaDe(estado: EstadoNaMasmorra, tipo: string): EstadoNaMasmorra {
  for (const linha of estado.map) {
    for (const celula of linha) {
      if (celula.type === tipo) return { ...estado, pos: { x: celula.x, y: celula.y } };
    }
  }
  throw new Error(`sem sala ${tipo}`);
}

/** Fixa qual evento está na sala, pra o teste não depender do sorteio. */
function comEvento(estado: EstadoNaMasmorra, templateId: EventTemplateId, ouro = 100): EstadoNaMasmorra {
  const naSala = emCimaDe(estado, 'event');
  const sala = celulaAtual(naSala) as DungeonCell;
  return substituirCelulaAtual(
    { ...naSala, hero: { ...naSala.hero, gold: ouro } },
    { ...sala, event: { templateId }, resolved: false },
  );
}

function eventoDe(estado: EstadoNaMasmorra): Evento {
  const evento = abrirEvento(estado);
  if (!evento) throw new Error('esperava um evento nesta sala');
  return evento;
}

describe('abrirEvento', () => {
  it('devolve null onde não há evento', () => {
    expect(abrirEvento(emCimaDe(masmorra(), 'start'))).toBeNull();
  });

  it('abre com o texto do template e sem estar resolvido', () => {
    const evento = eventoDe(comEvento(masmorra(), 'altar'));

    expect(evento.template.id).toBe('altar');
    expect(evento.resolvido).toBe(false);
    expect(evento.log[0]).toBe(evento.template.text);
  });

  it('evento já resolvido abre avisando', () => {
    const naSala = comEvento(masmorra(), 'altar');
    const sala = celulaAtual(naSala) as DungeonCell;
    const resolvido = substituirCelulaAtual(naSala, { ...sala, resolved: true });

    expect(eventoDe(resolvido).log[0]).toContain('já foi resolvido');
  });
});

describe('escolhas', () => {
  it('cada evento tem exatamente três, na ordem do original', () => {
    expect(ESCOLHAS.ferido.map((e) => e.id)).toEqual(['ajudar', 'curar', 'ignorar']);
    expect(ESCOLHAS.altar.map((e) => e.id)).toEqual(['estudar', 'rezar', 'sacrificar']);
    expect(ESCOLHAS.porta.map((e) => e.id)).toEqual(['forcar', 'examinar', 'desistir']);
  });

  it('a lista sai do template da sala', () => {
    expect(escolhas(eventoDe(comEvento(masmorra(), 'porta')))).toBe(ESCOLHAS.porta);
  });
});

describe('escolher', () => {
  it('ignorar resolve a sala sem cobrar nada', () => {
    const evento = eventoDe(comEvento(masmorra(), 'ferido'));
    const ouroAntes = evento.estado.hero.gold;

    const depois = escolher(evento, 'ignorar');

    expect(depois.resolvido).toBe(true);
    expect((celulaAtual(depois.estado) as DungeonCell).resolved).toBe(true);
    expect(depois.estado.hero.gold).toBe(ouroAntes);
  });

  it('ajudar cobra 15 de ouro e dá XP', () => {
    const evento = eventoDe(comEvento(masmorra(), 'ferido', 100));

    const depois = escolher(evento, 'ajudar');

    expect(depois.estado.hero.gold).toBe(85);
    expect(depois.resolvido).toBe(true);
  });

  it('sem ouro a escolha é recusada e a sala continua aberta', () => {
    const evento = eventoDe(comEvento(masmorra(), 'ferido', 0));

    const depois = escolher(evento, 'ajudar');

    expect(depois.resolvido).toBe(false);
    expect((celulaAtual(depois.estado) as DungeonCell).resolved).toBeFalsy();
    expect(depois.log[0]).toContain('ouro');
  });

  it('evento resolvido não aceita segunda escolha', () => {
    const resolvido = escolher(eventoDe(comEvento(masmorra(), 'ferido')), 'ignorar');

    expect(escolher(resolvido, 'ajudar')).toBe(resolvido);
  });

  it('sacrificar tira vida do herói', () => {
    const evento = eventoDe(comEvento(masmorra(), 'altar'));
    const vidaAntes = evento.estado.hero.hp;

    const depois = escolher(evento, 'sacrificar', seededRng(1));

    expect(depois.estado.hero.hp).toBeLessThan(vidaAntes);
    expect(depois.resolvido).toBe(true);
  });
});

describe('XP de evento', () => {
  it('a escolha resolvida diz quanto XP rendeu', () => {
    const evento = eventoDe(comEvento(masmorra(), 'ferido', 100));
    const xp = eventXp(evento.estado.floor);

    const depois = escolher(evento, 'ajudar');

    expect(depois.log[0]).toBe(`Você ajuda o aventureiro. +${xp} XP.`);
  });

  it('vale também pra escolha que não deu certo', () => {
    const evento = eventoDe(comEvento(masmorra(), 'porta'));
    const comForcaBaixa = { ...evento, estado: { ...evento.estado, hero: { ...evento.estado.hero, attrs: { ...evento.estado.hero.attrs, forca: 1 } } } };

    const depois = escolher(comForcaBaixa, 'forcar');

    expect(depois.log[0]).toContain('A porta não cede');
    expect(depois.log[0]).toContain(`+${eventXp(evento.estado.floor)} XP.`);
  });

  it('seguir caminho não fala de XP', () => {
    const depois = escolher(eventoDe(comEvento(masmorra(), 'ferido')), 'ignorar');

    expect(depois.log[0]).toBe('Você segue seu caminho sem se envolver.');
  });

  it('escolha recusada não fala de XP', () => {
    const depois = escolher(eventoDe(comEvento(masmorra(), 'ferido', 0)), 'ajudar');

    expect(depois.log[0]).not.toContain('XP');
  });
});
