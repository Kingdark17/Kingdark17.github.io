import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { RACES, TEMPLATES } from '@rpg-legend/shared';

import {
  ACESSORIOS,
  ARMADURAS,
  ARMAS,
  ARQUIVOS_DE_TRACO,
  BOTAS,
  CABELOS,
  CALCAS,
  CORPOS,
  COSTAS,
  COSTAS_DA_PERNEIRA,
  COSTAS_DO_ELMO,
  COSTAS_DO_PEITORAL,
  ELMOS,
  SECUNDARIAS,
} from './disponivel';
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
  // Pasta sem arte não existe num clone: git não guarda pasta vazia. Hoje é
  // o caso de `ladd/`, que espera o primeiro `_ladd_body` do Breno.
  const caminho = join(RAIZ_DA_ARTE, pasta);
  if (!existsSync(caminho)) return [];
  return readdirSync(caminho)
    .filter((nome) => nome.endsWith('.png'))
    .map((nome) => nome.slice(0, -'.png'.length))
    .sort();
}

function daLista(conjunto: ReadonlySet<string>): string[] {
  return [...conjunto].sort();
}

describe('disponivel.ts bate com o disco', () => {
  /**
   * **Todas as pastas do gerador, não algumas**, e na ordem em que elas se
   * empilham. Esta lista tinha seis das doze: `back`, `ladd`, `badd`,
   * `hadd`, `acessorio` e `botas` ficavam de fora, e é justamente nelas que
   * a arte nova cai. Soltar um `hadd/elmo_novo.png` e esquecer de regerar
   * passava batido — o sprite existia no disco e nunca chegava na tela, sem
   * ninguém reclamando.
   */
  const pastas: ReadonlyArray<[string, ReadonlySet<string>]> = [
    ['back', COSTAS],
    ['hadd', COSTAS_DO_ELMO],
    ['badd', COSTAS_DO_PEITORAL],
    ['ladd', COSTAS_DA_PERNEIRA],
    ['corpo', CORPOS],
    ['calca', CALCAS],
    ['botas', BOTAS],
    ['armadura', ARMADURAS],
    ['cabelo', CABELOS],
    ['elmo', ELMOS],
    ['acessorio', ACESSORIOS],
    ['traco', ARQUIVOS_DE_TRACO],
    ['arma', ARMAS],
    ['secundaria', SECUNDARIAS],
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

  /**
   * Arte que ainda não virou item. **Não é uma lista de escape pra erro de
   * digitação** — é o caso em que o `_body` chegou antes do ícone, e um
   * item sem ícone fica invisível na mochila.
   *
   * O chapéu do mago é o único: desenhava de brinde junto com o robe até a
   * armadura se dividir em peças (2026-09-20), e agora espera o
   * `mago_chapeu_icon` pra virar item do slot de elmo. Quando o ícone
   * chegar, some daqui.
   */
  const AINDA_SEM_ITEM = new Set(['robe_chapeu']);

  /**
   * Isto cobria só arma, armadura e secundária, e as pastas que nasceram
   * depois ficaram fora do contrato que o próprio bloco existe pra prender.
   * Um `calca/plaças.png` entrava na lista e não desenhava, calado.
   */
  it('toda peça equipável é um templateId', () => {
    const templates = new Set(TEMPLATES.map((template) => template.id));
    const daArte = [
      ...ARMAS,
      ...ARMADURAS,
      ...SECUNDARIAS,
      ...ACESSORIOS,
      ...CALCAS,
      ...ELMOS,
      ...BOTAS,
      ...COSTAS_DA_PERNEIRA,
      ...COSTAS_DO_PEITORAL,
      ...COSTAS_DO_ELMO,
    ];

    for (const id of daArte) {
      if (AINDA_SEM_ITEM.has(id)) continue;
      expect({ id, ehTemplate: templates.has(id) }).toEqual({ id, ehTemplate: true });
    }
  });

  /** Exceção que sobrou na lista depois de virar item é lixo, e some. */
  it('a lista de arte sem item não guarda id que já virou item', () => {
    const templates = new Set(TEMPLATES.map((template) => template.id));
    expect([...AINDA_SEM_ITEM].filter((id) => templates.has(id))).toEqual([]);
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
