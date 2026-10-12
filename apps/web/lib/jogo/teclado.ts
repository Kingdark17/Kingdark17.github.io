/**
 * WASD e setas andando pela sala — o que `bindKeyboard()` fazia em
 * `rpg-legend/js/ui.js`. O cliente antigo tinha teclado desde sempre; o
 * front novo nasceu só com os botões, e o texto do tutorial chegou a ser
 * reescrito pra parar de prometer o que não existia mais.
 *
 * Desde o andar solto (2026-10-11) a tecla não é mais um passo: é um
 * estado. Apertar põe a direção no conjunto das seguradas, soltar tira, e
 * o andar lê o conjunto a cada passo de simulação (`andar-na-sala.ts`) —
 * duas teclas juntas são diagonal.
 *
 * Aqui mora só a **leitura** da tecla: que direção ela significa, e se é
 * pra ignorar. Quem decide se o herói pode andar é a tela, que sabe de
 * pergunta na frente e de quem conduz a partida no co-op.
 *
 * Nada de `KeyboardEvent` nem de `HTMLElement` nas assinaturas, de
 * propósito: os testes de `lib/` rodam em ambiente `node`, sem DOM. As
 * formas que estas funções pedem são um subconjunto das reais, então o
 * evento do navegador entra direto sem conversão.
 */

import type { Direction } from '@rpg-legend/shared';

/**
 * Setas e WASD, exatamente o par que o original aceitava. Minúsculas
 * porque a comparação normaliza — com Caps Lock ligado o `key` vem 'W'.
 */
const DIRECAO_POR_TECLA: Record<string, Direction> = {
  w: 'N',
  a: 'W',
  s: 'S',
  d: 'E',
  arrowup: 'N',
  arrowleft: 'W',
  arrowdown: 'S',
  arrowright: 'E',
};

export interface TeclaPressionada {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  /** `true` quando o evento veio da auto-repetição da tecla segurada. */
  repeat?: boolean;
}

/**
 * Que direção a tecla apertada põe no conjunto das seguradas.
 *
 * Com modificador a tecla não é jogada: Ctrl+S é salvar a página e Ctrl+A
 * é selecionar tudo. Andar por engano ao tentar um atalho do navegador
 * seria pior que não andar.
 *
 * Shift fica de fora da lista porque não muda o sentido de nenhuma dessas
 * teclas, e segurar Shift sem querer enquanto anda é comum.
 *
 * A auto-repetição da tecla segurada devolve a mesma direção. Antes ela era
 * ignorada porque cada repetição virava um passo inteiro; agora a tecla é
 * estado (pôr de novo no conjunto não muda nada), e quem chama precisa
 * reconhecê-la pra continuar segurando a rolagem da página com as setas.
 */
export function direcaoDaTecla(tecla: TeclaPressionada): Direction | null {
  if (tecla.ctrlKey || tecla.metaKey || tecla.altKey) return null;
  return DIRECAO_POR_TECLA[tecla.key.toLowerCase()] ?? null;
}

/**
 * Que direção sai do conjunto quando a tecla é solta. Sem olhar
 * modificador: soltar o W com o Ctrl apertado também solta o W — senão o
 * herói seguiria andando sozinho.
 */
export function direcaoAoSoltar(tecla: Pick<TeclaPressionada, 'key'>): Direction | null {
  return DIRECAO_POR_TECLA[tecla.key.toLowerCase()] ?? null;
}

/** O bastante de um elemento pra saber se ele recebe texto. */
export interface AlvoDoEvento {
  tagName?: string;
  isContentEditable?: boolean;
}

/**
 * Quem está digitando não está andando. Sem isto, escrever "sword" na
 * busca da mochila daria quatro passos pela masmorra.
 *
 * O original só olhava INPUT e TEXTAREA. SELECT entra porque letra nele
 * pula pra opção que começa com ela, e `contentEditable` porque qualquer
 * campo rico futuro cairia no mesmo buraco sem avisar.
 */
export function estaDigitando(alvo: AlvoDoEvento | null | undefined): boolean {
  if (!alvo) return false;
  if (alvo.isContentEditable) return true;

  const tag = (alvo.tagName ?? '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
