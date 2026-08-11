/**
 * Fonte de aleatoriedade injetável.
 *
 * O jogo original chamava `Math.random()` direto de dentro da geração de item,
 * o que tornava impossível (a) testar a distribuição de raridade e (b) o
 * servidor conferir se um drop lendário realmente saiu do rolo que o cliente
 * alega ter feito. Passando a fonte por parâmetro, a mesma função vira
 * determinística quando o teste ou o validador precisa.
 */

/** Retorna um número em [0, 1), igual ao contrato de `Math.random`. */
export type Rng = () => number;

export const defaultRng: Rng = Math.random;

/** Inteiro em [0, max). */
export function randomInt(max: number, rng: Rng = defaultRng): number {
  return Math.floor(rng() * max);
}

/** Escolhe um elemento; lança se a lista estiver vazia, em vez de devolver undefined. */
export function pick<T>(list: readonly T[], rng: Rng = defaultRng): T {
  if (list.length === 0) throw new Error('pick() recebeu uma lista vazia');
  return list[randomInt(list.length, rng)] as T;
}

/**
 * PRNG determinístico (mulberry32) para testes e para reproduzir uma seed no
 * servidor. Não é criptográfico e não deve ser usado para nada sensível.
 */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
