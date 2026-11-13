/**
 * O mini boneco: o herói que anda no mapa (arte do Breno de 2026-11-10,
 * 31 × 32, do tamanho de uma casa do mapa dele), de frente e de costas.
 *
 * As pastas e os nomes são os do paperdoll grande (`camadas.ts`), dentro de
 * `public/img/mini/<frente|costas>/`: quem copia e renomeia a arte dele é
 * `packages/shared/scripts/copia-mini-boneco.mjs`. O que existe em disco
 * está escrito aqui (é pouco), e `mini.test.ts` falha se divergir.
 *
 * Decisão do usuário (2026-11-10): no site e no app; de frente ao descer e
 * pros lados (não veio arte de lado: espelha-se a de frente), de costas ao
 * subir; a peça sem arte mini (couro, botas, armas…) não aparece nele, e
 * fica a roupa de baixo. A roupa de baixo de costas é a de frente, até o
 * Breno desenhar.
 *
 * O app tem o mesmo em `Paperdoll.Mini` (C#).
 */

import { cabeloDe, type Vestimenta } from './camadas';

export type LadoDoMini = 'frente' | 'costas';

const RAIZ = '/img/mini';

/** A largura e a altura da arte, em pixel dela. A cauda do felino de costas tem 32 de largura: alinha-se pela esquerda. */
export const LARGURA_DO_MINI = 31;
export const ALTURA_DO_MINI = 32;

export const CORPOS_DO_MINI: ReadonlySet<string> = new Set([
  'celestial',
  'draconato',
  'elfo',
  'elfo_negro',
  'fada',
  'felino',
  'goblin',
  'humano',
  'meio_elfo',
  'morto_vivo',
  'orc',
]);

/** O que é da raça e fica por cima da roupa: de frente, auréola, chifres, orelhas e presas; de costas, asas, cauda e auréola. */
export const EXTRAS_DO_MINI: Readonly<Record<LadoDoMini, ReadonlySet<string>>> = {
  frente: new Set(['celestial', 'draconato', 'felino', 'orc']),
  costas: new Set(['celestial', 'draconato', 'fada', 'felino']),
};

export const CABELOS_DO_MINI: ReadonlySet<string> = new Set(['curto', 'medio', 'longo']);
export const CALCAS_DO_MINI: ReadonlySet<string> = new Set(['placas_calca', 'robe_calca']);
export const ARMADURAS_DO_MINI: ReadonlySet<string> = new Set(['placas', 'robe']);
export const ELMOS_DO_MINI: ReadonlySet<string> = new Set(['placas_elmo', 'robe_chapeu']);
export const SECUNDARIAS_DO_MINI: ReadonlySet<string> = new Set(['escudo']);

/**
 * As camadas do mini boneco, de trás pra frente. Vazia: sem raça, ou raça
 * sem mini corpo (o anão) — a tela mostra o emoji.
 *
 * A ordem é a do grande, sem o que não tem arte: corpo, roupa de baixo,
 * perneira, peitoral, cabelo, elmo, o extra da raça e o escudo. De costas o
 * extra (asas, cauda) também vai por cima: é o que está nas costas; e o
 * escudo vai atrás de tudo, porque está na frente do herói (doc do Breno,
 * 2026-11-13).
 */
export function montarMini({ raca, armadura, elmo, calca, secundaria, cabelo }: Vestimenta, lado: LadoDoMini): string[] {
  if (!raca || !CORPOS_DO_MINI.has(raca)) return [];
  const base = `${RAIZ}/${lado}`;
  const camadas: string[] = [];
  const vestir = (pasta: string, id: string | null | undefined, disponivel: ReadonlySet<string>) => {
    if (id && disponivel.has(id)) camadas.push(`${base}/${pasta}/${id}.png`);
  };
  if (lado === 'costas') vestir('secundaria', secundaria, SECUNDARIAS_DO_MINI);
  camadas.push(`${base}/corpo/${raca}.png`, `${base}/base/calca.png`, `${base}/base/roupa.png`);
  vestir('calca', calca, CALCAS_DO_MINI);
  vestir('armadura', armadura, ARMADURAS_DO_MINI);
  const penteado = cabeloDe(raca, cabelo);
  if (penteado && CABELOS_DO_MINI.has(penteado)) camadas.push(`${base}/cabelo/${penteado}.png`);
  vestir('elmo', elmo, ELMOS_DO_MINI);
  if (EXTRAS_DO_MINI[lado].has(raca)) camadas.push(`${base}/extra/${raca}.png`);
  if (lado === 'frente') vestir('secundaria', secundaria, SECUNDARIAS_DO_MINI);
  return camadas;
}
