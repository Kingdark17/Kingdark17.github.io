/**
 * O pacote de recursos que o `LazyMotion` de `tela-combate.tsx` carrega
 * depois. Precisa ser **arquivo próprio**: é o limite onde o bundler
 * corta o pedaço. Chamar `import('motion/react')` de dentro da tela não
 * separa nada — o módulo já está no grafo por causa do `LazyMotion`, e o
 * que acontece é o contrário do pretendido (medido: duas cópias).
 */

export { domAnimation as default } from 'motion/react';
