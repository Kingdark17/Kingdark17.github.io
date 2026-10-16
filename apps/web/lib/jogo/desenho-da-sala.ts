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
 */

import type * as Pixi from 'pixi.js';

import { HERO_HALF, ROOM_COLS, ROOM_ROWS, TILE_UNITS, type RoomLayout, type Walker } from '@rpg-legend/shared';

/** Pixels de tela por quadradinho: 16 de arte × 3, a escala do pixel art do jogo. */
export const LADO = 48;
export const LARGURA_DA_CENA = ROOM_COLS * LADO;
export const ALTURA_DA_CENA = ROOM_ROWS * LADO;

/** Pixels por unidade da regra. */
const ESCALA = LADO / TILE_UNITS;

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

export interface Cena {
  /** `figuras`: a figura de cada objeto da planta, pelo id; objeto sem figura não é desenhado. */
  desenharSala(planta: RoomLayout, tema: TemaDaSala, figuras: Readonly<Record<string, Figura>>): Promise<void>;
  /** Põe o herói onde a regra diz. `andando` balança o boneco, que ainda não tem quadros de caminhada. */
  colocarHeroi(walker: Walker, andando: boolean): void;
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
  app.canvas.style.width = '100%';
  app.canvas.style.height = 'auto';
  app.canvas.style.imageRendering = 'pixelated';
  app.canvas.setAttribute('aria-hidden', 'true');
  alvo.appendChild(app.canvas);

  const chao = new pixi.Container();
  // Objetos e herói no mesmo palco, ordenados pelo pé: quem está mais
  // embaixo na tela fica na frente — o herói que passa por trás do baú some
  // atrás dele, e o que passa pela frente o cobre.
  const mundo = new pixi.Container();
  mundo.sortableChildren = true;
  app.stage.addChild(chao, mundo);
  /** Os objetos desenhados na sala atual, pra sair quando ela troca. */
  let objetos: Pixi.Container[] = [];

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

  return {
    async desenharSala(planta, tema, figuras) {
      const esta = ++vez;
      chao.removeChildren().forEach((filho) => filho.destroy());
      for (const objeto of objetos) objeto.destroy();
      objetos = [];

      const ladrilhos = new pixi.Graphics();
      planta.solid.forEach((linha, row) => {
        linha.forEach((solido, col) => {
          const px = col * LADO;
          const py = row * LADO;
          const borda = col === 0 || row === 0 || col === ROOM_COLS - 1 || row === ROOM_ROWS - 1;
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
        const px = objeto.col * LADO;
        const py = objeto.row * LADO;
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
      chao.addChild(rachaduras);

      const desenhos = await Promise.all(
        planta.objects.map(async (objeto) => {
          const figura = figuras[objeto.id];
          if (!figura || figura.forma === 'rachadura') return null;
          const desenho = await figuraEm(pixi, figura, LADO * (figura.escala ?? 1));
          const pe = peNoQuadrado(objeto.col, objeto.row);
          desenho.position.set(pe.x, pe.y);
          desenho.zIndex = pe.y;
          if (figura.apagada) desenho.alpha = 0.45;
          return desenho;
        }),
      );
      if (esta !== vez) {
        for (const desenho of desenhos) desenho?.destroy();
        return;
      }
      for (const desenho of desenhos) {
        if (!desenho) continue;
        mundo.addChild(desenho);
        objetos.push(desenho);
      }
    },

    colocarHeroi(walker, andando) {
      // O pé do boneco fica na borda de baixo da base que bate nas paredes.
      const x = walker.x * ESCALA;
      const y = (walker.y + HERO_HALF) * ESCALA;
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
