/**
 * O Diário de Aventura — o registro do que aconteceu nesta partida.
 *
 * O jogo antigo tinha uma coluna que ia acumulando "você encontrou 29 de
 * ouro", "você desceu para o Andar 3", "você conversou com Erma". No front
 * novo isso **não existia**: os acontecimentos apareciam como aviso ou
 * recado e sumiam. Eram mostrados, nunca guardados.
 *
 * A fonte não é nova nem paralela — é exatamente o que já ia pra tela.
 * `avisar` e `recadar`, na tela de jogo, escrevem aqui de passagem. Um
 * gerador de eventos separado divergiria do que o jogador viu, e diário
 * que discorda da tela é pior que diário nenhum.
 *
 * **Vive na memória da sessão, não no save.** É deliberado: o save é
 * assinado e validado pelo servidor, e crescer o formato dele por causa
 * de um registro decorativo custaria migração e limite de tamanho por uma
 * coisa que ninguém consulta depois de fechar o jogo. Recarregar a página
 * começa um diário limpo, como o jogo antigo fazia.
 */

/** Cabe uma sessão longa sem o array virar problema, e ninguém rola além disso. */
export const LIMITE_DO_DIARIO = 60;

export interface Anotacao {
  /** Chave estável de lista. Cresce sempre, então nunca se repete. */
  id: number;
  icone: string;
  titulo: string;
  texto: string;
}

/**
 * O mais novo entra na frente, que é a ordem em que se lê um diário —
 * quem abre quer ver o que acabou de acontecer, não o começo da partida.
 *
 * Nada de remover repetido: encontrar ouro duas vezes seguidas é um
 * acontecimento legítimo, e engolir a segunda linha faria o diário mentir
 * sobre o que a pessoa fez.
 */
export function anotar(diario: Anotacao[], entrada: Omit<Anotacao, 'id'>): Anotacao[] {
  const id = (diario[0]?.id ?? 0) + 1;
  return [{ id, ...entrada }, ...diario].slice(0, LIMITE_DO_DIARIO);
}
