/**
 * `String()` que recusa objeto.
 *
 * Todo corpo de requisição e todo pacote de socket chegam como `unknown`,
 * e o porte normalizava com `String(body.campo ?? '')`. O problema é que
 * `String({})` devolve `'[object Object]'`: um POST com
 * `{"username": {}}` virava o nome de usuário literal `[object Object]`,
 * com 15 caracteres e todos válidos, em vez de cair na validação. Um
 * `{"room": []}` virava a sala `""`; `{"room": ['A','B']}`, a sala `A,B`.
 *
 * Aqui, o que não é primitivo vira o padrão — e a validação de sempre faz
 * o resto. Foi o que o `no-base-to-string` do ESLint estava apontando nos
 * 46 lugares onde isso acontecia.
 */
export function comoTexto(valor: unknown, padrao = ''): string {
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  return padrao;
}
