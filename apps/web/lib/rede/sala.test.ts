import { describe, expect, it } from 'vitest';

import { preservarMochila, type PapelNaSala, type PerfilNaSala } from './sala';

function perfil(nome: string, extras: Partial<PerfilNaSala> = {}): PerfilNaSala {
  return { name: nome, hero: { level: 3 }, party: [], publicProfile: null, ...extras };
}

const MOCHILA = [{ uid: 'a' }, { uid: 'b' }];

function guardados(mochila?: unknown[]): Partial<Record<PapelNaSala, PerfilNaSala>> {
  return { 1: perfil('Aria', mochila === undefined ? {} : { inventory: mochila }) };
}

/**
 * O acordo dos dois lados do fio: a mochila só viaja quando muda.
 *
 * Medido num save de andar 8 com 76 itens, ela era 11,5 KB de um pacote de
 * 20,3 KB — e o pacote sai a cada ação de jogo, nos dois sentidos. O que
 * viajava não era nem a mochila do parceiro (essa já tinha saído): era a
 * **sua própria**, ecoada de volta pelo servidor sem ter mudado.
 *
 * O preço de economizar isso é que "ausente" passa a significar algo. Ler
 * ausente como vazio apaga a mochila do jogador, e a perda volta pro
 * servidor na sincronização seguinte — vira definitiva. É a mesma
 * armadilha que `sanitizeProfile` documenta do lado do servidor.
 */
describe('preservarMochila', () => {
  it('mochila ausente mantém a que já estava guardada', () => {
    const recebido = perfil('Aria');

    const resultado = preservarMochila(guardados(MOCHILA), 1, recebido);

    expect(resultado.inventory).toBe(MOCHILA);
    expect(resultado.name).toBe('Aria');
  });

  it('mochila nova substitui a guardada', () => {
    const nova = [{ uid: 'z' }];

    expect(preservarMochila(guardados(MOCHILA), 1, perfil('Aria', { inventory: nova })).inventory).toBe(nova);
  });

  /** A distinção inteira: `[]` é o jogador tendo esvaziado a mochila. */
  it('mochila vazia passa reto — esvaziar é uma jogada válida', () => {
    expect(preservarMochila(guardados(MOCHILA), 1, perfil('Aria', { inventory: [] })).inventory).toEqual([]);
  });

  it('não inventa mochila quando não havia nenhuma guardada', () => {
    expect(preservarMochila(guardados(), 1, perfil('Aria')).inventory).toBeUndefined();
    expect(preservarMochila({}, 1, perfil('Aria')).inventory).toBeUndefined();
  });

  /**
   * O perfil do parceiro **nunca** tem mochila, por outro motivo: a tela do
   * outro jogador não a lê. Preservar por papel é o que impede a mochila de
   * um vazar pro instantâneo do outro.
   */
  it('cada papel guarda a sua', () => {
    const anteriores: Partial<Record<PapelNaSala, PerfilNaSala>> = {
      1: perfil('Aria', { inventory: MOCHILA }),
      2: perfil('Bree'),
    };

    expect(preservarMochila(anteriores, 2, perfil('Bree')).inventory).toBeUndefined();
    expect(preservarMochila(anteriores, 1, perfil('Aria')).inventory).toBe(MOCHILA);
  });

  it('não altera o perfil recebido nem o guardado', () => {
    const anteriores = guardados(MOCHILA);
    const recebido = perfil('Aria');

    preservarMochila(anteriores, 1, recebido);

    expect(recebido.inventory).toBeUndefined();
    expect(anteriores[1]?.inventory).toBe(MOCHILA);
  });
});
