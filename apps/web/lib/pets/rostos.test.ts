import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROSTOS_DE_PET, type Animacao } from './rostos';

const PUBLICO = join(__dirname, '..', '..', 'public');

/** Largura e altura de um PNG, do cabeçalho IHDR. */
function medirPng(caminho: string): { largura: number; altura: number } {
  const bruto = readFileSync(caminho);
  return { largura: bruto.readUInt32BE(16), altura: bruto.readUInt32BE(20) };
}

const todas: [string, string, Animacao][] = Object.entries(ROSTOS_DE_PET).flatMap(([pet, rosto]) =>
  rosto ? [[pet, 'normal', rosto.normal] as const, [pet, 'coracao', rosto.coracao] as const].map((t) => [...t] as [string, string, Animacao]) : [],
);

describe('ROSTOS_DE_PET', () => {
  it.each(todas)('%s/%s: o arquivo existe', (_pet, _estado, animacao) => {
    expect(() => readFileSync(join(PUBLICO, animacao.src))).not.toThrow();
  });

  /**
   * A regra que quebra calado.
   *
   * `quadros` alimenta o `steps()` e o `background-size` do CSS. Se ele
   * não bater com a tira, nada estoura: a animação só passa a cortar
   * quadro ou a mostrar vazio no fim. Defeito que atravessa revisão
   * inteira e só aparece na tela de quem joga — e como o número é escrito
   * pelo `gera-sprites-de-pet.mjs` e **copiado à mão** pra cá, a chance de
   * divergir é real.
   */
  it.each(todas)('%s/%s: a largura do PNG é exatamente quadros × altura', (_pet, _estado, animacao) => {
    const { largura, altura } = medirPng(join(PUBLICO, animacao.src));

    expect(largura).toBe(altura * animacao.quadros);
  });

  it.each(todas)('%s/%s: arte com mais de um quadro declara duração', (_pet, _estado, animacao) => {
    if (animacao.quadros > 1) expect(animacao.duracaoMs).toBeGreaterThan(0);
  });

  /**
   * `steps(1, jump-none)` é inválido — o componente cai no caminho sem
   * animação quando há um quadro só. Quadro zero ou negativo passaria
   * batido aqui e viraria `background-size` sem sentido.
   */
  it.each(todas)('%s/%s: quadros é pelo menos 1', (_pet, _estado, animacao) => {
    expect(animacao.quadros).toBeGreaterThanOrEqual(1);
  });

  it('as duas poses do mesmo pet têm a mesma altura, senão o bicho pula ao ser clicado', () => {
    for (const rosto of Object.values(ROSTOS_DE_PET)) {
      if (!rosto) continue;
      const parado = medirPng(join(PUBLICO, rosto.normal.src));
      const feliz = medirPng(join(PUBLICO, rosto.coracao.src));

      expect(feliz.altura).toBe(parado.altura);
    }
  });
});
