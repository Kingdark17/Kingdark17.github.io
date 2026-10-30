/**
 * O desenho da sala com PixiJS: o chão e as paredes em quadradinhos, o
 * conteúdo da sala no centro e o herói andando (decisão do usuário,
 * 2026-10-09: PixiJS, e arte provisória até o Breno desenhar os tiles e o
 * boneco do mapa).
 *
 * Desde o andar solto (2026-10-11) o herói não anda mais de quadradinho em
 * quadradinho: a regra da engine (`room-walk.ts`) diz onde ele está, em
 * unidades, e este arquivo só converte em pixel a cada quadro.
 *
 * O PixiJS chega **por parâmetro**, e não por `import`: quem chama
 * (`cena-da-sala.tsx`) o busca sob demanda, então a biblioteca só baixa
 * quando a exploração abre, e não pesa em nenhuma outra tela. Daqui só
 * saem tipos dele.
 *
 * A arte de agora é provisória e desenhada aqui mesmo: chão xadrez e
 * parede na cor de cada lugar, o ícone do minimapa no centro e o corpo da
 * raça do paperdoll como boneco. Quando a arte chegar, troca este arquivo;
 * a regra de andar fica.
 *
 * Na masmorra as salas são emendadas (2026-10-30, pedido do Breno): a cena
 * desenha a sala atual e as em volta (`salasEmVolta`), cada uma no lugar
 * dela no andar, e a câmera segue o herói. O herói fica na posição da sala
 * atual mais a dele dentro dela, então trocar de sala não move nada na
 * tela: a vizinha já estava desenhada ali. A vizinha em que ele ainda não
 * entrou fica na sombra, sem o que tem dentro.
 */

import type * as Pixi from 'pixi.js';

import {
  CAMADAS_DA_CIDADE,
  CIDADE_COLS,
  CIDADE_ROWS,
  HERO_HALF,
  PIXELS_DA_SALA,
  PIXELS_POR_CASA,
  ROOM_COLS,
  ROOM_ROWS,
  TILE_UNITS,
  camadasDaSala,
  cobreOHeroi,
  cobreOHeroiNaSala,
  type CamadaDaCidade,
  type CamadaDaSala,
  type DungeonId,
  type RoomLayout,
  type Walker,
} from '@rpg-legend/shared';

/** Pixels de tela por quadradinho: 16 de arte × 3, a escala do pixel art do jogo. */
export const LADO = 48;
/**
 * O tamanho da cena na sala de sempre, e da janela da cidade. A sala de
 * outro formato (a Torre, 11 × 12) muda a cena pro tamanho dela.
 */
export const LARGURA_DA_CENA = ROOM_COLS * LADO;
export const ALTURA_DA_CENA = ROOM_ROWS * LADO;

/** Pixels por unidade da regra. */
const ESCALA = LADO / TILE_UNITS;

/**
 * Na cidade desenhada do Breno, a arte vai no tamanho dela (32 pixels por
 * casa, sem esticar, que pixel art esticada por fração borra), e a sala vira
 * uma janela de 13,5 × 10,5 casas que segue o herói.
 */
const ESCALA_DA_CIDADE = PIXELS_POR_CASA / TILE_UNITS;
const LARGURA_DA_CIDADE = CIDADE_COLS * PIXELS_POR_CASA;
const ALTURA_DA_CIDADE = CIDADE_ROWS * PIXELS_POR_CASA;

/** A sombra da sala vizinha em que o herói ainda não entrou: dá pra ver as paredes, não o que tem dentro. */
const COR_DA_SOMBRA = 0x05060a;
const ALFA_DA_SOMBRA = 0.78;

/** Quanto se vê da camada que cobre o herói (meio transparente), e quanto leva pra chegar lá. */
const ALFA_DE_QUEM_COBRE = 0.5;
const MS_DO_ESMAECER = 150;

export type LugarDoTema = 'cidade' | 'floresta' | 'caverna' | 'torre';

export interface TemaDaSala {
  chao: number;
  chaoAlternado: number;
  parede: number;
  bordaDaParede: number;
  vao: number;
}

/** Cores provisórias de cada lugar, até o tileset do Breno. */
export const TEMAS: Record<LugarDoTema, TemaDaSala> = {
  cidade: { chao: 0x5d7a3f, chaoAlternado: 0x56723a, parede: 0x6f6a60, bordaDaParede: 0x8a8478, vao: 0x3b2f22 },
  floresta: { chao: 0x3e5f2c, chaoAlternado: 0x395828, parede: 0x253a1b, bordaDaParede: 0x3f5a2c, vao: 0x1d140c },
  caverna: { chao: 0x5b5148, chaoAlternado: 0x544b42, parede: 0x2f2925, bordaDaParede: 0x4a4038, vao: 0x15110e },
  torre: { chao: 0x4a4258, chaoAlternado: 0x443d51, parede: 0x2b2536, bordaDaParede: 0x40384f, vao: 0x120f17 },
};

/** Uma figura: a arte, se houver, e o emoji pra quando ela não carregar ou não existir. */
export interface Figura {
  arte: string | null;
  emoji: string;
  /** Altura em quadrados (1 se ausente): os extras são menores que o conteúdo da sala. */
  escala?: number;
  /** Já usado (baú aberto): desenhado apagado. */
  apagada?: boolean;
  /** `rachadura`: não é figura, é a parede rachada riscada no próprio quadrado da parede. */
  forma?: 'rachadura';
}

/** Uma sala da masmorra emendada, no lugar dela na grade do andar. */
export interface SalaDesenhada {
  x: number;
  y: number;
  planta: RoomLayout;
  /** A figura de cada objeto da planta, pelo id. A sala apagada não mostra nenhuma. */
  figuras: Readonly<Record<string, Figura>>;
  /** Já entrou nela (ou é a atual): sem sombra. */
  acesa: boolean;
}

/** A posição da sala atual na grade do andar: o herói anda contado do canto dela. */
export interface OrigemDaSala {
  x: number;
  y: number;
}

export interface Cena {
  /**
   * Uma sala sozinha, parada no meio da cena (a sala secreta, fora do mapa). `figuras`: a figura de cada objeto
   * da planta, pelo id; objeto sem figura não é desenhado. Com uma `masmorra` que tem arte
   * (`dungeon/arte-da-sala.ts`), a sala é a dela, e não os quadradinhos do `tema`.
   */
  desenharSala(planta: RoomLayout, tema: TemaDaSala, figuras: Readonly<Record<string, Figura>>, masmorra?: DungeonId | null): Promise<void>;
  /** A masmorra emendada: as salas em volta da atual, cada uma no lugar dela, e a câmera seguindo o herói. */
  desenharMasmorra(salas: readonly SalaDesenhada[], tema: TemaDaSala, masmorra: DungeonId | null): Promise<void>;
  /**
   * A cidade desenhada do Breno no lugar da sala (`city/mapa-da-cidade.ts`):
   * as camadas dele, e a janela seguindo o herói. `troncos`: os troncos
   * ainda fecham o caminho da caverna.
   */
  desenharCidade(troncos: boolean): Promise<void>;
  /**
   * Põe o herói onde a regra diz. `andando` balança o boneco, que ainda não tem quadros de caminhada. `origem`: na
   * masmorra emendada, a sala em que ele está (a posição dele é contada do canto dela). `enquadrar`: a câmera
   * enquadra essa sala inteira em vez de seguir o herói (a luta no mapa).
   */
  colocarHeroi(walker: Walker, andando: boolean, origem?: OrigemDaSala | null, enquadrar?: boolean): void;
  /** Chama `fn` a cada quadro da tela, com os milissegundos desde o anterior. Devolve como parar. */
  aCadaQuadro(fn: (decorridoMs: number) => void): () => void;
  destruir(): void;
}

async function textura(pixi: typeof Pixi, url: string | null): Promise<Pixi.Texture | null> {
  if (!url) return null;
  try {
    const carregada = (await pixi.Assets.load(url)) as Pixi.Texture;
    carregada.source.scaleMode = 'nearest';
    return carregada;
  } catch {
    return null;
  }
}

/** A figura como sprite ou, sem arte, como emoji. Ancorada no pé, no meio. */
async function figuraEm(pixi: typeof Pixi, figura: Figura, altura: number): Promise<Pixi.Container> {
  const tex = await textura(pixi, figura.arte);
  if (tex) {
    const sprite = new pixi.Sprite(tex);
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(altura / tex.height);
    return sprite;
  }
  const texto = new pixi.Text({ text: figura.emoji, style: { fontSize: Math.round(altura * 0.62) } });
  texto.anchor.set(0.5, 1);
  return texto;
}

/** O pé de quem está num quadrado: no meio dele, um pouco acima da borda de baixo. */
function peNoQuadrado(col: number, row: number): { x: number; y: number } {
  return { x: col * LADO + LADO / 2, y: row * LADO + LADO - 4 };
}

export async function criarCena(pixi: typeof Pixi, alvo: HTMLElement, heroi: Figura): Promise<Cena> {
  const app = new pixi.Application();
  await app.init({
    width: LARGURA_DA_CENA,
    height: ALTURA_DA_CENA,
    backgroundAlpha: 0,
    antialias: false,
    resolution: Math.min(2, window.devicePixelRatio || 1),
    autoDensity: true,
  });
  /** O canvas ocupa a largura da caixa, com a altura na proporção dele. */
  function esticar() {
    app.canvas.style.width = '100%';
    app.canvas.style.height = 'auto';
  }
  esticar();
  /** A cena no tamanho da sala. O autoDensity do PixiJS volta o estilo pro tamanho em pixel a cada troca. */
  function tamanho(largura: number, altura: number) {
    if (app.renderer.width === largura && app.renderer.height === altura) return;
    app.renderer.resize(largura, altura);
    esticar();
  }
  app.canvas.style.imageRendering = 'pixelated';
  app.canvas.setAttribute('aria-hidden', 'true');
  alvo.appendChild(app.canvas);

  const chao = new pixi.Container();
  // Objetos e herói no mesmo palco, ordenados pelo pé: quem está mais
  // embaixo na tela fica na frente — o herói que passa por trás do baú some
  // atrás dele, e o que passa pela frente o cobre.
  const mundo = new pixi.Container();
  mundo.sortableChildren = true;
  /** O que vai por cima de tudo: na cidade, as árvores da borda e a grade das pontes. */
  const acima = new pixi.Container();
  /** A sombra das salas vizinhas em que o herói ainda não entrou: por cima até das copas. */
  const sombra = new pixi.Container();
  /** O que a câmera move. Na sala sozinha fica parado; na cidade e na masmorra, segue o herói. */
  const palco = new pixi.Container();
  palco.addChild(chao, mundo, acima, sombra);
  app.stage.addChild(palco);
  /** Os objetos desenhados na sala atual, pra sair quando ela troca. */
  let objetos: Pixi.Container[] = [];
  /** Na cidade, as camadas do meio, que ficam meio transparentes quando cobrem o herói. */
  let doMeio: Array<{ camada: CamadaDaCidade; sprite: Pixi.Sprite }> = [];
  /**
   * Na masmorra, as camadas de cima de cada sala (as copas, a parede da frente), com o canto dela, em pixel: ficam meio
   * transparentes quando cobrem o herói, como as da cidade.
   */
  let copas: Array<{ camada: CamadaDaSala; sprite: Pixi.Sprite; ox: number; oy: number }> = [];
  /** As copas acabaram de ser desenhadas: vão direto pra transparência certa, sem piscar inteiras na troca de sala. */
  let copasNovas = false;
  let naCidade = false;
  /** Na masmorra emendada: o tamanho de uma sala, em pixel, pra achar o canto da sala atual. */
  let salaEmPixel: { largura: number; altura: number } | null = null;
  let escala = ESCALA;

  function limpar() {
    chao.removeChildren().forEach((filho) => filho.destroy());
    acima.removeChildren().forEach((filho) => filho.destroy());
    sombra.removeChildren().forEach((filho) => filho.destroy());
    for (const objeto of objetos) objeto.destroy();
    objetos = [];
    doMeio = [];
    copas = [];
  }

  /** Leva a camada rumo ao meio transparente (se cobre o herói) ou ao inteiro, `passo` por quadro. */
  function esmaecer(sprite: Pixi.Sprite, cobre: boolean, passo: number) {
    const alvo = cobre ? ALFA_DE_QUEM_COBRE : 1;
    sprite.alpha = alvo < sprite.alpha ? Math.max(alvo, sprite.alpha - passo) : Math.min(alvo, sprite.alpha + passo);
  }

  const boneco = await figuraEm(pixi, heroi, LADO * 1.25);
  mundo.addChild(boneco);

  const semMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  /** Fase do balanço do passo: avança só enquanto o herói anda. */
  let fase = 0;

  /**
   * Qual desenho é o da vez. A arte do conteúdo carrega com `await`, e
   * trocar de sala duas vezes rápido faria o desenho velho terminar depois
   * do novo e deixar o baú da sala anterior no meio desta.
   */
  let vez = 0;

  /** As texturas da arte das salas desta masmorra, pelas portas de cada uma (`null` sem arte). */
  async function arteDasSalas(plantas: readonly RoomLayout[], masmorra: DungeonId | null | undefined) {
    return Promise.all(
      plantas.map(async (planta) => {
        const camadas = masmorra ? camadasDaSala(masmorra, planta.doors) : null;
        if (!camadas || !masmorra) return null;
        const texturas = await Promise.all(camadas.map((camada) => textura(pixi, `/img/salas/${masmorra}/${camada.arquivo}.png`)));
        return { camadas, texturas };
      }),
    );
  }

  /** As figuras dos objetos da planta, já no lugar, com o canto da sala em (`ox`, `oy`). */
  async function figurasDaPlanta(planta: RoomLayout, figuras: Readonly<Record<string, Figura>>, ox: number, oy: number) {
    return Promise.all(
      planta.objects.map(async (objeto) => {
        const figura = figuras[objeto.id];
        if (!figura || figura.forma === 'rachadura') return null;
        const desenho = await figuraEm(pixi, figura, LADO * (figura.escala ?? 1));
        const pe = peNoQuadrado(objeto.col, objeto.row);
        desenho.position.set(ox + pe.x, oy + pe.y);
        desenho.zIndex = oy + pe.y;
        if (figura.apagada) desenho.alpha = 0.45;
        return desenho;
      }),
    );
  }

  /**
   * Uma sala com o canto em (`ox`, `oy`): a arte (ou os quadradinhos do `tema`), as rachaduras e as figuras já
   * carregadas. Apagada, ganha a sombra por cima.
   */
  function pintarSala(
    planta: RoomLayout,
    tema: TemaDaSala,
    figuras: Readonly<Record<string, Figura>>,
    arte: Awaited<ReturnType<typeof arteDasSalas>>[number],
    desenhos: readonly (Pixi.Container | null)[],
    ox: number,
    oy: number,
    acesa: boolean,
  ) {
    const colunas = planta.cols ?? ROOM_COLS;
    const linhas = planta.rows ?? ROOM_ROWS;
    // A arte tem 32 px por casa; a sala, LADO: estica por igual, no pixel mais próximo.
    arte?.camadas.forEach((camada, i) => {
      const tex = arte.texturas[i];
      if (!tex) return;
      const sprite = new pixi.Sprite(tex);
      sprite.scale.set(LADO / PIXELS_DA_SALA);
      sprite.position.set(ox, oy);
      if (camada.plano === 'cima') {
        acima.addChild(sprite);
        copas.push({ camada, sprite, ox, oy });
        copasNovas = true;
      } else chao.addChild(sprite);
    });

    const ladrilhos = new pixi.Graphics();
    if (!arte) planta.solid.forEach((linha, row) => {
      linha.forEach((solido, col) => {
        const px = ox + col * LADO;
        const py = oy + row * LADO;
        const borda = col === 0 || row === 0 || col === colunas - 1 || row === linhas - 1;
        if (borda && solido) {
          ladrilhos.rect(px, py, LADO, LADO).fill({ color: tema.parede });
          ladrilhos.rect(px + 2, py + 2, LADO - 4, LADO - 4).stroke({ width: 2, color: tema.bordaDaParede });
        } else {
          // Vão de porta na borda; dentro, chão xadrez — também debaixo do conteúdo.
          const xadrez = (col + row) % 2 === 0 ? tema.chao : tema.chaoAlternado;
          ladrilhos.rect(px, py, LADO, LADO).fill({ color: borda ? tema.vao : xadrez });
        }
      });
    });
    chao.addChild(ladrilhos);

    // A parede rachada é riscada na própria pedra, por cima do ladrilho.
    const rachaduras = new pixi.Graphics();
    for (const objeto of planta.objects) {
      if (figuras[objeto.id]?.forma !== 'rachadura') continue;
      const px = ox + objeto.col * LADO;
      const py = oy + objeto.row * LADO;
      rachaduras
        .moveTo(px + LADO * 0.5, py + 4)
        .lineTo(px + LADO * 0.38, py + LADO * 0.32)
        .lineTo(px + LADO * 0.6, py + LADO * 0.52)
        .lineTo(px + LADO * 0.42, py + LADO * 0.78)
        .lineTo(px + LADO * 0.52, py + LADO - 4)
        .moveTo(px + LADO * 0.6, py + LADO * 0.52)
        .lineTo(px + LADO * 0.8, py + LADO * 0.6)
        .stroke({ width: 3, color: 0x1a0b09 });
    }
    // Na sala desenhada as árvores dos lados passam por cima da parede: a rachadura vai por cima delas.
    (arte ? acima : chao).addChild(rachaduras);

    for (const desenho of desenhos) {
      if (!desenho) continue;
      mundo.addChild(desenho);
      objetos.push(desenho);
    }

    if (!acesa) sombra.addChild(new pixi.Graphics().rect(ox, oy, colunas * LADO, linhas * LADO).fill({ color: COR_DA_SOMBRA, alpha: ALFA_DA_SOMBRA }));
  }

  return {
    async desenharSala(planta, tema, figuras, masmorra) {
      const esta = ++vez;
      // A arte e as figuras carregam antes de limpar a sala anterior, pra não piscar um quadro vazio.
      const [arte] = await arteDasSalas([planta], masmorra);
      const desenhos = await figurasDaPlanta(planta, figuras, 0, 0);
      if (esta !== vez) {
        for (const desenho of desenhos) desenho?.destroy();
        return;
      }
      limpar();
      naCidade = false;
      salaEmPixel = null;
      escala = ESCALA;
      palco.position.set(0, 0);
      tamanho((planta.cols ?? ROOM_COLS) * LADO, (planta.rows ?? ROOM_ROWS) * LADO);
      pintarSala(planta, tema, figuras, arte ?? null, desenhos, 0, 0, true);
    },

    async desenharMasmorra(salas, tema, masmorra) {
      const esta = ++vez;
      const primeira = salas[0];
      if (!primeira) return;
      const largura = (primeira.planta.cols ?? ROOM_COLS) * LADO;
      const altura = (primeira.planta.rows ?? ROOM_ROWS) * LADO;
      const artes = await arteDasSalas(
        salas.map((sala) => sala.planta),
        masmorra,
      );
      const desenhos = await Promise.all(salas.map((sala) => figurasDaPlanta(sala.planta, sala.acesa ? sala.figuras : {}, sala.x * largura, sala.y * altura)));
      if (esta !== vez) {
        for (const lista of desenhos) for (const desenho of lista) desenho?.destroy();
        return;
      }
      limpar();
      naCidade = false;
      salaEmPixel = { largura, altura };
      escala = ESCALA;
      tamanho(largura, altura);
      salas.forEach((sala, i) =>
        pintarSala(sala.planta, tema, sala.acesa ? sala.figuras : {}, artes[i] ?? null, desenhos[i] ?? [], sala.x * largura, sala.y * altura, sala.acesa),
      );
    },

    async desenharCidade(troncos) {
      const esta = ++vez;
      const camadas = CAMADAS_DA_CIDADE.filter((camada) => troncos || !camada.soComTroncos);
      const texturas = await Promise.all(camadas.map((camada) => textura(pixi, `/img/cidade/${camada.arquivo}.png`)));
      if (esta !== vez) return;
      limpar();
      naCidade = true;
      salaEmPixel = null;
      escala = ESCALA_DA_CIDADE;
      tamanho(LARGURA_DA_CENA, ALTURA_DA_CENA);
      camadas.forEach((camada, i) => {
        const tex = texturas[i];
        if (!tex) return;
        const sprite = new pixi.Sprite(tex);
        if (camada.plano === 'chao') chao.addChild(sprite);
        else if (camada.plano === 'cima') acima.addChild(sprite);
        else {
          // Ordenada com o herói pela linha onde a camada encosta no chão.
          sprite.zIndex = camada.base * PIXELS_POR_CASA;
          mundo.addChild(sprite);
          objetos.push(sprite);
          doMeio.push({ camada, sprite });
        }
      });
    },

    colocarHeroi(walker, andando, origem, enquadrar) {
      // O pé do boneco fica na borda de baixo da base que bate nas paredes. Na masmorra emendada, contado do canto
      // da sala atual, que fica no lugar dela no andar.
      const canto = salaEmPixel && origem ? { x: origem.x * salaEmPixel.largura, y: origem.y * salaEmPixel.altura } : { x: 0, y: 0 };
      const x = canto.x + walker.x * escala;
      const y = canto.y + (walker.y + HERO_HALF) * escala;
      if (salaEmPixel && enquadrar) {
        // Na luta, a sala inteira: os monstros ficam por porcentagem dela, por cima do canvas.
        palco.position.set(-canto.x, -canto.y);
      } else if (salaEmPixel) {
        // A câmera no herói, em pixel inteiro (fração faz a arte tremer): parado no meio da sala, ela a enquadra inteira.
        palco.position.set(Math.round(app.renderer.width / 2 - x), Math.round(app.renderer.height / 2 - (y - LADO / 2)));
      }
      if (naCidade) {
        // A janela segue o herói, sem passar da borda do mapa, em pixel inteiro (fração faz a arte tremer).
        const meioX = Math.min(0, Math.max(LARGURA_DA_CENA - LARGURA_DA_CIDADE, LARGURA_DA_CENA / 2 - x));
        const meioY = Math.min(0, Math.max(ALTURA_DA_CENA - ALTURA_DA_CIDADE, ALTURA_DA_CENA / 2 - (y - LADO / 2)));
        palco.position.set(Math.round(meioX), Math.round(meioY));
        // Quem cobre o herói (a árvore da praça, a loja...) fica meio transparente, pra ele não sumir atrás.
        const passo = semMovimento ? 1 : Math.min(1, app.ticker.deltaMS / MS_DO_ESMAECER) * (1 - ALFA_DE_QUEM_COBRE);
        for (const { camada, sprite } of doMeio) esmaecer(sprite, cobreOHeroi(camada, walker), passo);
      }
      if (copas.length) {
        // As copas e a parede da frente que cobrem o herói também; cada sala conta o herói a partir do canto dela.
        const passo = semMovimento || copasNovas ? 1 : Math.min(1, app.ticker.deltaMS / MS_DO_ESMAECER) * (1 - ALFA_DE_QUEM_COBRE);
        copasNovas = false;
        for (const { camada, sprite, ox, oy } of copas) {
          esmaecer(sprite, cobreOHeroiNaSala(camada, { x: walker.x + (canto.x - ox) / escala, y: walker.y + (canto.y - oy) / escala }), passo);
        }
      }
      if (andando && !semMovimento) fase += 1;
      // Um pulinho a cada passo: sem quadros de caminhada ainda, é o que diz "andou" em vez de "deslizou".
      const pulo = andando && !semMovimento ? Math.abs(Math.sin(fase * 0.35)) * 3 : 0;
      boneco.position.set(x, y - pulo);
      boneco.zIndex = y;
      // Provisório: o corpo do paperdoll só tem frente. Espelhar pro lado
      // que anda já diz pra onde ele vai; as quatro direções vêm do Breno.
      if (walker.facing === 'W' || walker.facing === 'E') boneco.scale.x = Math.abs(boneco.scale.x) * (walker.facing === 'W' ? -1 : 1);
    },

    aCadaQuadro(fn) {
      const chamar = (ticker: Pixi.Ticker) => fn(ticker.deltaMS);
      app.ticker.add(chamar);
      return () => {
        // A cena pode já ter sido destruída (desmontar derruba as duas
        // coisas juntas, e a ordem não é garantida): aí não há o que parar.
        try {
          app.ticker.remove(chamar);
        } catch {
          // ticker já foi embora com a aplicação
        }
      };
    },

    destruir() {
      app.destroy({ removeView: true }, { children: true });
    },
  };
}
