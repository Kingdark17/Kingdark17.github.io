import { describe, expect, it } from 'vitest';

import { anotar, LIMITE_DO_DIARIO, type Anotacao } from './diario';

const entrada = (texto: string) => ({ icone: '💰', titulo: 'Ouro', texto });

function comAnotacoes(quantas: number): Anotacao[] {
  let diario: Anotacao[] = [];
  for (let i = 1; i <= quantas; i += 1) diario = anotar(diario, entrada(`evento ${i}`));
  return diario;
}

describe('anotar', () => {
  it('o mais novo entra na frente — é a ordem em que se lê um diário', () => {
    const diario = comAnotacoes(3);

    expect(diario.map((a) => a.texto)).toEqual(['evento 3', 'evento 2', 'evento 1']);
  });

  it('não mexe no diário que recebeu', () => {
    const antes = comAnotacoes(2);
    const copia = [...antes];

    anotar(antes, entrada('novo'));

    expect(antes).toEqual(copia);
  });

  /** Chave de lista repetida faz o React reaproveitar a linha errada. */
  it('cada anotação ganha id próprio, e eles nunca se repetem', () => {
    const diario = comAnotacoes(10);

    expect(new Set(diario.map((a) => a.id)).size).toBe(10);
  });

  it('o id continua crescendo mesmo depois de o limite descartar as antigas', () => {
    const cheio = comAnotacoes(LIMITE_DO_DIARIO);
    const depois = anotar(cheio, entrada('mais uma'));

    expect(depois[0].id).toBeGreaterThan(cheio[0].id);
    expect(new Set(depois.map((a) => a.id)).size).toBe(LIMITE_DO_DIARIO);
  });

  it('para de crescer no limite, descartando a mais velha', () => {
    const diario = comAnotacoes(LIMITE_DO_DIARIO + 5);

    expect(diario).toHaveLength(LIMITE_DO_DIARIO);
    expect(diario[0].texto).toBe(`evento ${LIMITE_DO_DIARIO + 5}`);
    expect(diario.some((a) => a.texto === 'evento 1')).toBe(false);
  });

  /**
   * Encontrar ouro duas vezes seguidas é acontecimento legítimo. Engolir a
   * segunda linha faria o diário mentir sobre o que a pessoa fez.
   */
  it('guarda repetido, porque repetido também aconteceu', () => {
    const diario = anotar(anotar([], entrada('29 de ouro')), entrada('29 de ouro'));

    expect(diario).toHaveLength(2);
  });
});
