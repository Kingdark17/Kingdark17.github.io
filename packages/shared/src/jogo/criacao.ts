/**
 * O que a criação de personagem decide: nome, raça e cabelo.
 *
 * Até 2026-10 ela também escolhia a classe, e a "Roleta do Destino"
 * sorteava dois poderes, a fraqueza e os atributos. O doc do Breno tirou
 * as duas coisas ("remoção de escolha de classe e poderes" e "de girar
 * status"): o herói nasce **Aprendiz**, com atributos fixos (8 em tudo mais
 * a raça), e a classe com o poder dela vêm do Treinamento de Guilda, na
 * cidade (`guilda.ts`). A fraqueza continua, sorteada sem aparecer aqui —
 * decisão do usuário — por `montarSaveInicial`.
 *
 * Fica fora do componente React de propósito: é regra de jogo, não de
 * tela. O jeito antigo de montar herói, com classe e tudo sorteado, mora em
 * `heroi-sorteado.ts`, que só os testes usam.
 */

import type { Race } from '../hero/catalog.js';

export interface Criacao {
  nome: string;
  raca: Race | null;
  /**
   * Penteado. **Não entra em `faltaParaComecar`**: começa no padrão e só
   * muda se a pessoa quiser. Travar o botão de começar por causa de
   * aparência seria cobrar uma decisão que o jogo não precisa.
   */
  cabelo: string | null;
}

export function criacaoVazia(nome: string): Criacao {
  return { nome, raca: null, cabelo: null };
}

export type FaltaParaComecar = 'nome' | 'raca';

/** O que ainda falta pra poder começar, na ordem em que o jogador resolve. */
export function faltaParaComecar(criacao: Criacao): FaltaParaComecar | null {
  if (!criacao.nome.trim()) return 'nome';
  if (!criacao.raca) return 'raca';
  return null;
}
