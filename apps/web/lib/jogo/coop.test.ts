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

  describe('a mochila só viaja quando muda', () => {
    function perfilDoPacote(pacote: Record<string, unknown>, papel = 1): Record<string, unknown> {
      return (pacote.profiles as Record<string, Record<string, unknown>>)[String(papel)];
    }

    it('vai inteira quando nada foi enviado ainda', () => {
      const estado = cidade();
      const perfil = perfilDoPacote(instantaneoDaSala(estado, 1, 'Aria', COSMETICOS, null));

      expect(perfil.inventory).toBe(estado.inventory);
    });

    // O ganho: andar, lutar ou abrir porta não mexem na mochila, e ela é o
    // pedaço grande do pacote — 10,5 KB de 14 KB num save com 76 itens.
    it('sai do pacote quando é a mesma de antes', () => {
      const estado = cidade();
      const perfil = perfilDoPacote(instantaneoDaSala(estado, 1, 'Aria', COSMETICOS, estado.inventory));

      expect(perfil).not.toHaveProperty('inventory');
      // O resto do perfil continua indo: o herói muda a cada golpe.
      expect(perfil.hero).toBe(estado.hero);
      expect(perfil.party).toBe(estado.party);
    });

    it('volta a viajar assim que muda', () => {
      const estado = cidade();
      const outra = [...estado.inventory];
      const perfil = perfilDoPacote(instantaneoDaSala(estado, 1, 'Aria', COSMETICOS, outra));

      // Mesmo conteúdo, referência diferente: a engine troca o array ao
      // mudar, então referência é o sinal — e errar pro lado de enviar
      // demais custa banda, enquanto errar pro outro custa a mochila.
      expect(perfil.inventory).toBe(estado.inventory);
    });

    // Sem argumento nenhum é o mesmo que "não sei o que o servidor tem", e
    // aí manda. É o que mantém as chamadas antigas de 4 argumentos corretas.
    it('manda quando não recebe a referência anterior', () => {
      const estado = cidade();
      expect(perfilDoPacote(instantaneoDaSala(estado, 1, 'Aria', COSMETICOS))).toHaveProperty('inventory');
    });
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

  /**
   * O par do teste acima, e a diferença que segura a regra inteira:
   * mochila **vazia** é esvaziar de verdade; mochila **ausente** é "não
   * mudou". O servidor parou de reenviá-la a cada ação (eram 11,5 KB de um
   * pacote de 20,3 KB, ecoados sem novidade), e ler ausência como `[]`
   * apagaria a mochila do jogador a cada passo — e a perda viajaria de
   * volta na sincronização seguinte, virando definitiva.
   */
  it('mochila ausente no perfil mantém a que eu já tinha', () => {
    const meu = cidade();
    const semMochila: PerfilNaSala = { ...perfilDe(meu) };
    delete semMochila.inventory;

    const depois = aplicarRemoto(meu, instantaneoDaSala(cidade('Bree', 9), 1, 'Bree', null), semMochila);

    expect(depois.inventory).toBe(meu.inventory);
    expect(depois.inventory.length).toBeGreaterThan(0);
  });
});
