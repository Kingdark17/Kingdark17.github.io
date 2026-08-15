import { describe, expect, it } from 'vitest';

import { itemCategory, randomItem, seededRng, type CityCell, type DungeonCell, type Item, type NpcService } from '@rpg-legend/shared';

import { rolarTudo } from './criacao';
import { abrirDialogo, falaAtual, proximaFala, servicoDisponivel, temMaisFalas, usarServico, type Dialogo } from './dialogo';
import { celulaAtual, entrarNaCidade, retomarSave, substituirCelulaAtual, type EstadoNaCidade, type EstadoNaMasmorra } from './estado';
import { montarSaveInicial } from './save-inicial';

function saveNovo() {
  const rng = seededRng(4);
  return montarSaveInicial(rolarTudo('Aria', rng), rng);
}

function cidade(): EstadoNaCidade {
  return entrarNaCidade(saveNovo());
}

function masmorra(): EstadoNaMasmorra {
  const estado = retomarSave({ ...saveNovo(), floor: 2, mapMode: 'dungeon' }, seededRng(11));
  if (estado.mapMode !== 'dungeon') throw new Error('esperava masmorra');
  return estado;
}

function emCimaDe<E extends EstadoNaCidade | EstadoNaMasmorra>(estado: E, tipo: string): E {
  for (const linha of estado.map) {
    for (const celula of linha) {
      if (celula.type === tipo) return { ...estado, pos: { x: celula.x, y: celula.y } };
    }
  }
  throw new Error(`sem sala ${tipo}`);
}

const NPC_DE_TESTE = { name: 'Teste', role: 'Testador', icon: '🧪', lines: ['Primeira.', 'Segunda.'], serviceUsed: false };

/** Põe um NPC com o serviço pedido na sala onde o jogador está. */
function comServico(estado: EstadoNaCidade, service: NpcService): EstadoNaCidade {
  const sala = celulaAtual(estado) as CityCell;
  return substituirCelulaAtual(estado, { ...sala, npc: { ...NPC_DE_TESTE, service } });
}

function comServicoNaMasmorra(estado: EstadoNaMasmorra, service: NpcService): EstadoNaMasmorra {
  const sala = celulaAtual(estado) as DungeonCell;
  return substituirCelulaAtual(estado, { ...sala, npc: { ...NPC_DE_TESTE, service } });
}

function dialogoCom(estado: EstadoNaCidade | EstadoNaMasmorra): Dialogo {
  const dialogo = abrirDialogo(estado);
  if (!dialogo) throw new Error('esperava um NPC nesta sala');
  return dialogo;
}

describe('abrirDialogo', () => {
  it('devolve null onde não há NPC', () => {
    expect(abrirDialogo(emCimaDe(cidade(), 'tavern'))).toBeNull();
  });

  it('começa na primeira fala', () => {
    const dialogo = dialogoCom(emCimaDe(cidade(), 'npc'));

    expect(dialogo.linha).toBe(0);
    expect(falaAtual(dialogo)).toBe(dialogo.npc.lines[0]);
  });
});

describe('proximaFala', () => {
  it('avança até a última e para lá', () => {
    let dialogo = dialogoCom(emCimaDe(cidade(), 'npc'));
    const total = dialogo.npc.lines.length;

    for (let i = 0; i < total + 3; i++) dialogo = proximaFala(dialogo);

    expect(dialogo.linha).toBe(total - 1);
    expect(temMaisFalas(dialogo)).toBe(false);
  });
});

describe('usarServico', () => {
  it('curar cobra ouro e devolve vida', () => {
    const base = emCimaDe(cidade(), 'npc');
    const ferido: EstadoNaCidade = { ...base, hero: { ...base.hero, hp: 1, mp: 0, gold: 500 } };

    const depois = usarServico(dialogoCom(comServico(ferido, 'heal')));

    expect(depois.estado.hero.hp).toBeGreaterThan(1);
    expect(depois.estado.hero.gold).toBeLessThan(500);
    expect(depois.npc.serviceUsed).toBe(true);
  });

  it('curar sem ouro não gasta o serviço', () => {
    const base = emCimaDe(cidade(), 'npc');
    const duro: EstadoNaCidade = { ...base, hero: { ...base.hero, hp: 1, gold: 0 } };

    const depois = usarServico(dialogoCom(comServico(duro, 'heal')));

    expect(depois.npc.serviceUsed).toBe(false);
    expect(depois.log[0]).toContain('ouro');
  });

  it('bênção fica guardada no herói para os próximos combates', () => {
    const depois = usarServico(dialogoCom(comServico(emCimaDe(cidade(), 'npc'), 'blessing')));

    expect(depois.estado.hero.npcBlessing?.combats).toBe(3);
    expect(depois.estado.hero.npcBlessing?.dodge).toBe(12);
  });

  it('troca dá poção por material', () => {
    const base = emCimaDe(cidade(), 'npc');
    const minerio: Item = randomItem({ category: 'material', floor: 1, rng: seededRng(2) });
    const comMaterial: EstadoNaCidade = { ...base, inventory: [minerio] };

    const depois = usarServico(dialogoCom(comServico(comMaterial, 'barter')), seededRng(3));

    expect(depois.estado.inventory.some((i) => i.uid === minerio.uid)).toBe(false);
    expect(depois.estado.inventory.map((i) => itemCategory(i))).toContain('consumivel');
  });

  it('troca sem material não gasta o serviço', () => {
    const base = emCimaDe(cidade(), 'npc');
    const semNada: EstadoNaCidade = { ...base, inventory: [] };

    const depois = usarServico(dialogoCom(comServico(semNada, 'barter')));

    expect(depois.npc.serviceUsed).toBe(false);
  });

  it('recrutar traz um companheiro temporário', () => {
    const depois = usarServico(dialogoCom(comServico(emCimaDe(cidade(), 'npc'), 'recruit')), seededRng(6));

    expect(depois.estado.party).toHaveLength(1);
    expect(depois.estado.party[0]?.temporary).toBe(true);
    expect(depois.estado.party[0]?.combatsLeft).toBe(3);
  });

  it('revelar não faz nada na cidade, onde o mapa já é conhecido', () => {
    const depois = usarServico(dialogoCom(comServico(emCimaDe(cidade(), 'npc'), 'reveal')));

    expect(depois.npc.serviceUsed).toBe(false);
    expect(depois.log[0]).toContain('cidade');
  });

  it('revelar abre as salas vizinhas na masmorra', () => {
    const naSala = comServicoNaMasmorra(emCimaDe(masmorra(), 'npc'), 'reveal');
    const antes = naSala.map.flat().filter((c) => c.revealed).length;

    const depois = usarServico(dialogoCom(naSala));
    const estado = depois.estado;
    if (estado.mapMode !== 'dungeon') throw new Error('esperava masmorra');

    expect(estado.map.flat().filter((c: DungeonCell) => c.revealed).length).toBeGreaterThan(antes);
    expect(depois.npc.serviceUsed).toBe(true);
  });

  it('o serviço usado fica gravado na sala, não só na sessão', () => {
    const depois = usarServico(dialogoCom(comServico(emCimaDe(cidade(), 'npc'), 'blessing')));
    const sala = celulaAtual(depois.estado) as CityCell;

    expect(sala.npc?.serviceUsed).toBe(true);
  });

  it('não deixa usar duas vezes', () => {
    const primeira = usarServico(dialogoCom(comServico(emCimaDe(cidade(), 'npc'), 'blessing')));
    const segunda = usarServico(primeira);

    expect(servicoDisponivel(primeira.npc)).toBe(false);
    expect(segunda.estado).toBe(primeira.estado);
    expect(segunda.log[0]).toContain('já foi utilizado');
  });
});
