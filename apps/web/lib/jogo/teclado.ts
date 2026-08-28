/**
 * WASD e setas andando pelo mapa — o que `bindKeyboard()` fazia em
 * `rpg-legend/js/ui.js`. O cliente antigo tinha teclado desde sempre; o
 * front novo nasceu só com os botões, e o texto do tutorial chegou a ser
 * reescrito pra parar de prometer o que não existia mais.
 *
 * Aqui mora só a **leitura** da tecla: que direção ela significa, e se é
 * pra ignorar. Quem decide se o passo pode acontecer é a tela, que sabe
 * de porta, de pergunta na frente e de quem conduz a partida no co-op.
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
 * Com modificador a tecla não é jogada: Ctrl+S é salvar a página e Ctrl+A
 * é selecionar tudo. Andar por engano ao tentar um atalho do navegador
 * seria pior que não andar.
 *
 * Shift fica de fora da lista porque não muda o sentido de nenhuma dessas
 * teclas, e segurar Shift sem querer enquanto anda é comum.
 *
 * **A repetição também não é jogada.** Tecla segurada repete no ritmo do
 * sistema — perto de 30 vezes por segundo — e cada repetição seria um
 * passo inteiro: clone do estado, mapa reconstruído, sala resolvida, som
 * e um render da tela. O botão da bússola não consegue fazer isso, um
 * clique é um passo, e o teclado tem que valer o mesmo.
 *
 * O efeito pior não era o gasto: o salvamento é adiado 2,5 s **depois da
 * última mudança**, então enquanto a tecla ficava presa o temporizador
 * era reiniciado antes de vencer e o progresso nunca ia pra nuvem.
 */
export function direcaoDaTecla(tecla: TeclaPressionada): Direction | null {
  if (tecla.repeat) return null;
  if (tecla.ctrlKey || tecla.metaKey || tecla.altKey) return null;
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
