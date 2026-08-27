/* GERADO POR scripts/gera-camadas.mjs — NÃO EDITE À MÃO.
 *
 * Para acrescentar arte: solte o `.png` de 64×64 na pasta certa em
 * `public/img/paperdoll/` e rode
 *
 *     node scripts/gera-camadas.mjs
 *
 * Se esquecer, `disponivel.test.ts` falha e diz isto de novo.
 *
 * O nome do arquivo é o contrato: para corpo é o `id` da raça
 * (`RACES[].id`), para arma/armadura/secundária é o `templateId` do item.
 * Sem tabela de tradução no meio, as duas listas não têm como divergir em
 * silêncio.
 */

/** Raças com corpo desenhado. (6 em `public/img/paperdoll/corpo/`) */
export const CORPOS: ReadonlySet<string> = new Set(['elfo', 'elfo_negro', 'felino', 'humano', 'meio_elfo', 'morto_vivo']);

/** Armas com camada — o nome do arquivo é o `templateId`. (2 em `public/img/paperdoll/arma/`) */
export const ARMAS: ReadonlySet<string> = new Set(['cajado', 'espada']);

/** Armaduras com camada. (1 em `public/img/paperdoll/armadura/`) */
export const ARMADURAS: ReadonlySet<string> = new Set(['placas']);

/** O que a mão secundária pode segurar. (1 em `public/img/paperdoll/secundaria/`) */
export const SECUNDARIAS: ReadonlySet<string> = new Set(['escudo']);

/** Cabelos disponíveis. (1 em `public/img/paperdoll/cabelo/`) */
export const CABELOS: ReadonlySet<string> = new Set(['masculino']);

/** Arquivos de traço de raça, pelo nome — ver `TRACOS_DE_RACA`. (1 em `public/img/paperdoll/traco/`) */
export const ARQUIVOS_DE_TRACO: ReadonlySet<string> = new Set(['orelhas-de-gato']);
