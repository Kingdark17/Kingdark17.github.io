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

import { ARMADURAS, ARMAS, CORPOS, SECUNDARIAS } from './disponivel';

export { ARMADURAS, ARMAS, CORPOS, SECUNDARIAS };

const RAIZ = '/img/paperdoll';

/**
 * **Acessório equipável não tem camada.** Os quatro que existem —
 * `anel_som`, `amuleto_sab`, `bota_vento`, `colar_forca` — são anel,
 * amuleto, botas e colar: nada que mude a silhueta o bastante pra valer
 * uma camada. `montarCamadas` não os menciona de propósito, e é por isso
 * que a pasta de traços se chama `traco/` e não `acessorio/`.
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
export const TRACOS_DE_RACA: ReadonlyMap<string, string> = new Map([['felino', 'traco/orelhas-de-gato.png']]);

/**
 * Corpos que já vêm com a cabeça resolvida: o felino tem orelhas e pelo
 * próprios, o morto-vivo é caveira. Cabelo humano por cima dos dois fica
 * grotesco, então nem entra.
 */
const SEM_CABELO: ReadonlySet<string> = new Set(['felino', 'morto_vivo']);

/** O único cabelo desenhado até agora. Ver `CABELOS` no arquivo gerado. */
const CABELO_PADRAO = 'masculino';

export interface Vestimenta {
  /** Id da raça (`RACES[].id`). */
  raca: string | null;
  /** `templateId` do que está na mão principal. */
  arma?: string | null;
  /** `templateId` do que está no slot `armadura`. */
  armadura?: string | null;
  /** `templateId` do que está no slot `secundaria`. */
  secundaria?: string | null;
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
export function montarCamadas({ raca, arma, armadura, secundaria }: Vestimenta): string[] {
  if (!raca || !CORPOS.has(raca)) return [];

  const camadas = [`${RAIZ}/corpo/${raca}.png`, `${RAIZ}/base/calca.png`, `${RAIZ}/base/roupa.png`];

  if (armadura && ARMADURAS.has(armadura)) camadas.push(`${RAIZ}/armadura/${armadura}.png`);
  if (!SEM_CABELO.has(raca)) camadas.push(`${RAIZ}/cabelo/${CABELO_PADRAO}.png`);

  const traco = TRACOS_DE_RACA.get(raca);
  if (traco) camadas.push(`${RAIZ}/${traco}`);

  if (secundaria && SECUNDARIAS.has(secundaria)) camadas.push(`${RAIZ}/secundaria/${secundaria}.png`);
  if (arma && ARMAS.has(arma)) camadas.push(`${RAIZ}/arma/${arma}.png`);

  return camadas;
}
