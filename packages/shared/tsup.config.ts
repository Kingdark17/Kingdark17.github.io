import { defineConfig } from 'tsup';

// Saída dupla de propósito: o Next consome o ESM (que faz tree-shaking do que
// o cliente não usa) e o Nest, que roda em CommonJS, consome o .cjs.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
});
