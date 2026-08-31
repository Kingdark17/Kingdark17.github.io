/**
 * A costura entre o save local e a sala co-op — o `snapshot()`/
 * `applyState()` de `js/multiplayer.js`, sem DOM.
 *
 * A regra que dá forma a tudo: **o mapa é compartilhado, o personagem
 * não.** Quem conduz manda mapa, posição, andar e missões; cada jogador
 * guarda o próprio herói, mochila e equipe dentro de `profiles[papel]`.
 * Ao receber, o parceiro adota o mapa do outro e recupera o *seu* herói do
 * perfil — nunca o do parceiro.
 *
 * O que chega da rede é `Record<string, unknown>`: JSON de outro
 * navegador, já saneado pelo servidor mas sem tipo nenhum. As conversões
 * ficam presas aqui, do mesmo jeito que os casts de célula ficam presos em
 * `apresentacao.ts`.
 */

import type { CityCell, Companion, DungeonCell, Hero, Item, Quest } from '@rpg-legend/shared';

import type { EstadoDoJogo, Posicao } from './estado';
import type { PerfilNaSala } from '../rede/sala';

/** Os campos que viajam pela rede — os mesmos do `snapshot()` original. */
const CAMPOS_COMPARTILHADOS = ['quests', 'floor', 'mapMode', 'map', 'mapRows', 'mapCols', 'pos'] as const;

export interface CosmeticosDoJogador {
  username: string;
  avatarUrl: string;
  frame: string;
  nameColor: string;
  pet: string;
}

/**
 * Monta o que vai pro servidor. `profiles` leva só o **meu** papel: o do
 * parceiro o servidor já tem, e reenviá-lo abriria caminho pra um cliente
 * reescrever o herói do outro.
 *
 * `mochilaJaEnviada` é a mochila da última sincronização. Quando ela é a
 * mesma, o campo **sai do pacote**: o servidor entende ausência como "não
 * mudou" e mantém a que já aceitou. Medido num save com 76 itens, a mochila
 * era 10,5 KB de um pacote de 14 KB — e andar, lutar ou abrir uma porta não
 * mexem nela. É o mesmo acordo que o cosmético já tinha.
 *
 * A comparação é por **referência**, e funciona porque a engine troca o
 * array ao mudar e devolve o mesmo quando não muda (ver `mochila.ts`).
 * Passar `null` força o envio — é o que se usa depois de uma reconexão,
 * quando não dá pra saber o que o servidor ainda tem.
 */
export function instantaneoDaSala(
  estado: EstadoDoJogo,
  papel: number,
  nome: string,
  cosmeticos: CosmeticosDoJogador | null,
  mochilaJaEnviada?: readonly Item[] | null,
): Record<string, unknown> {
  const perfil: Record<string, unknown> = {
    name: estado.hero.name,
    hero: estado.hero,
    party: estado.party,
    publicProfile: cosmeticos,
  };
  if (estado.inventory !== mochilaJaEnviada) perfil.inventory = estado.inventory;

  return {
    quests: estado.quests,
    floor: estado.floor,
    mapMode: estado.mapMode,
    map: estado.map,
    mapRows: estado.mapRows,
    mapCols: estado.mapCols,
    pos: estado.pos,
    profiles: { [papel]: perfil },
  };
}

/**
 * Aplica o estado que veio da sala por cima do local.
 *
 * **Mapa ausente é "não mudou", igual à mochila.** O servidor só manda o
 * mapa quando esta conexão ainda não tem a versão dele (ver
 * `mapaParaMembro`), porque ele é 91% do pacote e quase nunca muda: atacar,
 * usar poção e comprar não mexem numa célula. Antes, ausência aqui fazia a
 * função devolver o estado local inteiro — e a sincronização toda era
 * jogada fora junto, posição, andar e perfis inclusive.
 *
 * O que sobrou da guarda antiga continua valendo: sem mapa **nenhum** —
 * nem no pacote, nem no local — não há o que aplicar. Sincronização pela
 * metade não pode apagar a masmorra de ninguém.
 */
export function aplicarRemoto(local: EstadoDoJogo, remoto: Record<string, unknown>, meuPerfil: PerfilNaSala | undefined): EstadoDoJogo {
  const veioMapa = Array.isArray(remoto.map) && remoto.map.length > 0;
  const mapa = veioMapa ? remoto.map : local.map;
  const pos = remoto.pos as Posicao | undefined;
  if (!Array.isArray(mapa) || !mapa.length || !pos) return local;

  /**
   * Trocar de modo **exige** mapa no pacote: cidade e masmorra têm células
   * de formato diferente, e reaproveitar o mapa local sob o modo novo faria
   * a tela ler sala de masmorra como quadra de cidade. Na prática não
   * acontece — mudar de modo muda o mapa, então a versão sobe e o servidor
   * manda —, mas o dia em que acontecer tem que ser um pacote ignorado, e
   * não uma tela lendo lixo.
   */
  const modo = (remoto.mapMode as string | undefined) ?? local.mapMode;
  if (modo !== local.mapMode && !veioMapa) return local;

  const compartilhado: Record<string, unknown> = {};
  for (const campo of CAMPOS_COMPARTILHADOS) {
    if (remoto[campo] !== undefined) compartilhado[campo] = remoto[campo];
  }

  // Mochila ausente é "não mudou", nunca "esvaziou". Quem preenche a
  // ausência é `preservarMochila`, na fronteira do socket, então na prática
  // ela chega aqui completa — mas o campo é opcional, e ler opcional como
  // `[]` seria dizer "esvaziou" para um pacote que não disse nada.
  const proprio = meuPerfil
    ? {
        hero: meuPerfil.hero as unknown as Hero,
        inventory: (meuPerfil.inventory ?? local.inventory) as Item[],
        party: (meuPerfil.party ?? []) as unknown as Companion[],
      }
    : { hero: local.hero, inventory: local.inventory, party: local.party };

  const base = {
    ...local,
    ...proprio,
    quests: (compartilhado.quests as Quest[] | undefined) ?? local.quests,
    floor: (compartilhado.floor as number | undefined) ?? local.floor,
    mapRows: (compartilhado.mapRows as number | undefined) ?? local.mapRows,
    mapCols: (compartilhado.mapCols as number | undefined) ?? local.mapCols,
    pos,
  };

  // `modo`, e não `remoto.mapMode`: ler o campo direto faria um pacote sem
  // ele cair no `else` e virar cidade — um jeito silencioso de teleportar
  // alguém pra fora da masmorra.
  return modo === 'dungeon'
    ? { ...base, mapMode: 'dungeon', map: mapa as DungeonCell[][] }
    : { ...base, mapMode: 'city', map: mapa as CityCell[][] };
}
