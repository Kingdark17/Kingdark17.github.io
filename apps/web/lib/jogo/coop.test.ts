import { describe, expect, it } from 'vitest';

import { seededRng } from '@rpg-legend/shared';

import { aplicarRemoto, instantaneoDaSala } from './coop';
import { rolarTudo } from './criacao';
import { entrarNaCidade, entrarNaMasmorra, type EstadoDoJogo, type EstadoNaCidade } from './estado';
import { montarSaveInicial } from './save-inicial';
import type { PerfilNaSala } from '../rede/sala';

function cidade(nome = 'Aria', semente = 3): EstadoNaCidade {
  const rng = seededRng(semente);
  return entrarNaCidade(montarSaveInicial(rolarTudo(nome, rng), rng));
}

function perfilDe(estado: EstadoDoJogo): PerfilNaSala {
  return {
    name: estado.hero.name,
    hero: estado.hero as unknown as Record<string, unknown>,
    inventory: estado.inventory,
    party: estado.party as unknown as Record<string, unknown>[],
    publicProfile: null,
  };
}

const COSMETICOS = { username: 'Aria', avatarUrl: '', frame: 'gold', nameColor: '#6ee7ff', pet: 'owl' };

describe('instantaneoDaSala', () => {
  it('leva mapa, posição, andar e missões — o que é compartilhado', () => {
    const estado = cidade();
    const pacote = instantaneoDaSala(estado, 1, 'Aria', COSMETICOS);

    expect(pacote.map).toBe(estado.map);
    expect(pacote.pos).toBe(estado.pos);
    expect(pacote.floor).toBe(estado.floor);
    expect(pacote.mapMode).toBe('city');
  });

  it('manda só o próprio papel em profiles', () => {
    const pacote = instantaneoDaSala(cidade(), 2, 'Aria', COSMETICOS);
    const perfis = pacote.profiles as Record<string, unknown>;

    expect(Object.keys(perfis)).toEqual(['2']);
  });

  it('o cosmético viaja junto do perfil', () => {
    const pacote = instantaneoDaSala(cidade(), 1, 'Aria', COSMETICOS);
    const meu = (pacote.profiles as Record<string, { publicProfile: unknown }>)['1'];

    expect(meu.publicProfile).toEqual(COSMETICOS);
  });
});

describe('aplicarRemoto', () => {
  it('adota o mapa e a posição do parceiro', () => {
    const meu = cidade('Aria', 3);
    const doOutro = entrarNaMasmorra(cidade('Bree', 9), seededRng(9));

    const depois = aplicarRemoto(meu, instantaneoDaSala(doOutro, 1, 'Bree', null), perfilDe(meu));

    expect(depois.mapMode).toBe('dungeon');
    expect(depois.map).toEqual(doOutro.map);
    expect(depois.pos).toEqual(doOutro.pos);
    expect(depois.floor).toBe(doOutro.floor);
  });

  it('o herói continua sendo o meu, não o do parceiro', () => {
    const meu = cidade('Aria', 3);
    const doOutro = cidade('Bree', 9);

    const depois = aplicarRemoto(meu, instantaneoDaSala(doOutro, 1, 'Bree', null), perfilDe(meu));

    expect(depois.hero.name).toBe('Aria');
    expect(depois.hero.name).not.toBe(doOutro.hero.name);
  });

  it('sem perfil meu no pacote, o herói local fica como está', () => {
    const meu = cidade();
    const depois = aplicarRemoto(meu, instantaneoDaSala(cidade('Bree', 9), 1, 'Bree', null), undefined);

    expect(depois.hero).toBe(meu.hero);
    expect(depois.inventory).toBe(meu.inventory);
  });

  it('pacote sem mapa ou sem posição não apaga a masmorra de ninguém', () => {
    const meu = entrarNaMasmorra(cidade(), seededRng(3));

    expect(aplicarRemoto(meu, { floor: 9 }, perfilDe(meu))).toBe(meu);
    expect(aplicarRemoto(meu, { map: [], pos: { x: 0, y: 0 } }, perfilDe(meu))).toBe(meu);
    expect(aplicarRemoto(meu, { map: meu.map }, perfilDe(meu))).toBe(meu);
  });

  it('a mochila que volta é a que o servidor devolveu no meu perfil', () => {
    const meu = cidade();
    const comMenos: PerfilNaSala = { ...perfilDe(meu), inventory: [] };

    const depois = aplicarRemoto(meu, instantaneoDaSala(cidade('Bree', 9), 1, 'Bree', null), comMenos);

    expect(depois.inventory).toEqual([]);
  });
});
