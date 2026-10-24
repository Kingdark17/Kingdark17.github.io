import { describe, expect, it } from 'vitest';

import { CAMADAS_DAS_SALAS, camadasDaSala } from './arte-da-sala.js';

describe('a arte das salas', () => {
  it('a sala da Floresta leva o chão, o caminho só das portas que tem e as copas por cima', () => {
    expect(camadasDaSala('floresta', ['N', 'S'])!.map((c) => c.arquivo)).toEqual(['1_grama', '2_caminho_cima', '5_caminho_baixo', '6_floresta_cima']);
    expect(camadasDaSala('floresta', ['E', 'W'])!.map((c) => c.arquivo)).toEqual(['1_grama', '3_caminho_direita', '4_caminho_esquerda', '6_floresta_cima']);
  });

  it('as copas ficam por cima e o resto no chão', () => {
    const camadas = camadasDaSala('floresta', ['N', 'S', 'E', 'W'])!;
    expect(camadas.filter((c) => c.plano === 'cima').map((c) => c.arquivo)).toEqual(['6_floresta_cima']);
    expect(camadas).toHaveLength(CAMADAS_DAS_SALAS.floresta!.length);
  });

  it('masmorra sem arte fica com os quadradinhos', () => {
    expect(camadasDaSala('caverna', ['N'])).toBeNull();
    expect(camadasDaSala('torre', [])).toBeNull();
  });
});
