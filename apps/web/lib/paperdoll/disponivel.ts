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

/** Asa e cauda da raça, atrás de tudo. Pelo id da raça. (3 em `public/img/paperdoll/back/`) */
export const COSTAS: ReadonlySet<string> = new Set(['celestial', 'draconato', 'felino']);

/** A parte do elmo que fica **atrás** da cabeça. Pelo `templateId`. (1 em `public/img/paperdoll/hadd/`) */
export const COSTAS_DO_ELMO: ReadonlySet<string> = new Set(['robe_chapeu']);

/** A parte do peitoral que fica **atrás** do tronco. Pelo `templateId`. (1 em `public/img/paperdoll/badd/`) */
export const COSTAS_DO_PEITORAL: ReadonlySet<string> = new Set(['robe']);

/** A parte da perneira que fica **atrás** da perna. Pelo `templateId`. (0 em `public/img/paperdoll/ladd/`) */
export const COSTAS_DA_PERNEIRA: ReadonlySet<string> = new Set([]);

/** Raças com corpo desenhado. (10 em `public/img/paperdoll/corpo/`) */
export const CORPOS: ReadonlySet<string> = new Set(['celestial', 'draconato', 'elfo', 'elfo_negro', 'felino', 'goblin', 'humano', 'meio_elfo', 'morto_vivo', 'orc']);

/** Perneira e calça com camada. Pelo `templateId`. (2 em `public/img/paperdoll/calca/`) */
export const CALCAS: ReadonlySet<string> = new Set(['placas_calca', 'robe_calca']);

/** Calçado com camada — o nome do arquivo é o `templateId`. (1 em `public/img/paperdoll/botas/`) */
export const BOTAS: ReadonlySet<string> = new Set(['botas']);

/** Peitoral e manto com camada. (2 em `public/img/paperdoll/armadura/`) */
export const ARMADURAS: ReadonlySet<string> = new Set(['placas', 'robe']);

/** Cabelos disponíveis. (3 em `public/img/paperdoll/cabelo/`) */
export const CABELOS: ReadonlySet<string> = new Set(['curto', 'longo', 'medio']);

/** Elmo e chapéu com camada. Pelo `templateId`. (2 em `public/img/paperdoll/elmo/`) */
export const ELMOS: ReadonlySet<string> = new Set(['placas_elmo', 'robe_chapeu']);

/** Acessórios com camada — o nome do arquivo é o `templateId`. (2 em `public/img/paperdoll/acessorio/`) */
export const ACESSORIOS: ReadonlySet<string> = new Set(['amuleto_sab', 'colar_forca']);

/** Arquivos de traço de raça, pelo nome — ver `TRACOS_DE_RACA`. (3 em `public/img/paperdoll/traco/`) */
export const ARQUIVOS_DE_TRACO: ReadonlySet<string> = new Set(['aureola', 'chifres-de-dragao', 'orelhas-de-gato']);

/** Armas com camada — o nome do arquivo é o `templateId`. (4 em `public/img/paperdoll/arma/`) */
export const ARMAS: ReadonlySet<string> = new Set(['adaga', 'arco', 'cajado', 'espada']);

/** O que a mão secundária pode segurar. (2 em `public/img/paperdoll/secundaria/`) */
export const SECUNDARIAS: ReadonlySet<string> = new Set(['adaga', 'escudo']);
