/**
 * Que camadas de paperdoll existem em `public/img/paperdoll/`, e em que
 * ordem elas se empilham.
 *
 * **A lista é escrita à mão, e tem que ser.** O navegador não enxerga o
 * disco: pedir `corpo/anao.png` sem saber se existe rende um 404 e um
 * quadrado quebrado na tela. Aqui a ausência é dado, não acidente — a
 * tela pergunta antes de desenhar e mostra outra coisa quando não há arte.
 *
 * Os nomes de arquivo são **exatamente os ids do catálogo da engine**
 * (`RACES` em `packages/shared/src/hero/catalog.ts`, `weaponTemplate` em
 * `CLASSES`). Isso é de propósito: sem tabela de tradução no meio, não há
 * como as duas listas divergirem em silêncio.
 */

const RAIZ = '/img/paperdoll';

/** Raças com corpo desenhado. Faltam anao, orc, draconato, goblin, fada, celestial. */
export const CORPOS: ReadonlySet<string> = new Set(['humano', 'elfo', 'elfo_negro', 'meio_elfo', 'felino', 'morto_vivo']);

/**
 * Armas com camada. Faltam **seis**: adaga, maca, machado, arco, marreta e
 * violao.
 *
 * O comentário dizia quatro até 26/08/2026 e esquecia `marreta` e
 * `violao` — que existem em `items/templates.ts` como qualquer outra. Lista
 * escrita à mão envelhece calada, e a de "o que falta" envelhece pior:
 * ninguém a lê pra descobrir que está errada, só pra planejar o trabalho.
 */
export const ARMAS: ReadonlySet<string> = new Set(['espada', 'cajado']);

/** Armaduras com camada. Faltam couro e robe. */
export const ARMADURAS: ReadonlySet<string> = new Set(['placas']);

/**
 * **Acessório equipável não tem camada, e nem conjunto aqui.** Os quatro
 * que existem — `anel_som`, `amuleto_sab`, `bota_vento`, `colar_forca` —
 * são anel, amuleto, botas e colar: nada que mude a silhueta o bastante
 * pra valer uma camada. `montarCamadas` não os menciona de propósito.
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
 * Moram em `traco/`. Estiveram em `acessorio/` enquanto ninguém sabia o
 * que eram — nome que confundia com o slot de acessório equipável, que é
 * outra coisa e nem tem camada (ver o bloco acima).
 */
const TRACOS_DE_RACA: ReadonlyMap<string, string> = new Map([['felino', 'traco/orelhas-de-gato.png']]);

/**
 * Mão secundária. Hoje só o escudo — e ele é `category: 'armadura'` nos
 * templates, mas `equipItem` o manda pro slot `secundaria` (ver o caso
 * especial em `hero.ts`). Quem lê daqui usa o slot, não a categoria.
 */
export const SECUNDARIAS: ReadonlySet<string> = new Set(['escudo']);

/**
 * Corpos que já vêm com a cabeça resolvida: o felino tem orelhas e pelo
 * próprios, o morto-vivo é caveira. Cabelo humano por cima dos dois fica
 * grotesco, então nem entra.
 */
const SEM_CABELO: ReadonlySet<string> = new Set(['felino', 'morto_vivo']);

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
  if (!SEM_CABELO.has(raca)) camadas.push(`${RAIZ}/cabelo/masculino.png`);

  const traco = TRACOS_DE_RACA.get(raca);
  if (traco) camadas.push(`${RAIZ}/${traco}`);

  if (secundaria && SECUNDARIAS.has(secundaria)) camadas.push(`${RAIZ}/secundaria/${secundaria}.png`);
  if (arma && ARMAS.has(arma)) camadas.push(`${RAIZ}/arma/${arma}.png`);

  return camadas;
}
