import type { Metadata } from 'next';
import { Jacquard_12, EB_Garamond, JetBrains_Mono } from 'next/font/google';

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
// A fonte de título era Cinzel (pesos 500 e 700). Trocada pela Jacquard 12 em
// 2026-08-22, e a troca saiu **mais barata**: 89,1 KB → 70,5 KB no caminho
// crítico, porque uma família de um peso só substituiu uma de dois.

// Jacquard 12 é blackletter pixelada e existe **num peso só (400)**. Isso
// tem uma consequência que não aparece no CSS: `<h1>`/`<h2>` já nascem com
// `font-weight: bold` pela folha de estilo do navegador, então todo título
// pediria 700 de uma fonte que não tem. O navegador então *finge* o negrito
// engrossando o traço na força bruta — num desenho pixelado isso empasta os
// vãos e some com a forma da letra.
//
// Por isso o `globals.css` fixa `font-weight: 400` em quem usa
// `--font-display`. Ao acrescentar título novo, herdar a regra em vez de
// pedir peso.
const jacquard = Jacquard_12({
  subsets: ['latin'],
  weight: ['400'],
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
      <body className={`${jacquard.variable} ${garamond.variable} ${jetbrains.variable}`}>
        {children}
      </body>
    </html>
  );
}
