/**
 * Que camadas de paperdoll existem, e em que ordem elas se empilham.
 *
 * **O que existe em disco não mora mais aqui.** `disponivel.ts` é gerado
 * por `scripts/gera-camadas.mjs` a partir de `public/img/paperdoll/`, e
 * `disponivel.test.ts` falha se o gerado e o disco divergirem. Antes esta
 * lista era escrita à mão, e o preço aparecia no lugar errado: soltar um
 * sprite novo não bastava — tinha que lembrar de editar um `Set`. Os
 * comentários de "faltam tais e tais" também envelheciam calados, e já
 * estiveram errados (o de armas dizia quatro quando eram seis).
 *
 * A lista continua existindo porque o navegador não enxerga o disco: pedir
 * `corpo/anao.png` sem saber se existe rende 404 e um quadrado quebrado na
 * tela. A ausência é dado, não acidente — a tela pergunta antes de
 * desenhar e mostra outra coisa quando não há arte.
 *
 * O que **fica** escrito à mão são as decisões, não o inventário:
 * `TRACOS_DE_RACA` (que arquivo pertence a que raça) e `SEM_CABELO`. Essas
 * o disco não tem como responder.
 *
 * Os nomes de arquivo são **exatamente os ids do catálogo da engine**
 * (`RACES` em `packages/shared/src/hero/catalog.ts`, `weaponTemplate` em
 * `CLASSES`). Isso é de propósito: sem tabela de tradução no meio, não há
 * como as duas listas divergirem em silêncio — e há teste conferindo.
 */

import { templateById } from '@rpg-legend/shared';

import {
  ACESSORIOS,
  ADICIONAIS_DE_CABECA,
  ADICIONAIS_DE_PERNA,
  ADICIONAIS_DE_TRONCO,
  ARMADURAS,
  ARMAS,
  CORPOS,
  COSTAS,
  SECUNDARIAS,
} from './disponivel';

export {
  ACESSORIOS,
  ADICIONAIS_DE_CABECA,
  ADICIONAIS_DE_PERNA,
  ADICIONAIS_DE_TRONCO,
  ARMADURAS,
  ARMAS,
  CORPOS,
  COSTAS,
  SECUNDARIAS,
};

const RAIZ = '/img/paperdoll';

/**
 * **Acessório tem camada — e este comentário já dizia o contrário.**
 *
 * A versão antiga argumentava que anel, amuleto, botas e colar não mudam a
 * silhueta o bastante pra valer uma camada. Era uma decisão defensável
 * enquanto não havia arte; o Breno pediu a camada no doc e desenhou os dois
 * amuletos, o que encerra o argumento. É por isso que a pasta de traços se
 * chama `traco/` e não `acessorio/` — o nome estava reservado, e agora é
 * usado pelo que ele diz.
 *
 * **Por cima da armadura**, e isso foi decidido olhando: por baixo do
 * peitoral de placas o amuleto some inteiro, e uma camada que não aparece
 * pra quem veste armadura não serve de nada. Por cima ele lê como pingente
 * sobre a couraça, que é o que se espera.
 *
 * Continua antes do traço da raça: o traço é o último de propósito (ver
 * `TRACOS_DE_RACA`), e equipamento não passa na frente de quem a pessoa é.
 */

/**
 * O que a raça **não perde ao vestir armadura**.
 *
 * As orelhas do felino são a primeira; virão outras, uma por raça com
 * traço marcante. Elas não são item nem equipamento — ninguém as escolhe,
 * nem as tira. Vêm da raça e ficam.
 *
 * **Desenhadas por último entre as do corpo, depois da armadura e do
 * cabelo.** É o ponto inteiro: o capacete da armadura de placas cobre a
 * cabeça, e sem esta camada por cima o felino de armadura fica idêntico ao
 * humano de armadura. A pessoa escolheu a raça e deixaria de vê-la
 * justamente quando o personagem fica mais forte.
 *
 * Este mapa é escrito à mão porque é **decisão**: `orelhas-de-gato.png`
 * não diz "felino" em lugar nenhum. O disco lista os arquivos
 * (`ARQUIVOS_DE_TRACO`); quem os liga a uma raça é aqui, e há teste
 * conferindo que todo caminho citado existe.
 */
export const TRACOS_DE_RACA: ReadonlyMap<string, string> = new Map([
  ['felino', 'traco/orelhas-de-gato.png'],
  ['draconato', 'traco/chifres-de-dragao.png'],
  ['celestial', 'traco/aureola.png'],
]);

/**
 * Corpos que já vêm com a cabeça resolvida: o felino tem orelhas e pelo
 * próprios, o morto-vivo é caveira. Cabelo humano por cima dos dois fica
 * grotesco, então nem entra.
 *
 * **O critério não é o gosto de quem lê o código, é como a arte foi
 * desenhada.** Quem leva cabelo tem uma calota parcial no topo da cabeça,
 * esperando a camada; quem não leva tem a cabeça inteira resolvida.
 *
 * Já se contou os pixels claros e escuros do topo (linhas 6–10) pra separar
 * os dois grupos, e **essa conta não presta** — ela mede tinta, não
 * anatomia. Quem revelou isso foi o orc: o Breno mandou o mesmo desenho em
 * duas cores, e o verde e o cinza caíram em grupos diferentes sendo pixel
 * por pixel a mesma silhueta. O número servia pro draconato por sorte, e
 * teria mentido aqui.
 *
 * O que decide é a **forma**: pelo denso (felino) e caveira lisa
 * (morto_vivo) resolvem a cabeça sozinhos; cabeça humanoide comum espera a
 * camada. Goblin e orc são cabeça humanoide comum, então levam.
 */
const SEM_CABELO: ReadonlySet<string> = new Set(['felino', 'morto_vivo']);

/** O único cabelo desenhado até agora. Ver `CABELOS` no arquivo gerado. */
const CABELO_PADRAO = 'masculino';

export interface Vestimenta {
  /** Id da raça (`RACES[].id`). */
  raca: string | null;
  /** `templateId` do que está na mão principal. */
  arma?: string | null;
  /** `templateId` do que está no slot `armadura` — o peitoral. */
  armadura?: string | null;
  /** `templateId` do que está no slot `elmo`. */
  elmo?: string | null;
  /** `templateId` do que está no slot `calca`. */
  calca?: string | null;
  /** `templateId` do que está no slot `secundaria`. */
  secundaria?: string | null;
  /** `templateId` do que está no slot `acessorio`. */
  acessorio?: string | null;
}

/**
 * Acrescenta `pasta/<id>.png` à pilha, quando há peça e há arte pra ela.
 *
 * O `disponivel` é o que o gerador leu do disco: peça equipada sem arte
 * simplesmente não desenha, em vez de pedir um `.png` que não existe e
 * deixar um quadrado quebrado no boneco. É o caso da maioria das armas.
 */
function vestir(camadas: string[], pasta: string, id: string | null | undefined, disponivel: ReadonlySet<string>): void {
  if (id && disponivel.has(id)) camadas.push(`${RAIZ}/${pasta}/${id}.png`);
}

/**
 * Os caminhos das camadas, de trás para frente. Lista vazia quer dizer
 * "não há como desenhar isto" — sem raça, ou raça sem corpo.
 *
 * A ordem é a de vestir: corpo, calça, roupa, armadura por cima da roupa,
 * cabelo, **o traço da raça por cima do capacete**, escudo, e a arma na
 * frente de tudo. É a mesma que o `monta-paperdoll.mjs` recebe na linha de
 * comando, e trocá-la aqui sem passar na mesma ordem lá faz a conferência
 * mentir.
 *
 * O traço vem depois da armadura e do cabelo de propósito — ver
 * `TRACOS_DE_RACA`. Antes do escudo e da arma porque esses são objetos
 * segurados na frente do corpo, e orelha atravessando escudo seria pior
 * que capacete cobrindo orelha.
 */
export function montarCamadas({ raca, arma, armadura, elmo, calca, secundaria, acessorio }: Vestimenta): string[] {
  if (!raca || !CORPOS.has(raca)) return [];

  const camadas: string[] = [];

  // Atrás de tudo, inclusive do corpo: asa e cauda saem das costas, então
  // desenhá-las depois faria a asa passar por cima do peito.
  if (COSTAS.has(raca)) camadas.push(`${RAIZ}/back/${raca}.png`);

  camadas.push(`${RAIZ}/corpo/${raca}.png`, `${RAIZ}/base/calca.png`, `${RAIZ}/base/roupa.png`);

  // O cabelo vem **antes** da armadura: assim a peça cobre o cabelo, em vez
  // de o cabelo cair por cima do peitoral e das ombreiras. Com uma camada
  // só é o arranjo certo, e foi o que o Breno pediu.
  //
  // O correto de verdade seriam duas camadas — costas atrás de tudo, frente
  // por cima —, que é o que cabelo longo pede. Custa um PNG a mais por
  // penteado, e a hora de fazer isso é quando existir penteado longo.
  if (!SEM_CABELO.has(raca)) camadas.push(`${RAIZ}/cabelo/${CABELO_PADRAO}.png`);

  // Daqui pra baixo é a ordem de vestir, escrita como uma lista. Cada
  // linha é "esta peça, nesta pasta" — e a ordem das linhas **é** a ordem
  // das camadas, que é a única coisa que importa e a mais fácil de quebrar
  // sem perceber. Eram sete `if` quase idênticos antes.
  //
  // Até 2026-09-20 perneira, tronco e elmo saíam todos do **mesmo**
  // `templateId`: a armadura era um item só e `ladd`/`hadd` eram partes
  // dela. Agora cada uma responde pelo seu próprio slot. `badd` continua
  // atrelado à armadura porque ele é o tronco — é o próprio peitoral, não
  // uma peça à parte.
  //
  // Ausência é o caso comum e não é erro: quase todo mundo anda sem elmo.
  //
  // **Botas não aparecem aqui** — chegou `botas_icon.png` e não chegou o
  // `_body`. O item existe, veste e conta atributo; o boneco só não muda.
  // Quando a arte vier, é mais uma linha desta lista.
  vestir(camadas, 'ladd', calca, ADICIONAIS_DE_PERNA);
  vestir(camadas, 'armadura', armadura, ARMADURAS);
  vestir(camadas, 'badd', armadura, ADICIONAIS_DE_TRONCO);
  vestir(camadas, 'hadd', elmo, ADICIONAIS_DE_CABECA);

  // O acessório vem por cima da armadura — ver o comentário logo acima de
  // `TRACOS_DE_RACA`: por baixo do peitoral ele some inteiro.
  vestir(camadas, 'acessorio', acessorio, ACESSORIOS);

  // O traço da raça vem **depois de toda a armadura**, adicionais
  // inclusive. É o ponto dele: sobreviver à peça. Pôr o `hadd` por cima
  // desfaria exatamente o que o traço existe pra garantir — o felino de
  // chapéu voltaria a ser indistinguível do humano de chapéu.
  const traco = TRACOS_DE_RACA.get(raca);
  if (traco) camadas.push(`${RAIZ}/${traco}`);

  vestir(camadas, 'secundaria', secundaria, SECUNDARIAS);
  vestir(camadas, 'arma', arma, ARMAS);

  return camadas;
}

/**
 * O que está **na mão**, e não vestido no corpo.
 *
 * A distinção existe por causa do corte na cintura: o corpo é desenhado
 * duas vezes e cada cópia mostra metade, mas objeto segurado não pode ser
 * partido assim. Medindo as artes, a adaga ocupa y 40..48 e o corte fica em
 * 48 — as linhas 46 e 47 caíam na cópia do tronco, que sobe 2 px ao
 * respirar, e a 48 na das pernas, que não sobe. A lâmina se rasgava.
 *
 * É também o que permite girar a arma: camada partida em duas cópias
 * recortadas não tem como rodar em torno de um pivô só.
 *
 * O prefixo é comparado contra `RAIZ` em vez de ser escrito de novo do
 * outro lado: quem monta o caminho é esta função, e o dia em que a pasta
 * mudar de nome as duas mudam juntas.
 */
export function ehSegurada(camada: string): boolean {
  return camada.startsWith(`${RAIZ}/arma/`) || camada.startsWith(`${RAIZ}/secundaria/`);
}

export type MaoDaCamada = 'principal' | 'secundaria';

/**
 * Qual mão esta camada gira no golpe, ou `null` se ela não gira.
 *
 * As duas mãos têm punho próprio e sentido próprio — os valores estão em
 * `paperdoll.module.css`, medidos. Por isso devolve **qual** mão em vez de
 * um sim/não: com um booleano só, a arma da mão secundária giraria em
 * torno do punho da principal e sairia voando pelo meio do corpo.
 *
 * **Quem decide é o catálogo, não o nome do arquivo.** A pasta
 * `secundaria/` guarda adaga e escudo, e só o primeiro é arma. Perguntar
 * `templateById(...)?.category` mantém a regra num lugar só: o dia em que
 * um item novo puder ir pra mão secundária, ele acerta sozinho.
 *
 * O escudo fica parado porque não é arma — era essa a intenção desde o
 * começo, mas a checagem antiga olhava só a pasta e prendia a adaga da mão
 * secundária junto com ele.
 */
export function maoDaCamada(camada: string): MaoDaCamada | null {
  if (camada.startsWith(`${RAIZ}/arma/`)) return 'principal';

  const prefixo = `${RAIZ}/secundaria/`;
  if (!camada.startsWith(prefixo)) return null;

  const id = camada.slice(prefixo.length).replace(/\.png$/, '');
  return templateById(id)?.category === 'arma' ? 'secundaria' : null;
}
