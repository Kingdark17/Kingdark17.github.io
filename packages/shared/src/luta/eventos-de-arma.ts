/**
 * O evento de mira de cada arma, na luta em tempo real do app.
 *
 * Ideia do usuário (2026-10-17): em vez de uma barra só pra todo mundo,
 * cada arma tem o seu jeito de mirar —
 *
 * - **espada e maça:** a barra de hoje, o cursor cruzando e o toque no meio;
 * - **arco:** uma bolinha que encolhe, e o toque quando ela bate no aro;
 * - **machado e marreta:** segurar pra encher e soltar na faixa — nem baixa,
 *   nem alta demais (passou do topo, estourou);
 * - **cajado:** passar o dedo por cima de um símbolo, como um feitiço. No
 *   PC, onde desenhar com o mouse é mais difícil que com o dedo, são
 *   letras: uma por vez (U, I, O ou P), com um aro fechando em volta, e a
 *   tecla quando o aro encosta (ideia do usuário, 2026-10-17);
 * - **violão:** tocar no ritmo de três batidas;
 * - **adaga:** dois toques ligeiros em duas janelas curtas.
 *
 * **Só no app.** O site continua com a barra única pra todas as armas
 * (decisão do usuário). Mora na engine porque é regra: o app desenha, e
 * quem diz o quanto cada toque valeu é daqui, conferido pelos casos.
 *
 * Todo evento termina numa `LeituraDaMira` — acertou, com que força, se
 * critou — e o resto do golpe é o de sempre (`resolverGolpe`): o d20, os
 * atributos, a fraqueza do monstro. Por isso a força vai de 0,5× a 1,5× em
 * todos, e por isso todos passam pela `lerMira`: a régua é uma só, e a mesma
 * arma não fica mais forte só porque o evento dela é mais fácil. O que muda
 * de arma pra arma é o que a pessoa faz pra chegar no centro.
 *
 * A largura da zona (`zonaDoAtaque`) é o quanto o evento perdoa: o ataque da
 * classe perdoa mais, a Precisão alarga, a Visão Fraca com arco ou cajado
 * aperta. Vale em todos os eventos, cada um do seu jeito.
 *
 * **Tempo em passos**, os mesmos 60 por segundo do andar
 * (`WALK_TICKS_PER_SECOND`), contados a partir do aperto que abriu o
 * evento. Desenho em números inteiros numa caixa de 0 a
 * `TAMANHO_DO_DESENHO`. Com inteiros, o app e os casos dão a mesma conta.
 */

import type { Hero } from '../hero/hero.js';
import { FORCA_NA_BORDA, lerMira, zonaDoAtaque, type AttackStyle, type LeituraDaMira } from '../combat/resolve-attack.js';
import { defaultRng, randomInt, type Rng } from '../rng.js';

export type TipoDeEvento = 'barra' | 'circulo' | 'carga' | 'desenho' | 'letras' | 'ritmo' | 'toque_duplo';

/** O evento de cada arma, pelo id do modelo. */
export const EVENTO_POR_ARMA: Readonly<Record<string, TipoDeEvento>> = {
  espada: 'barra',
  maca: 'barra',
  arco: 'circulo',
  machado: 'carga',
  marreta: 'carga',
  cajado: 'desenho',
  violao: 'ritmo',
  adaga: 'toque_duplo',
};

/** De mão vazia (ou com uma arma que ainda não tem evento), a barra. */
export const EVENTO_SEM_ARMA: TipoDeEvento = 'barra';

/**
 * Jogando no teclado (o PC), o evento que troca: o desenho do cajado vira
 * as letras. Os outros ficam como estão — o toque é apertar o ataque de novo.
 */
export const EVENTO_NO_TECLADO: Readonly<Record<string, TipoDeEvento>> = {
  desenho: 'letras',
};

/** Quanto o cursor leva pra cruzar a barra: 1,4 s, a mesma do site. */
export const DURACAO_DA_BARRA = 84;

/** Quanto a bolinha leva pra sumir. Ela bate no aro na metade do caminho — o centro da régua. */
export const DURACAO_DO_CIRCULO = 84;

/**
 * Quanto a carga leva pra ir do vazio ao topo, com o botão apertado. O
 * aperto que abre o evento já começa a encher: segurar é o mesmo gesto.
 * Chegou no topo sem soltar, estourou.
 */
export const DURACAO_DA_CARGA = 84;

/** As três batidas do violão, em passos desde o aperto: meio segundo entre uma e outra. */
export const NOTAS_DO_RITMO: readonly number[] = [30, 60, 90];

/**
 * Até quantos passos antes ou depois da batida o toque ainda conta pra ela.
 * É a meia régua da nota: o centro é a batida, a ponta é a janela.
 */
export const JANELA_DO_RITMO = 24;

/** Os dois toques da adaga, mais juntos que as batidas do violão. */
export const NOTAS_DO_TOQUE_DUPLO: readonly number[] = [24, 42];

/** A janela de cada toque da adaga — mais curta, como a arma. */
export const JANELA_DO_TOQUE_DUPLO = 16;

/** O tempo do desenho, do aperto até a mão ter que sair. */
export const DURACAO_DO_DESENHO = 120;

/** A caixa do desenho vai de 0 a isto nos dois eixos. Quem desenha converte a tela pra ela. */
export const TAMANHO_DO_DESENHO = 1000;

/** O traço que termina dentro deste tempo não perde nada pela demora. */
export const TEMPO_LIVRE_DO_DESENHO = 45;

/** Cada passo além do tempo livre conta como este tanto de erro no traço. */
export const ERRO_POR_PASSO = 1;

/**
 * O erro, em unidades da caixa, que leva o golpe pra ponta da régua. Com a
 * zona comum (metade), acerta quem erra até 120 em média — 12% da caixa;
 * crita quem erra até 12.
 */
export const ERRO_NA_PONTA = 240;

/** O traço da pessoa vem com buracos (um ponto por quadro); entre dois pontos, um a cada tanto. */
export const PASSO_DO_TRACO = 25;

/** Um traço com mais pontos que isto não é de dedo. */
export const PONTOS_MAXIMOS_DO_TRACO = 600;

/**
 * As letras do cajado no teclado: quatro da mão direita que nenhum controle
 * da luta usa. A esquerda fica no WASD, desviando o coração.
 */
export const LETRAS_DO_TECLADO: readonly string[] = ['U', 'I', 'O', 'P'];

/**
 * Quando o aro de cada letra encosta nela, em passos desde o aperto. Uma
 * letra por vez: cada uma fica na tela da batida menos a janela até a
 * batida mais a janela, e a próxima aparece quando ela some.
 */
export const NOTAS_DAS_LETRAS: readonly number[] = [36, 108, 180];

/**
 * A meia janela de cada letra: o aro leva isto pra fechar até ela (0,6 s,
 * perto dos 0,7 s do arco) e isto pra sumir depois. Começou em 24 (0,4 s),
 * e o usuário achou rápido (2026-10-17).
 */
export const JANELA_DAS_LETRAS = 36;

/**
 * Os símbolos do cajado, de um traço só, na caixa de 0 a 1000, com os
 * pontos igualmente espaçados ao longo do traço (nenhum trecho pesa mais).
 * Gerados uma vez a partir das formas — círculo, triângulo, raio, espiral e
 * onda — e escritos aqui como número, pra conta não depender de seno.
 */
export const SIMBOLOS: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  circulo: [
    [500, 160], [545, 163], [589, 172], [631, 186], [672, 207], [709, 232], [743, 262], [772, 296], [796, 333],
    [816, 374], [830, 417], [838, 461], [840, 506], [836, 551], [827, 595], [811, 637], [790, 677], [765, 714],
    [734, 747], [699, 775], [661, 799], [620, 818], [577, 831], [533, 838], [488, 840], [443, 835], [400, 825],
    [358, 809], [318, 787], [282, 761], [249, 730], [221, 695], [198, 656], [180, 615], [168, 572], [161, 527],
    [160, 482], [166, 438], [177, 394], [194, 352], [216, 313], [243, 277], [275, 245], [310, 218], [349, 195],
    [391, 178], [434, 166], [479, 161], [500, 160],
  ],
  triangulo: [
    [500, 150], [521, 190], [542, 229], [563, 269], [584, 309], [606, 349], [627, 388], [648, 428], [669, 468],
    [690, 508], [711, 547], [732, 587], [753, 627], [774, 667], [796, 706], [817, 746], [838, 786], [800, 790],
    [755, 790], [710, 790], [665, 790], [620, 790], [575, 790], [530, 790], [485, 790], [440, 790], [395, 790],
    [350, 790], [305, 790], [260, 790], [215, 790], [170, 790], [177, 759], [198, 719], [219, 679], [240, 640],
    [261, 600], [282, 560], [303, 520], [324, 481], [345, 441], [367, 401], [388, 361], [409, 322], [430, 282],
    [451, 242], [472, 202], [500, 150],
  ],
  raio: [
    [620, 120], [595, 158], [571, 195], [546, 233], [522, 271], [497, 309], [473, 346], [448, 384], [424, 422],
    [399, 460], [375, 497], [378, 517], [422, 511], [467, 505], [511, 498], [556, 492], [600, 486], [637, 484],
    [613, 522], [588, 560], [564, 597], [539, 635], [515, 673], [490, 711], [466, 748], [441, 786], [417, 824],
    [392, 862], [380, 880],
  ],
  espiral: [
    [500, 460], [543, 455], [577, 483], [590, 525], [581, 569], [554, 605], [515, 627], [471, 635], [427, 627],
    [387, 606], [355, 575], [333, 536], [322, 493], [322, 448], [333, 404], [354, 365], [384, 331], [420, 304],
    [461, 286], [505, 277], [550, 276], [594, 285], [636, 302], [673, 326], [706, 357], [733, 393], [752, 433],
    [765, 477], [770, 521], [768, 566], [758, 610], [741, 652], [718, 690], [689, 725], [655, 755], [618, 779],
    [577, 797], [533, 809], [489, 815], [444, 814], [399, 807], [356, 794], [316, 775], [278, 751], [243, 722],
    [213, 689], [188, 651], [168, 611], [152, 569], [143, 525], [140, 500],
  ],
  onda: [
    [120, 500], [140, 460], [160, 419], [181, 380], [204, 341], [229, 304], [260, 271], [300, 251], [343, 259],
    [377, 288], [405, 323], [429, 361], [451, 401], [471, 441], [491, 481], [511, 522], [530, 562], [551, 602],
    [573, 642], [597, 680], [625, 715], [660, 742], [704, 748], [743, 727], [773, 693], [798, 656], [821, 617],
    [842, 578], [862, 537], [880, 500],
  ],
};

/** O que o app precisa pra desenhar o evento, e o que a leitura confere. */
export interface EventoDeArma {
  tipo: TipoDeEvento;
  /** O quanto o evento perdoa (`zonaDoAtaque`), em fração da régua. */
  zona: number;
  /** O máximo que o evento dura, em passos: a câmera lenta dura isso. */
  duracao: number;
  /** Ritmo, toque duplo e letras: em que passo cada nota bate. */
  notas?: number[];
  /** Ritmo, toque duplo e letras: a meia janela de cada nota, em passos. */
  janela?: number;
  /** Desenho: o símbolo sorteado, uma chave de `SIMBOLOS`. */
  simbolo?: string;
  /** Letras: a letra de cada nota, em ordem. */
  letras?: string[];
}

/** Um ponto do traço do dedo: onde, na caixa do desenho, e em que passo. */
export interface PontoDoTraco {
  x: number;
  y: number;
  t: number;
}

/** Uma tecla de letra apertada no evento: qual, e em que passo. */
export interface TeclaDoEvento {
  letra: string;
  t: number;
}

/**
 * O que a pessoa fez no evento. Só o campo do tipo do evento conta; ausente
 * é não ter feito (não tocou, não soltou a tempo, não desenhou).
 */
export interface JogadaDoEvento {
  /** Barra e bolinha: o passo do toque. */
  toque?: number;
  /** Carga: o passo em que soltou. */
  soltou?: number;
  /** Ritmo e toque duplo: os passos de cada toque, em ordem. */
  toques?: number[];
  /** Desenho: os pontos do traço, em ordem. */
  traco?: PontoDoTraco[];
  /** Letras: as teclas apertadas, em ordem. */
  teclas?: TeclaDoEvento[];
}

function proprio<T>(tabela: Readonly<Record<string, T>>, chave: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(tabela, chave) ? tabela[chave] : undefined;
}

/**
 * O evento da arma pelo id do modelo; sem arma, ou arma sem evento, a barra.
 * No teclado, o que troca troca (`EVENTO_NO_TECLADO`).
 */
export function eventoDaArma(templateId: string | null | undefined, teclado = false): TipoDeEvento {
  const tipo = (templateId ? proprio(EVENTO_POR_ARMA, templateId) : undefined) ?? EVENTO_SEM_ARMA;
  return (teclado ? proprio(EVENTO_NO_TECLADO, tipo) : undefined) ?? tipo;
}

/**
 * O evento que abre quando o herói aperta o ataque: o da arma na mão, com a
 * zona deste estilo de ataque. Só o desenho e as letras sorteiam (o símbolo;
 * uma letra por nota); os outros não tiram nada do `rng`.
 */
export function eventoDoAtaque(hero: Hero, estilo: AttackStyle, rng: Rng = defaultRng, teclado = false): EventoDeArma {
  const tipo = eventoDaArma(hero.equip.arma?.templateId, teclado);
  const zona = zonaDoAtaque(hero, estilo);
  switch (tipo) {
    case 'barra':
      return { tipo, zona, duracao: DURACAO_DA_BARRA };
    case 'circulo':
      return { tipo, zona, duracao: DURACAO_DO_CIRCULO };
    case 'carga':
      return { tipo, zona, duracao: DURACAO_DA_CARGA };
    case 'ritmo':
      return notas(tipo, zona, NOTAS_DO_RITMO, JANELA_DO_RITMO);
    case 'toque_duplo':
      return notas(tipo, zona, NOTAS_DO_TOQUE_DUPLO, JANELA_DO_TOQUE_DUPLO);
    case 'desenho': {
      const nomes = Object.keys(SIMBOLOS);
      return { tipo, zona, duracao: DURACAO_DO_DESENHO, simbolo: nomes[randomInt(nomes.length, rng)] as string };
    }
    case 'letras':
      return { ...notas(tipo, zona, NOTAS_DAS_LETRAS, JANELA_DAS_LETRAS), letras: sortearLetras(NOTAS_DAS_LETRAS.length, rng) };
  }
}

function notas(tipo: TipoDeEvento, zona: number, batidas: readonly number[], janela: number): EventoDeArma {
  return { tipo, zona, duracao: (batidas[batidas.length - 1] as number) + janela, notas: [...batidas], janela };
}

/** Uma letra por nota, sem repetir a de antes: cada uma é uma tecla nova pra achar. */
function sortearLetras(quantas: number, rng: Rng): string[] {
  const letras: string[] = [];
  for (let i = 0; i < quantas; i++) {
    const podem = LETRAS_DO_TECLADO.filter((letra) => i === 0 || letra !== letras[i - 1]);
    letras.push(podem[randomInt(podem.length, rng)] as string);
  }
  return letras;
}

/**
 * Lê o que a pessoa fez no evento.
 *
 * Número fora do evento (passo negativo, quebrado, depois do fim; ponto
 * fora da caixa; traço voltando no tempo) é defeito de quem chamou, e
 * lança — como a `resolveAttack` faz com a mira fora da barra.
 */
export function lerEvento(evento: EventoDeArma, jogada: JogadaDoEvento): LeituraDaMira {
  const { tipo, zona, duracao } = evento;
  switch (tipo) {
    case 'barra':
    case 'circulo':
      return lerNoTempo(zona, duracao, jogada.toque, 'toque', tipo);
    case 'carga':
      return lerNoTempo(zona, duracao, jogada.soltou, 'soltou', tipo);
    case 'ritmo':
    case 'toque_duplo':
      return lerNotas(evento, jogada.toques ?? []);
    case 'desenho':
      return lerDesenho(evento, jogada.traco ?? []);
    case 'letras':
      return lerLetras(evento, jogada.teclas ?? []);
    default:
      throw new RangeError(`evento desconhecido: ${String(tipo)}`);
  }
}

function conferirPasso(valor: number, duracao: number, oQue: string, tipo: TipoDeEvento): void {
  if (!Number.isInteger(valor) || valor < 0 || valor > duracao) {
    throw new RangeError(`${oQue} ${valor} fora do evento (${tipo}, ${duracao} passos)`);
  }
}

/**
 * Barra, bolinha e carga são a mesma régua no tempo: o passo do gesto
 * dividido pela duração é onde o cursor parou. Na bolinha, o meio do tempo
 * é quando ela bate no aro; na carga, o meio do tempo é o meio da barra. O
 * gesto no último passo, ou nenhum, é erro: a barra acabou, a bolinha
 * sumiu, a carga estourou.
 */
function lerNoTempo(zona: number, duracao: number, passo: number | undefined, oQue: string, tipo: TipoDeEvento): LeituraDaMira {
  if (passo === undefined) return lerMira(zona, null);
  conferirPasso(passo, duracao, oQue, tipo);
  return lerMira(zona, passo >= duracao ? null : passo / duracao);
}

/**
 * Ritmo e toque duplo. Cada nota é uma régua pequena, com a batida no
 * centro e a janela na ponta, e fica com o **primeiro** toque que cai na
 * janela dela e ainda não foi de outra nota — quem bate sem parar pega
 * sempre o toque mais cedo, longe do centro. A força é a média das notas
 * (nota perdida vale zero), nunca abaixo da borda se alguma acertou; crita
 * quem crita todas.
 */
function lerNotas(evento: EventoDeArma, toques: readonly number[]): LeituraDaMira {
  const { tipo, zona, duracao } = evento;
  const batidas = evento.notas ?? [];
  const janela = evento.janela ?? 0;
  let anterior = 0;
  for (const toque of toques) {
    conferirPasso(toque, duracao, 'toque', tipo);
    if (toque < anterior) throw new RangeError(`toque ${toque} antes do anterior (${tipo})`);
    anterior = toque;
  }

  const usados = toques.map(() => false);
  const leituras = batidas.map((batida) => {
    const i = toques.findIndex((t, k) => !usados[k] && t >= batida - janela && t <= batida + janela);
    if (i < 0) return lerMira(zona, null);
    usados[i] = true;
    return lerMira(zona, 0.5 + ((toques[i] as number) - batida) / (2 * janela));
  });
  return juntarNotas(zona, leituras);
}

/**
 * Letras. Uma por vez: a janela de cada uma vai da batida menos a janela até
 * a batida mais a janela, sem o último passo (que já é da próxima), e a
 * letra fica com a **primeira** tecla apertada ali. Se for outra letra,
 * perdeu: apertar todas não adianta. Cada letra é uma régua pequena, como as
 * notas do ritmo, e elas se juntam do mesmo jeito.
 */
function lerLetras(evento: EventoDeArma, teclas: readonly TeclaDoEvento[]): LeituraDaMira {
  const { tipo, zona, duracao } = evento;
  const batidas = evento.notas ?? [];
  const janela = evento.janela ?? 0;
  const letras = evento.letras ?? [];
  let anterior = 0;
  for (const tecla of teclas) {
    conferirPasso(tecla.t, duracao, 'tecla no passo', tipo);
    if (tecla.t < anterior) throw new RangeError(`tecla no passo ${tecla.t} antes da anterior (${tipo})`);
    anterior = tecla.t;
  }

  const leituras = batidas.map((batida, i) => {
    const tecla = teclas.find((k) => k.t >= batida - janela && k.t < batida + janela);
    if (!tecla || tecla.letra !== letras[i]) return lerMira(zona, null);
    return lerMira(zona, 0.5 + (tecla.t - batida) / (2 * janela));
  });
  return juntarNotas(zona, leituras);
}

/**
 * As notas juntas: a força é a média delas (nota perdida vale zero), nunca
 * abaixo da borda se alguma acertou; crita quem crita todas.
 */
function juntarNotas(zona: number, leituras: readonly LeituraDaMira[]): LeituraDaMira {
  if (!leituras.some((l) => l.acerto)) return lerMira(zona, null);
  const soma = leituras.reduce((total, l) => total + l.forca, 0);
  return {
    acerto: true,
    forca: Math.max(FORCA_NA_BORDA, Math.round((soma / leituras.length) * 100) / 100),
    critico: leituras.every((l) => l.critico),
  };
}

/**
 * Desenho. O erro do traço é a distância média entre ele e o símbolo, medida
 * nos dois sentidos — de cada ponto do símbolo até o traço (faltou um
 * pedaço?) e de cada ponto do traço até o símbolo (rabiscou fora?) — e vale
 * o pior dos dois: a média deles perdoaria meio símbolo bem feito. Não
 * importa por onde a pessoa começou nem pra que lado foi. A demora além do
 * tempo livre soma erro. O erro vira posição na régua: zero é o centro,
 * `ERRO_NA_PONTA` é a ponta.
 */
function lerDesenho(evento: EventoDeArma, traco: readonly PontoDoTraco[]): LeituraDaMira {
  const { zona, duracao } = evento;
  const simbolo = proprio(SIMBOLOS, evento.simbolo ?? '');
  if (!simbolo) throw new RangeError(`símbolo desconhecido: ${String(evento.simbolo)}`);
  if (traco.length > PONTOS_MAXIMOS_DO_TRACO) {
    throw new RangeError(`traço com ${traco.length} pontos (máximo ${PONTOS_MAXIMOS_DO_TRACO})`);
  }
  let anterior = 0;
  for (const ponto of traco) {
    for (const eixo of [ponto.x, ponto.y]) {
      if (!Number.isInteger(eixo) || eixo < 0 || eixo > TAMANHO_DO_DESENHO) {
        throw new RangeError(`ponto (${ponto.x}, ${ponto.y}) fora da caixa do desenho`);
      }
    }
    conferirPasso(ponto.t, duracao, 'ponto no passo', 'desenho');
    if (ponto.t < anterior) throw new RangeError(`ponto no passo ${ponto.t} antes do anterior (desenho)`);
    anterior = ponto.t;
  }
  if (traco.length < 2) return lerMira(zona, null);

  const linha = traco.map((p): readonly [number, number] => [p.x, p.y]);
  const erro = Math.max(distanciaMedia(simbolo, linha), distanciaMedia(densificar(traco), simbolo));
  const tempo = (traco[traco.length - 1] as PontoDoTraco).t - (traco[0] as PontoDoTraco).t;
  const total = erro + Math.max(0, tempo - TEMPO_LIVRE_DO_DESENHO) * ERRO_POR_PASSO;
  return lerMira(zona, Math.min(1, 0.5 + total / (2 * ERRO_NA_PONTA)));
}

/**
 * O traço com os buracos preenchidos: entre dois pontos, um a cada
 * `PASSO_DO_TRACO`. É o que mede "rabiscou fora": um traço rápido tem
 * poucos pontos, e o trecho entre eles também é traço.
 */
function densificar(traco: readonly PontoDoTraco[]): Array<readonly [number, number]> {
  const primeiro = traco[0] as PontoDoTraco;
  const pontos: Array<readonly [number, number]> = [[primeiro.x, primeiro.y]];
  for (let i = 1; i < traco.length; i++) {
    const a = traco[i - 1] as PontoDoTraco;
    const b = traco[i] as PontoDoTraco;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const pedacos = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / PASSO_DO_TRACO));
    for (let k = 1; k <= pedacos; k++) {
      pontos.push([a.x + Math.floor((dx * k) / pedacos), a.y + Math.floor((dy * k) / pedacos)]);
    }
  }
  return pontos;
}

/**
 * A média, sobre os pontos de `pontos`, da distância até a linha `linha`
 * (o trecho mais perto dela) — cada distância e a média arredondadas pra
 * baixo. Passar exatamente em cima da linha dá zero, por mais pontos que o
 * traço tenha.
 *
 * As contas com coordenadas são todas de inteiros (exatas nos dois
 * lados); só a raiz e a divisão final não são, e as duas saem iguais em
 * qualquer máquina.
 */
function distanciaMedia(pontos: readonly (readonly [number, number])[], linha: readonly (readonly [number, number])[]): number {
  // Uma linha de um ponto só é um trecho de comprimento zero.
  const trechos = Math.max(1, linha.length - 1);
  let soma = 0;
  for (const [px, py] of pontos) {
    let menor = Infinity;
    for (let i = 0; i < trechos; i++) {
      const [ax, ay] = linha[i] as readonly [number, number];
      const [bx, by] = linha[Math.min(i + 1, linha.length - 1)] as readonly [number, number];
      const d = distanciaAoTrecho(px, py, ax, ay, bx, by);
      if (d < menor) menor = d;
    }
    soma += Math.floor(menor);
  }
  return Math.floor(soma / pontos.length);
}

/** A distância do ponto P ao trecho AB: até a ponta mais perto, ou na perpendicular quando ela cai dentro. */
function distanciaAoTrecho(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const comprimento2 = abx * abx + aby * aby;
  const projecao = apx * abx + apy * aby;
  if (comprimento2 === 0 || projecao <= 0) return Math.sqrt(apx * apx + apy * apy);
  if (projecao >= comprimento2) return Math.sqrt((px - bx) * (px - bx) + (py - by) * (py - by));
  return Math.abs(apx * aby - apy * abx) / Math.sqrt(comprimento2);
}
