import { describe, expect, it } from 'vitest';

import type { CityCell } from '../city/city.js';
import type { DungeonCell, DungeonRoomType } from '../dungeon/generate.js';
import { CLASSES, RACES } from '../hero/catalog.js';
import { randomItem } from '../items/item.js';
import { seededRng } from '../rng.js';
import { celulaAtual, entrarNaCidade, retomarSave, substituirCelulaAtual, type EstadoNaCidade, type EstadoNaMasmorra } from './estado.js';
import { treinar } from './guilda.js';
import { saveSorteado } from './heroi-sorteado.js';
import { entrar } from './portao.js';
import { confirmaAoTocar, interagir, lutaAoEntrar } from './sala.js';
import { montarSaveInicial } from './save-inicial.js';

function saveNovo() {
  return saveSorteado('Aria', Math.random);
}

function cidadeNova(): EstadoNaCidade {
  return entrarNaCidade(saveNovo());
}

function masmorraNoAndar(floor: number, seed = 11): EstadoNaMasmorra {
  const estado = retomarSave({ ...saveNovo(), floor, mapMode: 'dungeon' }, seededRng(seed));
  if (estado.mapMode !== 'dungeon') throw new Error('esperava cair na masmorra');
  return estado;
}

/** Teleporta o jogador pra primeira sala de um tipo — evita ter que andar até ela. */
function emCimaDe<E extends EstadoNaCidade | EstadoNaMasmorra>(estado: E, tipo: string): E {
  for (const linha of estado.map) {
    for (const celula of linha) {
      if (celula.type === tipo) return { ...estado, pos: { x: celula.x, y: celula.y } };
    }
  }
  throw new Error(`nenhuma sala do tipo ${tipo} neste mapa`);
}

function comSalaAtual(estado: EstadoNaMasmorra, mudanca: Partial<DungeonCell>): EstadoNaMasmorra {
  const atual = celulaAtual(estado) as DungeonCell;
  return substituirCelulaAtual(estado, { ...atual, ...mudanca });
}

function sala(tipo: DungeonRoomType, extra: Partial<DungeonCell> = {}): DungeonCell {
  return { type: tipo, x: 0, y: 0, doors: {}, ...extra };
}

describe('lutaAoEntrar', () => {
  it('sala de monstro e de chefe ainda não batida começa a luta ao entrar, sem perguntar', () => {
    expect(lutaAoEntrar(sala('monster'))).toBe(true);
    expect(lutaAoEntrar(sala('boss'))).toBe(true);
  });

  it('a já batida, e qualquer outra sala, não', () => {
    expect(lutaAoEntrar(sala('monster', { beaten: true }))).toBe(false);
    expect(lutaAoEntrar(sala('treasure'))).toBe(false);
    expect(lutaAoEntrar(sala('stairs'))).toBe(false);
    expect(lutaAoEntrar({ type: 'shop', x: 0, y: 0, doors: {} } as CityCell)).toBe(false);
    expect(lutaAoEntrar(null)).toBe(false);
  });
});

describe('confirmaAoTocar', () => {
  it('a escada e a saída perguntam antes, porque não têm volta', () => {
    expect(confirmaAoTocar(sala('stairs'))).toBe(true);
    expect(confirmaAoTocar(sala('exit'))).toBe(true);
  });

  it('o resto aciona no encostão: baú, evento, mestre, totem, portão, loja', () => {
    expect(confirmaAoTocar(sala('treasure'))).toBe(false);
    expect(confirmaAoTocar(sala('event'))).toBe(false);
    expect(confirmaAoTocar(sala('teacher'))).toBe(false);
    expect(confirmaAoTocar(sala('totem'))).toBe(false);
    expect(confirmaAoTocar({ type: 'gate', x: 0, y: 0, doors: {} } as CityCell)).toBe(false);
    expect(confirmaAoTocar({ type: 'shop', x: 0, y: 0, doors: {} } as CityCell)).toBe(false);
  });
});

describe('interagir na cidade', () => {
  it('o portão abre a escolha de masmorra, sem descer ainda', () => {
    const naPorta = emCimaDe(cidadeNova(), 'gate');
    const { estado, tela } = interagir(naPorta, seededRng(1));

    expect(estado.mapMode).toBe('city');
    expect(tela?.tipo).toBe('portao');
  });

  it('do portão se entra na Floresta Normal, pelo andar 1', () => {
    const { tela } = interagir(emCimaDe(cidadeNova(), 'gate'), seededRng(1));
    if (tela?.tipo !== 'portao') throw new Error('esperava o portão');

    const entrada = entrar(tela.portao, seededRng(1));

    expect(entrada?.estado.mapMode).toBe('dungeon');
    expect(entrada?.estado.floor).toBe(1);
    expect(entrada?.estado.masmorra).toEqual({ dungeon: 'floresta', difficulty: 'normal' });
  });

  it('abrir o portão e desistir não fecha "Entre na masmorra"; atravessar fecha', () => {
    const { tela, recado, estado } = interagir(emCimaDe(cidadeNova(), 'gate'), seededRng(1));
    if (tela?.tipo !== 'portao') throw new Error('esperava o portão');

    expect(recado).toBeNull();
    expect(estado.tutorial?.completed.dungeon).toBeUndefined();

    const entrada = entrar(tela.portao, seededRng(1));
    expect(entrada?.recado?.titulo).toContain('Etapa concluída');
    expect(entrada?.estado.tutorial?.completed.dungeon).toBe(true);
  });

  it('a taverna recupera vida e mana', () => {
    const cidade = cidadeNova();
    const machucado: EstadoNaCidade = { ...cidade, hero: { ...cidade.hero, hp: 1, mp: 0 } };

    const { estado } = interagir(emCimaDe(machucado, 'tavern'));

    expect(estado.hero.hp).toBe(estado.hero.maxHp);
    expect(estado.hero.mp).toBe(estado.hero.maxMp);
  });

  it('a loja abre com estoque em vez de avisar', () => {
    const { tela } = interagir(emCimaDe(cidadeNova(), 'shop'), seededRng(5));

    expect(tela?.tipo).toBe('loja');
    if (tela?.tipo !== 'loja') return;
    expect(tela.loja.kind).toBe('shop');
  });

  it('o ferreiro abre no modo de forja', () => {
    const { tela } = interagir(emCimaDe(cidadeNova(), 'blacksmith'), seededRng(5));

    expect(tela?.tipo).toBe('loja');
    if (tela?.tipo !== 'loja') return;
    expect(tela.loja.kind).toBe('blacksmith');
  });

  it('o quadro de missões abre com missões dentro', () => {
    const { tela } = interagir(emCimaDe(cidadeNova(), 'questboard'), seededRng(5));

    expect(tela?.tipo).toBe('missoes');
    if (tela?.tipo !== 'missoes') return;
    expect(tela.quadro.estado.quests.length).toBeGreaterThan(0);
  });

  it('o morador abre conversa em vez de avisar', () => {
    const { tela } = interagir(emCimaDe(cidadeNova(), 'npc'));

    expect(tela?.tipo).toBe('dialogo');
    if (tela?.tipo !== 'dialogo') return;
    expect(tela.dialogo.npc.lines.length).toBeGreaterThan(0);
  });

  it('a guilda abre o treinamento', () => {
    const { tela } = interagir(emCimaDe(cidadeNova(), 'guild'));
    expect(tela?.tipo).toBe('guilda');
  });
});

describe('o Aprendiz na cidade', () => {
  function cidadeDoAprendiz(): EstadoNaCidade {
    return entrarNaCidade(montarSaveInicial({ nome: 'Novato', raca: RACES[0]!, cabelo: null }, seededRng(3)));
  }

  it('o portão não abre pra quem ainda não treinou', () => {
    const naPorta = emCimaDe(cidadeDoAprendiz(), 'gate');
    const { estado, aviso, tela } = interagir(naPorta, seededRng(1));

    expect(estado.mapMode).toBe('city');
    expect(estado.pos).toEqual(naPorta.pos);
    expect(tela).toBeNull();
    expect(aviso?.texto).toContain('Guilda');
  });

  it('barrado no portão, o Aprendiz não fecha "Entre na masmorra"', () => {
    const { estado, recado } = interagir(emCimaDe(cidadeDoAprendiz(), 'gate'), seededRng(1));

    expect(recado).toBeNull();
    expect(estado.tutorial?.completed.dungeon).toBeUndefined();
  });

  it('entrar na guilda não fecha "Treine na Guilda"; o treino fecha', () => {
    const { tela, recado, estado } = interagir(emCimaDe(cidadeDoAprendiz(), 'guild'));
    if (tela?.tipo !== 'guilda') throw new Error('esperava a guilda');

    expect(recado).toBeNull();
    expect(estado.tutorial?.completed.guild).toBeUndefined();

    const treinada = treinar(tela.guilda, CLASSES[0]!);
    expect(treinada.recado?.titulo).toContain('Etapa concluída');
    expect(treinada.estado.tutorial?.completed.guild).toBe(true);
  });

  it('quem já tem classe fecha "Treine na Guilda" só de entrar: não há o que treinar', () => {
    const { recado, estado } = interagir(emCimaDe(cidadeNova(), 'guild'));

    expect(recado?.titulo).toContain('Etapa concluída');
    expect(estado.tutorial?.completed.guild).toBe(true);
  });

  it('depois da guilda, o mesmo portão abre', () => {
    const { tela } = interagir(emCimaDe(cidadeDoAprendiz(), 'guild'));
    if (tela?.tipo !== 'guilda') throw new Error('esperava a guilda');
    const treinado = treinar(tela.guilda, CLASSES[0]!).estado as EstadoNaCidade;

    expect(interagir(emCimaDe(treinado, 'gate'), seededRng(1)).tela?.tipo).toBe('portao');
  });

  it('a cidade de um save de antes da guilda ganha a guilda ao carregar', () => {
    const cidade = cidadeNova();
    const antiga = cidade.map.map((linha) => linha.map((cell) => (cell.type === 'guild' ? { ...cell, type: 'normal' as const } : cell)));
    const recarregada = retomarSave({ ...saveNovo(), mapMode: 'city', cityMap: antiga, cityStart: cidade.cityStart });

    expect(recarregada.map.flat().some((cell) => cell.type === 'guild')).toBe(true);
  });
});

describe('interagir na masmorra', () => {
  it('a escada desce um andar', () => {
    const { estado, aviso } = interagir(emCimaDe(masmorraNoAndar(2), 'stairs'), seededRng(3));

    expect(estado.floor).toBe(3);
    expect(aviso?.titulo).toBe('Escadas');
  });

  it('a escada fica selada com o chefe vivo', () => {
    const naEscada = emCimaDe(masmorraNoAndar(5), 'stairs');
    const { estado, aviso } = interagir(naEscada, seededRng(3));

    expect(estado).toBe(naEscada);
    expect(aviso?.titulo).toBe('Caminho Selado');
  });

  it('a saída volta pra cidade sem zerar o andar', () => {
    const { estado } = interagir(emCimaDe(masmorraNoAndar(3), 'exit'));

    expect(estado.mapMode).toBe('city');
    expect(estado.floor).toBe(3);
  });

  it('o baú de ouro paga e fica vazio', () => {
    const bau = comSalaAtual(emCimaDe(masmorraNoAndar(2), 'treasure'), { giveGold: true, isMimic: false, collected: false });
    const ouroAntes = bau.hero.gold;

    const { estado, aviso } = interagir(bau, seededRng(7));

    expect(estado.hero.gold).toBeGreaterThan(ouroAntes);
    expect((celulaAtual(estado) as DungeonCell).collected).toBe(true);
    expect(aviso?.titulo).toBe('Baú Encontrado');
  });

  it('o baú de item vai pra mochila', () => {
    const item = randomItem({ floor: 2, rng: seededRng(8) });
    const bau = comSalaAtual(emCimaDe(masmorraNoAndar(2), 'treasure'), { giveGold: false, isMimic: false, collected: false, item });

    const { estado } = interagir(bau, seededRng(7));

    expect(estado.inventory).toHaveLength(bau.inventory.length + 1);
    expect(estado.inventory.at(-1)?.uid).toBe(item.uid);
  });

  it('baú já revistado não paga de novo', () => {
    const bau = comSalaAtual(emCimaDe(masmorraNoAndar(2), 'treasure'), { collected: true });

    const { estado, aviso } = interagir(bau, seededRng(7));

    expect(estado).toBe(bau);
    expect(aviso?.titulo).toBe('Baú Vazio');
  });

  it('o mímico troca o baú por uma sala de monstro e não entrega o prêmio', () => {
    const bau = comSalaAtual(emCimaDe(masmorraNoAndar(2), 'treasure'), { isMimic: true, giveGold: true, collected: false });

    const { estado } = interagir(bau, seededRng(7));
    const depois = celulaAtual(estado) as DungeonCell;

    expect(depois.type).toBe('monster');
    expect(depois.monsters).toHaveLength(1);
    expect(depois.collected).toBeFalsy();
    expect(depois.bonusTreasure).toBeDefined();
    expect(estado.hero.gold).toBe(bau.hero.gold);
  });

  it('sala de monstro abre o encontro em vez de resolver sozinha', () => {
    const naSala = emCimaDe(masmorraNoAndar(2), 'monster');
    const { estado, tela } = interagir(naSala);

    // Entrar não mexe em herói nem em sala; só marca a etapa do tutorial.
    expect(estado.hero).toBe(naSala.hero);
    expect(estado.map).toBe(naSala.map);
    expect(tela?.tipo).toBe('combate');
    if (tela?.tipo !== 'combate') return;
    // Já em `combate`, e não numa fase de confirmação: a pergunta "deseja
    // entrar?" da porta é a única decisão, e ela já foi tomada aqui.
    expect(tela.combate.fase).toBe('combate');
  });

  it('o mímico já entra em combate junto com a revelação', () => {
    const bau = comSalaAtual(emCimaDe(masmorraNoAndar(2), 'treasure'), { isMimic: true, giveGold: true, collected: false });

    const { tela } = interagir(bau, seededRng(7));

    expect(tela?.tipo).toBe('combate');
    if (tela?.tipo !== 'combate') return;
    expect(tela.combate.log[0]).toContain('aparece');
  });

  it('sala de evento abre o acontecimento', () => {
    const { tela } = interagir(emCimaDe(masmorraNoAndar(2), 'event'));

    expect(tela?.tipo).toBe('evento');
    if (tela?.tipo !== 'evento') return;
    expect(tela.evento.resolvido).toBe(false);
  });

  /**
   * Passar de novo por um evento já resolvido não abre tela nenhuma — vira
   * aviso, igual ao baú vazio e à sala de monstro já batida. A tela que
   * existia ali só tinha um botão "Continuar" e a frase de que não havia
   * nada: dois cliques cobrados por nada.
   */
  it('evento já resolvido vira aviso, e não tela', () => {
    const resolvido = comSalaAtual(emCimaDe(masmorraNoAndar(2), 'event'), { resolved: true });

    const { tela, aviso } = interagir(resolvido);

    expect(tela).toBeNull();
    expect(aviso?.texto).toContain('já resolveu');
  });

  /**
   * O título é o do próprio evento, e não um "Sala Vazia" genérico: quem
   * passa de novo pelo Altar Antigo reconhece qual sala era, que é a única
   * informação que sobrou pra dar.
   */
  it('o aviso mantém o nome do evento que estava ali', () => {
    const masmorra = emCimaDe(masmorraNoAndar(2), 'event');
    const original = interagir(masmorra);
    if (original.tela?.tipo !== 'evento') throw new Error('esperava a tela do evento');

    const { aviso } = interagir(comSalaAtual(masmorra, { resolved: true }));

    expect(aviso?.titulo).toBe(original.tela.evento.template.title);
    expect(aviso?.icone).toBe(original.tela.evento.template.icon);
  });
});
