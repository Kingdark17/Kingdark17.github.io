import type { Metadata } from 'next';
import { Pixelify_Sans } from 'next/font/google';
import localFont from 'next/font/local';

import './globals.css';

// Três famílias, auto-hospedadas pelo Next em vez de vindas do CDN do Google:
// o `<link>` do index.html custava um preconnect e um round-trip antes de
// qualquer texto aparecer.
//
// **Cada peso e estilo pedido aqui vira arquivo baixado antes do primeiro
// texto**, em toda rota, mesmo que só uma tela use. Medido: eram 149 KB de
// fonte no caminho crítico, e o maior arquivo de todos era o itálico do
// Garamond — usado num único `.placeholder` da criação de personagem, que o
// navegador desenha inclinado sozinho quando não há itálico de verdade.
//
// Os pesos abaixo são os que o CSS de fato seleciona. Já saíram daqui, por
// não terem quem os pedisse: Garamond itálico e JetBrains 600.
//
// **Desde 2026-10-09 as três são pixel**, pedido do doc do Breno ("todas as
// fontes em pixel"). O usuário escolheu na página de comparação, com textos
// do jogo: Pixelify Sans no texto e VT323 nos números e rótulos, no lugar
// da EB Garamond e da JetBrains Mono.
//
// A fonte de título foi Cinzel, depois Jacquard 12 (2026-08-22), e desde
// 2026-10-01 é a **Alkhemikal**, de jeti — escolhida pelo Breno entre três
// opções "legíveis": a Jacquard era a blackletter que ninguém lia. Das
// outras duas, a Alagard não tem nenhum acento e a Pixel Takhisis é paga
// pra uso comercial.
//
// **Licença CC BY 4.0: o crédito é obrigatório**, e está nas Configurações.
// Não tirar de lá sem pôr em outro lugar visível.
//
// Local, e não do Google: ela não está lá. O arquivo é WOFF 1 gerado da TTF
// original (cada tabela em zlib, conferida byte a byte na volta): 44,7 KB
// viraram 10,7 KB, uns 4 KB a mais que a Jacquard no caminho crítico.
//
// É pixel art com grade de 16 px por em: nítida em 16, 32 e 48 px, um pouco
// irregular nos tamanhos quebrados.
//
// E existe **num peso só (400)**. `<h1>`/`<h2>` nascem com `font-weight:
// bold` pela folha do navegador, e pedir um peso que a fonte não tem faz o
// navegador *fingir* o negrito, engrossando o traço na força bruta — num
// desenho pixelado isso empasta os vãos e some com a forma da letra. Por
// isso o `globals.css` fixa `font-weight: 400` em quem usa `--font-display`.
// Ao acrescentar título novo, herdar a regra em vez de pedir peso.
const alkhemikal = localFont({
  src: './fontes/alkhemikal.woff',
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

// Fonte variável: um arquivo só cobre o 400 e o 600 que o CSS pede. Sem
// grade fixa de pixel, então lê bem em qualquer tamanho — os ~138 `rem`
// espalhados pelos módulos continuam valendo como estão.
const pixelify = Pixelify_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

// Local, e não do Google, por um motivo só: `size-adjust`, que o
// `next/font/google` não aceita. A VT323 é miúda — no mesmo tamanho, a
// maiúscula dela tem 0,56 em contra 0,73 da JetBrains —, e o rótulo de
// 10 px do cartão viraria risco. Aumentada 60%, ela fica do tamanho que o
// usuário aprovou na comparação (20 px onde a JetBrains tinha 12) sem
// mexer em cada `font-size` dos módulos.
//
// Um peso só (400): nada que use `--font-mono` pode pedir negrito, pelo
// mesmo motivo da Alkhemikal. O arquivo é o recorte latino do Google
// Fonts (acentos do português conferidos); licença OFL em
// `fontes/VT323-OFL.txt`.
const vt323 = localFont({
  src: './fontes/vt323.woff2',
  weight: '400',
  variable: '--font-mono',
  display: 'swap',
  declarations: [{ prop: 'size-adjust', value: '160%' }],
});

export const metadata: Metadata = {
  title: 'RPG Legend',
  description: 'Jogo RPG/roguelike no navegador.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${alkhemikal.variable} ${pixelify.variable} ${vt323.variable}`}>
        {children}
      </body>
    </html>
  );
}
