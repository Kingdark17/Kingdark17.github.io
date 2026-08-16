'use client';

/**
 * A ponte entre a sessão de rede (que vive fora do React, em `sala.ts`) e
 * a tela.
 *
 * `useSyncExternalStore` é exatamente a ferramenta pra isto: o React
 * assina o módulo, e o instantâneo imutável decide sozinho se houve
 * mudança. No servidor não há socket, então o instantâneo do servidor é o
 * estado desligado — é o que evita erro de hidratação.
 */

import { useSyncExternalStore } from 'react';

import { assinar, instantanea, type EstadoDaSala } from './sala';

const DESLIGADO: EstadoDaSala = {
  fase: 'desligado',
  eu: '',
  codigo: '',
  papel: null,
  perfis: {},
  remoto: null,
  turno: 1,
  travado: false,
  convite: null,
  mensagem: null,
  recado: '',
  erro: '',
};

export function useSala(): EstadoDaSala {
  return useSyncExternalStore(assinar, instantanea, () => DESLIGADO);
}
