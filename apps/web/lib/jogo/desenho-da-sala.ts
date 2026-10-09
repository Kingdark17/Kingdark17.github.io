/**
 * O desenho da sala com PixiJS: o chão e as paredes em quadradinhos, o
 * conteúdo da sala no centro e o herói andando (decisão do usuário,
 * 2026-10-09: PixiJS, e arte provisória até o Breno desenhar os tiles e o
 * boneco do mapa).
 *
 * O PixiJS chega **por parâmetro**, e não por `import`: quem chama
 * (`cena-da-sala.tsx`) o busca sob demanda, então a biblioteca só baixa
 * quando a exploração abre, e não pesa em nenhuma outra tela. Daqui só
 * saem tipos dele.
 *
 * A arte de agora é provisória e desenhada aqui mesmo: chão xadrez e
 * parede na cor de cada lugar, o ícone do minimapa no centro e o corpo da
 * raça do paperdoll como boneco. Quando a arte chegar, troca este arquivo;
 * a regra de andar (`sala-em-tiles.ts`) fica.
 */

import type * as Pixi from 'pixi.js';

import type { Direction } from '@rpg-legend/shared';

import { ALTURA_DA_SALA, LARGURA_DA_SALA, type PassoNaSala, type PlantaDaSala } from './sala-em-tiles';

/** Pixels de tela por quadradinho: 16 de arte × 3, a escala do pixel art do jogo. */
export const LADO = 48;
export const LARGURA_DA_CENA = LARGURA_DA_SALA * LADO;
export const ALTURA_DA_CENA = ALTURA_DA_SALA * LADO;

/** Quanto dura um passo. É também o ritmo de quem segura a tecla. */
export const DURACAO_DO_PASSO_MS = 140;

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
}

export interface Cena {
  desenharSala(planta: PlantaDaSala, tema: TemaDaSala, conteudo: Figura | null): Promise<void>;
  /** `animar: false` põe o herói no lugar na hora — chegada em sala nova, carregar o jogo. */
  colocarHeroi(passo: PassoNaSala, animar: boolean): void;
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

function centroDoPe(x: number, y: number): { x: number; y: number } {
  return { x: x * LADO + LADO / 2, y: y * LADO + LADO - 4 };
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
  const conteudo = new pixi.Container();
  const personagem = new pixi.Container();
  app.stage.addChild(chao, conteudo, personagem);

  const boneco = await figuraEm(pixi, heroi, LADO * 1.25);
  personagem.addChild(boneco);

  const semMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let destino = centroDoPe(4, 5);
  let caminhada: { de: { x: number; y: number }; inicio: number } | null = null;
  boneco.position.set(destino.x, destino.y);

  app.ticker.add(() => {
    if (!caminhada) return;
    const fracao = Math.min(1, (performance.now() - caminhada.inicio) / DURACAO_DO_PASSO_MS);
    boneco.x = caminhada.de.x + (destino.x - caminhada.de.x) * fracao;
    // Um pulinho no meio do passo: sem frame de caminhada ainda, é o que
    // diz "andou" em vez de "deslizou".
    boneco.y = caminhada.de.y + (destino.y - caminhada.de.y) * fracao - Math.sin(fracao * Math.PI) * 4;
    if (fracao >= 1) caminhada = null;
  });

  function olharPara(direcao: Direction) {
    // Provisório: o corpo do paperdoll só tem frente. Espelhar pro lado
    // que anda já diz pra onde ele vai; as quatro direções vêm do Breno.
    const lado = direcao === 'W' ? -1 : 1;
    boneco.scale.x = Math.abs(boneco.scale.x) * lado;
  }

  /**
   * Qual desenho é o da vez. A arte do conteúdo carrega com `await`, e
   * trocar de sala duas vezes rápido faria o desenho velho terminar depois
   * do novo e deixar o baú da sala anterior no meio desta.
   */
  let vez = 0;

  return {
    async desenharSala(planta, tema, figura) {
      const esta = ++vez;
      chao.removeChildren().forEach((filho) => filho.destroy());
      conteudo.removeChildren().forEach((filho) => filho.destroy());

      const ladrilhos = new pixi.Graphics();
      planta.ladrilhos.forEach((linha, y) => {
        linha.forEach((ladrilho, x) => {
          const px = x * LADO;
          const py = y * LADO;
          if (ladrilho === 'parede') {
            ladrilhos.rect(px, py, LADO, LADO).fill({ color: tema.parede });
            ladrilhos.rect(px + 2, py + 2, LADO - 4, LADO - 4).stroke({ width: 2, color: tema.bordaDaParede });
          } else {
            const xadrez = (x + y) % 2 === 0 ? tema.chao : tema.chaoAlternado;
            ladrilhos.rect(px, py, LADO, LADO).fill({ color: ladrilho === 'porta' ? tema.vao : xadrez });
          }
        });
      });
      chao.addChild(ladrilhos);

      if (planta.objeto && figura) {
        const objeto = await figuraEm(pixi, figura, LADO);
        if (esta !== vez) {
          objeto.destroy();
          return;
        }
        const pe = centroDoPe(planta.objeto.x, planta.objeto.y);
        objeto.position.set(pe.x, pe.y);
        conteudo.addChild(objeto);
      }
    },

    colocarHeroi(passo, animar) {
      const novo = centroDoPe(passo.x, passo.y);
      olharPara(passo.olhando);
      if (animar && !semMovimento && (novo.x !== destino.x || novo.y !== destino.y)) {
        caminhada = { de: { x: boneco.x, y: boneco.y }, inicio: performance.now() };
      } else {
        caminhada = null;
        boneco.position.set(novo.x, novo.y);
      }
      destino = novo;
    },

    destruir() {
      app.destroy({ removeView: true }, { children: true });
    },
  };
}
