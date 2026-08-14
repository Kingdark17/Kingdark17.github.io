import { defineConfig } from 'vitest/config';

/**
 * Só a lógica de jogo em `lib/` — as pastas de tela não têm teste ainda
 * (precisariam de ambiente DOM, que este projeto não configurou).
 */
export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: { '@': new URL('./', import.meta.url).pathname },
  },
});
