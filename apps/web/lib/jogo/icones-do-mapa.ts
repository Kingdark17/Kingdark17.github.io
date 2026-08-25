/**
 * A pixel art do minimapa, por tipo de sala.
 *
 * Chaveia pelo **tipo**, que a célula já carrega e que o CSS já usa em
 * `data-tipo`, e não pelo emoji que a engine devolve. Emoji como chave
 * seria acoplar a arte a um caractere que existe pra ser exibido: mudar
 * `cityIconFor` de 🏵 pra 🛒 quebraria o ícone sem quebrar nada que um
 * teste veja.
 *
 * **Quem não está aqui continua no emoji.** É o mesmo arranjo do paperdoll
 * e dos pets: a arte chega por partes, e a ausência tem que ser um caminho
 * previsto, não um quadrado quebrado. `normal` nunca terá arte — sala vazia
 * é vazia de propósito, e a engine já devolve `''` pra ela.
 */

const RAIZ = '/img/mapa';

const POR_TIPO: Record<string, string> = {
  // masmorra
  start: 'inicio',
  npc: 'npc',
  treasure: 'bau',
  monster: 'monstro',
  boss: 'chefe',
  stairs: 'escada',
  exit: 'saida',
  event: 'evento',
  // cidade
  shop: 'loja',
  blacksmith: 'ferreiro',
  tavern: 'taverna',
  questboard: 'missoes',
  gate: 'portao',
};

/**
 * Onde o jogador está. É uma cabeça, e não o boneco inteiro do paperdoll:
 * numa célula de minimapa o corpo vira um borrão de três pixels, e o que
 * precisa ler de relance é "estou aqui".
 */
export const MARCADOR_DO_JOGADOR = `${RAIZ}/jogador.png`;

/** Caminho da arte do tipo, ou `null` quando ainda não há — aí vale o emoji. */
export function arteDoTipo(tipo: string | undefined): string | null {
  const arquivo = tipo ? POR_TIPO[tipo] : undefined;
  return arquivo ? `${RAIZ}/${arquivo}.png` : null;
}
