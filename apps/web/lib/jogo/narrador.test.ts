import { describe, expect, it } from 'vitest';

import { seededRng } from '@rpg-legend/shared';

import { rolarTudo } from './criacao';
import { andar, entrarNaCidade, entrarNaMasmorra, revelar, type EstadoDoJogo } from './estado';
import { narrar } from './narrador';
import { montarSaveInicial } from './save-inicial';

function naCidade(): EstadoDoJogo {
  const rng = seededRng(7);
  return entrarNaCidade(montarSaveInicial(rolarTudo('Aria', rng), rng));
}

function naMasmorra(): EstadoDoJogo {
  const rng = seededRng(7);
  return entrarNaMasmorra(naCidade() as ReturnType<typeof entrarNaCidade>, rng);
}

/** Direção com porta aberta, pra o teste não depender do desenho do mapa. */
function algumaSaida(estado: EstadoDoJogo) {
  const atual = estado.map[estado.pos.y]?.[estado.pos.x];
  return (['N', 'S', 'E', 'W'] as const).find((direcao) => atual?.doors?.[direcao]);
}

describe('narrar', () => {
  it('descreve ambiente, conteúdo e as quatro portas', () => {
    const narracao = narrar(naCidade());

    expect(narracao?.ambiente).toBeTruthy();
    expect(narracao?.portas).toHaveLength(4);
    expect(narracao?.portas.join(' ')).toContain('Norte:');
    expect(narracao?.portas.join(' ')).toContain('Oeste:');
  });

  it('a mesma sala mantém a frase de ambiente entre visitas', () => {
    const inicio = naCidade();
    const saida = algumaSaida(inicio);
    expect(saida).toBeDefined();

    const primeira = narrar(inicio)?.ambiente;
    const voltando = andar(andar(inicio, saida!), saida! === 'N' ? 'S' : saida! === 'S' ? 'N' : saida! === 'E' ? 'W' : 'E');

    // Sem isso a sala trocaria de cara a cada passo — era por isso que o
    // original guardava a frase dentro da célula.
    expect(narrar(voltando)?.ambiente).toBe(primeira);
  });

  it('cidade e masmorra têm ambientes próprios', () => {
    const cidade = narrar(naCidade())?.ambiente ?? '';
    const masmorra = narrar(naMasmorra())?.ambiente ?? '';

    expect(cidade).not.toBe(masmorra);
    expect([cidade, masmorra].every((frase) => frase.endsWith('.'))).toBe(true);
  });

  it('não entrega sala que a neblina ainda esconde', () => {
    const estado = naCidade();
    const saida = algumaSaida(estado);
    expect(saida).toBeDefined();

    const nome = { N: 'Norte', S: 'Sul', E: 'Leste', W: 'Oeste' }[saida!];
    const antes = narrar(estado)?.portas.find((pista) => pista.startsWith(nome));
    expect(antes).toBe(`${nome}: porta fechada.`);

    const vizinha = estado.map[estado.pos.y]?.[estado.pos.x];
    const vetor = { N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 } }[saida!];
    const revelado = revelar(estado, { x: vizinha!.x + vetor.x, y: vizinha!.y + vetor.y });

    const depois = narrar(revelado)?.portas.find((pista) => pista.startsWith(nome));
    expect(depois).not.toBe(`${nome}: porta fechada.`);
  });
});
