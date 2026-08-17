import { defineConfig } from 'tsup';

// Saída dupla de propósito: o Next consome o ESM (que faz tree-shaking do que
// o cliente não usa) e o Nest, que roda em CommonJS, consome o .cjs.
//
// `bundle: false` — um arquivo de saída por arquivo de origem, em vez de um
// `index.js` com tudo dentro. Com o pacote inteiro num arquivo só, o bundler
// do Next não tem por onde cortar: `/conta` e `/multiplayer` baixavam os 62 KB
// do catálogo de itens e monstros **só por importarem `PET_ICONS`**. Marcar
// `sideEffects: false` no `package.json` não resolveu sozinho — a granularidade
// do corte é o módulo, e havia um módulo só.
export default defineConfig({
  entry: ['src/**/*.ts', '!src/**/*.test.ts'],
  format: ['esm', 'cjs'],
  bundle: false,
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
});
