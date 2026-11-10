import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ARMADURAS_DO_MINI,
  CABELOS_DO_MINI,
  CALCAS_DO_MINI,
  CORPOS_DO_MINI,
  ELMOS_DO_MINI,
  EXTRAS_DO_MINI,
  montarMini,
  SECUNDARIAS_DO_MINI,
  type LadoDoMini,
} from './mini';

const DISCO = path.resolve(__dirname, '../../public/img/mini');
const LADOS: LadoDoMini[] = ['frente', 'costas'];

function noDisco(lado: LadoDoMini, pasta: string): string[] {
  const dir = path.join(DISCO, lado, pasta);
  return fs.existsSync(dir) ? fs.readdirSync(dir).map((nome) => nome.replace(/\.png$/, '')).sort() : [];
}

describe('o mini boneco', () => {
  it('o que está escrito é o que está em disco, dos dois lados', () => {
    for (const lado of LADOS) {
      expect(noDisco(lado, 'corpo')).toEqual([...CORPOS_DO_MINI].sort());
      expect(noDisco(lado, 'extra')).toEqual([...EXTRAS_DO_MINI[lado]].sort());
      expect(noDisco(lado, 'cabelo')).toEqual([...CABELOS_DO_MINI].sort());
      expect(noDisco(lado, 'calca')).toEqual([...CALCAS_DO_MINI].sort());
      expect(noDisco(lado, 'armadura')).toEqual([...ARMADURAS_DO_MINI].sort());
      expect(noDisco(lado, 'elmo')).toEqual([...ELMOS_DO_MINI].sort());
      expect(noDisco(lado, 'secundaria')).toEqual([...SECUNDARIAS_DO_MINI].sort());
      expect(noDisco(lado, 'base')).toEqual(['calca', 'roupa']);
    }
  });

  it('sem raça ou sem mini corpo, não há camada (a tela mostra o emoji)', () => {
    expect(montarMini({ raca: null }, 'frente')).toEqual([]);
    expect(montarMini({ raca: 'anao' }, 'costas')).toEqual([]);
  });

  it('o humano pelado de equipamento sai com a roupa de baixo e o cabelo padrão', () => {
    expect(montarMini({ raca: 'humano' }, 'frente')).toEqual([
      '/img/mini/frente/corpo/humano.png',
      '/img/mini/frente/base/calca.png',
      '/img/mini/frente/base/roupa.png',
      '/img/mini/frente/cabelo/curto.png',
    ]);
  });

  it('veste o que tem arte, na ordem, e ignora o que não tem', () => {
    const vestido = { raca: 'celestial', armadura: 'placas', elmo: 'robe_chapeu', calca: 'placas_calca', secundaria: 'escudo', botas: 'botas', arma: 'espada', cabelo: 'longo' };
    expect(montarMini(vestido, 'costas').map((c) => c.replace('/img/mini/costas/', ''))).toEqual([
      'corpo/celestial.png',
      'base/calca.png',
      'base/roupa.png',
      'calca/placas_calca.png',
      'armadura/placas.png',
      'cabelo/longo.png',
      'elmo/robe_chapeu.png',
      'extra/celestial.png',
      'secundaria/escudo.png',
    ]);
    // Couro não tem arte mini: fica a roupa de baixo.
    expect(montarMini({ raca: 'humano', armadura: 'couro' }, 'frente')).not.toContain('/img/mini/frente/armadura/couro.png');
  });

  it('felino e morto-vivo não levam cabelo; a fada só tem extra de costas, o orc só de frente', () => {
    expect(montarMini({ raca: 'felino', cabelo: 'longo' }, 'frente').some((c) => c.includes('/cabelo/'))).toBe(false);
    expect(montarMini({ raca: 'morto_vivo' }, 'costas').some((c) => c.includes('/cabelo/'))).toBe(false);
    expect(montarMini({ raca: 'fada' }, 'frente').some((c) => c.includes('/extra/'))).toBe(false);
    expect(montarMini({ raca: 'fada' }, 'costas')).toContain('/img/mini/costas/extra/fada.png');
    expect(montarMini({ raca: 'orc' }, 'frente')).toContain('/img/mini/frente/extra/orc.png');
    expect(montarMini({ raca: 'orc' }, 'costas').some((c) => c.includes('/extra/'))).toBe(false);
  });
});
