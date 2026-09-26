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
  ARMADURAS,
  ARMAS,
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

export {
  ACESSORIOS,
  ARMADURAS,
  ARMAS,
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
export const SEM_CABELO: ReadonlySet<string> = new Set(['felino', 'morto_vivo']);

/**
 * O penteado de quem não escolheu — todo personagem criado antes de a
 * escolha existir. Trocar isto mudaria a cara de gente que já joga, então
 * é o mesmo desenho que sempre foi o único.
 *
 * Ele se chamava `masculino` e virou `curto` junto com a escolha. Gênero é
 * outro eixo, e é item separado no doc do Breno: é o **corpo** que muda,
 * não o cabelo. Renomear custou um `git mv` porque nenhum save guardava o
 * id ainda; depois disso teria custado migração.
 */
export const CABELO_PADRAO = 'curto';

/** Penteado válido, ou o padrão. Raça sem cabelo desenhado devolve nada. */
export function cabeloDe(raca: string, escolhido?: string | null): string | null {
  if (SEM_CABELO.has(raca)) return null;
  return escolhido && CABELOS.has(escolhido) ? escolhido : CABELO_PADRAO;
}

/**
 * Os penteados que a criação oferece, **do mais curto pro mais longo** —
 * que é a ordem em que a pessoa compara. `CABELOS` não serve pra isso: é
 * um `Set` lido do disco, e sai alfabético (curto, longo, medio).
 *
 * Mora aqui, e não na tela, pelo mesmo motivo de `TRACOS_DE_RACA`: é
 * tabela escrita à mão que o disco não tem como responder sozinho, e
 * tabela escrita à mão precisa de teste. `camadas.test.ts` confere os dois
 * lados — que todo id listado tem arte, e que toda arte está listada.
 */
export const PENTEADOS: ReadonlyArray<{ id: string; nome: string }> = [
  { id: 'curto', nome: 'Curto' },
  { id: 'medio', nome: 'Médio' },
  { id: 'longo', nome: 'Longo' },
].filter((penteado) => CABELOS.has(penteado.id));

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
  /** `templateId` do que está no slot `botas`. */
  botas?: string | null;
  /** `templateId` do que está no slot `secundaria`. */
  secundaria?: string | null;
  /** `templateId` do que está no slot `acessorio`. */
  acessorio?: string | null;
  /** Penteado escolhido na criação. Sem escolha, vai o padrão. */
  cabelo?: string | null;
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
 * **Esta é a lista numerada do doc do Breno**, "Lembrando da ordem das
 * layers", nas treze linhas dela e na mesma ordem. Ele desenha contando com
 * ela; qualquer troca aqui é uma discordância com quem fez a arte, e tem
 * que passar por ele antes.
 *
 * O que o corpo separa é o ponto inteiro: uma peça não é uma camada só. O
 * manto tem costas e peito, e o corpo passa **no meio** — `badd` atrás,
 * `armadura` na frente. O chapéu tem aba de trás e copa, e a cabeça passa
 * no meio. Foi lendo isso ao contrário — como "adicional por cima" — que o
 * mago ficou sem rosto e sem mãos por seis dias, uma laje roxa de chapéu.
 *
 * O traço da raça (11) vem depois de toda a armadura, elmo inclusive: é o
 * ponto dele, sobreviver à peça, senão o felino de elmo volta a ser
 * indistinguível do humano de elmo. E antes das armas (12, 13), que são
 * objetos segurados na frente do corpo — orelha atravessando escudo seria
 * pior que elmo cobrindo orelha.
 *
 * O acessório não está nas treze do doc. Entra entre o elmo e o traço, que
 * é onde ele aparece: por baixo do peitoral de placas o amuleto some.
 */
export function montarCamadas({ raca, arma, armadura, elmo, calca, botas, secundaria, acessorio, cabelo }: Vestimenta): string[] {
  if (!raca || !CORPOS.has(raca)) return [];

  const camadas: string[] = [];

  // 1-4: tudo que fica **atrás do corpo**. Asa e cauda saem das costas; as
  // três partes `add` são o verso da peça, que o tronco e a cabeça tapam
  // pela frente.
  if (COSTAS.has(raca)) camadas.push(`${RAIZ}/back/${raca}.png`);
  vestir(camadas, 'hadd', elmo, COSTAS_DO_ELMO);
  vestir(camadas, 'badd', armadura, COSTAS_DO_PEITORAL);
  vestir(camadas, 'ladd', calca, COSTAS_DA_PERNEIRA);

  // 5: o corpo, com a roupa de baixo que todo mundo tem. `base/` não é
  // escolha de ninguém — é o que impede o boneco de ficar pelado quando o
  // slot está vazio.
  camadas.push(`${RAIZ}/corpo/${raca}.png`, `${RAIZ}/base/calca.png`, `${RAIZ}/base/roupa.png`);

  // 6-8: o que se veste, de baixo pra cima.
  //
  // A bota (7) vem depois da perneira (6), e não antes, embora seja a peça
  // mais baixa: as duas perneiras que existem desenham o próprio calçado
  // até a linha 61, a mesma em que a bota acaba. Sob elas a bota some
  // inteira — conferido desenhando as quatro combinações, e "sob placas"
  // saiu pixel por pixel igual a "sem bota". O doc pede o mesmo, com
  // outras palavras: "acima da calça e abaixo do peitoral/manto".
  vestir(camadas, 'calca', calca, CALCAS);
  vestir(camadas, 'botas', botas, BOTAS);
  vestir(camadas, 'armadura', armadura, ARMADURAS);

  // 9: o cabelo cai **por cima** do peitoral, e isso mudou com o doc — até
  // 2026-09-26 ele vinha antes da armadura, que cobria o penteado. Com o
  // `longo` a diferença aparece: ele desce até a linha 32, a gola do manto
  // começa na 26, e as sete linhas de sobreposição são cabelo no ombro.
  const penteado = cabeloDe(raca, cabelo);
  if (penteado) camadas.push(`${RAIZ}/cabelo/${penteado}.png`);

  // 10: o elmo por cima do cabelo — é o que faz chapéu parecer vestido, e
  // não colado atrás da franja.
  vestir(camadas, 'elmo', elmo, ELMOS);

  vestir(camadas, 'acessorio', acessorio, ACESSORIOS);

  // 11
  const traco = TRACOS_DE_RACA.get(raca);
  if (traco) camadas.push(`${RAIZ}/${traco}`);

  // 12, 13: a mão secundária na frente da principal, que é a ordem do doc —
  // escudo na frente do corpo, e da espada.
  vestir(camadas, 'arma', arma, ARMAS);
  vestir(camadas, 'secundaria', secundaria, SECUNDARIAS);

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
