/**
 * Mede onde as camadas de cima das salas da masmorra escondem o herói e
 * imprime o `cobre` de cada uma, pronto pra colar em `CAMADAS_DAS_SALAS`
 * (`src/dungeon/arte-da-sala.ts`): uma linha por fileira da sala, `#` na casa
 * com mais da metade dos pixels desenhados, `.` no resto.
 *
 *     cd packages/shared && pnpm dlx tsx scripts/cobertura-das-salas.ts
 *
 * Lê a arte do site (`apps/web/public/img/salas/<masmorra>/`). Arte nova →
 * rodar de novo e conferir.
 */

import { fileURLToPath } from 'node:url';

import { CAMADAS_DAS_SALAS, PIXELS_DA_SALA } from '../src/dungeon/arte-da-sala.js';
import { lerPng } from './ler-png.mjs';

const pasta = fileURLToPath(new URL('../../../apps/web/public/img/salas/', import.meta.url));

for (const [masmorra, camadas] of Object.entries(CAMADAS_DAS_SALAS)) {
  for (const camada of camadas ?? []) {
    if (camada.plano !== 'cima') continue;
    const imagem = lerPng(`${pasta}${masmorra}/${camada.arquivo}.png`);
    const linhas: string[] = [];
    for (let row = 0; row < imagem.altura / PIXELS_DA_SALA; row++) {
      let linha = '';
      for (let col = 0; col < imagem.largura / PIXELS_DA_SALA; col++) {
        let desenhados = 0;
        for (let y = 0; y < PIXELS_DA_SALA; y++) {
          for (let x = 0; x < PIXELS_DA_SALA; x++) {
            const o = ((row * PIXELS_DA_SALA + y) * imagem.largura + col * PIXELS_DA_SALA + x) * imagem.canais;
            if (imagem.canais !== 4 || imagem.px[o + 3] > 0) desenhados++;
          }
        }
        linha += desenhados * 2 > PIXELS_DA_SALA * PIXELS_DA_SALA ? '#' : '.';
      }
      linhas.push(linha);
    }
    console.log(`${masmorra}/${camada.arquivo}:`);
    console.log(`  cobre: [${linhas.map((linha) => `'${linha}'`).join(', ')}],`);
  }
}
