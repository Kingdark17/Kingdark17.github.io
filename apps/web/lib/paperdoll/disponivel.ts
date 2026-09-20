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

/** O que fica **atrás** do corpo — asa, cauda. Pelo id da raça. (0 em `public/img/paperdoll/back/`) */
export const COSTAS: ReadonlySet<string> = new Set([]);

/** Raças com corpo desenhado. (10 em `public/img/paperdoll/corpo/`) */
export const CORPOS: ReadonlySet<string> = new Set(['celestial', 'draconato', 'elfo', 'elfo_negro', 'felino', 'goblin', 'humano', 'meio_elfo', 'morto_vivo', 'orc']);

/** Armas com camada — o nome do arquivo é o `templateId`. (3 em `public/img/paperdoll/arma/`) */
export const ARMAS: ReadonlySet<string> = new Set(['adaga', 'cajado', 'espada']);

/** Armaduras com camada. (2 em `public/img/paperdoll/armadura/`) */
export const ARMADURAS: ReadonlySet<string> = new Set(['placas', 'robe']);

/** Parte da armadura que se desenha por cima, na perna. Pelo `templateId`. (0 em `public/img/paperdoll/ladd/`) */
export const ADICIONAIS_DE_PERNA: ReadonlySet<string> = new Set([]);

/** Parte da armadura que se desenha por cima, no tronco. Pelo `templateId`. (1 em `public/img/paperdoll/badd/`) */
export const ADICIONAIS_DE_TRONCO: ReadonlySet<string> = new Set(['robe']);

/** Parte da armadura que se desenha por cima, na cabeça. Pelo `templateId`. (1 em `public/img/paperdoll/hadd/`) */
export const ADICIONAIS_DE_CABECA: ReadonlySet<string> = new Set(['robe']);

/** O que a mão secundária pode segurar. (2 em `public/img/paperdoll/secundaria/`) */
export const SECUNDARIAS: ReadonlySet<string> = new Set(['adaga', 'escudo']);

/** Cabelos disponíveis. (1 em `public/img/paperdoll/cabelo/`) */
export const CABELOS: ReadonlySet<string> = new Set(['masculino']);

/** Arquivos de traço de raça, pelo nome — ver `TRACOS_DE_RACA`. (3 em `public/img/paperdoll/traco/`) */
export const ARQUIVOS_DE_TRACO: ReadonlySet<string> = new Set(['aureola', 'chifres-de-dragao', 'orelhas-de-gato']);
