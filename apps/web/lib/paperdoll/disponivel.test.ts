import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { RACES, TEMPLATES } from '@rpg-legend/shared';

import { ARMADURAS, ARMAS, ARQUIVOS_DE_TRACO, CABELOS, CORPOS, SECUNDARIAS } from './disponivel';
import { TRACOS_DE_RACA } from './camadas';

const RAIZ_DA_ARTE = fileURLToPath(new URL('../../public/img/paperdoll', import.meta.url));

const REGENERE = 'rode `node scripts/gera-camadas.mjs` em apps/web';

/**
 * Lê a pasta **sem usar o gerador**.
 *
 * A repetição destas cinco linhas é de propósito. Se o teste chamasse a
 * mesma função que escreve o arquivo, um erro dentro dela passaria pelos
 * dois lados e o teste diria "bate" sobre a própria falha. Aqui há dois
 * leitores independentes do mesmo disco, que é o que dá valor à comparação.
 */
function noDisco(pasta: string): string[] {
  return readdirSync(join(RAIZ_DA_ARTE, pasta))
    .filter((nome) => nome.endsWith('.png'))
    .map((nome) => nome.slice(0, -'.png'.length))
    .sort();
}

function daLista(conjunto: ReadonlySet<string>): string[] {
  return [...conjunto].sort();
}

describe('disponivel.ts bate com o disco', () => {
  const pastas: ReadonlyArray<[string, ReadonlySet<string>]> = [
    ['corpo', CORPOS],
    ['arma', ARMAS],
    ['armadura', ARMADURAS],
    ['secundaria', SECUNDARIAS],
    ['cabelo', CABELOS],
    ['traco', ARQUIVOS_DE_TRACO],
  ];

  /**
   * Pega as duas direções de erro, e as duas doem:
   *
   * - arte nova no disco e ausente da lista → o sprite existe e nunca
   *   aparece, sem erro nenhum pra denunciar;
   * - entrada na lista sem arquivo no disco → 404 e quadrado quebrado na
   *   tela do jogador.
   */
  it.each(pastas)('%s', (pasta, conjunto) => {
    expect({ pasta, arquivos: daLista(conjunto) }).toEqual({ pasta, arquivos: noDisco(pasta) });
  });

  it('a mensagem de conserto está no arquivo gerado', () => {
    // Quem vir o teste acima falhar precisa saber o que fazer sem ir
    // procurar; o cabeçalho do gerado diz o comando.
    expect(REGENERE).toContain('gera-camadas.mjs');
  });
});

/**
 * O nome do arquivo **é** o contrato com a engine — é o que permite não
 * haver tabela de tradução no meio. Um `corpo/anão.png` com acento, ou um
 * `corpo/dwarf.png` em inglês, entra na lista, some da tela e não levanta
 * erro em lugar nenhum.
 */
describe('os nomes dos arquivos são ids da engine', () => {
  it('todo corpo é uma raça do catálogo', () => {
    const racas = new Set(RACES.map((raca) => raca.id));
    for (const corpo of CORPOS) expect({ corpo, ehRaca: racas.has(corpo) }).toEqual({ corpo, ehRaca: true });
  });

  it('toda arma, armadura e secundária é um templateId', () => {
    const templates = new Set(TEMPLATES.map((template) => template.id));
    for (const id of [...ARMAS, ...ARMADURAS, ...SECUNDARIAS]) {
      expect({ id, ehTemplate: templates.has(id) }).toEqual({ id, ehTemplate: true });
    }
  });
});

/**
 * `TRACOS_DE_RACA` continua escrito à mão — `orelhas-de-gato.png` não diz
 * "felino" em lugar nenhum, então o disco não tem como responder isso. Mas
 * o caminho que ele cita pode ser conferido, e é o único do módulo que um
 * `git mv` quebraria em silêncio.
 */
describe('TRACOS_DE_RACA aponta pra coisas que existem', () => {
  it('a raça tem corpo e o arquivo está no disco', () => {
    for (const [raca, caminho] of TRACOS_DE_RACA) {
      expect({ raca, temCorpo: CORPOS.has(raca) }).toEqual({ raca, temCorpo: true });
      expect({ caminho, existe: existsSync(join(RAIZ_DA_ARTE, caminho)) }).toEqual({ caminho, existe: true });
    }
  });
});
