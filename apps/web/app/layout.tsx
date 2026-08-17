import type { Metadata } from 'next';
import { Cinzel, EB_Garamond, JetBrains_Mono } from 'next/font/google';

import './globals.css';

// As mesmas três famílias do jogo atual, mas auto-hospedadas pelo Next em vez
// de vindas do CDN do Google: o `<link>` do index.html custava um preconnect e
// um round-trip antes de qualquer texto aparecer.
//
// **Cada peso e estilo pedido aqui vira arquivo baixado antes do primeiro
// texto**, em toda rota, mesmo que só uma tela use. Medido: eram 149 KB de
// fonte no caminho crítico, e o maior arquivo de todos era o itálico do
// Garamond — usado num único `.placeholder` da criação de personagem, que o
// navegador desenha inclinado sozinho quando não há itálico de verdade.
//
// Os pesos abaixo são os que o CSS de fato seleciona. Antes havia Cinzel 900
// (nada pede 800+), Garamond itálico e JetBrains 600 (o único `font-weight:600`
// do projeto é o `.botao`, que não tem texto monoespaçado dentro).
const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['500', '700'],
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
      <body className={`${cinzel.variable} ${garamond.variable} ${jetbrains.variable}`}>
        {children}
      </body>
    </html>
  );
}
