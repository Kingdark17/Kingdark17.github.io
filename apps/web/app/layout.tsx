import type { Metadata } from 'next';
import { EB_Garamond, JetBrains_Mono } from 'next/font/google';
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

const garamond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-body',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-mono',
  display: 'swap',
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
      <body className={`${alkhemikal.variable} ${garamond.variable} ${jetbrains.variable}`}>
        {children}
      </body>
    </html>
  );
}
