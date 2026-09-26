/**
 * Lê `public/img/paperdoll/` e escreve `lib/paperdoll/disponivel.ts`.
 *
 * Existe porque a lista do que há em disco **precisava ser escrita à mão**:
 * o navegador não enxerga o sistema de arquivos, e pedir `corpo/anao.png`
 * sem saber se existe rende 404 e um quadrado quebrado na tela. Só que
 * lista escrita à mão envelhece calada — e o preço aparecia no lugar
 * errado: soltar um sprite novo não bastava, tinha que lembrar de editar
 * um `Set` num arquivo que nada indicava.
 *
 * Agora quem lê o disco é este script, no seu computador, e o resultado
 * fica versionado. O navegador recebe a lista pronta e continua sem tocar
 * em `fs`.
 *
 * **Não é preciso lembrar de rodar.** `disponivel.test.ts` compara o
 * arquivo gerado com o disco e falha dizendo o comando quando os dois
 * divergem — nas duas direções: arte nova sem regenerar, e entrada na
 * lista cujo arquivo sumiu.
 *
 *     node scripts/gera-camadas.mjs
 */

import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ_DA_ARTE = join(AQUI, '..', 'public', 'img', 'paperdoll');
export const ARQUIVO_GERADO = join(AQUI, '..', 'lib', 'paperdoll', 'disponivel.ts');

/**
 * As pastas cujo conteúdo vira lista, e o nome da constante de cada uma.
 *
 * **A ordem desta lista é a ordem das camadas**, de trás pra frente, e é a
 * do doc do Breno — as treze numeradas em "Lembrando da ordem das layers".
 * `montarCamadas` desenha nesta ordem, e um teste confere que as duas não
 * se descolam.
 *
 * **A pasta é o tipo da camada; o arquivo é o id.** O vocabulário também é
 * o dele, pra arte nova cair na pasta óbvia sem tabela de tradução — e o
 * sufixo do arquivo que ele entrega **diz a pasta**:
 *
 * | arquivo dele | pasta | o que é |
 * |---|---|---|
 * | `X_back_body.png` | `back` | asa, cauda da raça — atrás de tudo |
 * | `X_hadd_body.png` | `hadd` | a parte do elmo que fica **atrás** da cabeça |
 * | `X_badd_body.png` | `badd` | a parte do peitoral que fica **atrás** do tronco |
 * | `X_ladd_body.png` | `ladd` | a parte da perneira que fica **atrás** da perna |
 * | `X_body.png` | a pasta do slot | a peça em si |
 * | `X_add_body.png` | `traco` | chifre, auréola — sobrevive à armadura |
 * | `X_icon.png` | `img/armor/` | o ícone da mochila |
 *
 * **Os três `add` são a parte de trás, e não um adicional por cima.** Esta
 * tabela dizia o contrário até 2026-09-26, e o preço foi visível: o manto
 * do mago desenhava as costas por cima do peito, e quem vestia o Robe
 * Arcano ficava sem rosto e sem mãos — uma laje roxa com chapéu. Foi assim
 * que o Breno printou no doc ("Erro de layer").
 *
 * Eles existem porque uma peça não é uma camada só: o corpo tem que passar
 * **no meio** do manto, com as costas atrás e o peito na frente. Achatar
 * num PNG só é justamente o que impediria isso.
 *
 * `base/` fica de fora: calça e roupa entram sempre, não são escolha de
 * ninguém. `traco/` entra como lista de arquivos, e não de ids, porque
 * `orelhas-de-gato.png` não diz "felino" — quem liga raça a traço é o mapa
 * escrito à mão em `camadas.ts`, que é decisão e não inventário.
 */
export const PASTAS = [
  { pasta: 'back', constante: 'COSTAS', doc: 'Asa e cauda da raça, atrás de tudo. Pelo id da raça.' },
  { pasta: 'hadd', constante: 'COSTAS_DO_ELMO', doc: 'A parte do elmo que fica **atrás** da cabeça. Pelo `templateId`.' },
  { pasta: 'badd', constante: 'COSTAS_DO_PEITORAL', doc: 'A parte do peitoral que fica **atrás** do tronco. Pelo `templateId`.' },
  { pasta: 'ladd', constante: 'COSTAS_DA_PERNEIRA', doc: 'A parte da perneira que fica **atrás** da perna. Pelo `templateId`.' },
  { pasta: 'corpo', constante: 'CORPOS', doc: 'Raças com corpo desenhado.' },
  { pasta: 'calca', constante: 'CALCAS', doc: 'Perneira e calça com camada. Pelo `templateId`.' },
  { pasta: 'botas', constante: 'BOTAS', doc: 'Calçado com camada — o nome do arquivo é o `templateId`.' },
  { pasta: 'armadura', constante: 'ARMADURAS', doc: 'Peitoral e manto com camada.' },
  { pasta: 'cabelo', constante: 'CABELOS', doc: 'Cabelos disponíveis.' },
  { pasta: 'elmo', constante: 'ELMOS', doc: 'Elmo e chapéu com camada. Pelo `templateId`.' },
  { pasta: 'acessorio', constante: 'ACESSORIOS', doc: 'Acessórios com camada — o nome do arquivo é o `templateId`.' },
  { pasta: 'traco', constante: 'ARQUIVOS_DE_TRACO', doc: 'Arquivos de traço de raça, pelo nome — ver `TRACOS_DE_RACA`.' },
  { pasta: 'arma', constante: 'ARMAS', doc: 'Armas com camada — o nome do arquivo é o `templateId`.' },
  { pasta: 'secundaria', constante: 'SECUNDARIAS', doc: 'O que a mão secundária pode segurar.' },
];

/** Os `.png` de uma pasta, sem extensão, em ordem alfabética estável. */
export function lerPasta(pasta) {
  let arquivos;
  try {
    arquivos = readdirSync(join(RAIZ_DA_ARTE, pasta));
  } catch {
    // Pasta que ainda não existe é lista vazia, não erro: dá pra gerar num
    // clone recém-feito sem toda a arte presente.
    return [];
  }
  return arquivos
    .filter((nome) => nome.endsWith('.png'))
    .map((nome) => nome.slice(0, -'.png'.length))
    .sort();
}

/** O inventário completo, do jeito que o arquivo gerado o expressa. */
export function lerTudo() {
  const inventario = {};
  for (const { pasta, constante } of PASTAS) inventario[constante] = lerPasta(pasta);
  return inventario;
}

export function montarArquivo(inventario) {
  const blocos = PASTAS.map(({ constante, doc, pasta }) => {
    const itens = inventario[constante];
    const lista = itens.length ? itens.map((item) => `'${item}'`).join(', ') : '';
    return `/** ${doc} (${itens.length} em \`public/img/paperdoll/${pasta}/\`) */\nexport const ${constante}: ReadonlySet<string> = new Set([${lista}]);`;
  });

  return `/* GERADO POR scripts/gera-camadas.mjs — NÃO EDITE À MÃO.
 *
 * Para acrescentar arte: solte o \`.png\` de 64×64 na pasta certa em
 * \`public/img/paperdoll/\` e rode
 *
 *     node scripts/gera-camadas.mjs
 *
 * Se esquecer, \`disponivel.test.ts\` falha e diz isto de novo.
 *
 * O nome do arquivo é o contrato: para corpo é o \`id\` da raça
 * (\`RACES[].id\`), para arma/armadura/secundária é o \`templateId\` do item.
 * Sem tabela de tradução no meio, as duas listas não têm como divergir em
 * silêncio.
 */

${blocos.join('\n\n')}
`;
}

// `import.meta.main` não existe em toda versão de Node; comparar o caminho
// é o teste que funciona nas duas, e mantém o módulo importável pelo teste
// sem escrever arquivo nenhum.
/**
 * Em que lista cada slot procura a sua arte — o mesmo pareamento que
 * `montarCamadas` faz na hora de vestir.
 *
 * Existe porque **slot e categoria deixaram de ser a mesma palavra**: elmo,
 * perneira, bota e peitoral são todos `category: 'armadura'` no catálogo, e
 * desenham em quatro pastas diferentes. Sem este mapa a conta abaixo
 * procurava os quatro em `armadura/` e dizia que faltavam — quatro peças
 * dadas como não desenhadas no dia seguinte ao de elas entrarem.
 */
const LISTA_DO_SLOT = {
  arma: 'ARMAS',
  secundaria: 'SECUNDARIAS',
  armadura: 'ARMADURAS',
  elmo: 'ELMOS',
  calca: 'CALCAS',
  botas: 'BOTAS',
  acessorio: 'ACESSORIOS',
};

/**
 * O que a engine conhece e o disco ainda não tem.
 *
 * Isto já foi comentário no código (`Faltam anao, orc, ...`) e envelheceu
 * calado — o de armas dizia quatro quando eram seis, e ninguém lê um
 * comentário desses pra descobrir que está errado, só pra planejar o
 * trabalho. Agora é uma conta contra o catálogo, feita na hora.
 *
 * A pergunta é **por slot, não por categoria**: o que decide onde a peça
 * desenha é `slotForTemplate`, que é o mesmo que o jogo chama pra equipar.
 *
 * `secundaria` só lista quem **declara** o slot (hoje, o escudo). Arma de
 * uma mão pode ir pra mão secundária sem declarar nada, e pedir sprite de
 * canhoto pra todas encheria o relatório de trabalho que ninguém pediu.
 */
async function oQueFalta(inventario) {
  const { RACES, TEMPLATES, isEquippable, slotForTemplate } = await import('@rpg-legend/shared');

  const faltamPorSlot = new Map(Object.keys(LISTA_DO_SLOT).map((slot) => [slot, []]));
  for (const template of TEMPLATES) {
    if (!isEquippable(template.category)) continue;
    const slot = slotForTemplate(template);
    const lista = inventario[LISTA_DO_SLOT[slot]];
    if (lista && !lista.has(template.id)) faltamPorSlot.get(slot).push(template.id);
  }

  return [
    { o_que: 'corpo', faltam: RACES.map((r) => r.id).filter((id) => !inventario.CORPOS.has(id)) },
    ...[...faltamPorSlot].map(([slot, faltam]) => ({ o_que: slot, faltam })),
  ];
}

// `import.meta.main` não existe em toda versão de Node; comparar o caminho
// é o teste que funciona nas duas, e mantém o módulo importável pelo teste
// sem escrever arquivo nenhum.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const inventario = lerTudo();
  writeFileSync(ARQUIVO_GERADO, montarArquivo(inventario), 'utf8');

  const total = Object.values(inventario).reduce((soma, lista) => soma + lista.length, 0);
  console.log(`disponivel.ts atualizado — ${total} sprites em ${PASTAS.length} pastas.\n`);
  for (const { constante } of PASTAS) {
    console.log(`  ${constante.padEnd(18)} ${inventario[constante].join(', ') || '(vazio)'}`);
  }

  // Conjuntos, pra `oQueFalta` poder perguntar `.has()` como o resto do código.
  const comoConjuntos = Object.fromEntries(Object.entries(inventario).map(([chave, lista]) => [chave, new Set(lista)]));

  try {
    console.log('\nfalta desenhar (64×64, contorno rgb(26,11,9), fundo transparente):');
    for (const { o_que, faltam } of await oQueFalta(comoConjuntos)) {
      console.log(`  ${o_que.padEnd(10)} ${faltam.length ? `${faltam.length} — ${faltam.join(', ')}` : 'nenhum'}`);
    }
  } catch (erro) {
    // Sem a engine construída (`pnpm --filter @rpg-legend/shared build`) o
    // inventário acima continua valendo: a conta do que falta é extra, e
    // não pode derrubar a geração.
    console.log(`  (não deu pra conferir contra o catálogo: ${erro.message})`);
  }
}
