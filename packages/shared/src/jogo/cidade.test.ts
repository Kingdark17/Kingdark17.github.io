import { describe, expect, it } from 'vitest';

import { CIDADE_COLS, CIDADE_ROWS, PONTOS_DA_CIDADE, chegadaNoPonto, plantaDaCidade, type PontoDaCidade } from '../city/mapa-da-cidade.js';
import { markCleared, type DungeonProgress } from '../dungeon/dungeons.js';
import { TILE_UNITS, walkTick, type RoomLayout, type Walker } from '../dungeon/room-walk.js';
import { seededRng } from '../rng.js';
import { chegadaNaCidade, entrarNoPonto, falarComOBram, plantaDaCidadeAgora, troncosNoCaminho } from './cidade.js';
import { celulaAtual, entrarNaCidade, type EstadoNaCidade } from './estado.js';
import { saveSorteado } from './heroi-sorteado.js';
import { escolherMasmorra } from './portao.js';

function cidade(nivel = 1, progresso?: DungeonProgress): EstadoNaCidade {
  const save = saveSorteado('Aria', seededRng(4));
  const base = entrarNaCidade({ ...save, hero: { ...save.hero, level: nivel } });
  return progresso ? { ...base, progresso } : base;
}

function aprendiz(): EstadoNaCidade {
  const base = cidade();
  return { ...base, hero: { ...base.hero, classId: undefined, className: 'Aprendiz' } };
}

const FLORESTA_ZERADA = markCleared({ cleared: [], totems: {} }, { dungeon: 'floresta', difficulty: 'normal' });

function casa(walker: Walker): { col: number; row: number } {
  return { col: Math.floor(walker.x / TILE_UNITS), row: Math.floor(walker.y / TILE_UNITS) };
}

/** Anda reto numa direção até parar (ou encostar em algo), e devolve onde parou e no quê encostou. */
function andarAteParar(planta: RoomLayout, de: Walker, x: number, y: number): { walker: Walker; tocando: string | null } {
  let walker = de;
  for (let i = 0; i < 2000; i++) {
    const passo = walkTick(planta, walker, { x, y });
    if (passo.touching) return { walker: passo.walker, tocando: passo.touching };
    if (passo.walker.x === walker.x && passo.walker.y === walker.y) return { walker, tocando: null };
    walker = passo.walker;
  }
  throw new Error('não parou');
}

describe('a planta da cidade', () => {
  it('tem o tamanho do mapa do Breno', () => {
    const planta = plantaDaCidade(true);
    expect(planta.cols).toBe(CIDADE_COLS);
    expect(planta.rows).toBe(CIDADE_ROWS);
    expect(planta.solid).toHaveLength(CIDADE_ROWS);
    expect(planta.solid.every((linha) => linha.length === CIDADE_COLS)).toBe(true);
  });

  it('cada ponto tem chão na frente, e quem aparece ali não está encostado nele', () => {
    const planta = plantaDaCidade(false);
    for (const id of new Set(PONTOS_DA_CIDADE.map((p) => p.id)) as Set<PontoDaCidade>) {
      if (id === 'troncos') continue;
      const chegada = chegadaNoPonto(id);
      const { col, row } = casa(chegada);
      expect(planta.solid[row]?.[col], id).toBe(false);
      expect(walkTick(planta, chegada, { x: 0, y: 0 }).touching, id).toBeNull();
    }
  });

  it('todas as portas se alcançam a partir da praça, com os troncos fora do caminho', () => {
    const planta = plantaDaCidade(false);
    const visto = new Set<string>();
    const fila = [casa(chegadaNoPonto('arvore'))];
    while (fila.length) {
      const { col, row } = fila.pop()!;
      const chave = `${col},${row}`;
      if (visto.has(chave) || planta.solid[row]?.[col] !== false) continue;
      visto.add(chave);
      fila.push({ col: col + 1, row }, { col: col - 1, row }, { col, row: row + 1 }, { col, row: row - 1 });
    }
    for (const id of new Set(PONTOS_DA_CIDADE.map((p) => p.id)) as Set<PontoDaCidade>) {
      if (id === 'troncos') continue;
      const { col, row } = casa(chegadaNoPonto(id));
      expect(visto.has(`${col},${row}`), id).toBe(true);
    }
  });

  it('os troncos barram o caminho da caverna até a Floresta ser zerada', () => {
    const daPraca = chegadaNoPonto('arvore');
    // Sobe pela coluna 12 até a árvore e contorna pela 11, que leva aos troncos.
    const aoLado = { ...daPraca, x: 11 * TILE_UNITS + TILE_UNITS / 2, y: 10 * TILE_UNITS + TILE_UNITS / 2 };
    expect(andarAteParar(plantaDaCidade(true), aoLado, 0, -127).tocando).toBe('troncos');
    const aberto = andarAteParar(plantaDaCidade(false), aoLado, 0, -127);
    expect(aberto.tocando).toBeNull();
    expect(casa(aberto.walker).row).toBeLessThan(5);
  });
});

describe('a cidade no jogo', () => {
  it('os troncos ficam enquanto a Floresta não é zerada no Normal', () => {
    expect(troncosNoCaminho(cidade())).toBe(true);
    expect(troncosNoCaminho(cidade(1, FLORESTA_ZERADA))).toBe(false);
    expect(plantaDaCidadeAgora(cidade(1, FLORESTA_ZERADA)).objects.some((o) => o.id === 'troncos')).toBe(false);
  });

  it('a porta da loja leva à sala da loja e abre o balcão', () => {
    const resultado = entrarNoPonto(cidade(), 'loja', seededRng(1), null, () => 1000);
    expect(celulaAtual(resultado.estado)?.type).toBe('shop');
    expect(resultado.tela?.tipo).toBe('loja');
  });

  it('a taverna cura, e a igreja é a Encantadora (fechada no site)', () => {
    const ferido = { ...cidade(), hero: { ...cidade().hero, hp: 1 } };
    const taverna = entrarNoPonto(ferido, 'taverna');
    expect(taverna.estado.hero.hp).toBe(taverna.estado.hero.maxHp);
    expect(entrarNoPonto(cidade(), 'igreja').aviso?.texto).toBe('A porta da Encantadora está fechada.');
    expect(entrarNoPonto(cidade(), 'igreja', seededRng(1), null, undefined, true).tela?.tipo).toBe('encantadora');
  });

  it('a cabana é a Erma, e o Bram atende pelo ferreiro', () => {
    const erma = entrarNoPonto(cidade(), 'vidente');
    expect(erma.tela?.tipo).toBe('dialogo');
    expect((celulaAtual(erma.estado) as { npc?: { service: string } }).npc?.service).toBe('blessing');
    const bram = falarComOBram(cidade());
    expect(bram.tela?.tipo).toBe('dialogo');
    expect((celulaAtual(bram.estado) as { npc?: { service: string } }).npc?.service).toBe('barter');
    // Fechar a conversa devolve o herói à porta do ferreiro.
    expect(chegadaNaCidade(bram.estado as EstadoNaCidade)).toEqual(chegadaNoPonto('ferreiro'));
  });

  it('a entrada da Floresta abre o portão com a masmorra fixa', () => {
    const resultado = entrarNoPonto(cidade(), 'floresta');
    expect(resultado.tela?.tipo).toBe('portao');
    if (resultado.tela?.tipo !== 'portao') return;
    expect(resultado.tela.portao.escolha.dungeon).toBe('floresta');
    expect(resultado.tela.portao.fixa).toBe(true);
    expect(escolherMasmorra(resultado.tela.portao, 'caverna')).toBe(resultado.tela.portao);
  });

  it('entrada fechada diz o que falta, e o Aprendiz é barrado pelo guarda', () => {
    expect(entrarNoPonto(cidade(1, FLORESTA_ZERADA), 'caverna').aviso?.texto).toBe('A entrada da Caverna ainda não abre. Para entrar: Nível 15.');
    expect(entrarNoPonto(cidade(40, FLORESTA_ZERADA), 'torre').aviso?.texto).toBe('A entrada da Torre ainda não abre. Para entrar: Zere a Caverna no Normal.');
    expect(entrarNoPonto(aprendiz(), 'floresta').aviso?.titulo).toBe('Portão da Masmorra');
  });

  it('o poço ainda não faz nada, e os troncos explicam por que barram', () => {
    const estado = cidade();
    const poco = entrarNoPonto(estado, 'poco');
    expect(poco.tela).toBeNull();
    expect(poco.aviso).toBeNull();
    expect(entrarNoPonto(estado, 'troncos').aviso?.titulo).toBe('Troncos no Caminho');
  });

  it('encostar numa porta fecha "Dê o primeiro passo"', () => {
    const resultado = entrarNoPonto(cidade(), 'poco');
    expect(resultado.estado.tutorial?.completed.move).toBe(true);
  });

  it('quem carrega o jogo aparece na porta da sala; quem volta da masmorra, na entrada dela', () => {
    const naLoja = entrarNoPonto(cidade(), 'loja').estado as EstadoNaCidade;
    expect(chegadaNaCidade(naLoja)).toEqual(chegadaNoPonto('loja'));
    expect(chegadaNaCidade(cidade())).toEqual(chegadaNoPonto('arvore'));
    const daTorre: EstadoNaCidade = { ...cidade(), masmorra: { dungeon: 'torre', difficulty: 'normal' } };
    expect(chegadaNaCidade(daTorre, true)).toEqual(chegadaNoPonto('torre'));
  });
});
