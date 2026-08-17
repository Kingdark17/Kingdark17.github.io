/**
 * A descrição da sala onde o herói está parado: uma frase de ambiente, o
 * que há na sala e uma pista por porta. É o `js/narrator.js` do cliente
 * antigo, devolvendo dados em vez de HTML — quem monta parágrafo é a tela.
 *
 * Mora em `apps/web` e não em `packages/shared` porque `shared` não é
 * "todo código puro": é o código que **o servidor também precisa**, pra
 * validar jogada com a mesma regra do cliente. O servidor nunca vai
 * validar uma descrição de sala.
 *
 * ## A frase de ambiente não é sorteada de novo a cada visita
 *
 * O original sorteava uma vez e **guardava na célula** (`cell.ambientLine`),
 * pra a sala não trocar de cara quando o jogador voltasse. Aqui ela é
 * derivada da posição: mesma sala, mesma frase, sem guardar nada.
 *
 * A troca evita um campo novo dentro do save — que hoje é assinado e
 * conferido contra trapaça pelo servidor (`isValidSave`) e ainda viaja
 * inteiro no relay do co-op. Pagar isso por uma frase de enfeite seria
 * caro pelo motivo errado. De brinde, os dois jogadores em co-op leem a
 * mesma frase sem ninguém precisar sincronizar nada.
 */

import { DIR_LABEL, DIR_ORDER, pick, seededRng, type Direction } from '@rpg-legend/shared';

import { apresentacaoDe } from './apresentacao';
import { celulaAtual, celulaEm, vizinhaEm, type CelulaDoMapa, type EstadoDoJogo } from './estado';

const AMBIENTE_DA_CIDADE = [
  'As ruas de paralelepípedo ecoam seus passos.',
  'O cheiro de pão fresco e fumaça de forja se mistura no ar.',
  'Bandeiras coloridas tremulam entre os telhados inclinados ao redor.',
  'Vozes distantes de mercadores anunciam ofertas em algum lugar próximo.',
  'Uma brisa fresca percorre a rua estreita, carregando cheiro de terra molhada.',
  'Lampiões pendurados nas paredes iluminam fracamente o caminho.',
  'Passos apressados ecoam em algum beco próximo, fora de vista.',
];

const AMBIENTE_DA_MASMORRA = [
  'O ar aqui é frio e cheira a pedra úmida.',
  'Tochas bruxuleantes lançam sombras longas pelas paredes de pedra.',
  'Um silêncio pesado paira sobre a sala, quebrado apenas por um pingar distante.',
  'Musgo cobre as pedras irregulares sob seus pés.',
  'Algo goteja em algum lugar da escuridão adiante.',
  'As paredes de pedra parecem se fechar um pouco mais a cada passo.',
  'Um vento fraco sopra vindo de algum lugar mais fundo na masmorra.',
];

export interface Narracao {
  /** Frase de ambiente, estável por sala. */
  ambiente: string;
  /** O que há nesta sala — vem da engine (`roomDesc`), pode ser vazio. */
  conteudo: string;
  /** Uma pista por ponto cardeal, na ordem Norte, Sul, Leste, Oeste. */
  portas: string[];
}

export function narrar(estado: EstadoDoJogo): Narracao | null {
  const aqui = celulaAtual(estado);
  if (!aqui) return null;

  const visual = apresentacaoDe(estado);
  return {
    ambiente: ambienteDe(estado, aqui),
    conteudo: visual.descricao(aqui),
    portas: DIR_ORDER.map((direcao) => pistaDaPorta(estado, direcao, visual.rotulo)),
  };
}

/**
 * Semente por sala. Os multiplicadores são primos grandes só pra salas
 * vizinhas não caírem em frases vizinhas — o mulberry32 embaralha o
 * suficiente, mas com `x + y` cru duas salas coladas rimariam demais.
 */
function ambienteDe(estado: EstadoDoJogo, celula: CelulaDoMapa): string {
  const semente = celula.x * 73856093 + celula.y * 19349663 + estado.floor * 83492791 + (estado.mapMode === 'city' ? 0 : 1);
  const frases = estado.mapMode === 'city' ? AMBIENTE_DA_CIDADE : AMBIENTE_DA_MASMORRA;
  return pick(frases, seededRng(semente));
}

/**
 * Só descreve o que o jogador já conhece — a neblina de guerra vale aqui
 * também, senão a narração entrega o mapa inteiro de graça.
 *
 * `vizinhaEm` devolve `null` tanto pra parede quanto pra porta que não
 * leva a lugar nenhum; as duas viram "parede", que é a leitura honesta pra
 * quem está olhando.
 */
function pistaDaPorta(estado: EstadoDoJogo, direcao: Direction, rotulo: (celula: CelulaDoMapa) => string): string {
  const nome = DIR_LABEL[direcao];
  const destino = vizinhaEm(estado, direcao);
  if (!destino) return `${nome}: parede.`;

  const alvo = celulaEm(estado, destino);
  if (!alvo) return `${nome}: parede.`;
  if (!alvo.visited && !alvo.revealed) return `${nome}: porta fechada.`;

  return `${nome}: ${rotulo(alvo)}.`;
}
